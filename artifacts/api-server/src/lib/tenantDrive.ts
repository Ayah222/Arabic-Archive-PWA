import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";
import { FILE_LIMITS } from "./fileLimits";
import { logger } from "./logger";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const MAX_DRIVE_FILE_BYTES = FILE_LIMITS.maxFileBytes;
// Phase 18BW. NARROWED from the restricted .../auth/drive. An External app
// requesting that scope needs Google verification and an annual CASA
// assessment, and users see the unverified-app screen until it completes.
// drive.file is NON-SENSITIVE, is sufficient because ArchHive creates every
// file it later reads and resolves them by id, and is ALREADY the only
// scope declared on the In-production ArchHive Migration consent screen -
// so code and console agree for the first time.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SETUP_MESSAGE = "إعداد Google Drive غير مكتمل. تحقق من ربط حساب المكتب ومجلد الأرشيف.";

interface DriveConnection {
  tenantId: string;
  rootFolderId: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
}

interface GoogleErrorResponse {
  error?: {
    status?: string;
    errors?: Array<{ reason?: string }>;
  };
}

export class GoogleDriveAccessDeniedError extends Error {
  readonly httpStatus = 502;
  readonly code = "GOOGLE_DRIVE_ACCESS_DENIED";
  readonly publicMessage: string;

  constructor(readonly reason: string) {
    const messages: Record<string, string> = {
      storageQuotaExceeded: "رفض Google Drive حفظ الملف بسبب سعة التخزين في حساب المكتب.",
      insufficientFilePermissions: "حساب المكتب لا يملك صلاحية الكتابة في مجلد الأرشيف.",
      teamDriveMembershipRequired: "حساب المكتب غير مخول للوصول إلى Shared Drive.",
    };
    const publicMessage = messages[reason]
      || "رفض Google Drive إكمال العملية. تحقق من صلاحيات حساب المكتب على مجلد الأرشيف.";
    super(publicMessage);
    this.name = "GoogleDriveAccessDeniedError";
    this.publicMessage = publicMessage;
  }
}

function getGoogleErrorReason(responseText: string): { reason: string; status: string | null } {
  try {
    const result = JSON.parse(responseText) as GoogleErrorResponse;
    const rawReason = result.error?.errors?.[0]?.reason || result.error?.status || "";
    return {
      reason: /^[A-Za-z0-9_]{1,80}$/.test(rawReason) ? rawReason : "unknown",
      status: result.error?.status || null,
    };
  } catch {
    return { reason: "unknown", status: null };
  }
}

type OAuthDriveCredentials = { mode: "oauth"; iv: string; tag: string; ciphertext: string };
/**
 * Phase 18BW. A refresh failure that a human must fix, told apart from one
 * that will clear by itself.
 *
 * Google answers invalid_grant when the refresh token is gone - revoked,
 * expired under a Testing-mode consent screen, or superseded. No amount of
 * retrying brings it back; only a new consent does. Treating that the same
 * as a 503 is how a dead connection stays dead for weeks while the logs
 * fill with retries and nobody is told.
 */
export class DriveAuthError extends Error {
  readonly terminal: boolean;
  readonly reason: string;
  constructor(terminal: boolean, reason: string, message: string) {
    super(message);
    this.terminal = terminal;
    this.reason = reason;
    this.name = "DriveAuthError";
  }
}

/** Classifies a token-endpoint rejection. Unknown failures are transient. */
export function classifyTokenFailure(status: number, body: unknown): DriveAuthError {
  const error = typeof (body as { error?: unknown })?.error === "string"
    ? String((body as { error: string }).error)
    : "";
  const terminalReasons = ["invalid_grant", "unauthorized_client", "invalid_client"];
  if (terminalReasons.includes(error) || status === 400 || status === 401) {
    return new DriveAuthError(true, error || `http_${status}`,
      "انتهت صلاحية ربط Google Drive أو تم إلغاؤه. يلزم إعادة الربط من حساب المؤسسة.");
  }
  return new DriveAuthError(false, error || `http_${status}`,
    "تعذر تجديد الاتصال بـ Google Drive مؤقتاً. ستتم إعادة المحاولة.");
}

const accessTokens = new Map<string, { token: string; expiresAt: number }>();

function oauthClientId() {
  const value = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  if (!value) throw new Error("لم يتم إعداد OAuth لـ Google Drive على الخادم.");
  return value;
}

