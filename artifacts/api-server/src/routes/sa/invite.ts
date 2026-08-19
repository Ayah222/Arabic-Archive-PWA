import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

router.post("/sa/invite", async (req, res) => {
  const { email, role } = req.body as { email: string; role: string };

  if (!email) return res.status(400).json({ error: "email required" });

  const supabaseUrl = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const redirectTo = req.headers.origin
    ? `${req.headers.origin}/accept-invite`
    : undefined;

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { role: role ?? "employee" },
  });

  if (error) return res.status(400).json({ error: error.message });

  res.json({ success: true });
});

export default router;
