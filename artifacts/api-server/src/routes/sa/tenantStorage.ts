import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import {
  finishDriveOAuth,
  getDriveOAuthAuthorizationUrl,
  getDriveOAuthRedirectUri,
  getTenantDriveStatus,
  DriveConnectError,
} from "../../lib/tenantDrive";
import { saveTenantPrivateObject, storageObjectUrl } from "../../lib/objectStorage";
import { FILE_LIMITS } from "../../lib/fileLimits";
import { hasAdminAccess, verifyEmailArchiveSession } from "../../lib/emailArchiveAuth";
import { LegacyDriveError } from "../../lib/legacyDriveReader";
import { connectionDiagnostics } from "../../lib/driveMonitorAccess";
import { runMonitorCycle, schedulerSecretMatches } from "../../lib/monitorRunner";
import { monitorCycleDeps } from "../../lib/monitorRunnerAccess";
import { readTenantDriveFile, driveReadStatus } from "../../lib/driveRead";
import { driveReadDepsFor } from "../../lib/driveReadAccess";
import { logger } from "../../lib/logger";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: "utf8",
  limits: { fileSize: FILE_LIMITS.maxFileBytes },
});

function oauthStateSignature(payload: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("تعذر بدء ربط Google Drive.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function makeOAuthState(tenantId: string) {
  const payload = Buffer.from(JSON.stringify({
    tenantId,
    nonce: randomBytes(18).toString("base64url"),
    expiresAt: Date.now() + 10 * 60 * 1000,
  })).toString("base64url");
  return `${payload}.${oauthStateSignature(payload)}`;
}

function validOAuthState(value: unknown, expectedTenantId: string) {
  if (typeof value !== "string") return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = Buffer.from(oauthStateSignature(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return false;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      tenantId?: string; nonce?: string; expiresAt?: number;
    };
    return state.tenantId === expectedTenantId && Boolean(state.nonce) && Number(state.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

/**
 * Phase 18BY. Connection diagnostics for the institution administrator.
 *
 * Read-only: it refreshes the access token if needed and makes ONE /about
 * call. It never uploads, deletes, shares, lists a folder or reads a
 * customer document.
 *
 * SAFE TO PASTE INTO A SUPPORT THREAD. No token, no client secret, no
 * encrypted credential, no file name and no file id appears in the
 * response - which is the point of having it at all.
 */
/**
 * Phase 18CA. The monitoring cycle, driven by an EXTERNAL scheduler.
 *
 * Not a background timer: an Autoscale instance can be stopped between
 * any two ticks, so a setInterval is a hope rather than a schedule. An
 * external scheduler calling this route is the only arrangement that
 * actually holds.
 *
 * Several instances may be called at once. Each claims only tenants whose
 * lease has expired, and the claim moves the lease forward in the same
 * step, so exactly one instance checks a given tenant in a given interval.
 *
 * AUTHENTICATION is a shared secret compared in constant time. This route
 * is deliberately NOT behind the institution session: a scheduler has no
 * session. It performs no write to customer data and returns only counts
 * and states.
 */
router.post("/sa/tenants/storage/monitor/run", async (req, res): Promise<void> => {
  const provided = req.header("x-archhive-monitor-key");
  if (!schedulerSecretMatches(provided, process.env.DRIVE_MONITOR_TRIGGER_SECRET)) {
    // Identical answer whether the secret is wrong or unset, so the route
    // reveals nothing about its own configuration.
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const result = await runMonitorCycle(monitorCycleDeps());
    res.json({
      claimed: result.claimed,
      checked: result.checked,
      alerts: result.alerts.map((entry) => ({
        state: entry.alert.state,
        severity: entry.alert.severity,
        delivery: entry.delivery.status,
      })),
    });
  } catch (error) {
    res.status(503).json({
      error: error instanceof Error ? error.message : "monitor cycle failed",
    });
  }
});

router.get("/sa/tenants/storage/diagnostics", async (req, res): Promise<void> => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor || !hasAdminAccess(actor)) {
    res.status(403).json({ error: "يلزم حساب مدير لعرض تشخيص الربط" });
    return;
  }
  // The tenant comes from the verified session, never from the request.
  res.json(await connectionDiagnostics(actor.tenantId));
});

router.get("/sa/tenants/storage/oauth/start", (req, res): void => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor || !hasAdminAccess(actor)) {
    res.status(403).json({ error: "يلزم حساب مدير لربط Google Drive" });
    return;
  }
  try {
    const state = makeOAuthState(actor.tenantId);
    const redirectUri = getDriveOAuthRedirectUri();
    res.cookie("sa_drive_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 10 * 60 * 1000,
      path: "/api/sa/tenants/storage/oauth",
    });
    res.redirect(302, getDriveOAuthAuthorizationUrl(state, redirectUri));
  } catch {
    res.status(503).json({ error: "إعداد OAuth غير مكتمل. تحقق من عنوان الرجوع وإعدادات Google." });
  }
});

