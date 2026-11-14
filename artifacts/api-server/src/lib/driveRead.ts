// ONE provider-aware Drive read path, shared by every route.
//
// WHY THIS EXISTS
// downloadTenantFile() was called from nine places. Exactly one of them -
// tenantStorage.ts - first asked whether the tenant is on the historical
// service-account marker. The other eight went straight into the OAuth
// reader, which begins by decrypting a refresh token. For a tenant whose
// connection record is {mode:"service_account"} there is no refresh token to
// decrypt, so those eight paths rejected the request before it ever reached
// Google. That is the 400 that attachment previews, downloads, AI ingest,
// the email archive, HR files, HR candidates and upload read-back have been
// returning for every one of the 811 historical drive:// references.
//
// The fix is not eight copies of the branch. Two copies of one rule is what
// produced Phase 18BC and Phase 18BI; eight would be worse. Every route calls
// readTenantDriveFile(), the provider is resolved once, from trusted server
// configuration, and the legacy and OAuth readers are reached only through it.
//
// WHAT THIS MODULE DELIBERATELY DOES NOT DO
// It adds no authorisation of its own and removes none. Each route keeps the
// guard it already had, and each underlying reader keeps its own gate:
//   legacy  the file id must be referenced by an attachment row belonging to
//           this tenant, and that row's project must belong to this tenant
//   oauth   the Drive file must carry appProperties.smartArchiveTenantId
//           equal to this tenant
// Both are tenant-bound, so neither accepts a bare id from the client. A
// refactor that also moved authorisation would be two changes wearing one
// diff, and this one is urgent.
//
// This module performs no write of any kind and never touches Replit Object
// Storage, which is unchanged on every route.

import { LegacyDriveError, type LegacyDriveFailure } from "./legacyDriveReader";

/** What a Drive read returns, identical for both providers. */
export interface TenantDriveFile {
  bytes: Buffer;
  filename: string;
  contentType: string;
}

/**
 * Which reader serves this tenant.
 *
 * "legacy-service-account"  the connection carries the historical marker
 * "oauth"                   the connection carries a real encrypted token
 * null                      no usable connection - refuse, never guess
 */
export type DriveProvider = "legacy-service-account" | "oauth";

export interface DriveReadDeps {
  /** Resolved from the tenant's own connection record. Never from a request. */
  resolveProvider: () => Promise<DriveProvider | null>;
  readLegacy: (fileId: string, maxBytes: number) => Promise<TenantDriveFile>;
  readOAuth: (fileId: string, maxBytes: number) => Promise<TenantDriveFile>;
}

/** The id shape Drive itself uses. Rejected before any provider work. */
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{5,256}$/;

/**
 * Maps whatever the OAuth reader threw onto a typed failure.
 *
 * downloadTenantFile throws plain Errors with Arabic messages, so the only
 * signal available is the text. Anything unrecognised becomes "transient",
 * which is the fail-closed direction: the caller retries later rather than
 * being told the file does not exist.
 */
export function classifyOAuthError(error: unknown): LegacyDriveFailure {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/different organization/i.test(message)) return "forbidden";
  if (/Invalid Google Drive file ID/i.test(message)) return "invalid-id";
  if (/allowed download size/i.test(message)) return "too-large";
  if (/incomplete file/i.test(message)) return "incomplete";
  if (/\(404\)/.test(message)) return "not-found";
  if (/\(401\)/.test(message)) return "auth-failed";
  if (/\(403\)/.test(message)) return "denied";
  if (/\(429\)/.test(message) || /\(5\d\d\)/.test(message)) return "transient";
  // "يلزم ربط Google Drive" and "انتهت صلاحية ربط Google Drive" both land here:
  // the connection is unusable, which is not the caller's fault.
  if (/Google Drive/i.test(message)) return "not-configured";
  return "transient";
}

/**
 * Reads one Drive file for one tenant, through whichever provider that
 * tenant is actually on.
 *
 * Order matters. The id is validated before the connection is consulted, and
 * the provider is resolved before either reader is constructed, so a legacy
 * tenant never reaches the OAuth reader and therefore never reaches
 * decryptRefreshToken.
 */
export async function readTenantDriveFile(
  fileId: string,
  deps: DriveReadDeps,
  maxBytes: number,
): Promise<TenantDriveFile> {
  if (typeof fileId !== "string" || !FILE_ID_PATTERN.test(fileId)) {
    throw new LegacyDriveError("invalid-id", "مرجع ملف Google Drive غير صالح");
  }
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new LegacyDriveError("too-large", "حجم الملف يتجاوز الحد المسموح للتنزيل");
  }

  const provider = await deps.resolveProvider();
  if (provider === "legacy-service-account") {
    // The legacy reader throws LegacyDriveError already; let it through
    // untouched so routes keep their existing status mapping.
    return deps.readLegacy(fileId, maxBytes);
  }
  if (provider === "oauth") {
    try {
      return await deps.readOAuth(fileId, maxBytes);
    } catch (error) {
      if (error instanceof LegacyDriveError) throw error;
      throw new LegacyDriveError(classifyOAuthError(error), describe(error));
    }
  }
  // No connection, an unreadable record, or a provider we do not recognise.
  // Refusing here is what keeps an unknown record from silently escalating
  // to either reader.
  throw new LegacyDriveError(
    "not-configured",
    "إعداد Google Drive غير مكتمل. تحقق من ربط حساب المكتب ومجلد الأرشيف.",
  );
}

/** The user-facing text, never the underlying one, which can carry detail. */
function describe(error: unknown): string {
  const code = classifyOAuthError(error);
  const messages: Record<LegacyDriveFailure, string> = {
    "invalid-id": "مرجع ملف Google Drive غير صالح",
    "not-legacy": "هذا السجل لا يستخدم الربط التاريخي",
    "not-configured": "إعداد Google Drive غير مكتمل. تحقق من ربط حساب المكتب ومجلد الأرشيف.",
    "not-referenced": "الملف المطلوب غير مرتبط بأرشيف هذه المؤسسة",
    forbidden: "لا تملك صلاحية الوصول إلى هذا الملف",
    "not-found": "الملف غير موجود أو غير مرئي للحساب الحالي",
    denied: "تم رفض الوصول إلى الملف في Google Drive",
    "auth-failed": "فشل اعتماد الوصول إلى Google Drive",
    "too-large": "حجم الملف يتجاوز الحد المسموح للتنزيل",
    incomplete: "تم إرجاع ملف غير مكتمل من Google Drive",
    transient: "خدمة Google Drive غير متاحة حالياً، أعد المحاولة لاحقاً",
  };
  return messages[code];
}

/**
 * The HTTP status for a Drive refusal.
 *
 * Lifted verbatim from tenantStorage.ts so all nine routes answer alike.
 */
export function driveReadStatus(code: LegacyDriveFailure): number {
  switch (code) {
    case "not-referenced":
    case "not-found":
      return 404;
    case "forbidden":
      return 403;
    case "invalid-id":
      return 400;
    case "too-large":
      return 413;
    default:
      // not-configured, auth-failed, denied, incomplete, transient, not-legacy
      // are all "the archive cannot serve this right now", not "your request
      // was wrong".
      return 503;
  }
}
