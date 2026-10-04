// HR file storage: national IDs, CVs, contracts, and government documents are
// too sensitive to sit behind the generic /sa/upload + /sa/files/:filename
// pair (which has no auth beyond forgeable role headers and serves files to
// anyone with the URL). These routes live under /sa/hr, so they inherit
// requireHrAccess's signed-cookie gate on both the upload and the download —
// a leaked/guessed URL alone is not enough to read an HR file.
import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { decodeSupabasePath, signedSupabaseUrl, SUPABASE_STORAGE_DISABLED_MESSAGE } from "../../../lib/supabaseStorage";
import { FILE_LIMITS } from "../../../lib/fileLimits";
import { currentTenantId } from "../../../lib/tenantContext";
import { downloadTenantFile, parseTenantDriveObjectPath, saveTenantFile } from "../../../lib/tenantDrive";

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

// Deliberately separate from the generic uploads dir: HR files must never be
// reachable through the unauthenticated /sa/files/:filename route.
const hrUploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads-hr");

if (!fs.existsSync(hrUploadsDir)) {
  fs.mkdirSync(hrUploadsDir, { recursive: true });
}

// HR uploads are limited to document/image types an employee record or CV
// would realistically need. This also blocks .html/.svg/.js uploads, which
// would otherwise be servable back as active content from this origin.
const SAFE_EXTENSIONS: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_LIMITS.maxFileBytes },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!(ext in SAFE_EXTENSIONS)) {
      cb(new Error("نوع الملف غير مدعوم"));
      return;
    }
    cb(null, true);
  },
});

const router: IRouter = Router();

router.post("/sa/hr/storage/upload-url", async (req, res): Promise<void> => {
  const { filename } = req.body as { filename?: string };
  if (!filename) {
    res.status(400).json({ error: "filename is required" });
    return;
  }
  res.status(503).json({ error: SUPABASE_STORAGE_DISABLED_MESSAGE });
});

router.get("/sa/hr/storage/file/:ref", async (req, res): Promise<void> => {
  res.redirect(await signedSupabaseUrl(decodeSupabasePath(req.params.ref)));
});

router.post("/sa/hr/upload", (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "تعذر رفع الملف" });
      return;
    }
    next();
  });
}, async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "لم يتم رفع ملف" });
    return;
  }
  const tenantId = currentTenantId();
  const uploadFile = req.file;
  void saveTenantFile({
    tenantId,
    filename: uploadFile.originalname,
    bytes: uploadFile.buffer,
    contentType: SAFE_EXTENSIONS[path.extname(uploadFile.originalname).toLowerCase()],
    folderSegments: ["hr"],
  }).then((saved) => {
    const fileId = parseTenantDriveObjectPath(saved.objectName);
    if (!fileId) throw new Error("Invalid Google Drive upload reference");
    res.json({
      url: `/api/sa/hr/storage/files/${encodeURIComponent(fileId)}`,
      filename: uploadFile.originalname,
      size: uploadFile.size,
      mimetype: SAFE_EXTENSIONS[path.extname(uploadFile.originalname).toLowerCase()],
    });
  }).catch((error: unknown) => {
    if (!res.headersSent) res.status(503).json({ error: error instanceof Error ? error.message : "تعذر حفظ الملف" });
  });
});

router.get("/sa/hr/storage/files/:fileId", async (req, res): Promise<void> => {
  try {
    const file = await downloadTenantFile(currentTenantId(), String(req.params.fileId));
    const extension = path.extname(file.filename).toLowerCase();
    const contentType = SAFE_EXTENSIONS[extension];
    if (!contentType) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(file.bytes);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

router.get("/sa/hr/files/:filename", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const filename = path.basename(raw);
  const ext = path.extname(filename).toLowerCase();
  const filePath = path.join(hrUploadsDir, filename);
  if (!fs.existsSync(filePath) || !(ext in SAFE_EXTENSIONS)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  // Serve with a content-type resolved from a whitelist (never the client's
  // claimed mimetype) and force download so a crafted file cannot execute as
  // active content (e.g. HTML/script) in the browser on this origin.
  res.setHeader("Content-Type", SAFE_EXTENSIONS[ext]);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(filePath);
});

export function resolveHrFilePath(filename: string): string {
  return path.join(hrUploadsDir, path.basename(filename));
}

export default router;
