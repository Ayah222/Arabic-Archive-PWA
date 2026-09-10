import { Router, type IRouter } from "express";
import multer from "multer";
import {
  decodeStorageObjectRef,
  objectStorageClient,
  privateObjectLocation,
  savePrivateObject,
} from "../../lib/objectStorage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router: IRouter = Router();

router.post("/sa/upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "لم يتم رفع ملف" });
    return;
  }

  const projectId = String(req.body.projectId || "general");
  const section = String(req.body.section || "files");
  const saved = await savePrivateObject({
    namespace: "uploads",
    filename: req.file.originalname,
    bytes: req.file.buffer,
    contentType: req.file.mimetype,
    segments: [projectId, section],
  });

  res.json({
    url: saved.url,
    objectPath: saved.objectName,
    filename: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

router.get("/sa/files/:objectRef", async (req, res): Promise<void> => {
  try {
    const objectName = decodeStorageObjectRef(req.params.objectRef);
    const { bucketName, objectName: privatePrefix } = privateObjectLocation();
    const allowedRoot = privatePrefix ? `${privatePrefix}/` : "";
    const relativeName = objectName.startsWith(allowedRoot) ? objectName.slice(allowedRoot.length) : "";
    if (!["uploads/", "project-photos/", "attachments/"].some((prefix) => relativeName.startsWith(prefix))) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const [metadata] = await file.getMetadata();
    const filename = String(metadata.metadata?.originalName || objectName.split("/").at(-1) || "file");
    res.setHeader("Content-Type", metadata.contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    file.createReadStream()
      .on("error", () => {
        if (!res.headersSent) res.status(500).json({ error: "تعذر قراءة الملف" });
        else res.end();
      })
      .pipe(res);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

export default router;