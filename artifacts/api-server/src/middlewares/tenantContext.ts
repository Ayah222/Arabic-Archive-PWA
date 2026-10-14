import type { NextFunction, Request, Response } from "express";
import { isSystemAdmin, verifyEmailArchiveSession, verifyHrSession } from "../lib/emailArchiveAuth";
import { runWithTenant } from "../lib/tenantContext";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const publicTenantRoutes = new Set([
  "/sa/auth/login",
  "/sa/auth/register",
  "/sa/auth/accept-invite",
  "/sa/auth/logout",
  "/sa/auth/session",
  "/sa/auth/supabase-email-archive-session",
  "/sa/auth/supabase-hr-session",
  "/sa/storage/config",
  "/sa/app-version",
]);

function isProfileBootstrap(req: Request) {
  return req.method === "GET" && /^\/sa\/profiles\/[^/]+$/.test(req.path);
}

export async function requireTenantContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.path.startsWith("/sa") || publicTenantRoutes.has(req.path) || isProfileBootstrap(req)) {
    next();
    return;
  }

  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  const hrActor = verifyHrSession(req.cookies?.sa_hr_session);
  const systemAdmin = isSystemAdmin(actor);
  const tenantId = actor?.tenantId ?? hrActor?.tenantId;
  const userId = actor?.id ?? hrActor?.id;
  if (!tenantId || !userId) {
    res.status(401).json({ error: "جلسة المؤسسة غير صالحة. يرجى تسجيل الدخول مجدداً." });
    return;
  }
  if (actor && hrActor && (actor.id !== hrActor.id || actor.tenantId !== hrActor.tenantId)) {
    res.status(401).json({ error: "جلسات وحدة الموارد البشرية والمؤسسة غير متطابقة" });
    return;
  }

  if (!systemAdmin) {
    const { data: membership, error } = await supabaseAdmin()
      .from("organization_memberships")
      .select("tenant_id,role,status")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !membership || membership.status !== "active") {
      res.status(403).json({ error: "لا تملك عضوية نشطة في هذه المؤسسة" });
      return;
    }
    if (actor && membership.role !== actor.role) {
      res.status(401).json({ error: "تغيرت صلاحيات حسابك. يرجى تسجيل الدخول مجدداً." });
      return;
    }
  }

  res.locals.tenantId = tenantId;
  runWithTenant(tenantId, next);
}