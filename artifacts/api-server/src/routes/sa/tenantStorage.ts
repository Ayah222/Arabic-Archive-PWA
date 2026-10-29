import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import {
  downloadTenantFile,
  finishDriveOAuth,
  getDriveOAuthAuthorizationUrl,
  getDriveOAuthRedirectUri,
  getTenantDriveStatus,
} from "../../lib/tenantDrive";
import { saveTenantPrivateObject, storageObjectUrl } from "../../lib/objectStorage";
import { FILE_LIMITS } from "../../lib/fileLimits";
import { hasAdminAccess, verifyEmailArchiveSession } from "../../lib/emailArchiveAuth";

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
  } catch {
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
    const file = await downloadTenantFile(String(res.locals.tenantId), String(req.params.fileId));
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(file.bytes);
  } catch (error) {
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