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
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor || actor.role !== "admin") {
    return res.status(403).json({ error: "إدارة المستخدمين متاحة للمدير فقط" });
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
  const appOrigin = forwardedHost
    ? `${forwardedProto ?? "https"}://${forwardedHost}`
    : req.headers.origin;
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
  if (existingProfile) {
    const { data: existingMembership } = await admin
      .from("organization_memberships")
      .select("user_id,status,role,hr_access")
      .eq("tenant_id", actor.tenantId)
      .eq("user_id", existingProfile.id)
      .maybeSingle();
    if (existingMembership?.status === "active") {
      return res.status(409).json({ error: "هذا المستخدم عضو بالفعل في المؤسسة" });
    }
    if (!existingMembership) {
      const { error: membershipError } = await admin.from("organization_memberships").insert({
        tenant_id: actor.tenantId,
        user_id: existingProfile.id,
        role: normalizedRole,
        hr_access: false,
        status: "pending",
      });
      if (membershipError) return res.status(400).json({ error: membershipError.message });
    } else {
      const { error: membershipError } = await admin.from("organization_memberships")
        .update({ role: normalizedRole, hr_access: false, status: "pending" })
        .eq("tenant_id", actor.tenantId)
        .eq("user_id", existingProfile.id);
      if (membershipError) return res.status(400).json({ error: membershipError.message });
    }
    if (existingProfile.status === "pending") {
      const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetError) {
        if (existingMembership) {
          await admin.from("organization_memberships")
            .update({
              role: existingMembership.role,
              hr_access: existingMembership.hr_access,
              status: existingMembership.status,
            })
            .eq("tenant_id", actor.tenantId)
            .eq("user_id", existingProfile.id);
        } else {
          await admin.from("organization_memberships")
            .delete()
            .eq("tenant_id", actor.tenantId)
            .eq("user_id", existingProfile.id)
            .eq("status", "pending");
        }
        return res.status(400).json({ error: resetError.message });
      }
    }
    return res.json({ success: true, existingAccount: true });
  }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { role: normalizedRole },
  });

  if (inviteError) return res.status(400).json({ error: inviteError.message });
  if (!inviteData.user) return res.status(500).json({ error: "Supabase did not return the invited user" });

  const { error: profileError } = await admin.from("profiles").upsert({
    id: inviteData.user.id,
    email,
    role: normalizedRole,
    hr_access: false,
    status: "pending",
    is_active: false,
    invited_by: actor?.id ?? null,
  }, { onConflict: "id" });

  if (profileError) {
    await admin.auth.admin.deleteUser(inviteData.user.id);
    return res.status(500).json({ error: `Invite was created but its profile could not be saved: ${profileError.message}` });
  }
  const { error: membershipError } = await admin.from("organization_memberships").insert({
    tenant_id: actor?.tenantId,
    user_id: inviteData.user.id,
    role: normalizedRole,
    status: "pending",
  });
  if (membershipError) {
    await admin.auth.admin.deleteUser(inviteData.user.id);
    await admin.from("profiles").delete().eq("id", inviteData.user.id);
    return res.status(500).json({ error: `Invite was created but its organization membership could not be saved: ${membershipError.message}` });
  }

  return res.json({ success: true });
});

export default router;