function oauthClientSecret() {
  const value = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  if (!value) throw new Error("لم يتم إعداد OAuth لـ Google Drive على الخادم.");
  return value;
}

function encryptionKey() {
  const value = process.env.STORAGE_ENCRYPTION_KEY;
  if (!value) throw new Error("مفتاح تشفير بيانات Drive غير مُعدّ.");
  return createHash("sha256").update(value).digest();
}

function encryptRefreshToken(token: string): OAuthDriveCredentials {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return { mode: "oauth", iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") };
}

function decryptRefreshToken(value: unknown): string {
  if (!value || typeof value !== "object") throw new Error("يلزم ربط Google Drive بحساب المكتب.");
  const credentials = value as Partial<OAuthDriveCredentials>;
  if (credentials.mode !== "oauth" || !credentials.iv || !credentials.tag || !credentials.ciphertext) {
    throw new Error("يلزم ربط Google Drive بحساب المكتب.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(credentials.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(credentials.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(credentials.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function getDriveOAuthRedirectUri() {
  const value = process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI?.trim();
  if (!value || !value.startsWith("https://")) throw new Error("يجب إعداد عنوان رجوع OAuth الخاص بالمعاينة.");
  return value;
}

export function getDriveOAuthAuthorizationUrl(state: string, redirectUri: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: oauthClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return url.toString();
}

/**
 * Which step of the connect flow failed.
 *
 * finishDriveOAuth has five failure points and the callback catches them
 * all into one redirect, so a failed connection used to be indistinguishable
 * from any other - Phase 18CZ could not tell a wrong client secret from an
 * unreachable archive folder without guessing. The stage is carried on the
 * error so the route can record WHICH step failed.
 *
 * The stage name and an HTTP status are the whole payload. No authorization
 * code, no token, no secret, and no Google error body - those can carry
 * identifiers and must never reach a log.
 */
export type DriveConnectStage =
  | "token-exchange"
  | "account-identity"
  | "root-folder-access"
  | "root-folder-ownership"
  | "credential-persistence";

export class DriveConnectError extends Error {
  readonly stage: DriveConnectStage;
  /** The Google HTTP status, when the step made a request. 0 otherwise. */
  readonly httpStatus: number;
  constructor(stage: DriveConnectStage, httpStatus: number, message: string) {
    super(message);
    this.name = "DriveConnectError";
    this.stage = stage;
    this.httpStatus = httpStatus;
  }
}

/**
 * THE OPERATING ROOT, and why it is not the historical archive root.
 *
 * Phase 18DG proved from production logs that connecting failed at
 * root-folder-access with Google HTTP 404, twice, identically. The folder
 * named by GOOGLE_DRIVE_ROOT_FOLDER_ID exists and the institution owns it -
 * but it was created on 2026-10-13 by a DIFFERENT OAuth client, and
 * drive.file shows an app only the files that app created or the user
 * explicitly handed it. Ownership is irrelevant; visibility is per
 * application. No configuration can repair that, so the connect flow stops
 * demanding a folder it can never see.
 *
 * Instead the application creates and owns an OPERATING ROOT, under the
 * consenting user's identity, inside their My Drive. Two distinct roots now
 * exist and they must not be conflated:
 *
 *   historical archive root  GOOGLE_DRIVE_ROOT_FOLDER_ID, created by the
 *                            old client. Never read, written, renamed or
 *                            re-shared by this path. The 811 historical
 *                            drive:// references do not live through it -
 *                            they resolve per file through the service
 *                            account, which is why they are unaffected.
 *   operating root           created here, owned by the institution
 *                            account, visible to this client under
 *                            drive.file, stored as root_folder_id.
 *
 * IDEMPOTENCE. Discovery runs before creation and is keyed on appProperties
 * private to this application, so a reconnect, a retry, a crash between
 * creating the folder and persisting the row, or two concurrent consents all
 * converge on the SAME folder. When more than one somehow exists, the oldest
 * wins deterministically and the others are left untouched - this code never
 * deletes anything in a user's Drive. Exactly one root is ever active.
 */
const OPERATING_ROOT_ROLE = "operating-root";
export const operatingRootName = (tenantId: string) => `ArchHive Operating Root - ${tenantId}`;

type OperatingRoot = { id: string; created: boolean; duplicates: number };

export async function ensureOperatingRoot(
  accessToken: string,
  tenantId: string,
  connectedEmail: string,
  storedRootId: string | null = null,
  fetchImpl: typeof fetch = fetch,
): Promise<OperatingRoot> {
  const auth = { Authorization: `Bearer ${accessToken}` };

  // STEP 0, and the one that actually makes the active root stable.
  //
  // Discovery-before-create is NOT atomic: two simultaneous consents can
  // both see an empty list and both create a folder. Nothing in the Drive
  // API prevents that. What we can guarantee is that the tenant keeps using
  // ONE root for ever after - by preferring the one already recorded,
  // whenever it is still a folder this client can see, this tenant owns the
  // marker on, and the institution owns.
  //
  // This also quietly rejects a stale historical id: the pre-18DH value
  // points at a folder created by a different OAuth client, so files.get
  // returns 404 here and we fall through to discovery instead of failing.
  if (storedRootId) {
    const adopted = await inspectCandidateRoot(storedRootId, tenantId, connectedEmail, auth, fetchImpl);
    if (adopted) return { id: adopted, created: false, duplicates: 0 };
  }
  const esc = (v: string) => v.replace(/'/g, "\\'");
  // drive.file already limits this search to files THIS app created, and the
  // appProperties pin it to THIS tenant - so another tenant's root can never
  // be returned here.
  const q = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `appProperties has { key='smartArchiveTenantId' and value='${esc(tenantId)}' }`,
    `appProperties has { key='smartArchiveRole' and value='${OPERATING_ROOT_ROLE}' }`,
  ].join(" and ");

  const listUrl = `${DRIVE_API}/files?` + new URLSearchParams({
    q,
    fields: "files(id,createdTime,owners(emailAddress))",
    orderBy: "createdTime",
    pageSize: "10",
  });
  const listResponse = await fetchImpl(listUrl, { headers: auth });
  if (!listResponse.ok) {
    throw new DriveConnectError("root-folder-access", listResponse.status,
      "تعذر الوصول إلى مجلد التشغيل في Google Drive.");
  }
  const found = (await listResponse.json() as {
    files?: Array<{ id?: string; createdTime?: string; owners?: Array<{ emailAddress?: string }> }>;
  }).files ?? [];

  if (found[0]?.id) {
    // Oldest first by orderBy, so concurrent creators converge on one folder.
    assertOwnedByInstitution(found[0].owners, connectedEmail);
    return { id: found[0].id, created: false, duplicates: Math.max(0, found.length - 1) };
  }

  // No parents: Drive places it at the root of the consenting user's My
  // Drive, and creating it with THEIR token makes them the owner.
  const createResponse = await fetchImpl(`${DRIVE_API}/files?fields=id,owners(emailAddress)`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: operatingRootName(tenantId),
      mimeType: "application/vnd.google-apps.folder",
      appProperties: {
        smartArchiveTenantId: tenantId,
        smartArchiveRole: OPERATING_ROOT_ROLE,
      },
    }),
  });
  const created = await createResponse.json() as {
    id?: string; owners?: Array<{ emailAddress?: string }>;
  };
  if (!createResponse.ok || !created.id) {
    throw new DriveConnectError("root-folder-access", createResponse.status,
      "تعذر إنشاء مجلد التشغيل في حساب Google الخاص بالمكتب.");
  }
  assertOwnedByInstitution(created.owners, connectedEmail);

  // BEST EFFORT reconciliation. If a concurrent consent also created one,
  // a second listing usually shows both and we converge on the oldest. It is
  // only best effort: Drive's listing is eventually consistent, so a folder
  // created moments ago may not appear yet. The stable guarantee is step 0,
  // not this. Nothing is ever deleted - a loser is simply never used.
  try {
    const after = await fetchImpl(listUrl, { headers: auth });
    if (after.ok) {
      const siblings = (await after.json() as { files?: Array<{ id?: string }> }).files ?? [];
      if (siblings.length > 1 && siblings[0]?.id) {
        return { id: siblings[0].id, created: true, duplicates: siblings.length - 1 };
      }
    }
  } catch {
    // A failed reconciliation must never fail the connection: the folder
    // exists and is usable.
  }
  return { id: created.id, created: true, duplicates: 0 };
}

