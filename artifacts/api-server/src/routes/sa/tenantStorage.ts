import { Router } from "express";
import multer from "multer";
import {
  downloadTenantFile,
  getTenantDriveStatus,
} from "../../lib/tenantDrive";
import { FILE_LIMITS } from "../../lib/fileLimits";
import { saveTenantFile } from "../../lib/tenantDrive";
import { verifyEmailArchiveSession } from "../../lib/emailArchiveAuth";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: "utf8",
  limits: { fileSize: FILE_LIMITS.maxFileBytes },
});

router.get("/sa/tenants/storage", async (req, res): Promise<void> => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor) {
    res.status(401).json({ error: "يلزم تسجيل الدخول" });
    return;
  }
  res.json(await getTenantDriveStatus(actor.tenantId));
});

router.post("/sa/tenants/storage/upload", upload.single("file"), async (req, res): Promise<void> => {
  const namespace = typeof req.body.namespace === "string" ? req.body.namespace : "";
  const segments = namespace.split("/");
  const [category, folder] = segments;
  const safeSegment = /^[\p{L}\p{M}\p{N}_-]{1,120}$/u;
  const folderSegments = category === "agencies" && segments.length === 1
    ? ["agencies"]
    : category === "agencies" && segments.length === 2 && folder && safeSegment.test(folder)
      ? [category, folder]
      : null;
  if (!req.file || !folderSegments) {
    res.status(400).json({ error: "يرجى اختيار ملف صالح" });
    return;
  }
  const saved = await saveTenantFile({
    tenantId: String(res.locals.tenantId),
    filename: req.file.originalname,
    bytes: req.file.buffer,
    contentType: req.file.mimetype,
    folderSegments,
  });
  res.status(201).json({ path: saved.objectName });
});

router.get("/sa/storage/files/:fileId", async (req, res): Promise<void> => {
  try {
    const file = await downloadTenantFile(String(res.locals.tenantId), String(req.params.fileId));
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(file.bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تنزيل الملف";
    const status = message.includes("not connected")
      ? 503
      : message.includes("not found") || message.includes("different organization")
        ? 404
        : 400;
    res.status(status).json({ error: message });
  }
});

export default router;