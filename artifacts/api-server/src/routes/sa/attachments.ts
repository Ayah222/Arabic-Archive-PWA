import { Router, type IRouter } from "express";
import multer from "multer";
import { deletePrivateObject, savePrivateObject } from "../../lib/objectStorage";
import { listAttachments, createAttachment, deleteAttachment } from "./archiveDb";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

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