/**
 * Is this id usable as THIS tenant's operating root right now?
 *
 * Returns the id when it is visible to this client, is a live folder, is
 * owned by the consenting account, and carries this tenant's marker.
 * Returns null for anything else - including a 404, which is exactly what a
 * stale historical root id produces.
 */
async function inspectCandidateRoot(
  candidateId: string,
  tenantId: string,
  connectedEmail: string,
  auth: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetchImpl(
      `${DRIVE_API}/files/${encodeURIComponent(candidateId)}`
      + "?fields=id,mimeType,trashed,owners(emailAddress),appProperties",
      { headers: auth },
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const file = await response.json() as {
    id?: string; mimeType?: string; trashed?: boolean;
    owners?: Array<{ emailAddress?: string }>;
    appProperties?: Record<string, string>;
  };
  if (file.mimeType !== "application/vnd.google-apps.folder" || file.trashed) return null;
  if (file.appProperties?.smartArchiveTenantId !== tenantId) return null;
  if (file.appProperties?.smartArchiveRole !== OPERATING_ROOT_ROLE) return null;
  // A wrong owner is a real refusal, not a quiet fall-through.
  assertOwnedByInstitution(file.owners, connectedEmail);
  return file.id ?? null;
}

/** The folder must belong to the account that just consented. */
function assertOwnedByInstitution(
  owners: Array<{ emailAddress?: string }> | undefined,
  connectedEmail: string,
): void {
  if (owners?.length && !owners.some((o) => o.emailAddress?.toLowerCase() === connectedEmail)) {
    throw new DriveConnectError("root-folder-ownership", 0,
      "مجلد التشغيل ليس مملوكاً للحساب الذي تمت الموافقة عليه.");
  }
}

export async function finishDriveOAuth(tenantId: string, code: string, redirectUri: string) {
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: oauthClientId(),
      client_secret: oauthClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string };
  if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) {
    throw new DriveConnectError("token-exchange", tokenResponse.status,
      "تعذر إكمال ربط Google Drive. تأكد من إعداد OAuth وأعد الموافقة.");
  }
  const aboutResponse = await fetch(`${DRIVE_API}/about?fields=user(emailAddress)`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const about = await aboutResponse.json() as { user?: { emailAddress?: string } };
  const connectedEmail = about.user?.emailAddress?.trim().toLowerCase();
  if (!aboutResponse.ok || !connectedEmail) {
    throw new DriveConnectError("account-identity", aboutResponse.status,
      "تعذر التحقق من حساب Google الذي تمت الموافقة عليه.");
  }
  // Phase 18DH. The historical archive root is deliberately NOT touched here:
  // this client cannot see it under drive.file, which is the confirmed 404.
  // GOOGLE_DRIVE_ROOT_FOLDER_ID is left exactly as configured.
  // Read what this tenant already has, so a reconnect keeps the same root.
  const { data: existing } = await supabaseAdmin()
    .from("tenant_storage_connections")
    .select("root_folder_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const storedRootId = typeof existing?.root_folder_id === "string"
    ? existing.root_folder_id.trim() || null
    : null;
  const operatingRoot = await ensureOperatingRoot(
    tokens.access_token, tenantId, connectedEmail, storedRootId,
  );
  const rootFolderId = operatingRoot.id;
  logger.info({
    tenantId,
    created: operatingRoot.created,
    duplicatesIgnored: operatingRoot.duplicates,
  }, "Resolved Google Drive operating root");
  const { error } = await supabaseAdmin().from("tenant_storage_connections").upsert({
    tenant_id: tenantId,
    provider: "google_drive",
    encrypted_credentials: encryptRefreshToken(tokens.refresh_token),
    root_folder_id: rootFolderId,
    connected_email: connectedEmail,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id" });
  if (error) {
    throw new DriveConnectError("credential-persistence", 0,
      "تعذر حفظ ربط Google Drive المشفر.");
  }
  accessTokens.set(tenantId, { token: tokens.access_token, expiresAt: Date.now() + 50 * 60 * 1000 });
  return connectedEmail;
}

async function readJsonResponse<T>(response: Response, failureMessage: string): Promise<T> {
  let text: string;
  try {
    text = await response.text();
    return JSON.parse(text) as T;
  } catch {
    throw new Error(failureMessage);
  }
}

function sharedRootFolderId() {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  if (!id || !/^[A-Za-z0-9_-]{5,256}$/.test(id)) throw new Error(DRIVE_SETUP_MESSAGE);
  return id;
}

export function parseTenantDriveObjectPath(value: string | null | undefined) {
  if (typeof value !== "string" || !value.startsWith("drive://")) return null;
  const fileId = value.slice("drive://".length);
  return /^[A-Za-z0-9_-]{5,256}$/.test(fileId) ? fileId : null;
}

const tokenRefreshes = new Map<string, Promise<string>>();
async function getAccessToken(tenantId: string, forceRefresh = false): Promise<string> {
  const cached = accessTokens.get(tenantId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const pending = tokenRefreshes.get(tenantId);
  if (pending) return pending;
  const refresh = (async () => {
    const { data, error } = await supabaseAdmin()
      .from("tenant_storage_connections")
      .select("encrypted_credentials,provider")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || data?.provider !== "google_drive") throw new Error("يلزم ربط Google Drive بحساب المكتب.");
    const refreshToken = decryptRefreshToken(data.encrypted_credentials);
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: oauthClientId(),
        client_secret: oauthClientSecret(),
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const result = await response.json() as {
      access_token?: string; expires_in?: number; error?: string;
    };
    if (!response.ok || !result.access_token) {
      accessTokens.delete(tenantId);
      // A transient 5xx must not be reported as a revoked connection,
      // and a revoked connection must not be retried as a blip.
      throw classifyTokenFailure(response.status, result);
    }
    accessTokens.set(tenantId, {
      token: result.access_token,
      expiresAt: Date.now() + Math.max(60, result.expires_in ?? 3600) * 1000,
    });
    return result.access_token;
  })();
  tokenRefreshes.set(tenantId, refresh);
  try {
    return await refresh;
  } finally {
    if (tokenRefreshes.get(tenantId) === refresh) tokenRefreshes.delete(tenantId);
  }
}

async function getConnection(tenantId: string): Promise<DriveConnection> {
  const sharedRootId = sharedRootFolderId();
  const { data, error } = await supabaseAdmin()
    .from("tenant_storage_connections")
    .select("tenant_id,provider,encrypted_credentials,root_folder_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error("تعذر قراءة إعداد تخزين المؤسسة");
  if (data?.provider !== "google_drive") throw new Error("يلزم ربط Google Drive بحساب المكتب.");
  decryptRefreshToken(data.encrypted_credentials);

  // Prefer the operating root recorded at connect time. Falling back to the
  // configured historical root keeps a tenant that predates Phase 18DH
  // working exactly as before; a tenant connected after it never reaches the
  // folder this client cannot see.
  const storedRoot = typeof data.root_folder_id === "string" ? data.root_folder_id.trim() : "";
  if (storedRoot) {
    return { tenantId, rootFolderId: storedRoot };
  }
  const sharedRootConnection = { tenantId, rootFolderId: sharedRootId };
  const tenantFolder = await ensureFolder(
    sharedRootConnection,
    sharedRootId,
    `Smart Archive - ${tenantId}`,
  );
  const rootFolderId = tenantFolder.id;
  const previousRootReplaced = Boolean(data?.root_folder_id && String(data.root_folder_id) !== rootFolderId);
  if (tenantFolder.created || previousRootReplaced) {
    logger.info({
      tenantId,
      rootSource: "GOOGLE_DRIVE_ROOT_FOLDER_ID",
      tenantRootCreated: tenantFolder.created,
      previousRootReplaced,
    }, "Resolved tenant upload folder under configured Google Drive root");
  }

  const { error: saveError } = await supabaseAdmin()
    .from("tenant_storage_connections")
    .upsert({
      tenant_id: tenantId,
      provider: "google_drive",
      root_folder_id: rootFolderId,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
  if (saveError) throw new Error("تعذر حفظ إعداد مجلد تخزين المؤسسة");
  return { tenantId, rootFolderId };
}

async function driveFetch(connection: DriveConnection, url: string, init: RequestInit = {}) {
  const requestUrl = new URL(url);
  if (requestUrl.hostname === "www.googleapis.com") {
    requestUrl.searchParams.set("supportsAllDrives", "true");
    if (requestUrl.pathname.includes("/drive/v3/files")) {
      requestUrl.searchParams.set("includeItemsFromAllDrives", "true");
    }
  }
  const send = (token: string) => fetch(requestUrl.toString(), {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  const token = await getAccessToken(connection.tenantId);
  let response = await send(token);
  if (response.status !== 401) return response;

  await response.body?.cancel().catch(() => undefined);
  accessTokens.delete(connection.tenantId);
  response = await send(await getAccessToken(connection.tenantId, true));
  if (response.status === 401) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("تعذر دخول حساب المكتب إلى Google Drive.");
  }
  return response;
}

async function driveRequest<T>(connection: DriveConnection, url: string, init: RequestInit = {}): Promise<T> {
  const response = await driveFetch(connection, url, init);
  if (!response.ok) {
    const error = await response.text();
    if (response.status === 403) {
      const { reason, status } = getGoogleErrorReason(error);
      logger.error({ tenantId: connection.tenantId, status: response.status, reason, googleStatus: status }, "Google Drive denied an API request");
      throw new GoogleDriveAccessDeniedError(reason);
    }
    const safeError = error.trimStart().startsWith("<")
      ? "استجاب Google Drive بصفحة HTML بدلاً من بيانات API."
      : `Google Drive returned an error (${response.status}).`;
    throw new Error(`Google Drive request failed (${response.status}): ${safeError}`);
  }
  if (response.status === 204) return undefined as T;
  return readJsonResponse<T>(response, "أعاد Google Drive استجابة غير صالحة؛ تحقق من الوصول إلى مجلد الأرشيف.");
}

async function ensureFolder(connection: DriveConnection, parentId: string, name: string): Promise<{ id: string; created: boolean }> {
  const q = `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='smartArchiveTenantId' and value='${connection.tenantId}' } and trashed = false`;
  const query = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "100" });
  const results = await driveRequest<{ files?: DriveFile[] }>(connection, `${DRIVE_API}/files?${query}`);
  if (results.files?.[0]?.id) return { id: results.files[0].id, created: false };
  const folder = await driveRequest<DriveFile>(connection, `${DRIVE_API}/files?fields=id,name`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
      appProperties: { smartArchiveTenantId: connection.tenantId },
    }),
  });
  if (!folder.id) throw new Error(`Unable to create Google Drive folder: ${name}`);
  return { id: folder.id, created: true };
}

async function removeEmptyDriveFolder(connection: DriveConnection, folderId: string): Promise<boolean> {
  const query = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id)",
    pageSize: "1",
  });
  const children = await driveRequest<{ files?: DriveFile[] }>(connection, `${DRIVE_API}/files?${query}`);
  if (children.files?.length) return false;
  await driveRequest<void>(connection, `${DRIVE_API}/files/${encodeURIComponent(folderId)}`, { method: "DELETE" });
  return true;
}

