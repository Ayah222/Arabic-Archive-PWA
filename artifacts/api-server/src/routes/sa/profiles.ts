import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

function adminClient() {
  const url = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// GET /api/sa/profiles  — all profiles
router.get("/sa/profiles", async (_req, res) => {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("*")
    .order("email");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// PATCH /api/sa/profiles/:id  — update role and/or status
router.patch("/sa/profiles/:id", async (req, res) => {
  const { id } = req.params;
  const { role, status } = req.body as { role?: string; status?: string };
  const updates: Record<string, string> = {};
  if (role)   updates.role   = role;
  if (status) updates.status = status;

  const { data, error } = await adminClient()
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
