import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";
import { FILE_LIMITS } from "./fileLimits";
import { logger } from "./logger";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_DRIVE_FILE_BYTES = FILE_LIMITS.maxFileBytes;
const ACCESS_TOKEN_REFRESH_EARLY_MS = 10 * 60 * 1000;
const BACKGROUND_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const DRIVE_REAUTH_REQUIRED_MESSAGE = "تعذر تجديد ربط Google Drive. أعد ربط الحساب نفسه من إعدادات المؤسسة؛ لن تتأثر الملفات الموجودة.";

interface DriveCredentials {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
}

interface EncryptedCredentials {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
}

interface DriveConnection {
  tenantId: string;
  credentials: DriveCredentials;
  rootFolderId: string;
  connectedEmail: string | null;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
}

const accessTokens = new Map<string, { token: string; expiresAt: number }>();
const tokenRefreshes = new Map<string, Promise<string>>();
const reauthorizationRequiredTenants = new Set<string>();

export class DriveReauthorizationRequiredError extends Error {
  readonly code = "GOOGLE_DRIVE_REAUTH_REQUIRED";

  constructor() {
    super(DRIVE_REAUTH_REQUIRED_MESSAGE);
    this.name = "DriveReauthorizationRequiredError";
  }
}

export class DriveTokenRefreshUnavailableError extends Error {
  readonly code = "GOOGLE_DRIVE_REFRESH_UNAVAILABLE";

  constructor() {
    super("تعذر تحديث اتصال Google Drive مؤقتاً. أعد المحاولة، أو استخدم زر «إعادة ربط Google Drive» إذا استمر العطل.");
    this.name = "DriveTokenRefreshUnavailableError";
  }
}

function oauthClientId() {
  const value = process.env.GOOGLE_DRIVE_CLIENT_ID;
  if (!value) throw new Error("Google Drive OAuth is not configured");
  return value;
}

function oauthClientSecret() {
  const value = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!value) throw new Error("Google Drive OAuth is not configured");
  return value;
}

function encryptionKey() {
  const value = process.env.STORAGE_ENCRYPTION_KEY;
  if (!value || value.length < 32) {
    throw new Error("STORAGE_ENCRYPTION_KEY must contain at least 32 characters");
  }
  return createHash("sha256").update(value).digest();
}

