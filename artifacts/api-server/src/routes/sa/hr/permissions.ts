// Access gate for the entire HR module (/sa/hr/*). HR data (national IDs,
// CVs, government correspondence) is too sensitive to trust client-supplied
// `x-user-role`/`x-user-id` headers — anyone could set those in a request.
// Instead this checks the server-signed, HttpOnly `sa_hr_session` cookie,
// which is only issued by /sa/auth/login (local admin) or
// /sa/auth/supabase-hr-session (after verifying a real Supabase access token
// and the profile's `hr_access` flag server-side — see users.ts).
import type { NextFunction, Request, Response } from "express";
import { verifyHrSession, type HrActor } from "../../../lib/emailArchiveAuth";

// requireHrAccess stores the verified actor on res.locals.hrActor (Response.locals
// is already loosely typed by @types/express, so no module augmentation is
// needed). HR route handlers must read identity from here — never from
// x-user-id/x-user-label headers, which are client-controlled and forgeable.
export function hrActorFrom(res: Response): HrActor | undefined {
  return res.locals.hrActor as HrActor | undefined;
}

export async function requireHrAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.path.startsWith("/sa/hr")) {
    next();
    return;
  }

  const actor = verifyHrSession(req.cookies?.sa_hr_session);
  if (!actor) {
    res.status(403).json({ error: "ليست لديك صلاحية الوصول لوحدة الموارد البشرية" });
    return;
  }

  res.locals.hrActor = actor;
  next();
}
