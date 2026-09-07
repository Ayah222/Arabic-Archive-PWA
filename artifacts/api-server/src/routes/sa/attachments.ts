import { Router, type IRouter } from "express";
import multer from "multer";
import { basename, extname } from "node:path";
import { inflateRawSync } from "node:zlib";
import { deletePrivateObject, savePrivateObject } from "../../lib/objectStorage";
import { listAttachments, createAttachment, deleteAttachment } from "./archiveDb";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
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
    if (uncompressedSize > 20 * 1024 * 1024) throw new Error("أحد الملفات أكبر من 20MB");
    if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("بيانات ZIP غير صالحة");
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);
    const bytes = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: 20 * 1024 * 1024 });
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
  const { entityType, entityId, customType } = req.body as {
    entityType?: string; entityId?: string; customType?: string;
  };
  if (!entityType || !req.file || extname(req.file.originalname).toLowerCase() !== ".zip") {
    res.status(400).json({ error: "A ZIP folder and destination are required" });
    return;
  }

  const createdIds: string[] = [];
  try {
    const files = extractZipFiles(req.file.buffer);
    if (!files.length || files.length > 200) {
      res.status(400).json({ error: files.length ? "ZIP folders are limited to 200 files" : "The ZIP folder is empty" });
      return;
    }

    const results = [];
    let totalBytes = 0;
    for (const { relativePath, bytes } of files) {
      totalBytes += bytes.length;
      if (bytes.length > 20 * 1024 * 1024 || totalBytes > 200 * 1024 * 1024) {
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