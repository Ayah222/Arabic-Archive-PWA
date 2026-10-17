// Prompt 7: Simple role-based user management + login
// Prompt 8: Self-service user registration
import { Router, type IRouter } from "express";
import { store } from "./store";
import { addAuditLog } from "./archiveDb";
import { createClient } from "@supabase/supabase-js";
import { createEmailArchiveSession, createHrSession, verifyEmailArchiveSession, ARCHIVE_SESSION_TTL_MS, type EmailArchiveActor, type HrActor } from "../../lib/emailArchiveAuth";
import { getDefaultTenantId, getTenantMembership } from "../../lib/tenantMemberships";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const router: IRouter = Router();

function setEmailArchiveCookie(res: import("express").Response, actor: EmailArchiveActor) {
  res.cookie("sa_email_archive_session", createEmailArchiveSession(actor), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ARCHIVE_SESSION_TTL_MS,
    // Scoped to all of /api/sa (not just /email-archive): enforcePermissions
    // also reads this cookie to verify real admin status for user/profile
    // management routes, so it must be sent on those requests too.
    path: "/",
  });
}

function setHrCookie(res: import("express").Response, actor: HrActor) {
  res.cookie("sa_hr_session", createHrSession(actor), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ARCHIVE_SESSION_TTL_MS,
    path: "/api/sa/hr",
  });
}

// POST login
router.post("/sa/auth/login", async (req, res): Promise<void> => {
  const { username, password, tenantId } = req.body as { username?: string; password?: string; tenantId?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }
  const user = store.users.find((u) => u.username === username && u.password === password);
  if (!user) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }
  let membership;
  try {
    membership = user.id === "admin"
      ? { tenantId: await getDefaultTenantId(), role: "admin" as const, status: "active" as const, hrAccess: true }
      : await getTenantMembership(user.id, tenantId);
  } catch {
    res.status(503).json({ error: "يجب تطبيق ترحيل تعدد المؤسسات قبل تسجيل الدخول" });
    return;
  }
  if (!membership) {
    res.status(403).json({ error: "لا توجد عضوية نشطة لهذا الحساب" });
    return;
  }
  const actor: EmailArchiveActor = { id: user.id, name: user.name, role: membership.role, tenantId: membership.tenantId };
  setEmailArchiveCookie(res, actor);
  if (membership.role === "admin" || membership.hrAccess) {
    setHrCookie(res, { id: user.id, name: user.name, tenantId: membership.tenantId });
  } else {
    res.clearCookie("sa_hr_session", { path: "/api/sa/hr" });
  }
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: membership.role,
    tenantId: membership.tenantId,
  });
});

// Used by the client to detect a revoked manager session after credentials
// are rotated or the server rejects an old signed cookie.
router.get("/sa/auth/session", (req, res): void => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor) {
    res.clearCookie("sa_email_archive_session", { path: "/" });
    res.clearCookie("sa_hr_session", { path: "/api/sa/hr" });
    res.status(401).json({ error: "session expired" });
    return;
  }
  res.json({ user: actor });
});

// Public self-registration bypasses the manager invitation/approval process.
router.post("/sa/auth/register", (_req, res): void => {
  res.status(410).json({ error: "Self-registration is disabled. Ask an administrator for an invitation." });
});

// Completes an email invitation only for the invited account's pending membership.
// Validate the invite session before allowing the user to change any password.
router.get("/sa/auth/accept-invite", async (req, res): Promise<void> => {
  const authorization = req.headers.authorization;
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!accessToken || !url || !serviceRoleKey) {
    res.status(401).json({ error: "رابط الدعوة غير صالح أو منتهي الصلاحية." });
    return;
  }

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user?.email) {
    res.status(401).json({ error: "تعذر التحقق من جلسة رابط الدعوة." });
    return;
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,email,status")
    .eq("id", authData.user.id)
    .maybeSingle();
  const emailMatches = profile?.email?.toLowerCase() === authData.user.email.toLowerCase();
  if (profileError || !profile || profile.status !== "pending" || !emailMatches) {
    req.log.warn({
      authUserId: authData.user.id,
      profileFound: Boolean(profile),
      profileStatus: profile?.status ?? null,
      profileEmailMatches: emailMatches,
      profileLookupFailed: Boolean(profileError),
    }, "Invite verification session does not match a pending profile");
    res.status(403).json({ error: "هذا الرابط لا يخص دعوة معلّقة. اطلب من المدير إصدار رابط تفعيل جديد." });
    return;
  }

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (membershipError || !membership) {
    res.status(403).json({ error: "لم يتم العثور على عضوية معلّقة لهذا الحساب. اطلب من المدير التحقق من الدعوة." });
    return;
  }

  res.json({ success: true });
});

