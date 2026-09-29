import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { verifyEmailArchiveSession } from "../../lib/emailArchiveAuth";

const router = Router();

router.post("/sa/invite", async (req, res) => {
  const { email: rawEmail, role } = req.body as { email?: string; role?: string };
  const email = rawEmail?.trim().toLowerCase();
  const normalizedRole = role === "employee" ? "data_entry" : role ?? "data_entry";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  if (!["admin", "data_entry", "viewer"].includes(normalizedRole)) {
    return res.status(400).json({ error: "invalid role" });
  }

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
  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id,status")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) return res.status(500).json({ error: existingProfileError.message });
  if (existingProfile?.status === "pending") {
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, resent: true });
  }
  if (existingProfile) {
    return res.status(409).json({ error: "An account already exists for this email" });
  }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { role: normalizedRole },
  });

  if (inviteError) return res.status(400).json({ error: inviteError.message });
  if (!inviteData.user) return res.status(500).json({ error: "Supabase did not return the invited user" });

  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  const { error: profileError } = await admin.from("profiles").upsert({
    id: inviteData.user.id,
    email,
    role: normalizedRole,
    status: "pending",
    is_active: false,
    invited_by: actor?.id ?? null,
  }, { onConflict: "id" });

  if (profileError) {
    await admin.auth.admin.deleteUser(inviteData.user.id);
    return res.status(500).json({ error: `Invite was created but its profile could not be saved: ${profileError.message}` });
  }

  return res.json({ success: true });
});

export default router;
