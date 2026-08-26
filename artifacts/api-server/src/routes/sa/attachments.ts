import { Router, type IRouter } from "express";
import { listAttachments, createAttachment, deleteAttachment } from "./archiveDb";

const router: IRouter = Router();

// GET attachments for an entity within a project
// ?entityType=contract&entityId=xxx  OR  ?entityType=custom_doc (no entityId needed — uses projectId)
router.get("/sa/projects/:id/attachments", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };
  res.json(await listAttachments(id, { entityType, entityId }));
});

// POST create an attachment
router.post("/sa/projects/:id/attachments", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { entityType, entityId, dataUrl, name, customType, mimeType, size } = req.body as {
    entityType?: string; entityId?: string;
    dataUrl?: string; name?: string; customType?: string;
    mimeType?: string; size?: number;
  };

  if (!entityType || !dataUrl || !name) {
    res.status(400).json({ error: "entityType, dataUrl and name are required" });
    return;
  }

  const attachment = await createAttachment(id, { entityType, entityId, dataUrl, name, customType, mimeType, size });
  res.status(201).json(attachment);
});

// DELETE an attachment
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
