import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";
import { FILE_LIMITS } from "./fileLimits";
import { logger } from "./logger";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const MAX_DRIVE_FILE_BYTES = FILE_LIMITS.maxFileBytes;
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
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
    throw new Error("تعذر إكمال ربط Google Drive. تأكد من إعداد OAuth وأعد الموافقة.");
  }
  const aboutResponse = await fetch(`${DRIVE_API}/about?fields=user(emailAddress)`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const about = await aboutResponse.json() as { user?: { emailAddress?: string } };
  const connectedEmail = about.user?.emailAddress?.trim().toLowerCase();
  if (!aboutResponse.ok || !connectedEmail) throw new Error("تعذر التحقق من حساب Google الذي تمت الموافقة عليه.");
  const rootFolderId = sharedRootFolderId();
  const folderResponse = await fetch(`${DRIVE_API}/files/${encodeURIComponent(rootFolderId)}?fields=id,mimeType,owners(emailAddress),trashed`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const folder = await folderResponse.json() as { id?: string; mimeType?: string; owners?: Array<{ emailAddress?: string }>; trashed?: boolean };
  if (!folderResponse.ok || folder.mimeType !== "application/vnd.google-apps.folder" || folder.trashed) {
    throw new Error("حساب المكتب لا يستطيع الوصول إلى مجلد GOOGLE_DRIVE_ROOT_FOLDER_ID.");
  }
  if (folder.owners?.length && !folder.owners.some((owner) => owner.emailAddress?.toLowerCase() === connectedEmail)) {
    throw new Error("الحساب الذي تمت الموافقة عليه ليس مالك مجلد الأرشيف المحدد.");
  }
  const { error } = await supabaseAdmin().from("tenant_storage_connections").upsert({
    tenant_id: tenantId,
    provider: "google_drive",
    encrypted_credentials: encryptRefreshToken(tokens.refresh_token),
    root_folder_id: rootFolderId,
    connected_email: connectedEmail,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id" });
  if (error) throw new Error("تعذر حفظ ربط Google Drive المشفر.");
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
    const result = await response.json() as { access_token?: string; expires_in?: number };
    if (!response.ok || !result.access_token) {
      accessTokens.delete(tenantId);
      throw new Error("انتهت صلاحية ربط Google Drive. أعد ربط حساب المكتب.");
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
  return {
    connected: configured,
    configured,
    provider: configured ? "google_drive" : null,
    connectedEmail: configured ? data?.connected_email ?? null : null,
    connectedAt: data?.connected_at ?? null,
    sharedAccount: false,
    accountVerified: configured,
  };
}