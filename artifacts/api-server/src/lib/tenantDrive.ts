import { createSign } from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";
import { FILE_LIMITS } from "./fileLimits";
import { logger } from "./logger";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const MAX_DRIVE_FILE_BYTES = FILE_LIMITS.maxFileBytes;
const SERVICE_ACCOUNT_SCOPE = "https://www.googleapis.com/auth/drive";
const SERVICE_ACCOUNT_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SERVICE_ACCOUNT_SETUP_MESSAGE = "إعداد حساب خدمة Google Drive غير مكتمل. يرجى التحقق من أسرار الخادم ومجلد الأرشيف المشترك.";

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

interface ServiceAccountCredentials {
  type?: string;
  client_email: string;
  private_key: string;
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
      storageQuotaExceeded: "رفض Google Drive حفظ الملف بسبب سعة التخزين. حساب الخدمة لا يملك مساحة My Drive خاصة؛ استخدم Shared Drive وأضف حساب الخدمة إليه بصلاحية Contributor أو أعلى.",
      insufficientFilePermissions: "رفض Google Drive حفظ الملف بسبب الصلاحيات. امنح حساب الخدمة صلاحية Contributor أو أعلى على مجلد الأرشيف المشترك.",
      teamDriveMembershipRequired: "يجب إضافة حساب الخدمة كعضو في Shared Drive الذي يحتوي على مجلد الأرشيف.",
    };
    const publicMessage = messages[reason]
      || "رفض Google Drive إكمال رفع الملف. تحقق من صلاحية حساب الخدمة على مجلد الأرشيف المشترك.";
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

let parsedServiceAccount: ServiceAccountCredentials | null = null;
let cachedServiceToken: { token: string; expiresAt: number } | null = null;
let serviceTokenRefresh: Promise<string> | null = null;

function getServiceAccountCredentials(): ServiceAccountCredentials {
  if (parsedServiceAccount) return parsedServiceAccount;
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error(SERVICE_ACCOUNT_SETUP_MESSAGE);
  try {
    let decoded: unknown = raw;
    for (let attempt = 0; attempt < 3 && typeof decoded === "string"; attempt++) {
      const text = decoded.trim().replace(/^\uFEFF/, "");
      if (!text) throw new Error("Empty service account key");
      const withoutFence = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
      decoded = JSON.parse(withoutFence);
    }
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      throw new Error("Invalid service account key");
    }
    const credentials = decoded as Partial<ServiceAccountCredentials>;
    if (
      (credentials.type !== undefined && credentials.type !== "service_account")
      || typeof credentials.client_email !== "string"
      || typeof credentials.private_key !== "string"
    ) throw new Error("Invalid service account key");
    parsedServiceAccount = {
      client_email: credentials.client_email,
      private_key: credentials.private_key.replace(/\\n/g, "\n"),
    };
    return parsedServiceAccount;
  } catch {
    throw new Error(SERVICE_ACCOUNT_SETUP_MESSAGE);
  }
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

function serviceAccountEmail() {
  return getServiceAccountCredentials().client_email.trim().toLowerCase();
}

function sharedRootFolderId() {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  if (!id || !/^[A-Za-z0-9_-]{5,256}$/.test(id)) throw new Error(SERVICE_ACCOUNT_SETUP_MESSAGE);
  return id;
}

export function parseTenantDriveObjectPath(value: string | null | undefined) {
  if (typeof value !== "string" || !value.startsWith("drive://")) return null;
  const fileId = value.slice("drive://".length);
  return /^[A-Za-z0-9_-]{5,256}$/.test(fileId) ? fileId : null;
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  const credentials = getServiceAccountCredentials();
  if (!forceRefresh && cachedServiceToken && cachedServiceToken.expiresAt > Date.now() + 60_000) {
    return cachedServiceToken.token;
  }
  if (serviceTokenRefresh) return serviceTokenRefresh;

  const refresh = (async () => {
    const now = Math.floor(Date.now() / 1000);
    const jwtHeader = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const jwtClaims = Buffer.from(JSON.stringify({
      iss: credentials.client_email,
      scope: SERVICE_ACCOUNT_SCOPE,
      aud: SERVICE_ACCOUNT_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })).toString("base64url");
    const unsignedToken = `${jwtHeader}.${jwtClaims}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsignedToken);
    signer.end();
    const assertion = `${unsignedToken}.${signer.sign(credentials.private_key).toString("base64url")}`;
    let response: Response;
    try {
      response = await fetch(SERVICE_ACCOUNT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      });
    } catch {
      throw new Error("تعذر الاتصال بخدمة Google للتحقق من حساب الخدمة.");
    }
    const result = await readJsonResponse<{ access_token?: string; expires_in?: number }>(
      response,
      "أعادت خدمة Google استجابة غير صالحة لحساب الخدمة؛ تحقق من إعدادات الخادم وحاول مجدداً.",
    );
    if (!response.ok || !result.access_token) {
      cachedServiceToken = null;
      throw new Error("تعذر الحصول على رمز وصول لحساب خدمة Google Drive. تحقق من المفتاح وصلاحية حساب الخدمة.");
    }
    const expiresAt = Date.now() + Math.max(60, result.expires_in ?? 3600) * 1000;
    cachedServiceToken = { token: result.access_token, expiresAt };
    return result.access_token;
  })();
  serviceTokenRefresh = refresh;
  try {
    return await refresh;
  } finally {
    if (serviceTokenRefresh === refresh) serviceTokenRefresh = null;
  }
}

async function getConnection(tenantId: string): Promise<DriveConnection> {
  getServiceAccountCredentials();
  const sharedRootId = sharedRootFolderId();
  const { data, error } = await supabaseAdmin()
    .from("tenant_storage_connections")
    .select("tenant_id,provider,root_folder_id,connected_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error("تعذر قراءة إعداد تخزين المؤسسة");

  // Keep every tenant's active upload root beneath the configured shared archive folder.
  // Existing file IDs remain unchanged and are still resolved directly by ID.
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
      encrypted_credentials: { mode: "service_account" },
      root_folder_id: rootFolderId,
      connected_email: null,
      connected_at: data?.connected_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" });
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
  const token = await getAccessToken();
  let response = await send(token);
  if (response.status !== 401) return response;

  await response.body?.cancel().catch(() => undefined);
  if (cachedServiceToken?.token === token) cachedServiceToken = null;
  response = await send(await getAccessToken(true));
  if (response.status === 401) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("حساب خدمة Google Drive غير مخول للوصول إلى مجلد الأرشيف المشترك.");
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
    .select("tenant_id,provider,connected_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  let connectedEmail: string | null = null;
  let configured = false;
  try {
    connectedEmail = serviceAccountEmail();
    sharedRootFolderId();
    configured = true;
  } catch {
    // Report a missing server-side setup without exposing credential details to the browser.
  }
  return {
    connected: configured,
    configured,
    provider: configured ? "google_drive" : null,
    connectedEmail,
    connectedAt: data?.connected_at ?? null,
    sharedAccount: false,
    accountVerified: configured,
  };
}