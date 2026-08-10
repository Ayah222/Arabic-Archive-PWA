/**
 * Demo authentication route — DEVELOPMENT ONLY.
 *
 * Returns a signed demo token for admin/admin123. This route is completely
 * disabled (404) when NODE_ENV is "production", so it cannot be used as a
 * backdoor in deployed environments.
 *
 * Mounted BEFORE the SA router so it does not require auth.
 */
import { Router, type IRouter } from "express";
import { getDemoToken } from "../middleware/auth";

const router: IRouter = Router();

router.post("/sa/auth/demo-login", (req, res) => {
  // Hard-gate: never serve in production
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  const token = getDemoToken();
  if (!token) {
    res.status(503).json({ error: "SESSION_SECRET غير مضبوط — الدخول التجريبي غير متاح" });
    return;
  }

  if (username === "admin" && password === "admin123") {
    res.json({
      token,
      user: {
        id: "demo-admin",
        email: "admin@demo.local",
        name: "مدير النظام",
        role: "super_admin",
        canUpload: true,
        isActive: true,
        jobTitle: "مدير رئيسي",
        accessExpiresAt: null,
      },
    });
  } else {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
  }
});

export default router;
