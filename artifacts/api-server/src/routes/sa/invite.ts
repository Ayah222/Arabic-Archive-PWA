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

  const forwardedHost = Array.isArray(req.headers["x-forwarded-host"])
    ? req.headers["x-forwarded-host"][0]
    : req.headers["x-forwarded-host"];
  const forwardedProto = Array.isArray(req.headers["x-forwarded-proto"])
    ? req.headers["x-forwarded-proto"][0]
    : req.headers["x-forwarded-proto"];
  const replitOrigin = process.env["REPLIT_DEV_DOMAIN"]
    ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
    : undefined;
  const appOrigin = replitOrigin
    ?? (forwardedHost ? `${forwardedProto ?? "https"}://${forwardedHost}` : req.headers.origin);
  const redirectTo = appOrigin
    ? `${appOrigin}/accept-invite`
    : undefined;

  // Re-send a setup link for an existing account that is still awaiting approval.
  // Recovery links are handled by the same AcceptInvite page and avoid deleting
  // the existing auth/profile record.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id,status")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile?.status === "pending") {
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, resent: true });
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { role: role ?? "employee" },
  });

  if (error) return res.status(400).json({ error: error.message });

  res.json({ success: true });
});

export default router;
