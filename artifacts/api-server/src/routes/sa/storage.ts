import { Router, type IRouter } from "express";
import { decodeSupabasePath, encodeSupabasePath, signedSupabaseUrl, SUPABASE_STORAGE_DISABLED_MESSAGE } from "../../lib/supabaseStorage";
import { FILE_LIMITS, publicFileLimits } from "../../lib/fileLimits";

const router: IRouter = Router();

router.get("/sa/storage/config", (_req, res) => {
  res.json(publicFileLimits());
});

router.get("/sa/app-version", (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({
    version: process.env.REPLIT_DEPLOYMENT_ID || process.env.REPL_ID || "development",
  });
});

router.post("/sa/storage/upload-url", (_req, res): void => {
  res.status(503).json({ error: SUPABASE_STORAGE_DISABLED_MESSAGE });
});

router.post("/sa/storage/upload", (_req, res): void => {
  res.status(503).json({ error: SUPABASE_STORAGE_DISABLED_MESSAGE });
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