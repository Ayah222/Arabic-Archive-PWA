import { Router } from "express";
import multer from "multer";
import {
  buildDriveOAuthUrl,
  completeDriveOAuth,
  createDriveOAuthState,
  downloadTenantFile,
  getTenantDriveStatus,
  verifyDriveOAuthState,
} from "../../lib/tenantDrive";
import { FILE_LIMITS } from "../../lib/fileLimits";
import { saveTenantFile } from "../../lib/tenantDrive";
import { hasAdminAccess, verifyEmailArchiveSession } from "../../lib/emailArchiveAuth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: FILE_LIMITS.maxFileBytes } });

function callbackUrl(req: import("express").Request) {
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.get("host");
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || req.protocol;
  if (!host || !["https", "http"].includes(proto)) throw new Error("Application URL is unavailable");
  if (proto !== "https" && process.env.NODE_ENV === "production") {
    throw new Error("Google Drive connection requires HTTPS");
  }
  return `${proto}://${host}/api/sa/storage/google/callback`;
}

router.get("/sa/tenants/storage", async (req, res): Promise<void> => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor) {
    res.status(401).json({ error: "يلزم تسجيل الدخول" });
    return;
  }
  res.json(await getTenantDriveStatus(actor.tenantId));
});

router.post("/sa/tenants/storage/upload", upload.single("file"), async (req, res): Promise<void> => {
  const namespace = typeof req.body.namespace === "string" ? req.body.namespace : "";
  const [category, folder] = namespace.split("/");
  if (!req.file || category !== "agencies" || !folder || !/^[\p{L}\p{N}_-]{1,120}$/u.test(folder)) {
    res.status(400).json({ error: "يرجى اختيار ملف صالح" });
    return;
  }
  const saved = await saveTenantFile({
    tenantId: String(res.locals.tenantId),
    filename: req.file.originalname,
    bytes: req.file.buffer,
    contentType: req.file.mimetype,
    folderSegments: [category, folder],
  });
  res.status(201).json({ path: saved.objectName });
});

router.get("/sa/tenants/storage/google/connect", (req, res): void => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor || !hasAdminAccess(actor)) {
    res.status(403).json({ error: "ربط Google Drive متاح لمدير المؤسسة فقط" });
    return;
  }
  try {
    const redirectUri = callbackUrl(req);
    let returnPath = "/";
    const referer = req.get("referer");
    if (referer) {
      try {
        const referringUrl = new URL(referer, `${req.protocol}://${req.get("host")}`);
        const requestHost = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
        if (requestHost && referringUrl.host === requestHost) returnPath = referringUrl.pathname;
      } catch {
        // Use the app root if the referrer header is malformed.
      }
    }
    const state = createDriveOAuthState(actor.tenantId, redirectUri, returnPath);
    res.json({ url: buildDriveOAuthUrl(state, redirectUri) });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "إعداد Google Drive غير مكتمل" });
  }
});

router.get("/sa/storage/google/callback", async (req, res): Promise<void> => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  const state = verifyDriveOAuthState(req.query.state);
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const providerError = typeof req.query.error === "string" ? req.query.error : "";
  if (providerError) {
    res.status(400).send("لم يكتمل ربط Google Drive.");
    return;
  }
  if (!actor || !hasAdminAccess(actor) || !state || actor.tenantId !== state.tenantId || !code) {
    res.status(403).send("تعذر التحقق من طلب ربط Google Drive.");
    return;
  }
  try {
    const connection = await completeDriveOAuth({ tenantId: actor.tenantId, code, redirectUri: state.redirectUri });
    const query = new URLSearchParams({ storage: "connected" });
    if (connection.email) query.set("account", connection.email);
    res.redirect(`${state.returnPath}?${query.toString()}`);
  } catch (error) {
    req.log.error({ err: error, tenantId: actor.tenantId }, "Google Drive connection failed");
    const message = error instanceof Error ? error.message : "";
    const isolationError = [
      "حساب Google هذا مربوط",
      "هذه المؤسسة مربوطة",
      "تعذر استبدال مساحة التخزين الحالية",
      "تعذر التحقق من حساب Google",
    ].some((prefix) => message.startsWith(prefix));
    res.status(isolationError ? 409 : 502).send(
      isolationError ? message : "تعذر ربط Google Drive. تحقق من إعداد OAuth وحاول مرة أخرى.",
    );
  }
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