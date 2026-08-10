import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { supabaseAnon, supabaseAdmin } from "../lib/supabase";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  canUpload: boolean;
  isActive: boolean;
  accessExpiresAt: string | null;
  jobTitle: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

/**
 * Generate a deterministic demo token from SESSION_SECRET.
 * Returns null in production or when SESSION_SECRET is absent —
 * callers must treat null as "demo auth not available".
 */
export function getDemoToken(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null; // No fallback; require an explicit secret
  return (
    "demo:" +
    crypto
      .createHmac("sha256", secret)
      .update("admin:admin123")
      .digest("hex")
      .slice(0, 32)
  );
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ error: "غير مصرح، يرجى تسجيل الدخول" });
    return;
  }

  // ── Demo admin bypass (development only — null in production) ────────────
  const demoToken = getDemoToken(); // null when NODE_ENV === "production"
  if (demoToken && token === demoToken) {
    req.authUser = {
      id: "demo-admin",
      email: "admin@demo.local",
      role: "super_admin",
      name: "مدير النظام",
      canUpload: true,
      isActive: true,
      accessExpiresAt: null,
      jobTitle: "مدير رئيسي",
    };
    next();
    return;
  }

  try {
    // Verify token using the anon client (getUser validates the JWT against Supabase)
    const {
      data: { user },
      error,
    } = await supabaseAnon.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "جلسة غير صالحة، يرجى تسجيل الدخول مجدداً" });
      return;
    }

    const client = supabaseAdmin ?? supabaseAnon;

    // Fetch profile
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      // Auto-create super_admin profile for the configured admin email
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && user.email === adminEmail && supabaseAdmin) {
        const { data: newProfile, error: createErr } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email!,
            full_name:
              (user.user_metadata?.full_name as string | undefined) ??
              user.email,
            role: "super_admin",
            can_upload: true,
            is_active: true,
          })
          .select()
          .single();

        if (createErr || !newProfile) {
          res.status(500).json({ error: "خطأ في إنشاء الملف الشخصي" });
          return;
        }

        req.authUser = {
          id: user.id,
          email: user.email!,
          role: "super_admin",
          name: newProfile.full_name ?? user.email!,
          canUpload: true,
          isActive: true,
          accessExpiresAt: null,
          jobTitle: null,
        };
        next();
        return;
      }

      res.status(403).json({
        error:
          "عذراً، هذا البريد غير مصرح له بالدخول، يرجى التواصل مع المدير",
      });
      return;
    }

    // Account frozen?
    if (!profile.is_active) {
      res.status(403).json({ error: "تم تجميد حسابك، يرجى التواصل مع المدير" });
      return;
    }

    // Access expired?
    if (
      profile.access_expires_at &&
      new Date(profile.access_expires_at as string) < new Date()
    ) {
      res.status(403).json({
        error: "انتهت صلاحية وصولك، يرجى التواصل مع المدير",
      });
      return;
    }

    req.authUser = {
      id: user.id,
      email: user.email!,
      role: profile.role as string,
      name: (profile.full_name as string | null) ?? user.email!,
      canUpload: profile.can_upload as boolean,
      isActive: profile.is_active as boolean,
      accessExpiresAt: profile.access_expires_at as string | null,
      jobTitle: profile.job_title as string | null,
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "خطأ في التحقق من الهوية" });
  }
}

export function requireRole(...roles: string[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.authUser) {
      res.status(401).json({ error: "غير مصرح" });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: "ليس لديك صلاحية كافية لهذه العملية" });
      return;
    }
    next();
  };
}

/** Soft auth — sets req.authUser if token present but does NOT block the request */
export async function softAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { next(); return; }

  // Demo token check (null-safe — returns null in production)
  const softDemoToken = getDemoToken();
  if (softDemoToken && token === softDemoToken) {
    req.authUser = {
      id: "demo-admin",
      email: "admin@demo.local",
      role: "super_admin",
      name: "مدير النظام",
      canUpload: true,
      isActive: true,
      accessExpiresAt: null,
      jobTitle: "مدير رئيسي",
    };
    next();
    return;
  }

  try {
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (!error && user) {
      const client = supabaseAdmin ?? supabaseAnon;
      const { data: profile } = await client
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (profile) {
        req.authUser = {
          id: user.id,
          email: user.email!,
          role: profile.role as string,
          name: (profile.full_name as string | null) ?? user.email!,
          canUpload: profile.can_upload as boolean,
          isActive: profile.is_active as boolean,
          accessExpiresAt: profile.access_expires_at as string | null,
          jobTitle: profile.job_title as string | null,
        };
      }
    }
  } catch { /* ignore */ }
  next();
}
