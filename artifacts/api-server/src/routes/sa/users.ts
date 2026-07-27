// Prompt 7: Simple role-based user management + login
// Prompt 8: Self-service user registration
import { Router, type IRouter } from "express";
import { store, newId, addAuditLog } from "./store";

const router: IRouter = Router();

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
  // Return user info (no real token, client stores in localStorage)
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

  res.status(201).json({
    id: newUser.id,
    username: newUser.username,
    name: newUser.name,
    role: newUser.role,
  });
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
