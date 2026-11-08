// Reading the historical Google Drive files that predate the OAuth connection.
//
// WHY THIS EXISTS
//
// 811 attachments carry `drive://<fileId>` references written by an older code
// path that authenticated with a Google service account. That path is gone. The
// current reader accepts only OAuth credentials, so `decryptRefreshToken`
// rejects the historical connection record before any Drive request is made --
// which is why those downloads fail with 400, and why that failure says
// nothing about whether the files are reachable.
//
// Two things therefore have to change, and only for those historical records:
//
//  1. The credential. The service account key stays in the Replit secret
//     GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON; it is never read or copied here.
//
//  2. How ownership is established. The OAuth reader trusts
//     `appProperties.smartArchiveTenantId`, which the old uploader never wrote.
//     Trusting it would reject every historical file; ignoring ownership would
//     turn this into an arbitrary Drive proxy. So ownership comes from our own
//     database instead: the file id must already be referenced by an
//     attachment in the tenant of the caller. A Drive id nobody references is
//     refused, and that is the property which keeps this from becoming a
//     read-anything endpoint.
//
// This module performs NO database write and creates NO Drive folder. The OAuth
// path is untouched, and there is deliberately no fallback into this reader
// when OAuth fails: a broken or expired OAuth credential must surface as
// itself, not silently escalate to a service account.
//
// Every dependency is injected, so the gates below are tested without a
// credential, a network, or a database.

/** The marker the historical connection record carries instead of OAuth fields. */
export const LEGACY_CREDENTIAL_MODE = "service_account";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{5,256}$/;

export type LegacyDriveFailure =
  | "invalid-id"
  | "not-legacy"
  | "not-configured"
  | "not-referenced"
  | "forbidden"
  | "not-found"
  | "denied"
  | "auth-failed"
  | "too-large"
  | "incomplete"
  | "transient";

/**
 * A refusal, carrying a machine-readable reason.
 *
 * The message is safe to show a user: it never contains credential material, a
 * Drive id, a filename, or a tenant id.
 */
export class LegacyDriveError extends Error {
  readonly code: LegacyDriveFailure;
  constructor(code: LegacyDriveFailure, message: string) {
    super(message);
    this.code = code;
    this.name = "LegacyDriveError";
  }
}

/** One attachment row, reduced to what authorisation and limits need. */
export interface LegacyReference {
  projectId: string;
  /** The size recorded when the file was uploaded, if any. */
  recordedSize: number | null;
}

export interface LegacyDriveDeps {
  /**
   * Looks up `drive://<fileId>` among the attachments of the calling tenant.
   * Must be tenant-scoped by the caller (run it inside runWithTenant) and must
   * never widen that scope. Returns null when this tenant does not reference
   * the id.
   */
  lookupReference(fileId: string): Promise<LegacyReference | null>;
  /** Mints a short-lived read-only Google access token. Never returns the key. */
  getAccessToken(): Promise<string>;
  fetchImpl: typeof fetch;
  /**
   * Optional project or document permission check, applied on top of tenant
   * ownership. When omitted this reader is still strictly narrower than the
   * existing OAuth route, which checks neither the reference nor the project.
   */
  authorizeProject?(projectId: string): Promise<boolean>;
}

/**
 * True only for the historical marker: mode `service_account` and none of the
 * OAuth fields. A record carrying OAuth material is not legacy whatever its
 * mode says, so a half-migrated row can never take this path.
 */
export function isLegacyServiceAccountCredentials(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.mode !== LEGACY_CREDENTIAL_MODE) return false;
  return !record.iv && !record.tag && !record.ciphertext;
}

/** Maps a Drive HTTP status onto a refusal. Fails closed on anything unknown. */
function classifyStatus(status: number): LegacyDriveFailure {
  if (status === 401) return "auth-failed";
  if (status === 403) return "denied";
  if (status === 404) return "not-found";
  return "transient";
}

