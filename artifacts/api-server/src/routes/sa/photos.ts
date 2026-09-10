import { Router } from "express";
import multer from "multer";
import { deletePrivateObject, savePrivateObject, storageObjectUrl } from "../../lib/objectStorage";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

export interface SAPhoto {
  id: string;
  projectId: string;
  dataUrl: string;
  objectPath: string;
  name: string;
  description: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

function toPhoto(row: Record<string, unknown>): SAPhoto {
  const objectPath = row.object_path as string;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    dataUrl: storageObjectUrl(objectPath),
    objectPath,
    name: row.name as string,
    description: (row.description as string) ?? "",
    mimeType: (row.mime_type as string) ?? "application/octet-stream",
    size: Number(row.size ?? 0),
    uploadedAt: row.uploaded_at as string,
  };
}

router.get("/sa/projects/:id/photos", async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin()
    .from("project_photos")
    .select("*")
    .eq("project_id", req.params.id)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  res.json((data ?? []).map(toPhoto));
});

router.post("/sa/projects/:id/photos", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "يرجى اختيار صورة" });
    return;
  }

  const projectId = String(req.params.id);
  const saved = await savePrivateObject({
    namespace: "project-photos",
    filename: req.file.originalname,
    bytes: req.file.buffer,
    contentType: req.file.mimetype,
    segments: [projectId],
  });
  const { data, error } = await supabaseAdmin()
    .from("project_photos")
    .insert({
      project_id: projectId,
      object_path: saved.objectName,
      name: String(req.body.name || req.file.originalname),
      description: String(req.body.description || ""),
      mime_type: req.file.mimetype,
      size: req.file.size,
    })
    .select()
    .single();
  if (error) {
    await deletePrivateObject(saved.objectName);
    throw new Error(error.message);
  }
  res.status(201).json(toPhoto(data));
});

router.delete("/sa/projects/:id/photos/:pid", async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin()
    .from("project_photos")
    .delete()
    .eq("id", req.params.pid)
    .eq("project_id", req.params.id)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    res.status(404).json({ error: "not found" });
    return;
  }
  await deletePrivateObject(data.object_path);
  res.json({ ok: true });
});

export default router;