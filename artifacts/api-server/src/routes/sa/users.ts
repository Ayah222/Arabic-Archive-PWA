// Supabase-backed user management — Google OAuth + invite system
import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../../lib/supabase";
import { requireAuth, requireRole } from "../../middleware/auth";
import { addAuditLog } from "./store";

const router: IRouter = Router();

// Role hierarchy: super_admin > admin > employee
// • super_admin: can manage anyone, assign any role
// • admin:       can only manage employees (role === "employee")
// • employee:    no management permissions
const VALID_ROLES = ["super_admin", "admin", "employee"] as const;
type Role = (typeof VALID_ROLES)[number];

/**
 * Returns true when `actorRole` is allowed to assign `targetRole`.
 * super_admin can assign anything.
 * admin can only assign the "employee" role.
 */
function canActorAssignRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === "super_admin") return true;
  if (actorRole === "admin") return targetRole === "employee";
  return false;
}

/**
 * Returns true when `actorRole` is allowed to read/write a profile whose
 * current role is `targetRole`.
 * super_admin can touch anyone.
 * admin can only touch employees.
 */
function canActorManageProfile(actorRole: string, targetRole: string): boolean {
  if (actorRole === "super_admin") return true;
  if (actorRole === "admin") return targetRole === "employee";
  return false;
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /sa/auth/me  — current authenticated user profile
// ──────────────────────────────────────────────────────────────────────────────
router.get("/sa/auth/me", requireAuth, (req, res) => {
  res.json(req.authUser);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /sa/users  — list all users (admin+)
// ──────────────────────────────────────────────────────────────────────────────
router.get(
  "/sa/users",
  requireAuth,
  requireRole("super_admin", "admin"),
  async (_req, res): Promise<void> => {
    if (!supabaseAdmin) {
      res.status(503).json({
        error: "خدمة إدارة المستخدمين غير مهيأة بعد (يلزم SUPABASE_SERVICE_ROLE_KEY)",
      });
      return;
    }
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: "خطأ في جلب المستخدمين" });
      return;
    }
    res.json(data ?? []);
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// POST /sa/users/invite  — invite a new employee by email
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/sa/users/invite",
  requireAuth,
  requireRole("super_admin", "admin"),
  async (req, res): Promise<void> => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: "يلزم SUPABASE_SERVICE_ROLE_KEY لإرسال الدعوات" });
      return;
    }

    const {
      email,
      full_name,
      job_title,
      role = "employee",
      can_upload = true,
      access_expires_at,
    } = req.body as {
      email?: string;
      full_name?: string;
      job_title?: string;
      role?: string;
      can_upload?: boolean;
      access_expires_at?: string | null;
    };

    if (!email) {
      res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
      return;
    }

    // Validate role value
    if (!VALID_ROLES.includes(role as Role)) {
      res.status(400).json({
        error: `الدور غير صالح. الأدوار المتاحة: ${VALID_ROLES.join(", ")}`,
      });
      return;
    }

    // Enforce role hierarchy: actor cannot invite to a role above their authority
    if (!canActorAssignRole(req.authUser!.role, role)) {
      res.status(403).json({
        error: "ليس لديك صلاحية لتعيين هذا الدور. المدير يمكنه دعوة موظفين فقط.",
      });
      return;
    }

    // Check if user already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existingProfile) {
      res.status(409).json({ error: "هذا البريد الإلكتروني مسجل مسبقاً في النظام" });
      return;
    }

    // Derive the invite callback URL from the incoming request's origin.
    // The frontend sends its origin header; we append the auth callback path.
    // Falls back to the SUPABASE_REDIRECT_URL env var when set, then undefined
    // (Supabase will use the Site URL configured in its dashboard).
    const origin = (req.headers.origin as string | undefined)
      ?? (req.headers.referer as string | undefined)?.split("/").slice(0, 3).join("/");
    const redirectTo =
      process.env.SUPABASE_REDIRECT_URL
      ?? (origin ? `${origin}/smart-archive/auth/callback` : undefined);

    // Send invite via Supabase Auth
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name, job_title },
        redirectTo,
      });

    if (inviteError) {
      res.status(400).json({ error: inviteError.message });
      return;
    }

    // Create profile entry
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: inviteData.user.id,
        email,
        full_name: full_name ?? email,
        job_title: job_title ?? null,
        role,
        can_upload,
        access_expires_at: access_expires_at ?? null,
        is_active: true,
        invited_by: req.authUser!.id,
      })
      .select()
      .single();

    if (profileError) {
      res.status(500).json({
        error: "تم إرسال الدعوة لكن حدث خطأ في حفظ الملف الشخصي",
      });
      return;
    }

    addAuditLog(
      req.authUser!.id,
      req.authUser!.name,
      "create",
      "user",
      String(profile.id),
      `دعوة مستخدم جديد: ${email} (${role})`,
    );

    res.status(201).json(profile);
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /sa/users/:uid  — update user profile / permissions
// ──────────────────────────────────────────────────────────────────────────────
router.patch(
  "/sa/users/:uid",
  requireAuth,
  requireRole("super_admin", "admin"),
  async (req, res): Promise<void> => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: "يلزم SUPABASE_SERVICE_ROLE_KEY" });
      return;
    }

    const uid = String(req.params.uid);
    const {
      role,
      can_upload,
      is_active,
      access_expires_at,
      full_name,
      job_title,
    } = req.body as {
      role?: string;
      can_upload?: boolean;
      is_active?: boolean;
      access_expires_at?: string | null;
      full_name?: string;
      job_title?: string;
    };

    // Fetch target profile
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("role, email")
      .eq("id", uid)
      .single();

    if (!target) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    // Enforce profile management hierarchy:
    // • super_admin may manage anyone
    // • admin may ONLY manage employees (role === "employee")
    if (!canActorManageProfile(req.authUser!.role, String(target.role))) {
      res.status(403).json({
        error: "المدير يمكنه تعديل الموظفين فقط. لا يمكن تعديل حسابات المدير أو المدير الرئيسي.",
      });
      return;
    }

    // Validate and enforce role transition hierarchy
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role as Role)) {
        res.status(400).json({
          error: `الدور غير صالح. الأدوار المتاحة: ${VALID_ROLES.join(", ")}`,
        });
        return;
      }
      if (!canActorAssignRole(req.authUser!.role, role)) {
        res.status(403).json({
          error: "ليس لديك صلاحية لتعيين هذا الدور",
        });
        return;
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (role !== undefined) updates.role = role;
    if (can_upload !== undefined) updates.can_upload = can_upload;
    if (is_active !== undefined) updates.is_active = is_active;
    if (access_expires_at !== undefined)
      updates.access_expires_at = access_expires_at;
    if (full_name !== undefined) updates.full_name = full_name;
    if (job_title !== undefined) updates.job_title = job_title;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", uid)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: "خطأ في تحديث بيانات المستخدم" });
      return;
    }

    addAuditLog(
      req.authUser!.id,
      req.authUser!.name,
      "update",
      "user",
      uid,
      `تعديل بيانات: ${String(target.email)}`,
    );

    res.json(data);
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /sa/users/:uid  — delete user (super_admin only)
// ──────────────────────────────────────────────────────────────────────────────
router.delete(
  "/sa/users/:uid",
  requireAuth,
  requireRole("super_admin"),
  async (req, res): Promise<void> => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: "يلزم SUPABASE_SERVICE_ROLE_KEY" });
      return;
    }

    const uid = String(req.params.uid);

    // Prevent deleting self
    if (uid === req.authUser!.id) {
      res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص" });
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, role")
      .eq("id", uid)
      .single();

    // Prevent deleting other super_admin accounts (safety guard)
    if (String((profile?.role as string | undefined) ?? "") === "super_admin") {
      res.status(403).json({ error: "لا يمكن حذف حسابات المدير الرئيسي" });
      return;
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) {
      res.status(500).json({ error: "خطأ في حذف المستخدم" });
      return;
    }

    addAuditLog(
      req.authUser!.id,
      req.authUser!.name,
      "delete",
      "user",
      uid,
      `حذف مستخدم: ${String((profile?.email as string | undefined) ?? uid)}`,
    );

    res.json({ success: true });
  },
);

export default router;
