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

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_DRIVE_FILE_BYTES = FILE_LIMITS.maxFileBytes;

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
}

const accessTokens = new Map<string, { token: string; expiresAt: number }>();

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
  url.searchParams.set("prompt", "consent");
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
      connected_email: about.user?.emailAddress ?? null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" });
  if (error) throw new Error(error.message);
  accessTokens.set(input.tenantId, { token: accessToken, expiresAt: Date.now() + Math.max(60, tokenBody.expires_in ?? 3600) * 1000 });
  return { email: about.user?.emailAddress ?? null };
}

async function getConnection(tenantId: string): Promise<DriveConnection> {
  const { data, error } = await supabaseAdmin()
    .from("tenant_storage_connections")
    .select("tenant_id,encrypted_credentials,root_folder_id,connected_email")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data || !data.root_folder_id) {
    throw new Error("Google Drive is not connected for this organization");
  }
  return {
    tenantId: String(data.tenant_id),
    credentials: decryptCredentials(data.encrypted_credentials),
    rootFolderId: String(data.root_folder_id),
    connectedEmail: data.connected_email ? String(data.connected_email) : null,
  };
}

async function getAccessToken(connection: DriveConnection) {
  const cached = accessTokens.get(connection.tenantId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  if (connection.credentials.accessToken && (connection.credentials.expiresAt ?? 0) > Date.now() + 60_000) {
    accessTokens.set(connection.tenantId, {
      token: connection.credentials.accessToken,
      expiresAt: connection.credentials.expiresAt!,
    });
    return connection.credentials.accessToken;
  }
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: oauthClientId(),
      client_secret: oauthClientSecret(),
      refresh_token: connection.credentials.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const result = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description || "Unable to refresh Google Drive access");
  const expiresAt = Date.now() + Math.max(60, result.expires_in ?? 3600) * 1000;
  accessTokens.set(connection.tenantId, { token: result.access_token, expiresAt });
  const credentials = encryptCredentials({
    ...connection.credentials,
    accessToken: result.access_token,
    expiresAt,
  });
  await supabaseAdmin().from("tenant_storage_connections")
    .update({ encrypted_credentials: credentials, updated_at: new Date().toISOString() })
    .eq("tenant_id", connection.tenantId);
  return result.access_token;
}

async function driveRequest<T>(connection: DriveConnection, url: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken(connection);
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Drive request failed (${response.status}): ${error.slice(0, 400)}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function ensureFolder(connection: DriveConnection, parentId: string, name: string): Promise<string> {
  const q = `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='smartArchiveTenantId' and value='${connection.tenantId}' } and trashed = false`;
  const query = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "100" });
  const results = await driveRequest<{ files?: DriveFile[] }>(connection, `${DRIVE_API}/files?${query}`);
  if (results.files?.[0]?.id) return results.files[0].id;
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
  return folder.id;
}

export async function saveTenantFile(input: {
  tenantId: string;
  filename: string;
  bytes: Buffer;
  contentType?: string;
  folderSegments?: string[];
}) {
  if (input.bytes.length > MAX_DRIVE_FILE_BYTES) throw new Error("File exceeds the Google Drive upload limit");
  const connection = await getConnection(input.tenantId);
  let parentId = connection.rootFolderId;
  for (const segment of input.folderSegments ?? []) {
    const safeName = segment.normalize("NFKC").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "files";
    parentId = await ensureFolder(connection, parentId, safeName);
  }

  const uploadContentType = input.contentType || "application/octet-stream";
  const metadata = JSON.stringify({
    name: input.filename.normalize("NFKC").replace(/[^\p{L}\p{N}._() -]/gu, "_").slice(0, 180) || "file",
    parents: [parentId],
    appProperties: { smartArchiveTenantId: input.tenantId },
  });
  const token = await getAccessToken(connection);
  const sessionResponse = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name,mimeType,size`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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
  return { objectName: `drive://${uploaded.id}`, url: `/api/sa/storage/files/${encodeURIComponent(uploaded.id)}` };
}

export async function downloadTenantFile(tenantId: string, fileId: string, maxBytes = MAX_DRIVE_FILE_BYTES) {
  if (!/^[A-Za-z0-9_-]{5,256}$/.test(fileId)) throw new Error("Invalid Google Drive file ID");
  const connection = await getConnection(tenantId);
  const token = await getAccessToken(connection);
  const metadata = await driveRequest<{ name?: string; mimeType?: string; size?: string; appProperties?: Record<string, string> }>(
    connection,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=name,mimeType,size,appProperties`,
  );
  if (metadata.appProperties?.smartArchiveTenantId !== tenantId) throw new Error("Google Drive file belongs to a different organization");
  if (Number(metadata.size ?? 0) > maxBytes) throw new Error("File exceeds the allowed download size");
  const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Google Drive download failed (${response.status})`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new Error("File exceeds the allowed download size");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error("File exceeds the allowed download size");
  return {
    bytes,
    filename: metadata.name ?? "file",
    contentType: metadata.mimeType ?? response.headers.get("content-type") ?? "application/octet-stream",
  };
}

export async function deleteTenantFile(tenantId: string, fileId: string) {
  if (!/^[A-Za-z0-9_-]{5,256}$/.test(fileId)) throw new Error("Invalid Google Drive file ID");
  const connection = await getConnection(tenantId);
  const metadata = await driveRequest<{ appProperties?: Record<string, string> }>(
    connection,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=appProperties`,
  );
  if (metadata.appProperties?.smartArchiveTenantId !== tenantId) throw new Error("Google Drive file belongs to a different organization");
  await driveRequest<void>(connection, `${DRIVE_API}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
}

export async function getTenantDriveStatus(tenantId: string) {
  const { data, error } = await supabaseAdmin()
    .from("tenant_storage_connections")
    .select("provider,connected_email,connected_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    connected: data?.provider === "google_drive",
    provider: data?.provider ?? null,
    connectedEmail: data?.connected_email ?? null,
    connectedAt: data?.connected_at ?? null,
  };
}