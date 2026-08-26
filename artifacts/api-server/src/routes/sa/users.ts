// Prompt 7: Simple role-based user management + login
// Prompt 8: Self-service user registration
import { Router, type IRouter } from "express";
import { store, newId } from "./store";
import { addAuditLog } from "./archiveDb";
import { createClient } from "@supabase/supabase-js";
import { createEmailArchiveSession, createHrSession, type EmailArchiveActor, type HrActor } from "../../lib/emailArchiveAuth";

const router: IRouter = Router();

function setEmailArchiveCookie(res: import("express").Response, actor: EmailArchiveActor) {
  res.cookie("sa_email_archive_session", createEmailArchiveSession(actor), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000,
    // Scoped to all of /api/sa (not just /email-archive): enforcePermissions
    // also reads this cookie to verify real admin status for user/profile
    // management routes, so it must be sent on those requests too.
    path: "/api/sa",
  });
}

function setHrCookie(res: import("express").Response, actor: HrActor) {
  res.cookie("sa_hr_session", createHrSession(actor), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/api/sa/hr",
  });
}

// POST login
router.post("/sa/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }
  const user = store.users.find((u) => u.username === username && u.password === password);
  if (!user) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }
  setEmailArchiveCookie(res, { id: user.id, name: user.name, role: user.role });
  // The single local manager account (role "admin") always has HR access;
  // local data_entry/viewer accounts are not part of the HR grant model.
  if (user.role === "admin") {
    setHrCookie(res, { id: user.id, name: user.name });
  }
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });
});

// POST register (Prompt 8: Self-service registration)
router.post("/sa/auth/register", async (req, res): Promise<void> => {
  const { username, password, name } = req.body as {
    username?: string; password?: string; name?: string;
  };
  if (!username || !password || !name) {
    res.status(400).json({ error: "username, password, name are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    return;
  }
  const exists = store.users.find((u) => u.username === username);
  if (exists) {
    res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل" });
    return;
  }
  const newUser = {
    id: newId(),
    username,
    password,
    name,
    role: "data_entry" as const, // default role for self-registered users
    createdAt: new Date().toISOString(),
  };
  store.users.push(newUser);

  addAuditLog("system", "النظام", "create", "user", newUser.id, `تسجيل مستخدم جديد: ${username}`);

  setEmailArchiveCookie(res, { id: newUser.id, name: newUser.name, role: newUser.role });
  res.status(201).json({
    id: newUser.id,
    username: newUser.username,
    name: newUser.name,
    role: newUser.role,
  });
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
    res.status(401).json({ error: "جلسة المستخدم غير صالحة" });
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role, status")
    .eq("id", authData.user.id)
    .single();
  if (profileError || !profile || profile.status !== "active" || !["admin", "data_entry", "viewer"].includes(profile.role)) {
    res.status(403).json({ error: "الحساب غير مفعل أو لا يملك صلاحية الأرشيف" });
    return;
  }

  setEmailArchiveCookie(res, {
    id: profile.id,
    name: profile.email?.split("@")[0] || "مستخدم",
    role: profile.role as EmailArchiveActor["role"],
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
    .select("id, email, role, status, hr_access")
    .eq("id", authData.user.id)
    .single();
  const hasHrAccess = profile?.role === "admin" || profile?.hr_access === true;
  if (profileError || !profile || profile.status !== "active" || !hasHrAccess) {
    res.status(403).json({ error: "ليست لديك صلاحية الوصول لوحدة الموارد البشرية" });
    return;
  }

  setHrCookie(res, { id: profile.id, name: profile.email?.split("@")[0] || "مستخدم" });
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
