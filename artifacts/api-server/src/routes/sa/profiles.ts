import { Router, type Request } from "express";
import { createClient } from "@supabase/supabase-js";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { deleteNotificationsContaining } from "./notificationDb";
import { verifyEmailArchiveSession } from "../../lib/emailArchiveAuth";
import { getTenantMembership } from "../../lib/tenantMemberships";

const router = Router();
const gmail = new ReplitConnectors();

function adminClient() {
  const url = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function appOrigin(req: Request): string {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  if (origin) return origin.replace(/\/$/, "");
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  return host ? `${proto ?? "https"}://${host}` : "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char] ?? char);
}

async function sendActivationEmail(email: string, name: string, loginUrl: string): Promise<void> {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(loginUrl);
  const subject = "تم تفعيل حسابك في نظام الأرشيف الداخلي";
  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033">
      <p>مرحباً ${safeName}،</p>
      <p>تمت الموافقة على حسابك وتفعيله بنجاح في نظام الأرشيف الداخلي.</p>
      <p><a href="${safeUrl}" style="display:inline-block;padding:12px 22px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">الدخول إلى النظام</a></p>
      <p style="color:#667085;font-size:13px">يمكنك تسجيل الدخول باستخدام بريدك الإلكتروني وكلمة المرور التي قمت بتعيينها.</p>
    </div>`;
  const rawMessage = [
    `To: ${email}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");
  const raw = Buffer.from(rawMessage).toString("base64url");
  const response = await gmail.proxy("google-mail", "/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { raw },
  });
  if (!response.ok) {
    throw new Error(`Activation email failed (${response.status}): ${await response.text()}`);
  }
}

// GET /api/sa/profiles  — all profiles
router.get("/sa/profiles", async (req, res) => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor || actor.role !== "admin") return res.status(403).json({ error: "إدارة المستخدمين متاحة للمدير فقط" });
  const { data: memberships, error: membershipError } = await adminClient()
    .from("organization_memberships")
    .select("user_id,role,status,hr_access")
    .eq("tenant_id", actor.tenantId);
  if (membershipError) return res.status(500).json({ error: membershipError.message });
  const activeMemberships = memberships ?? [];
  if (!activeMemberships.length) return res.json([]);
  const { data, error } = await adminClient()
    .from("profiles")
    .select("*")
    .in("id", activeMemberships.map((membership) => membership.user_id))
    .order("email");
  if (error) return res.status(400).json({ error: error.message });
  return res.json(data.map((profile) => ({
    ...profile,
    role: activeMemberships.find((membership) => membership.user_id === profile.id)?.role ?? profile.role,
    status: profile.status === "pending"
      ? "pending"
      : activeMemberships.find((membership) => membership.user_id === profile.id)?.status ?? profile.status,
    hr_access: activeMemberships.find((membership) => membership.user_id === profile.id)?.hr_access ?? false,
  })));
});

// A profile is visible to its owner (verified Supabase bearer or signed session)
// and to administrators. The public anon key alone is never sufficient.
router.get("/sa/profiles/:id", async (req, res) => {
  const id = req.params.id;
  const archiveActor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (archiveActor?.role !== "admin" && archiveActor?.id !== id) {
    const authorization = req.get("authorization") ?? "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return res.status(401).json({ error: "Authentication required" });

    const admin = adminClient();
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authData.user) return res.status(401).json({ error: "Invalid Supabase session" });
    if (authData.user.id !== id) return res.status(403).json({ error: "Profile access denied" });
  }

  const { data, error } = await adminClient()
    .from("profiles")
    .select("id,email,name,role,status,hr_access")
    .eq("id", id)
    .single();
  if (error || !data) return res.status(404).json({ error: "Profile not found" });
  let membershipQuery = adminClient()
    .from("organization_memberships")
    .select("tenant_id,role,status,hr_access")
    .eq("user_id", id);
  if (archiveActor) membershipQuery = membershipQuery.eq("tenant_id", archiveActor.tenantId);
  const { data: membership } = await membershipQuery.order("tenant_id", { ascending: true }).limit(1).maybeSingle();
  if (!membership) return res.status(404).json({ error: "Profile not found" });
  return res.json(
    {
      ...data,
      role: membership.role,
      tenantId: membership.tenant_id,
      membershipStatus: membership.status,
      hr_access: membership.hr_access === true,
    },
  );
});

