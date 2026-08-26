import type { NextFunction, Request, Response } from "express";
import { addAuditLog } from "./archiveDb";

type SARole = "admin" | "data_entry" | "viewer";

function normalizeRole(value: unknown): SARole | null {
  if (value === "admin") return "admin";
  if (value === "data_entry" || value === "employee") return "data_entry";
  if (value === "viewer") return "viewer";
  return null;
}

function headerValue(req: Request, name: string, fallback: string) {
  const value = req.headers[name] as string | undefined;
  if (!value) return fallback;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  // Login and initial account creation happen before an app session exists.
  if (req.path.startsWith("/sa/auth/")) {
    next();
    return;
  }

  // Email archive has its own server-signed session middleware because it
  // protects sensitive Gmail content and must not trust client role headers.
  if (req.path.startsWith("/sa/email-archive")) {
    next();
    return;
  }

  const role = normalizeRole(req.headers["x-user-role"]);
  if (!role) {
    res.status(403).json({ error: "يلزم تسجيل الدخول بصلاحية صالحة لإجراء هذا التغيير" });
    return;
  }

  const isUserManagement =
    req.path.startsWith("/sa/invite") ||
    req.path.startsWith("/sa/profiles") ||
    req.path.startsWith("/sa/users");
  if (isUserManagement && role !== "admin") {
    res.status(403).json({ error: "إدارة المستخدمين متاحة للمدير فقط" });
    return;
  }

  if (role === "viewer") {
    res.status(403).json({ error: "حساب المراقب مخصص للمشاهدة والطباعة فقط" });
    return;
  }

  if (req.method === "DELETE" && role !== "admin") {
    res.status(403).json({ error: "الحذف النهائي متاح للمدير فقط" });
    return;
  }

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || hasDetailedAudit(req.path)) return;

    const action = req.method === "POST" ? "create" : req.method === "DELETE" ? "delete" : "update";
    const entity = entityForPath(req.path);
    const actionLabel = action === "create" ? "إضافة" : action === "update" ? "تعديل" : "حذف نهائي";
    const userId = headerValue(req, "x-user-id", "system");
    const userLabel = headerValue(req, "x-user-label", "النظام");
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

    void addAuditLog(userId, userLabel, action, entity, entityId, `${actionLabel} ${entity}`);
  });

  next();
}