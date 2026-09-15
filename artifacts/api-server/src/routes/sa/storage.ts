import { Router, type IRouter } from "express";
import multer from "multer";
import { extname } from "node:path";
import { createSupabaseUploadTarget, decodeSupabasePath, encodeSupabasePath, signedSupabaseUrl, uploadSupabaseObject } from "../../lib/supabaseStorage";
import { FILE_LIMITS, publicFileLimits } from "../../lib/fileLimits";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_LIMITS.maxFileBytes },
});
const mimeByExtension: Record<string, string> = {
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

router.get("/sa/storage/config", (_req, res) => {
  res.json(publicFileLimits());
});

router.get("/sa/app-version", (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({
    version: process.env.REPLIT_DEPLOYMENT_ID || process.env.REPL_ID || "development",
  });
});

router.post("/sa/storage/upload-url", async (req, res): Promise<void> => {
  const { filename, namespace } = req.body as { filename?: string; namespace?: string };
  if (!filename || !namespace) {
    res.status(400).json({ error: "filename and namespace are required" });
    return;
  }
  const target = await createSupabaseUploadTarget({ filename, namespace });
  res.json({ ...target, fileUrl: `/api/sa/storage/file/${encodeSupabasePath(target.path)}` });
});

router.post("/sa/storage/upload", upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;
  const { namespace } = req.body as { namespace?: string };
  if (!file || !namespace) {
    res.status(400).json({ error: "file and namespace are required" });
    return;
  }
  const target = await createSupabaseUploadTarget({ filename: file.originalname, namespace });
  await uploadSupabaseObject({
    storagePath: target.path,
    bytes: file.buffer,
    contentType: mimeByExtension[extname(file.originalname).toLowerCase()] || file.mimetype || "application/octet-stream",
  });
  res.json({ ...target, fileUrl: `/api/sa/storage/file/${encodeSupabasePath(target.path)}` });
});

router.get("/sa/storage/file/:ref", async (req, res): Promise<void> => {
  const path = decodeSupabasePath(req.params.ref);
  res.redirect(await signedSupabaseUrl(path));
});

router.post("/sa/storage/download-url", async (req, res): Promise<void> => {
  const { path } = req.body as { path?: string };
  if (!path) {
    res.status(400).json({ error: "path is required" });
    return;
  }
  res.json({ url: await signedSupabaseUrl(path) });
});

export default router;