router.get("/sa/tenants/storage/oauth/callback", async (req, res): Promise<void> => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  const state = req.query.state;
  const storedState = req.cookies?.sa_drive_oauth_state;
  res.clearCookie("sa_drive_oauth_state", { path: "/api/sa/tenants/storage/oauth" });
  if (!actor || !hasAdminAccess(actor) || state !== storedState || !validOAuthState(state, actor.tenantId)) {
    res.status(400).send("تعذر التحقق من طلب ربط Google Drive. ارجع للتطبيق وابدأ الربط من جديد.");
    return;
  }
  if (typeof req.query.error === "string" || typeof req.query.code !== "string") {
    res.redirect("/?driveOAuth=cancelled");
    return;
  }
  try {
    await finishDriveOAuth(actor.tenantId, req.query.code, getDriveOAuthRedirectUri());
    res.redirect("/?driveOAuth=connected");
  } catch (error) {
    // Record WHICH step failed. Stage and HTTP status only - never the
    // authorization code, the state, a token, a secret, or Google's error
    // body, any of which can carry identifiers. The redirect is unchanged,
    // so the user-facing behaviour is exactly what it was.
    logger.error({
      tenantId: actor.tenantId,
      stage: error instanceof DriveConnectError ? error.stage : "unclassified",
      googleStatus: error instanceof DriveConnectError ? error.httpStatus : 0,
    }, "Google Drive connect failed");
    res.redirect("/?driveOAuth=failed");
  }
});

router.get("/sa/tenants/storage", async (req, res): Promise<void> => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor) {
    res.status(401).json({ error: "يلزم تسجيل الدخول" });
    return;
  }
  res.json(await getTenantDriveStatus(String(res.locals.tenantId)));
});

router.post("/sa/tenants/storage/upload", upload.single("file"), async (req, res): Promise<void> => {
  const namespace = typeof req.body.namespace === "string" ? req.body.namespace : "";
  const segments = namespace.split("/");
  const [category, folder] = segments;
  const safeSegment = /^[\p{L}\p{M}\p{N}_-]{1,120}$/u;
  const folderSegments = category === "agencies" && segments.length === 1
    ? ["agencies"]
    : category === "agencies" && segments.length === 2 && folder && safeSegment.test(folder)
      ? [category, folder]
      : null;
  if (!req.file || !folderSegments) {
    res.status(400).json({ error: "يرجى اختيار ملف صالح" });
    return;
  }
  const saved = await saveTenantPrivateObject({
    tenantId: String(res.locals.tenantId),
    namespace: "agencies",
    filename: req.file.originalname,
    bytes: req.file.buffer,
    contentType: req.file.mimetype,
    segments: folderSegments.slice(1),
  });
  res.status(201).json({ path: saved.objectName, url: storageObjectUrl(saved.objectName) });
});

router.get("/sa/storage/files/:fileId", async (req, res): Promise<void> => {
  try {
    // Phase 18BN. The provider choice used to live here, inline, and ONLY
    // here - which is exactly why the other eight read sites were broken.
    // It now lives in readTenantDriveFile, and this route reaches it the
    // same way every other route does.
    const file = await readTenantDriveFile(
      String(req.params.fileId),
      driveReadDepsFor(String(res.locals.tenantId)),
      FILE_LIMITS.maxFileBytes,
    );
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(file.bytes);
  } catch (error) {
    if (error instanceof LegacyDriveError) {
      res.status(driveReadStatus(error.code)).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "تعذر تنزيل الملف";
    const status = message.includes("not connected")
      ? 503
      : message.includes("not found") || message.includes("different organization")
        ? 404
        : 400;
    res.status(status).json({ error: message });
  }
});

export default router;