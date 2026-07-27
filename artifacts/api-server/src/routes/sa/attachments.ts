import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { store } from "./store";

const router: IRouter = Router();

// GET attachments for an entity within a project
// ?entityType=contract&entityId=xxx  OR  ?entityType=custom_doc (no entityId needed — uses projectId)
router.get("/sa/projects/:id/attachments", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };

  let results = store.attachments.filter((a) => a.projectId === id);
  if (entityType) results = results.filter((a) => a.entityType === entityType);
  if (entityId)   results = results.filter((a) => a.entityId  === entityId);

  res.json(results);
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

  const attachment = {
    id: randomUUID(),
    projectId: id,
    entityType: entityType as "contract" | "meeting" | "letter" | "custom_doc",
    entityId: entityId ?? id, // fallback to projectId for custom_doc
    dataUrl,
    name,
    customType: customType ?? "مستند",
    mimeType: mimeType ?? "application/octet-stream",
    size: size ?? 0,
    uploadedAt: new Date().toISOString(),
  };

  store.attachments.push(attachment);
  res.status(201).json(attachment);
});

// DELETE an attachment
router.delete("/sa/projects/:id/attachments/:aid", async (req, res): Promise<void> => {
  const { id, aid } = req.params;
  const idx = store.attachments.findIndex((a) => a.id === aid && a.projectId === id);
  if (idx === -1) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  store.attachments.splice(idx, 1);
  res.sendStatus(204);
});

export default router;
