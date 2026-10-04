import { Router, type IRouter } from "express";
import multer from "multer";
import {
  decodeStorageObjectRef,
  objectStorageClient,
  privateObjectLocation,
} from "../../lib/objectStorage";
import { FILE_LIMITS } from "../../lib/fileLimits";
import { DEFAULT_TENANT_ID } from "../../lib/tenantContext";
import { saveTenantFile } from "../../lib/tenantDrive";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_LIMITS.maxFileBytes },
});

const router: IRouter = Router();

router.post("/sa/upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "لم يتم رفع ملف" });
    return;
  }

  const projectId = String(req.body.projectId || "general");
  const section = String(req.body.section || "files");
  const saved = await saveTenantFile({
    tenantId: String(res.locals.tenantId),
    filename: req.file.originalname,
    bytes: req.file.buffer,
    contentType: req.file.mimetype,
    folderSegments: ["uploads", projectId, section],
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
    const tenantId = String(res.locals.tenantId);
    const isLegacyTenant = tenantId === DEFAULT_TENANT_ID;
    const isTenantPath = relativeName.startsWith(`tenants/${tenantId}/`);
    const isLegacyPath = isLegacyTenant && ["uploads/", "project-photos/", "attachments/"].some((prefix) => relativeName.startsWith(prefix));
    if (!isTenantPath && !isLegacyPath) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const scopedName = isTenantPath ? relativeName.slice(`tenants/${tenantId}/`.length) : relativeName;
    if (!["uploads/", "project-photos/", "attachments/"].some((prefix) => scopedName.startsWith(prefix))) {
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