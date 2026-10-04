import { randomUUID } from "node:crypto";
import { Router } from "express";
import {
  ARCHIVE_SESSION_TTL_MS,
  createEmailArchiveSession,
  createHrSession,
  verifyEmailArchiveSession,
} from "../../lib/emailArchiveAuth";
import { listTenantMemberships, getTenantMembership } from "../../lib/tenantMemberships";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const router = Router();

function setSessionCookies(res: import("express").Response, actor: {
  id: string;
  name: string;
  role: "admin" | "data_entry" | "viewer";
  tenantId: string;
}, hrAccess = false) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: ARCHIVE_SESSION_TTL_MS,
  };
  res.cookie("sa_email_archive_session", createEmailArchiveSession(actor), { ...cookieOptions, path: "/" });
  if (actor.role === "admin" || hrAccess) {
    res.cookie("sa_hr_session", createHrSession({ id: actor.id, name: actor.name, tenantId: actor.tenantId }), {
      ...cookieOptions,
      path: "/api/sa/hr",
    });
  } else {
    res.clearCookie("sa_hr_session", { path: "/api/sa/hr" });
  }
}

router.get("/sa/tenants", async (req, res): Promise<void> => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor) {
    res.status(401).json({ error: "يلزم تسجيل الدخول" });
    return;
  }
  const memberships = await listTenantMemberships(actor.id);
  if (!memberships.length) {
    res.json([]);
    return;
  }
  const { data, error } = await supabaseAdmin()
    .from("organizations")
    .select("id,name,slug")
    .in("id", memberships.map((membership) => membership.tenantId))
    .order("name");
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json((data ?? []).map((tenant) => ({
    ...tenant,
    role: memberships.find((membership) => membership.tenantId === tenant.id)?.role,
    hrAccess: memberships.find((membership) => membership.tenantId === tenant.id)?.hrAccess ?? false,
    active: tenant.id === actor.tenantId,
  })));
});

router.post("/sa/tenants", async (req, res): Promise<void> => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor || actor.role !== "admin") {
    res.status(403).json({ error: "إنشاء المؤسسات متاح للمدير فقط" });
    return;
  }
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 120) {
    res.status(400).json({ error: "اسم المؤسسة مطلوب وبحد أقصى 120 حرفاً" });
    return;
  }
  const tenantId = randomUUID();
  const { data: tenant, error: tenantError } = await supabaseAdmin()
    .from("organizations")
    .insert({ id: tenantId, name, slug: `org-${tenantId.slice(0, 12)}` })
    .select("id,name,slug")
    .single();
  if (tenantError || !tenant) {
    res.status(500).json({ error: tenantError?.message ?? "تعذر إنشاء المؤسسة" });
    return;
  }
  const { error: membershipError } = await supabaseAdmin()
    .from("organization_memberships")
    .insert({ tenant_id: tenantId, user_id: actor.id, role: "admin", status: "active", hr_access: false });
  if (membershipError) {
    await supabaseAdmin().from("organizations").delete().eq("id", tenantId);
    res.status(500).json({ error: membershipError.message });
    return;
  }
  const nextActor = { ...actor, role: "admin" as const, tenantId };
  setSessionCookies(res, nextActor);
  res.status(201).json({ ...tenant, active: true, role: "admin" });
});

router.post("/sa/tenants/active", async (req, res): Promise<void> => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  const tenantId = typeof req.body?.tenantId === "string" ? req.body.tenantId : "";
  if (!actor || !tenantId) {
    res.status(400).json({ error: "معرّف المؤسسة مطلوب" });
    return;
  }
  const membership = await getTenantMembership(actor.id, tenantId);
  if (!membership) {
    res.status(403).json({ error: "لا تملك عضوية نشطة في المؤسسة المطلوبة" });
    return;
  }
  const nextActor = { ...actor, role: membership.role, tenantId: membership.tenantId };
  setSessionCookies(res, nextActor, membership.hrAccess);
  res.json({ tenantId: membership.tenantId, role: membership.role });
});

export default router;