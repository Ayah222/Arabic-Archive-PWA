import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { store } from "./store";

const router: IRouter = Router();

// GET all categories for a project
router.get("/sa/projects/:id/categories", async (req, res): Promise<void> => {
  const { id } = req.params;
  const cats = store.categories.filter((c) => c.projectId === id);
  res.json(cats);
});

// POST create a new category
router.post("/sa/projects/:id/categories", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const cat = {
    id: randomUUID(),
    projectId: id,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  store.categories.push(cat);
  res.status(201).json(cat);
});

// DELETE a category (also removes its attachments)
router.delete("/sa/projects/:id/categories/:cid", async (req, res): Promise<void> => {
  const { id, cid } = req.params;
  const idx = store.categories.findIndex((c) => c.id === cid && c.projectId === id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  store.categories.splice(idx, 1);
  // Remove all attachments belonging to this category
  const before = store.attachments.length;
  store.attachments = store.attachments.filter((a) => !(a.entityType === "custom_doc" && a.entityId === cid));
  res.json({ deleted: 1, attachmentsRemoved: before - store.attachments.length });
});

export default router;
