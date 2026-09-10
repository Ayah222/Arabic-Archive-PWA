import { Router } from "express";
import multer from "multer";
import { deletePrivateObject, savePrivateObject, storageObjectUrl } from "../../lib/objectStorage";
import { createSupabaseUploadTarget, deleteSupabaseObject, parseSupabaseObjectPath, signedSupabaseUrl, supabaseObjectPath } from "../../lib/supabaseStorage";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
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

async function toPhoto(row: Record<string, unknown>): Promise<SAPhoto> {
  const objectPath = row.object_path as string;
  const supabasePath = parseSupabaseObjectPath(objectPath);
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    dataUrl: supabasePath ? await signedSupabaseUrl(supabasePath) : storageObjectUrl(objectPath),
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
  res.json(await Promise.all((data ?? []).map(toPhoto)));
});

router.post("/sa/projects/:id/photos", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file && req.body.storagePath) {
    if (Number(req.body.size || 0) > 500 * 1024 * 1024) {
      res.status(400).json({ error: "حجم الصورة يتجاوز 500MB" });
      return;
    }
    const { data, error } = await supabaseAdmin()
      .from("project_photos")
      .insert({
        project_id: req.params.id,
        object_path: supabaseObjectPath(String(req.body.storagePath)),
        name: String(req.body.name || req.body.filename || "صورة"),
        description: String(req.body.description || ""),
        mime_type: String(req.body.mimeType || "application/octet-stream"),
        size: Number(req.body.size || 0),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    res.status(201).json(await toPhoto(data));
    return;
  }
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
  res.status(201).json(await toPhoto(data));
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
  const supabasePath = parseSupabaseObjectPath(data.object_path);
  if (supabasePath) await deleteSupabaseObject(supabasePath);
  else await deletePrivateObject(data.object_path);
  res.json({ ok: true });
});

export default router;