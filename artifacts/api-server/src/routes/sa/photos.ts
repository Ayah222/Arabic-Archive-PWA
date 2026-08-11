import { Router } from "express";
import { store } from "./store";
import { randomUUID } from "crypto";

const router = Router();

export interface SAPhoto {
  id: string;
  projectId: string;
  dataUrl: string;        // base64 data URL
  name: string;
  description: string;
  uploadedAt: string;
}

// ensure store has photos array
(store as any).photos = (store as any).photos ?? [];
const photos = (): SAPhoto[] => (store as any).photos;

// GET /sa/projects/:id/photos
router.get("/sa/projects/:id/photos", (req, res) => {
  const list = photos().filter(p => p.projectId === req.params.id);
  res.json(list);
});

// POST /sa/projects/:id/photos   body: { dataUrl, name, description }
router.post("/sa/projects/:id/photos", (req, res) => {
  const { dataUrl, name, description = "" } = req.body;
  if (!dataUrl || !name) return res.status(400).json({ error: "dataUrl and name required" });
  const photo: SAPhoto = {
    id: randomUUID(),
    projectId: req.params.id,
    dataUrl,
    name,
    description,
    uploadedAt: new Date().toISOString(),
  };
  photos().push(photo);
  res.status(201).json(photo);
});

// DELETE /sa/projects/:id/photos/:pid
router.delete("/sa/projects/:id/photos/:pid", (req, res) => {
  const arr = photos();
  const idx = arr.findIndex(p => p.id === req.params.pid && p.projectId === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  arr.splice(idx, 1);
  res.json({ ok: true });
});

export default router;
