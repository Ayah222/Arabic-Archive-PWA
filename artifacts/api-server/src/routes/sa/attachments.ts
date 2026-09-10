import { Router, type IRouter } from "express";
import multer from "multer";
import { basename, extname } from "node:path";
import { inflateRawSync } from "node:zlib";
import { deletePrivateObject, savePrivateObject } from "../../lib/objectStorage";
import { listAttachments, createAttachment, deleteAttachment, deleteAttachmentFolder } from "./archiveDb";

const router: IRouter = Router();
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_FOLDER_FILES = 2000;
const MAX_FOLDER_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const mimeByExtension: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".zip": "application/zip",
};

function safeArchivePath(value: string) {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!normalized || normalized.startsWith("/") || parts.some((part) => part === "." || part === "..")) return null;
  return parts.slice(0, 21).join("/");
}

function unicodeZipName(rawName: Buffer, extra: Buffer, utf8: boolean) {
  for (let offset = 0; offset + 4 <= extra.length;) {
    const id = extra.readUInt16LE(offset);
    const size = extra.readUInt16LE(offset + 2);
    const value = extra.subarray(offset + 4, offset + 4 + size);
    if (id === 0x7075 && value.length > 5 && value[0] === 1) return value.subarray(5).toString("utf8");
    offset += 4 + size;
  }
  return rawName.toString(utf8 ? "utf8" : "latin1");
}

function extractZipFiles(zip: Buffer) {
  let eocd = -1;
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65_557); offset--) {
    if (zip.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("ملف ZIP غير صالح");
  const entryCount = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const files: { relativePath: string; bytes: Buffer }[] = [];
  for (let index = 0; index < entryCount; index++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("فهرس ZIP غير صالح");
    const flags = zip.readUInt16LE(offset + 8);
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const rawName = zip.subarray(offset + 46, offset + 46 + nameLength);
    const extra = zip.subarray(offset + 46 + nameLength, offset + 46 + nameLength + extraLength);
    const decodedName = unicodeZipName(rawName, extra, Boolean(flags & 0x800));
    offset += 46 + nameLength + extraLength + commentLength;
    if (decodedName.replace(/\\/g, "/").endsWith("/") || decodedName.includes("__MACOSX")) continue;
    const relativePath = safeArchivePath(decodedName);
    if (!relativePath) throw new Error("يحتوي ZIP على مسار غير آمن");
    if (flags & 1) throw new Error("ملفات ZIP المشفرة بكلمة مرور غير مدعومة");
    if (method !== 0 && method !== 8) throw new Error("نوع ضغط ZIP غير مدعوم");
    if (uncompressedSize > MAX_UPLOAD_BYTES) throw new Error("أحد الملفات أكبر من 100MB");
    if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("بيانات ZIP غير صالحة");
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);
    const bytes = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: MAX_UPLOAD_BYTES });
    if (bytes.length !== uncompressedSize) throw new Error("حجم ملف ZIP غير متطابق");
    files.push({ relativePath, bytes });
  }
  return files;
}

router.get("/sa/projects/:id/attachments", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };
  res.json(await listAttachments(String(id), { entityType, entityId }));
});

router.post("/sa/projects/:id/attachments", upload.single("file"), async (req, res): Promise<void> => {
  const { id } = req.params;
  const projectId = String(id);
  const { entityType, entityId, name, customType, relativePath } = req.body as {
    entityType?: string; entityId?: string; name?: string; customType?: string; relativePath?: string;
  };
  if (!entityType || !req.file) {
    res.status(400).json({ error: "entityType and file are required" });
    return;
  }

  const relativeParts = String(relativePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .slice(0, -1)
    .filter((part) => part && part !== "." && part !== "..")
    .slice(0, 20);
  const saved = await savePrivateObject({
    namespace: "attachments",
    filename: req.file.originalname,
    bytes: req.file.buffer,
    contentType: req.file.mimetype,
    segments: [projectId, entityType, ...relativeParts],
  });
  try {
    const attachment = await createAttachment(projectId, {
      entityType,
      entityId,
      objectPath: saved.objectName,
      name: name || relativePath || req.file.originalname,
      customType,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
    res.status(201).json(attachment);
  } catch (error) {
    await deletePrivateObject(saved.objectName);
    throw error;
  }
});

router.post("/sa/projects/:id/attachments/folder-zip", upload.single("file"), async (req, res): Promise<void> => {
  const projectId = String(req.params.id);
  const { entityType, entityId, customType, targetPath } = req.body as {
    entityType?: string; entityId?: string; customType?: string; targetPath?: string;
  };
  if (!entityType || !req.file || extname(req.file.originalname).toLowerCase() !== ".zip") {
    res.status(400).json({ error: "A ZIP folder and destination are required" });
    return;
  }

  const createdIds: string[] = [];
  try {
    const files = extractZipFiles(req.file.buffer);
    if (!files.length || files.length > MAX_FOLDER_FILES) {
      res.status(400).json({ error: files.length ? `ZIP folders are limited to ${MAX_FOLDER_FILES} files` : "The ZIP folder is empty" });
      return;
    }

    const results = [];
    let totalBytes = 0;
    const safeTargetPath = targetPath ? safeArchivePath(`${targetPath}/placeholder`)?.split("/").slice(0, -1).join("/") : "";
    if (targetPath && !safeTargetPath) throw new Error("مسار الحفظ غير آمن");
    for (const file of files) {
      const relativePath = [safeTargetPath, file.relativePath].filter(Boolean).join("/");
      const { bytes } = file;
      totalBytes += bytes.length;
      if (bytes.length > MAX_UPLOAD_BYTES || totalBytes > MAX_FOLDER_TOTAL_BYTES) {
        throw new Error("Extracted folder exceeds the allowed size");
      }
      const relativeParts = relativePath.split("/").slice(0, -1);
      const filename = basename(relativePath);
      const mimeType = mimeByExtension[extname(filename).toLowerCase()] || "application/octet-stream";
      const saved = await savePrivateObject({
        namespace: "attachments",
        filename,
        bytes,
        contentType: mimeType,
        segments: [projectId, entityType, ...relativeParts],
      });
      try {
        const attachment = await createAttachment(projectId, {
          entityType,
          entityId,
          objectPath: saved.objectName,
          name: relativePath,
          customType: customType || "مجلد مستندات",
          mimeType,
          size: bytes.length,
        });
        createdIds.push(attachment.id);
        results.push(attachment);
      } catch (error) {
        await deletePrivateObject(saved.objectName);
        throw error;
      }
    }
    res.status(201).json(results);
  } catch (error) {
    for (const id of createdIds) await deleteAttachment(projectId, id).catch(() => undefined);
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not extract ZIP folder" });
  }
});

router.delete("/sa/projects/:id/attachments/folder", async (req, res): Promise<void> => {
  const { entityType, entityId, folderPath } = req.query as {
    entityType?: string; entityId?: string; folderPath?: string;
  };
  if (!entityType || !entityId || !folderPath?.trim()) {
    res.status(400).json({ error: "entityType, entityId and folderPath are required" });
    return;
  }
  const deleted = await deleteAttachmentFolder(String(req.params.id), {
    entityType,
    entityId,
    folderPath: folderPath.replace(/\\/g, "/"),
  });
  res.json({ deleted });
});

router.delete("/sa/projects/:id/attachments/:aid", async (req, res): Promise<void> => {
  const { id, aid } = req.params;
  const deleted = await deleteAttachment(id, aid);
  if (!deleted) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;