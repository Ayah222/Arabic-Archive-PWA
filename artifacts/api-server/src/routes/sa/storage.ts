import { Router, type IRouter } from "express";
import { createSupabaseUploadTarget, decodeSupabasePath, encodeSupabasePath, signedSupabaseUrl } from "../../lib/supabaseStorage";
import { publicFileLimits } from "../../lib/fileLimits";

const router: IRouter = Router();

router.get("/sa/storage/config", (_req, res) => {
  res.json(publicFileLimits());
});

router.post("/sa/storage/upload-url", async (req, res): Promise<void> => {
  const { filename, namespace } = req.body as { filename?: string; namespace?: string };
  if (!filename || !namespace) {
    res.status(400).json({ error: "filename and namespace are required" });
    return;
  }
  const target = await createSupabaseUploadTarget({ filename, namespace });
  res.json({ ...target, fileUrl: `/api/sa/storage/file/${encodeSupabasePath(target.path)}` });
});

router.get("/sa/storage/file/:ref", async (req, res): Promise<void> => {
  const path = decodeSupabasePath(req.params.ref);
  res.redirect(await signedSupabaseUrl(path));
});

router.post("/sa/storage/download-url", async (req, res): Promise<void> => {
  const { path } = req.body as { path?: string };
  if (!path) {
    res.status(400).json({ error: "path is required" });
    return;
  }
  res.json({ url: await signedSupabaseUrl(path) });
});

export default router;