router.post("/sa/auth/accept-invite", async (req, res): Promise<void> => {
  const authorization = req.headers.authorization;
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!accessToken || !url || !serviceRoleKey) {
    res.status(401).json({ error: "رابط الدعوة غير صالح أو منتهي الصلاحية." });
    return;
  }

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user?.email) {
    res.status(401).json({ error: "تعذر التحقق من حساب الدعوة." });
    return;
  }

  const userId = authData.user.id;
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,email,status")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile || profile.status !== "pending" ||
      profile.email?.toLowerCase() !== authData.user.email.toLowerCase()) {
    res.status(403).json({ error: "لا توجد دعوة معلقة لهذا الحساب." });
    return;
  }

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("tenant_id,status")
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (membershipError || !membership) {
    res.status(403).json({ error: "لا توجد عضوية مؤسسة معلقة لهذا الحساب." });
    return;
  }

  const { data: activatedMembership, error: activationError } = await admin
    .from("organization_memberships")
    .update({ status: "active" })
    .eq("tenant_id", membership.tenant_id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("user_id")
    .maybeSingle();
  if (activationError || !activatedMembership) {
    res.status(500).json({ error: "تعذر تفعيل عضوية المؤسسة." });
    return;
  }

  const { error: profileActivationError } = await admin
    .from("profiles")
    .update({ status: "active", is_active: true })
    .eq("id", userId)
    .eq("status", "pending");
  if (profileActivationError) {
    await admin.from("organization_memberships")
      .update({ status: "pending" })
      .eq("tenant_id", membership.tenant_id)
      .eq("user_id", userId)
      .eq("status", "active");
    res.status(500).json({ error: "تعذر تفعيل الحساب. حاولي فتح رابط الدعوة مرة أخرى." });
    return;
  }

  res.json({ success: true });
});

router.post("/sa/auth/logout", (_req, res): void => {
  res.clearCookie("sa_email_archive_session", { path: "/" });
  res.clearCookie("sa_hr_session", { path: "/api/sa/hr" });
  res.status(204).end();
});

// Exchanges a verified Supabase access token for an HttpOnly archive cookie.
// The email archive itself never trusts roles supplied by browser JavaScript.
router.post("/sa/auth/supabase-email-archive-session", async (req, res): Promise<void> => {
  const authorization = req.headers.authorization;
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!accessToken || !url || !serviceRoleKey) {
    res.status(401).json({ error: "تعذر التحقق من جلسة المستخدم" });
    return;
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    res.clearCookie("sa_email_archive_session", { path: "/" });
    res.status(401).json({ error: "جلسة المستخدم غير صالحة" });
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, name, role, status")
    .eq("id", authData.user.id)
    .single();
  const requestedTenantId = (req.body as { tenantId?: unknown })?.tenantId;
  const membership = !profileError && profile?.status === "active"
    ? await getTenantMembership(authData.user.id, typeof requestedTenantId === "string" ? requestedTenantId : undefined)
    : null;
  if (profileError || !profile || profile.status !== "active" || !membership) {
    res.clearCookie("sa_email_archive_session", { path: "/" });
    res.status(403).json({ error: "الحساب غير مفعل أو لا يملك صلاحية الأرشيف" });
    return;
  }

  setEmailArchiveCookie(res, {
    id: profile.id,
    name: profile.name?.trim() || profile.email?.split("@")[0] || "مستخدم",
    role: membership.role,
    tenantId: membership.tenantId,
  });
  res.status(204).end();
});

// Exchanges a verified Supabase access token for an HttpOnly HR session
// cookie. Only issued if the profile is active and either has the explicit
// `hr_access` grant or role "admin" — never trusts anything the browser sends.
router.post("/sa/auth/supabase-hr-session", async (req, res): Promise<void> => {
  const authorization = req.headers.authorization;
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  res.clearCookie("sa_hr_session", { path: "/api/sa/hr" });
  if (!accessToken || !url || !serviceRoleKey) {
    res.status(401).json({ error: "تعذر التحقق من جلسة المستخدم" });
    return;
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    res.status(401).json({ error: "جلسة المستخدم غير صالحة" });
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, name, role, status, hr_access")
    .eq("id", authData.user.id)
    .single();
  const archiveActor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  const membership = !profileError && profile?.status === "active"
    ? await getTenantMembership(authData.user.id, archiveActor?.tenantId)
    : null;
  const hasHrAccess = membership?.role === "admin" || membership?.hrAccess === true;
  if (profileError || !profile || profile.status !== "active" || !membership || !hasHrAccess) {
    res.status(403).json({ error: "ليست لديك صلاحية الوصول لوحدة الموارد البشرية" });
    return;
  }

  setHrCookie(res, { id: profile.id, name: profile.name?.trim() || profile.email?.split("@")[0] || "مستخدم", tenantId: membership.tenantId });
  res.status(204).end();
});

// GET all users (admin only — caller should validate role client-side)
router.get("/sa/users", async (_req, res): Promise<void> => {
  res.json(
    store.users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
    }))
  );
});

// PATCH update user role (admin only)
router.patch("/sa/users/:uid/role", async (req, res): Promise<void> => {
  const { uid } = req.params;
  const { role } = req.body as { role?: string };
  const validRoles = ["admin", "data_entry", "viewer"];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
    return;
  }
  const idx = store.users.findIndex((u) => u.id === uid);
  if (idx === -1) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  store.users[idx].role = role as "admin" | "data_entry" | "viewer";

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  addAuditLog(userId, userLabel, "update", "user", uid, `تغيير صلاحية ${store.users[idx].name} إلى: ${role}`);

  res.json({ id: store.users[idx].id, role: store.users[idx].role });
});

export default router;
