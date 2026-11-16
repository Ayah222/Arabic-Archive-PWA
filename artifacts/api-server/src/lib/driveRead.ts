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
  /**
   * Whether the historical service-account reader is usable AT ALL.
   *
   * This is the separation that Phase 18CK exists for. It answers from
   * server configuration - the service-account key - and NOT from the
   * connection row, because connecting OAuth overwrites that row.
   */
  legacyReaderAvailable: () => Promise<boolean>;
}

/**
 * OAuth failures for which the historical reader is worth trying.
 *
 * These all mean "the connected identity cannot serve this", which is
 * exactly the case a migrated file produces:
 *
 *   not-found       drive.file hides files this app did not create
 *   denied/forbidden the connected account is not permitted on the file
 *   auth-failed     the refresh token is expired or revoked
 *   not-configured  the OAuth connection is absent or half-configured
 *
 * Deliberately NOT here: invalid-id, too-large, incomplete, transient and
 * not-referenced. Those describe the request, the file or the network, and
 * retrying under another identity would fail identically while hiding the
 * real cause.
 *
 * A revoked token therefore does not take historical documents down with
 * it. The connection still reports unhealthy through diagnostics and
 * monitoring - the fault stays visible, only the outage does not spread.
 */
const LEGACY_RESCUE_FAILURES: ReadonlySet<LegacyDriveFailure> = new Set([
  "not-found",
  "denied",
  "forbidden",
  "auth-failed",
  "not-configured",
]);

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
  // Phase 18BO finding 1. The Word-specific message contains "Google Drive",
  // so it must be classified BEFORE the generic rule below - otherwise one
  // corrupt .docx is reported as a broken Drive connection.
  if (/Word/i.test(message) || /ورد/.test(message)) return "incomplete";
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
      const failure = error instanceof LegacyDriveError
        ? error.code
        : classifyOAuthError(error);
      // THE HISTORICAL SAFETY NET.
      //
      // The connected OAuth client is a different Google app from the one
      // that uploaded the migrated files, and drive.file only ever shows an
      // app the files it created or opened. So the connected identity
      // reporting "I cannot see this file" is the EXPECTED answer for a
      // historical file, not evidence that the file is gone.
      //
      // Falling back changes nothing about who may read what. The legacy
      // reader keeps both of its own gates - the id must be referenced by
      // an attachment row belonging to this tenant, and that row's project
      // must belong to this tenant - so this can only ever reach a file the
      // tenant already references. It cannot reach an arbitrary Drive file.
      if (LEGACY_RESCUE_FAILURES.has(failure) && await deps.legacyReaderAvailable()) {
        try {
          return await deps.readLegacy(fileId, maxBytes);
        } catch {
          // The rescue did not help. Report the CONNECTED provider's
          // failure, because that is the operative one: the fallback is a
          // best-effort rescue, not the configured path.
        }
      }
      if (error instanceof LegacyDriveError) throw error;
      throw new LegacyDriveError(failure, describe(error));
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