async function pruneEmptyDriveFolderTree(
  connection: DriveConnection,
  folderId: string,
  seen = new Set<string>(),
): Promise<void> {
  if (!folderId || folderId === connection.rootFolderId || seen.has(folderId)) return;
  seen.add(folderId);

  const folder = await driveRequest<DriveFile>(
    connection,
    `${DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=mimeType,parents,appProperties`,
  );
  if (
    folder.mimeType !== "application/vnd.google-apps.folder"
    || folder.appProperties?.smartArchiveTenantId !== connection.tenantId
  ) return;

  const removed = await removeEmptyDriveFolder(connection, folderId);
  if (!removed) return;
  for (const parentId of folder.parents ?? []) {
    await pruneEmptyDriveFolderTree(connection, parentId, seen);
  }
}

export async function saveTenantFile(input: {
  tenantId: string;
  filename: string;
  bytes: Buffer;
  contentType?: string;
  folderSegments?: string[];
}) {
  if (input.bytes.length === 0) throw new Error("الملف المحدد فارغ");
  if (
    input.filename.toLowerCase().endsWith(".docx")
    && !(input.bytes.length >= 4 && input.bytes[0] === 0x50 && input.bytes[1] === 0x4b)
  ) {
    throw new Error("الملف ليس مستند Word صالحاً بصيغة DOCX");
  }
  if (input.bytes.length > MAX_DRIVE_FILE_BYTES) throw new Error("File exceeds the Google Drive upload limit");
  const connection = await getConnection(input.tenantId);
  const rootFolder = await driveRequest<{
    mimeType?: string;
    trashed?: boolean;
    appProperties?: Record<string, string>;
  }>(
    connection,
    `${DRIVE_API}/files/${encodeURIComponent(connection.rootFolderId)}?fields=mimeType,trashed,appProperties`,
  );
  if (
    rootFolder.mimeType !== "application/vnd.google-apps.folder"
    || rootFolder.trashed
    || rootFolder.appProperties?.smartArchiveTenantId !== input.tenantId
  ) {
    throw new Error("تم إيقاف الرفع: مجلد التخزين لا يطابق المؤسسة الحالية.");
  }
  let parentId = connection.rootFolderId;
  const createdFolderIds: string[] = [];
  try {
    for (const segment of input.folderSegments ?? []) {
      const safeName = segment
        .normalize("NFKC")
        .replace(/[^\p{L}\p{M}\p{N}._ -]/gu, "_")
        .trim()
        .slice(0, 120);
      if (!safeName || safeName === "." || safeName === "..") {
        throw new Error("اسم مجلد التخزين غير صالح");
      }
      const folder = await ensureFolder(connection, parentId, safeName);
      parentId = folder.id;
      if (folder.created) createdFolderIds.push(folder.id);
    }

    const safeFilename = input.filename
      .normalize("NFKC")
      .replace(/[^\p{L}\p{M}\p{N}._() -]/gu, "_")
      .trim()
      .slice(0, 180);
    if (!safeFilename || safeFilename === "." || safeFilename === "..") {
      throw new Error("اسم الملف غير صالح");
    }
    const uploadContentType = input.contentType || "application/octet-stream";
    const metadata = JSON.stringify({
      name: safeFilename,
      parents: [parentId],
      appProperties: { smartArchiveTenantId: input.tenantId },
    });
    const sessionResponse = await driveFetch(
      connection,
      `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name,mimeType,size`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": uploadContentType,
          "X-Upload-Content-Length": String(input.bytes.length),
        },
        body: metadata,
      },
    );
    if (!sessionResponse.ok) {
      const responseText = await sessionResponse.text();
      const { reason, status } = getGoogleErrorReason(responseText);
      logger.error({
        tenantId: input.tenantId,
        status: sessionResponse.status,
        reason,
        googleStatus: status,
      }, "Google Drive rejected resumable upload setup");
      if (sessionResponse.status === 403) throw new GoogleDriveAccessDeniedError(reason);
      throw new Error(`Google Drive upload setup failed (${sessionResponse.status})`);
    }
    const sessionUrl = sessionResponse.headers.get("location");
    if (!sessionUrl || new URL(sessionUrl).hostname !== "www.googleapis.com") {
      throw new Error("Google Drive returned an invalid upload session");
    }
    const uploadResponse = await fetch(sessionUrl, {
      method: "PUT",
      headers: { "Content-Type": uploadContentType, "Content-Length": String(input.bytes.length) },
      body: input.bytes,
    });
    const uploadResponseText = await uploadResponse.text();
    let uploadResult: DriveFile & GoogleErrorResponse;
    try {
      uploadResult = JSON.parse(uploadResponseText) as DriveFile & GoogleErrorResponse;
    } catch {
      uploadResult = {} as DriveFile & GoogleErrorResponse;
    }
    if (!uploadResponse.ok) {
      const { reason, status } = getGoogleErrorReason(uploadResponseText);
      logger.error({
        tenantId: input.tenantId,
        status: uploadResponse.status,
        reason,
        googleStatus: status,
      }, "Google Drive rejected uploaded file content");
      throw new GoogleDriveAccessDeniedError(reason);
    }
    const uploaded = uploadResult;
    if (!uploaded.id) throw new Error("Google Drive did not return the uploaded file ID");
    if (uploaded.size !== undefined && Number(uploaded.size) !== input.bytes.length) {
      await driveRequest<void>(connection, `${DRIVE_API}/files/${encodeURIComponent(uploaded.id)}`, { method: "DELETE" });
      throw new Error("تعذر التأكد من اكتمال رفع الملف إلى Google Drive");
    }
    return { objectName: `drive://${uploaded.id}`, url: `/api/sa/storage/files/${encodeURIComponent(uploaded.id)}` };
  } catch (error) {
    for (const folderId of createdFolderIds.reverse()) {
      try {
        await removeEmptyDriveFolder(connection, folderId);
      } catch {
        // Keep the original upload error; only app-created empty folders are eligible for cleanup.
      }
    }
    throw error;
  }
}