function encryptCredentials(value: DriveCredentials): EncryptedCredentials {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

function decryptCredentials(value: unknown): DriveCredentials {
  if (!value || typeof value !== "object") throw new Error("Stored Google Drive credentials are invalid");
  const encrypted = value as Partial<EncryptedCredentials>;
  if (encrypted.version !== 1 || !encrypted.iv || !encrypted.tag || !encrypted.ciphertext) {
    throw new Error("Stored Google Drive credentials have an unsupported format");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(encrypted.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64url"));
  const clear = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64url")),
    decipher.final(),
  ]);
  const credentials = JSON.parse(clear.toString("utf8")) as Partial<DriveCredentials>;
  if (typeof credentials.refreshToken !== "string" || !credentials.refreshToken) {
    throw new Error("Stored Google Drive refresh token is missing");
  }
  return {
    refreshToken: credentials.refreshToken,
    accessToken: typeof credentials.accessToken === "string" ? credentials.accessToken : undefined,
    expiresAt: typeof credentials.expiresAt === "number" ? credentials.expiresAt : undefined,
  };
}

function oauthStateSignature(payload: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for Google Drive OAuth");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createDriveOAuthState(tenantId: string, redirectUri: string, returnPath = "/") {
  const payload = Buffer.from(JSON.stringify({
    tenantId,
    redirectUri,
    returnPath,
    nonce: randomUUID(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  })).toString("base64url");
  return `${payload}.${oauthStateSignature(payload)}`;
}

export function verifyDriveOAuthState(state: unknown): { tenantId: string; redirectUri: string; returnPath: string } | null {
  if (typeof state !== "string") return null;
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(oauthStateSignature(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      tenantId?: unknown;
      redirectUri?: unknown;
      returnPath?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof parsed.tenantId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(parsed.tenantId) ||
      typeof parsed.redirectUri !== "string" ||
      !parsed.redirectUri.startsWith("https://") ||
      typeof parsed.returnPath !== "string" ||
      !parsed.returnPath.startsWith("/") ||
      parsed.returnPath.startsWith("//") ||
      parsed.returnPath.includes("\\") ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt < Date.now()
    ) return null;
    return { tenantId: parsed.tenantId, redirectUri: parsed.redirectUri, returnPath: parsed.returnPath };
  } catch {
    return null;
  }
}

export function buildDriveOAuthUrl(state: string, redirectUri: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", oauthClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/drive.file email openid");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export function parseTenantDriveObjectPath(value: string | null | undefined) {
  if (typeof value !== "string" || !value.startsWith("drive://")) return null;
  const fileId = value.slice("drive://".length);
  return /^[A-Za-z0-9_-]{5,256}$/.test(fileId) ? fileId : null;
}

export async function completeDriveOAuth(input: {
  tenantId: string;
  code: string;
  redirectUri: string;
}) {
  const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: oauthClientId(),
      client_secret: oauthClientSecret(),
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenBody = await tokenResponse.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new Error(tokenBody.error_description || "Google Drive authorization failed");
  }
  if (!tokenBody.refresh_token) {
    throw new Error("Google did not return a refresh token; revoke access and connect again");
  }

  const accessToken = tokenBody.access_token;
  const aboutResponse = await fetch(`${DRIVE_API}/about?fields=user(emailAddress)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const about = await aboutResponse.json() as { user?: { emailAddress?: string } };
  if (!aboutResponse.ok) throw new Error("Unable to read the connected Google account");
  const connectedEmail = about.user?.emailAddress?.trim().toLowerCase();
  if (!connectedEmail) {
    throw new Error("تعذر التحقق من حساب Google. لم يتم حفظ الربط.");
  }

  const { data: existingConnections, error: connectionsError } = await supabaseAdmin()
    .from("tenant_storage_connections")
    .select("tenant_id,connected_email,root_folder_id")
    .eq("provider", "google_drive");
  if (connectionsError) throw new Error("تعذر التحقق من ملكية حساب Google لمؤسستك");
  const normalizedConnections = existingConnections ?? [];
  const currentConnection = normalizedConnections.find((item) => String(item.tenant_id) === input.tenantId);
  if (
    currentConnection?.connected_email
    && String(currentConnection.connected_email).trim().toLowerCase() !== connectedEmail
  ) {
    throw new Error("هذه المؤسسة مربوطة بحساب Google آخر. لا يمكن استبداله تلقائياً حتى لا تنقطع الملفات المخزنة.");
  }
  const accountUsedByAnotherTenant = normalizedConnections.some((item) =>
    String(item.tenant_id) !== input.tenantId
    && typeof item.connected_email === "string"
    && item.connected_email.trim().toLowerCase() === connectedEmail,
  );
  if (accountUsedByAnotherTenant) {
    throw new Error("حساب Google هذا مربوط بمؤسسة أخرى. استخدم حساب Google مستقل لهذه المؤسسة.");
  }

  const rootFolderName = `Smart Archive - ${input.tenantId}`;
  const folderQuery = `name = '${rootFolderName}' and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='smartArchiveTenantId' and value='${input.tenantId}' } and trashed = false`;
  const folderResponse = await fetch(`${DRIVE_API}/files?fields=files(id,name,appProperties)&pageSize=100&q=${encodeURIComponent(folderQuery)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const folderList = await folderResponse.json() as { files?: DriveFile[] };
  if (!folderResponse.ok) throw new Error("Unable to inspect the connected Google Drive");
  let rootFolder = folderList.files?.[0];
  if (!rootFolder) {
    const createdFolder = await fetch(`${DRIVE_API}/files?fields=id,name`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: rootFolderName,
        mimeType: "application/vnd.google-apps.folder",
        appProperties: { smartArchiveTenantId: input.tenantId },
      }),
    });
    rootFolder = await createdFolder.json() as DriveFile;
    if (!createdFolder.ok || !rootFolder.id) throw new Error("Unable to create the Smart Archive folder in Google Drive");
  }
  if (currentConnection?.root_folder_id && String(currentConnection.root_folder_id) !== rootFolder.id) {
    throw new Error("تعذر استبدال مساحة التخزين الحالية تلقائياً حتى لا تنقطع الملفات القديمة.");
  }

  const credentials = encryptCredentials({
    refreshToken: tokenBody.refresh_token,
    accessToken,
    expiresAt: Date.now() + Math.max(60, tokenBody.expires_in ?? 3600) * 1000,
  });
  const { error } = await supabaseAdmin()
    .from("tenant_storage_connections")
    .upsert({
      tenant_id: input.tenantId,
      provider: "google_drive",
      encrypted_credentials: credentials,
      root_folder_id: rootFolder.id,
      connected_email: connectedEmail,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" });
  if (error) throw new Error(error.message);
  accessTokens.set(input.tenantId, { token: accessToken, expiresAt: Date.now() + Math.max(60, tokenBody.expires_in ?? 3600) * 1000 });
  reauthorizationRequiredTenants.delete(input.tenantId);
  return { email: connectedEmail };
}

async function getConnection(tenantId: string): Promise<DriveConnection> {
  const { data, error } = await supabaseAdmin()
    .from("tenant_storage_connections")
    .select("tenant_id,provider,encrypted_credentials,root_folder_id,connected_email")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data || data.provider !== "google_drive" || !data.root_folder_id) {
    throw new Error("Google Drive is not connected for this organization");
  }
  const connectedEmail = typeof data.connected_email === "string" ? data.connected_email.trim().toLowerCase() : null;
  return {
    tenantId: String(data.tenant_id),
    credentials: decryptCredentials(data.encrypted_credentials),
    rootFolderId: String(data.root_folder_id),
    connectedEmail,
  };
}

