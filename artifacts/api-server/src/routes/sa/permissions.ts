import type { NextFunction, Request, Response } from "express";
import { addAuditLog } from "./archiveDb";
import { hasAdminAccess, verifyEmailArchiveSession } from "../../lib/emailArchiveAuth";
import { runWithTenant } from "../../lib/tenantContext";

function writeAuditLog(req: Request, tenantId: string, actorId: string, actorName: string, action: "create" | "update" | "delete", entity: string, entityId: string, description: string) {
  if (!tenantId) {
    req.log.error("Skipping audit log because tenant context is missing");
    return;
  }
  void runWithTenant(tenantId, () => addAuditLog(actorId, actorName, action, entity, entityId, description))
    .catch((error) => req.log.error({ err: error }, "Failed to write audit log"));
}

function entityForPath(path: string) {
  if (path.includes("/contracts")) return "عقد";
  if (path.includes("/contractors")) return "مقاول";
  if (path.includes("/documents")) return "مستند";
  if (path.includes("/meetings")) return "اجتماع";
  if (path.includes("/letters")) return "خطاب";
  if (path.includes("/contacts")) return "جهة اتصال";
  if (path.includes("/attachments")) return "مرفق";
  if (path.includes("/categories")) return "فئة";
  if (path.includes("/photos")) return "صورة";
  if (path.includes("/finance")) return "سجل مالي";
  if (path.includes("/profiles") || path.includes("/invite") || path.includes("/users")) return "مستخدم";
  if (path.includes("/upload")) return "ملف";
  return "مشروع";
}

function hasDetailedAudit(path: string) {
  return (
    path.includes("/letters") ||
    path.includes("/documents") ||
    path.includes("/contacts") ||
    path.startsWith("/sa/users/")
  );
}

export function enforcePermissions(req: Request, res: Response, next: NextFunction) {
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const isTenantSessionMutation =
    req.method === "POST" &&
    (req.path === "/sa/tenants" || req.path === "/sa/tenants/active");
  const isUserManagement = ["/sa/invite", "/sa/profiles", "/sa/users"].some(
    (basePath) => req.path === basePath || req.path.startsWith(`${basePath}/`),
  );
  const isSingleProfileLookup =
    req.method === "GET" && /^\/sa\/profiles\/[^/]+$/.test(req.path);

  // A single profile may be read only by that authenticated user or an admin;
  // profiles.ts verifies the matching Supabase bearer token or signed session.
  // All other user-management routes, including the profile list, are admin-only.
  if (isUserManagement && !isSingleProfileLookup) {
    const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
    if (!actor || !hasAdminAccess(actor)) {
      res.status(403).json({ error: "إدارة المستخدمين متاحة للمدير فقط" });
      return;
    }
    if (isMutating) {
      const tenantId = String(res.locals.tenantId ?? "");
      res.on("finish", () => {
        if (res.statusCode < 200 || res.statusCode >= 300 || hasDetailedAudit(req.path)) return;
        const action = req.method === "POST" ? "create" : req.method === "DELETE" ? "delete" : "update";
        const entity = entityForPath(req.path);
        const actionLabel = action === "create" ? "إضافة" : action === "update" ? "تعديل" : "حذف نهائي";
        const entityId = String(req.params.uid ?? req.params.id ?? "new");
        writeAuditLog(req, tenantId, actor.id, actor.name, action, entity, entityId, `${actionLabel} ${entity}`);
      });
    }
    next();
    return;
  }

  if (!isMutating) {
    next();
    return;
  }

  // Login and initial account creation happen before an app session exists.
  if (req.path.startsWith("/sa/auth/")) {
    next();
    return;
  }

  // Organization creation and switching are authorized by the tenant routes
  // themselves using the signed session cookie. Do not require the legacy
  // x-user-role header here: the system administrator authenticates through
  // the signed local-admin session, not the legacy role-header flow.
  if (isTenantSessionMutation) {
    const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
    if (!actor) {
      res.status(401).json({ error: "جلسة الدخول غير صالحة. يرجى تسجيل الدخول مجدداً." });
      return;
    }
    next();
    return;
  }

  // Email archive and HR each have their own server-signed session
  // middleware (see emailArchiveAuth.ts / hr/permissions.ts) because they
  // protect sensitive data and must not derive authorization from client-
  // supplied role headers, which are trivially forgeable.
  if (req.path.startsWith("/sa/email-archive") || req.path.startsWith("/sa/hr") || req.path.startsWith("/sa/messages")) {
    next();
    return;
  }

  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor) {
    res.status(401).json({ error: "جلسة المؤسسة غير صالحة. يرجى تسجيل الدخول مجدداً." });
    return;
  }
  const role = actor.role;
  const tenantId = String(res.locals.tenantId ?? "");

  if (role === "viewer") {
    res.status(403).json({ error: "حساب المراقب مخصص للمشاهدة والطباعة فقط" });
    return;
  }

  const isSingleAttachmentDelete =
    req.method === "DELETE" &&
    /^\/sa\/projects\/[^/]+\/attachments\/[^/]+$/.test(req.path) &&
    !req.path.endsWith("/attachments/folder");
  const isAttachmentFolderDelete =
    req.method === "DELETE" &&
    /^\/sa\/projects\/[^/]+\/attachments\/folder$/.test(req.path);
  if (req.method === "DELETE" && role !== "admin" && !(role === "data_entry" && (isSingleAttachmentDelete || isAttachmentFolderDelete))) {
    res.status(403).json({ error: "الحذف النهائي متاح للمدير فقط" });
    return;
  }

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || hasDetailedAudit(req.path)) return;

    const action = req.method === "POST" ? "create" : req.method === "DELETE" ? "delete" : "update";
    const entity = entityForPath(req.path);
    const actionLabel = action === "create" ? "إضافة" : action === "update" ? "تعديل" : "حذف نهائي";
    const entityId = String(
      req.params.did ??
      req.params.cid ??
      req.params.mid ??
      req.params.lid ??
      req.params.aid ??
      req.params.pid ??
      req.params.id ??
      "new",
    );

    writeAuditLog(req, tenantId, actor.id, actor.name, action, entity, entityId, `${actionLabel} ${entity}`);
  });

  next();
}