// PATCH /api/sa/profiles/:id  — update role and/or status
router.patch("/sa/profiles/:id", async (req, res) => {
  const { id } = req.params;
  const { role, status, hr_access } = req.body as { role?: string; status?: string; hr_access?: boolean };
  const normalizedRole = role === "employee" ? "data_entry" : role;
  if (normalizedRole && !["admin", "data_entry", "viewer"].includes(normalizedRole)) {
    return res.status(400).json({ error: "role must be admin, data_entry, or viewer" });
  }
  if (status && !["pending", "active"].includes(status)) {
    return res.status(400).json({ error: "status must be pending or active" });
  }
  const updates: Record<string, string | boolean> = {};
  if (!normalizedRole && !status && typeof hr_access !== "boolean") {
    return res.status(400).json({ error: "No profile changes supplied" });
  }

  const admin = adminClient();
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor || actor.role !== "admin") return res.status(403).json({ error: "إدارة المستخدمين متاحة للمدير فقط" });
  const membershipUpdates: Record<string, string | boolean> = {};
  if (normalizedRole) membershipUpdates.role = normalizedRole;
  if (status) membershipUpdates.status = status === "active" ? "active" : "pending";
  if (typeof hr_access === "boolean") membershipUpdates.hr_access = hr_access;
  if (Object.keys(membershipUpdates).length) {
    const { data: member, error: memberError } = await admin
      .from("organization_memberships")
      .update(membershipUpdates)
      .eq("tenant_id", actor.tenantId)
      .eq("user_id", id)
      .select("user_id")
      .maybeSingle();
    if (memberError) return res.status(400).json({ error: memberError.message });
    if (!member) return res.status(404).json({ error: "User is not a member of this organization" });
  }
  if (status) updates.status = status;

  const { data: previousProfile } = await admin
    .from("profiles")
    .select("email,status")
    .eq("id", id)
    .maybeSingle();

  let data: Record<string, unknown> | null = null;
  if (Object.keys(updates).length) {
    const result = await admin.from("profiles").update(updates).eq("id", id).select().single();
    if (result.error) return res.status(400).json({ error: result.error.message });
    data = result.data as Record<string, unknown>;
  } else {
    const result = await admin.from("profiles").select("*").eq("id", id).single();
    if (result.error) return res.status(400).json({ error: result.error.message });
    data = result.data as Record<string, unknown>;
  }
  if (!data) return res.status(404).json({ error: "Profile not found" });
  let activationEmailSent: boolean | undefined;
  if (status === "active") {
    await deleteNotificationsContaining(`[pending-user:${id}]`);
    if (previousProfile?.status !== "active" && typeof data.email === "string") {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(id);
        const name = String(authUser.user?.user_metadata?.name ?? data.email.split("@")[0]);
        const origin = appOrigin(req);
        if (!origin) throw new Error("Application origin is unavailable");
        await sendActivationEmail(data.email, name, `${origin}/login`);
        activationEmailSent = true;
      } catch (emailError) {
        activationEmailSent = false;
        console.error("Unable to send activation email", emailError);
      }
    }
  }
  const currentMembership = await getTenantMembership(id, actor.tenantId);
  return res.json({
    ...data,
    role: normalizedRole ?? currentMembership?.role,
    hr_access: typeof hr_access === "boolean" ? hr_access : currentMembership?.hrAccess ?? false,
    activationEmailSent,
  });
});

// Reject this organization's pending membership; keep shared accounts that still
// belong to another tenant.
router.delete("/sa/profiles/:id", async (req, res) => {
  const { id } = req.params;
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor || actor.role !== "admin") return res.status(403).json({ error: "إدارة المستخدمين متاحة للمدير فقط" });
  const admin = adminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,status")
    .eq("id", id)
    .single();

  if (profileError || !profile) return res.status(404).json({ error: "Profile not found" });
  const { data: membership, error: membershipReadError } = await admin
    .from("organization_memberships")
    .select("status")
    .eq("tenant_id", actor.tenantId)
    .eq("user_id", id)
    .maybeSingle();
  if (membershipReadError) return res.status(400).json({ error: membershipReadError.message });
  if (!membership || membership.status !== "pending") {
    return res.status(409).json({ error: "Only a pending organization invitation can be rejected" });
  }

  const { error: membershipError } = await admin
    .from("organization_memberships")
    .delete()
    .eq("tenant_id", actor.tenantId)
    .eq("user_id", id);
  if (membershipError) return res.status(400).json({ error: membershipError.message });
  const { data: remainingMemberships, error: remainingError } = await admin
    .from("organization_memberships")
    .select("id")
    .eq("user_id", id)
    .limit(1);
  if (remainingError) return res.status(400).json({ error: remainingError.message });
  if (!remainingMemberships?.length && profile.status === "pending") {
    const { error: authError } = await admin.auth.admin.deleteUser(id);
    if (authError) return res.status(400).json({ error: authError.message });
    await admin.from("profiles").delete().eq("id", id);
  }
  await deleteNotificationsContaining(`[pending-user:${id}]`);
  return res.json({ id });
});

export default router;
