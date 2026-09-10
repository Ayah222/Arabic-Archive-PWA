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

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

// Deliberately separate from the generic uploads dir: HR files must never be
// reachable through the unauthenticated /sa/files/:filename route.
const hrUploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads-hr");

if (!fs.existsSync(hrUploadsDir)) {
  fs.mkdirSync(hrUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, hrUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

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
  storage,
  limits: { fileSize: 250 * 1024 * 1024 },
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
  res.json({
    url: `/api/sa/hr/files/${req.file.filename}`,
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
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