const MESSAGES: Record<LegacyDriveFailure, string> = {
  "invalid-id": "مرجع ملف Google Drive غير صالح",
  "not-legacy": "هذا السجل لا يستخدم الربط التاريخي",
  "not-configured": "لم يتم إعداد الوصول التاريخي إلى Google Drive",
  "not-referenced": "الملف المطلوب غير مرتبط بأرشيف هذه المؤسسة",
  forbidden: "لا تملك صلاحية الوصول إلى هذا الملف",
  "not-found": "الملف غير موجود أو غير مرئي للحساب الحالي",
  denied: "تم رفض الوصول إلى الملف في Google Drive",
  "auth-failed": "فشل اعتماد الوصول التاريخي إلى Google Drive",
  "too-large": "حجم الملف يتجاوز الحد المسموح للتنزيل",
  incomplete: "تم إرجاع ملف غير مكتمل من Google Drive",
  transient: "خدمة Google Drive غير متاحة حالياً، أعد المحاولة لاحقاً",
};

function refuse(code: LegacyDriveFailure): never {
  throw new LegacyDriveError(code, MESSAGES[code]);
}

/**
 * The authorisation gate, run before anything reaches Google.
 *
 * Order matters: the cheap local checks come first, so a malformed or
 * unreferenced id costs no Drive request at all.
 */
async function authorize(fileId: string, deps: LegacyDriveDeps): Promise<LegacyReference> {
  if (!FILE_ID_PATTERN.test(fileId)) refuse("invalid-id");
  const reference = await deps.lookupReference(fileId);
  if (!reference) refuse("not-referenced");
  if (deps.authorizeProject && !(await deps.authorizeProject(reference.projectId))) {
    refuse("forbidden");
  }
  return reference;
}

async function driveGet(url: string, deps: LegacyDriveDeps): Promise<Response> {
  let token: string;
  try {
    token = await deps.getAccessToken();
  } catch {
    // Never surface the underlying error: it can carry key material.
    refuse("auth-failed");
  }
  if (!token) refuse("auth-failed");
  let response: Response;
  try {
    // One attempt. No retry: a repeated read of customer content on a
    // transient error is exactly what the pilot limits forbid.
    response = await deps.fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    refuse("transient");
  }
  if (!response.ok) refuse(classifyStatus(response.status));
  return response;
}

export interface LegacyDriveMetadata {
  /** Present so a caller can compare against the recorded size. */
  size: number | null;
  recordedSize: number | null;
  sizeMatchesRecord: boolean | null;
  mimeType: string;
  filename: string;
  trashed: boolean;
  canDownload: boolean | null;
}

/**
 * Metadata only. Downloads nothing, so it is safe to run against a historical
 * file without reading customer content.
 */
export async function readLegacyDriveMetadata(
  fileId: string,
  deps: LegacyDriveDeps,
): Promise<LegacyDriveMetadata> {
  const reference = await authorize(fileId, deps);
  const response = await driveGet(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}`
      + "?fields=id,name,mimeType,size,trashed,capabilities(canDownload)"
      + "&supportsAllDrives=true",
    deps,
  );
  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    refuse("transient");
  }
  const rawSize = body.size === undefined || body.size === null ? null : Number(body.size);
  const size = rawSize !== null && Number.isFinite(rawSize) ? rawSize : null;
  const capabilities = body.capabilities as { canDownload?: boolean } | undefined;
  return {
    size,
    recordedSize: reference.recordedSize,
    sizeMatchesRecord:
      size === null || reference.recordedSize === null ? null : size === reference.recordedSize,
    mimeType: typeof body.mimeType === "string" ? body.mimeType : "application/octet-stream",
    filename: typeof body.name === "string" && body.name ? body.name : "file",
    trashed: body.trashed === true,
    canDownload: typeof capabilities?.canDownload === "boolean" ? capabilities.canDownload : null,
  };
}

/**
 * Content read, bounded.
 *
 * The size is checked three times -- against the metadata, against the
 * content-length header, and against what actually arrived -- because the first
 * two are claims and only the third is a fact.
 */
export async function readLegacyDriveContent(
  fileId: string,
  deps: LegacyDriveDeps,
  maxBytes: number,
): Promise<{ bytes: Buffer; filename: string; contentType: string }> {
  const metadata = await readLegacyDriveMetadata(fileId, deps);
  if (metadata.size !== null && metadata.size > maxBytes) refuse("too-large");
  const response = await driveGet(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    deps,
  );
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) refuse("too-large");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) refuse("too-large");
  if (metadata.size !== null && metadata.size > 0 && bytes.length !== metadata.size) {
    refuse("incomplete");
  }
  return { bytes, filename: metadata.filename, contentType: metadata.mimeType };
}
