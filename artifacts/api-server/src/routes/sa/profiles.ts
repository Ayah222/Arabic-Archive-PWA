import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { store } from "./store";

const router = Router();

function adminClient() {
  const url = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// GET /api/sa/profiles  — all profiles
router.get("/sa/profiles", async (_req, res) => {
  await adminClient().from("profiles").update({ role: "admin" }).eq("role", "super_admin");
  await adminClient().from("profiles").update({ role: "data_entry" }).eq("role", "employee");

  const { data, error } = await adminClient()
    .from("profiles")
    .select("*")
    .order("email");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Fallback profile lookup used after a Supabase employee login.
router.get("/sa/profiles/:id", async (req, res) => {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("id,email,role,status")
    .eq("id", req.params.id)
    .single();
  if (error || !data) return res.status(404).json({ error: "Profile not found" });
  res.json(
    data.role === "super_admin"
      ? { ...data, role: "admin" }
      : data.role === "employee"
        ? { ...data, role: "data_entry" }
        : data,
  );
});

// PATCH /api/sa/profiles/:id  — update role and/or status
router.patch("/sa/profiles/:id", async (req, res) => {
  const { id } = req.params;
  const { role, status } = req.body as { role?: string; status?: string };
  const normalizedRole = role === "employee" ? "data_entry" : role;
  if (normalizedRole && !["admin", "data_entry", "viewer"].includes(normalizedRole)) {
    return res.status(400).json({ error: "role must be admin, data_entry, or viewer" });
  }
  const updates: Record<string, string> = {};
  if (normalizedRole) updates.role = normalizedRole;
  if (status) updates.status = status;

  const { data, error } = await adminClient()
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  if (status === "active") {
    store.notifications = store.notifications.filter(
      (notification) => !notification.message.includes(`[pending-user:${id}]`),
    );
  }
  res.json(data);
});

// Reject a pending invitation and completely remove the auth account/profile.
router.delete("/sa/profiles/:id", async (req, res) => {
  const { id } = req.params;
  const admin = adminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,status")
    .eq("id", id)
    .single();

  if (profileError || !profile) return res.status(404).json({ error: "Profile not found" });
  if (profile.status !== "pending") {
    return res.status(409).json({ error: "Only pending invitations can be rejected" });
  }

  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) return res.status(400).json({ error: authError.message });

  await admin.from("profiles").delete().eq("id", id);
  store.notifications = store.notifications.filter(
    (notification) => !notification.message.includes(`[pending-user:${id}]`),
  );
  res.json({ id });
});

export default router;