async function assertDriveAccountIsIsolatedForUpload(connection: DriveConnection) {
  if (!connection.connectedEmail) {
    throw new Error("تم إيقاف الرفع: تعذر التحقق من حساب Google المرتبط بهذه المؤسسة.");
  }
  const { data: allConnections, error: isolationError } = await supabaseAdmin()
    .from("tenant_storage_connections")
    .select("tenant_id,connected_email")
    .eq("provider", "google_drive");
  if (isolationError) throw new Error("تعذر التحقق من عزل مساحة Google Drive قبل الرفع");
  const sharedAccount = (allConnections ?? []).some((item) =>
    String(item.tenant_id) !== connection.tenantId
    && typeof item.connected_email === "string"
    && item.connected_email.trim().toLowerCase() === connection.connectedEmail,
  );
  if (sharedAccount) {
    throw new Error("تم إيقاف رفع الملفات الجديدة: حساب Google هذا مربوط بمؤسسة أخرى. اربط حساباً مستقلاً لهذه المؤسسة.");
  }
}

async function getAccessToken(connection: DriveConnection, forceRefresh = false) {
  if (reauthorizationRequiredTenants.has(connection.tenantId)) {
    throw new DriveReauthorizationRequiredError();
  }
  const cached = accessTokens.get(connection.tenantId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now() + ACCESS_TOKEN_REFRESH_EARLY_MS) return cached.token;
  if (!forceRefresh && connection.credentials.accessToken && (connection.credentials.expiresAt ?? 0) > Date.now() + ACCESS_TOKEN_REFRESH_EARLY_MS) {
    accessTokens.set(connection.tenantId, {
      token: connection.credentials.accessToken,
      expiresAt: connection.credentials.expiresAt!,
    });
    return connection.credentials.accessToken;
  }
  const existingRefresh = tokenRefreshes.get(connection.tenantId);
  if (existingRefresh) return existingRefresh;

  const refresh = (async () => {
    let result: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    let response: Response;
    try {
      response = await fetch(OAUTH_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: oauthClientId(),
          client_secret: oauthClientSecret(),
          refresh_token: connection.credentials.refreshToken,
          grant_type: "refresh_token",
        }),
      });
      result = await response.json() as typeof result;
    } catch {
      throw new DriveTokenRefreshUnavailableError();
    }
    if (!response.ok || !result.access_token) {
      accessTokens.delete(connection.tenantId);
      if (result.error === "invalid_grant") {
        reauthorizationRequiredTenants.add(connection.tenantId);
        throw new DriveReauthorizationRequiredError();
      }
      throw new DriveTokenRefreshUnavailableError();
    }

    const expiresAt = Date.now() + Math.max(60, result.expires_in ?? 3600) * 1000;
    const credentials = encryptCredentials({
      ...connection.credentials,
      refreshToken: result.refresh_token || connection.credentials.refreshToken,
      accessToken: result.access_token,
      expiresAt,
    });
    const { error } = await supabaseAdmin().from("tenant_storage_connections")
      .update({ encrypted_credentials: credentials, updated_at: new Date().toISOString() })
      .eq("tenant_id", connection.tenantId);
    if (error) {
      throw new DriveTokenRefreshUnavailableError();
    }
    accessTokens.set(connection.tenantId, { token: result.access_token, expiresAt });
    return result.access_token;
  })();
  tokenRefreshes.set(connection.tenantId, refresh);
  try {
    return await refresh;
  } finally {
    if (tokenRefreshes.get(connection.tenantId) === refresh) {
      tokenRefreshes.delete(connection.tenantId);
    }
  }
}