export async function downloadTenantFile(tenantId: string, fileId: string, maxBytes = MAX_DRIVE_FILE_BYTES) {
  if (!/^[A-Za-z0-9_-]{5,256}$/.test(fileId)) throw new Error("Invalid Google Drive file ID");
  const connection = await getConnection(tenantId);
  const metadata = await driveRequest<{ name?: string; mimeType?: string; size?: string; appProperties?: Record<string, string> }>(
    connection,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=name,mimeType,size,appProperties`,
  );
  if (metadata.appProperties?.smartArchiveTenantId !== tenantId) throw new Error("Google Drive file belongs to a different organization");
  if (Number(metadata.size ?? 0) > maxBytes) throw new Error("File exceeds the allowed download size");
  const response = await driveFetch(connection, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`);
  if (!response.ok) throw new Error(`Google Drive download failed (${response.status})`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new Error("File exceeds the allowed download size");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error("File exceeds the allowed download size");
  const expectedSize = Number(metadata.size ?? 0);
  if (expectedSize > 0 && bytes.length !== expectedSize) {
    throw new Error(`Google Drive returned an incomplete file (${bytes.length}/${expectedSize} bytes)`);
  }
  if (
    metadata.name?.toLowerCase().endsWith(".docx")
    && !(bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b)
  ) {
    throw new Error("ملف Word المخزن في Google Drive فارغ أو غير صالح");
  }
  return {
    bytes,
    filename: metadata.name ?? "file",
    contentType: metadata.mimeType ?? response.headers.get("content-type") ?? "application/octet-stream",
  };
}

export async function deleteTenantFile(tenantId: string, fileId: string) {
  if (!/^[A-Za-z0-9_-]{5,256}$/.test(fileId)) throw new Error("Invalid Google Drive file ID");
  const connection = await getConnection(tenantId);
  const metadata = await driveRequest<{ appProperties?: Record<string, string>; parents?: string[] }>(
    connection,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=appProperties,parents`,
  );
  if (metadata.appProperties?.smartArchiveTenantId !== tenantId) throw new Error("Google Drive file belongs to a different organization");
  await driveRequest<void>(connection, `${DRIVE_API}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  for (const parentId of metadata.parents ?? []) {
    try {
      await pruneEmptyDriveFolderTree(connection, parentId);
    } catch {
      // File deletion has completed; empty-folder pruning is best-effort.
    }
  }
}

export async function getTenantDriveStatus(tenantId: string) {
  const { data, error } = await supabaseAdmin()
    .from("tenant_storage_connections")
    .select("tenant_id,provider,connected_email,connected_at,encrypted_credentials")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  let configured = false;
  try {
    oauthClientId();
    oauthClientSecret();
    encryptionKey();
    sharedRootFolderId();
    if (data?.provider === "google_drive") {
      decryptRefreshToken(data.encrypted_credentials);
      configured = true;
    }
  } catch {
    // Report missing or incomplete setup without exposing credential details.
  }
  // Phase 18BW. `configured` means a credential is present and decrypts.
  // `connected` now means Google ACCEPTED it moments ago. Those are not the
  // same thing, and conflating them is how a revoked token reads as healthy:
  // decryption is a local operation and succeeds happily for a token Google
  // has already thrown away.
  let verified = false;
  let state: "healthy" | "reauth_required" | "degraded" | "misconfigured" | "disconnected" =
    configured ? "degraded" : "disconnected";
  if (configured) {
    try {
      const token = await getAccessToken(tenantId);
      const probe = await fetch(`${DRIVE_API}/about?fields=user(emailAddress)`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      verified = probe.ok;
      state = probe.ok ? "healthy" : "degraded";
    } catch (error) {
      verified = false;
      state = error instanceof DriveAuthError && error.terminal
        ? "reauth_required"
        : "degraded";
    }
  }
  return {
    connected: verified,
    verified,
    state,
    configured,
    provider: configured ? "google_drive" : null,
    connectedEmail: configured ? data?.connected_email ?? null : null,
    connectedAt: data?.connected_at ?? null,
    sharedAccount: false,
    accountVerified: verified,
  };
}