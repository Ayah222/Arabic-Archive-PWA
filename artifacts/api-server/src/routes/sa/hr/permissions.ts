// Access gate for the entire HR module (/sa/hr/*). Unlike the rest of the
// archive (gated only on mutating methods via enforcePermissions), HR data is
// sensitive enough that even GET requests must be gated: the manager (admin)
// always has access, and any other Supabase-authenticated employee needs an
// explicit `hr_access` flag on their profile row (granted from the Users page).
import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name] as string | undefined;
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function requireHrAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.path.startsWith("/sa/hr")) {
    next();
    return;
  }

  const role = headerValue(req, "x-user-role");
  if (role === "admin") {
    next();
    return;
  }

  const userId = headerValue(req, "x-user-id");
  if (!userId) {
    res.status(403).json({ error: "ليست لديك صلاحية الوصول لوحدة الموارد البشرية" });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin().from("profiles").select("hr_access").eq("id", userId).maybeSingle();
    if (error || !data?.hr_access) {
      res.status(403).json({ error: "ليست لديك صلاحية الوصول لوحدة الموارد البشرية" });
      return;
    }
    next();
  } catch {
    res.status(403).json({ error: "ليست لديك صلاحية الوصول لوحدة الموارد البشرية" });
  }
}
