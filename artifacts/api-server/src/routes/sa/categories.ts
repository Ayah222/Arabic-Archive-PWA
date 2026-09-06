import { Router, type IRouter } from "express";
import { listCategories, createCategory, deleteCategory, deleteAttachmentsByCategory } from "./archiveDb";

const router: IRouter = Router();

// GET all categories for a project
router.get("/sa/projects/:id/categories", async (req, res): Promise<void> => {
  const { id } = req.params;
  res.json(await listCategories(id));
});

// POST create a new category
router.post("/sa/projects/:id/categories", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const cat = await createCategory(id, name.trim());
  res.status(201).json(cat);
});

// DELETE a category (also removes its attachments)
router.delete("/sa/projects/:id/categories/:cid", async (req, res): Promise<void> => {
  const { id, cid } = req.params;
  const categories = await listCategories(id);
  if (!categories.some((category) => category.id === cid)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const attachmentsRemoved = await deleteAttachmentsByCategory(id, cid);
  const deleted = await deleteCategory(id, cid);
  if (!deleted) {
    res.status(409).json({ error: "Category could not be deleted" });
    return;
  }
  res.json({ deleted: 1, attachmentsRemoved });
});

export default router;