async function driveFetch(connection: DriveConnection, url: string, init: RequestInit = {}) {
  const send = (token: string) => fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  const token = await getAccessToken(connection);
  let response = await send(token);
  if (response.status !== 401) return response;

  await response.body?.cancel().catch(() => undefined);
  const cached = accessTokens.get(connection.tenantId);
  if (cached?.token === token) accessTokens.delete(connection.tenantId);
  response = await send(await getAccessToken(connection, true));
  if (response.status === 401) {
    await response.body?.cancel().catch(() => undefined);
    throw new DriveReauthorizationRequiredError();
  }
  return response;
}

async function driveRequest<T>(connection: DriveConnection, url: string, init: RequestInit = {}): Promise<T> {
  const response = await driveFetch(connection, url, init);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Drive request failed (${response.status}): ${error.slice(0, 400)}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
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
  await assertDriveAccountIsIsolatedForUpload(connection);
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
    const uploaded = await uploadResponse.json() as DriveFile;
    if (!uploadResponse.ok) throw new Error(`Google Drive upload failed (${uploadResponse.status})`);
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
    .select("tenant_id,provider,connected_email,connected_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  let sharedAccount = false;
  if (data?.provider === "google_drive" && typeof data.connected_email === "string") {
    const { data: connections, error: isolationError } = await supabaseAdmin()
      .from("tenant_storage_connections")
      .select("tenant_id,connected_email")
      .eq("provider", "google_drive");
    if (isolationError) throw new Error(isolationError.message);
    sharedAccount = (connections ?? []).some((item) =>
      String(item.tenant_id) !== tenantId
      && typeof item.connected_email === "string"
      && item.connected_email.trim().toLowerCase() === data.connected_email.trim().toLowerCase(),
    );
  }
  return {
    connected: data?.provider === "google_drive",
    provider: data?.provider ?? null,
    connectedEmail: data?.connected_email ?? null,
    connectedAt: data?.connected_at ?? null,
    sharedAccount,
    accountVerified: typeof data?.connected_email === "string" && data.connected_email.trim().length > 0,
  };
}

let refreshSchedulerStarted = false;

export function startTenantDriveRefreshScheduler() {
  if (refreshSchedulerStarted) return;
  refreshSchedulerStarted = true;

  let scanInProgress = false;
  const refreshExpiringConnections = async () => {
    if (scanInProgress) return;
    scanInProgress = true;
    try {
      const { data, error } = await supabaseAdmin()
        .from("tenant_storage_connections")
        .select("tenant_id")
        .eq("provider", "google_drive");
      if (error) {
        logger.warn({ err: error }, "Google Drive token refresh scan failed");
        return;
      }
      for (const row of data ?? []) {
        const tenantId = String(row.tenant_id);
        if (reauthorizationRequiredTenants.has(tenantId)) continue;
        try {
          const connection = await getConnection(tenantId);
          await getAccessToken(connection);
        } catch (refreshError) {
          if (refreshError instanceof DriveReauthorizationRequiredError) {
            logger.warn({ tenantId }, "Google Drive requires organization reauthorization");
          } else {
            logger.warn({ err: refreshError, tenantId }, "Google Drive background token refresh failed");
          }
        }
      }
    } finally {
      scanInProgress = false;
    }
  };

  void refreshExpiringConnections();
  const timer = setInterval(() => void refreshExpiringConnections(), BACKGROUND_REFRESH_INTERVAL_MS);
  timer.unref();
}