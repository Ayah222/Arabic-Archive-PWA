// The verified direct-to-Drive upload transaction.
//
// WHAT THIS GUARANTEES, and why each one needed its own step
//   the institution owns the file   the upload runs as the institution OAuth
//                                   user, never as the service account, which
//                                   on a consumer My Drive would OWN what it
//                                   creates and take ownership away from the
//                                   institution
//   the bytes in Drive are the bytes we sent
//                                   size AND sha256Checksum are read back from
//                                   Drive and compared before anything is
//                                   recorded. Google computes that checksum
//                                   itself, so it is independent evidence.
//   no false success                a database row is written only after the
//                                   read-back agrees. The caller receives a
//                                   reference it can resolve, or an error.
//   a retry does not duplicate      every upload carries a deterministic key
//                                   in appProperties; a retry finds its own
//                                   earlier file and returns it unchanged
//   no silent fallback              a Drive failure throws. There is no path
//                                   from here into Replit Object Storage.
//
// This module is PURE: every effect is injected. It can therefore be tested
// end to end - including the failure branches that matter most - without a
// credential, a network, or a Drive.

import { createHash } from "node:crypto";

export class DriveUploadError extends Error {
  readonly code: DriveUploadFailure;
  /** Evidence a human or a sweep can act on. Never contains file bytes. */
  readonly evidence: Record<string, unknown>;
  constructor(code: DriveUploadFailure, message: string, evidence: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.name = "DriveUploadError";
    this.evidence = evidence;
  }
}

export type DriveUploadFailure =
  | "not-enabled"
  | "invalid-input"
  | "not-configured"
  | "auth-revoked"
  | "denied"
  | "rate-limited"
  | "transient"
  | "verification-failed"
  | "orphan-left";

/** The app-private key under which the idempotency token is stamped. */
export const UPLOAD_KEY_PROPERTY = "archhiveUploadKey";
/** Marks how an object came to exist, so native and migrated never blur. */
export const ORIGIN_PROPERTY = "archhiveOrigin";
export const ORIGIN_NATIVE = "native";

export interface UploadRequest {
  tenantId: string;
  projectId: string;
  /** Human-facing project label, used only to name the folder. */
  projectLabel: string;
  /** Document category, e.g. "01 Contracts". Becomes a subfolder. */
  category: string;
  filename: string;
  bytes: Buffer;
  contentType: string;
  /**
   * An explicit folder chain, from the shared namespace mapper. When
   * absent the project layout is derived from projectId/label/category,
   * which is what the attachments path has always done.
   */
  folderSegments?: string[];
}

export interface UploadDeps {
  /** True only for tenants the owner has explicitly approved. */
  isEnabled: (tenantId: string) => boolean;
  /** Looks for an earlier upload carrying this idempotency key. */
  findByUploadKey: (tenantId: string, key: string) => Promise<DriveObject | null>;
  /** Performs the actual upload. Must create the file owned by the institution. */
  upload: (input: {
    tenantId: string;
    filename: string;
    bytes: Buffer;
    contentType: string;
    folderSegments: string[];
    appProperties: Record<string, string>;
  }) => Promise<{ objectName: string }>;
  /** Reads back what Drive actually stored. */
  getMetadata: (tenantId: string, fileId: string) => Promise<DriveObject>;
  /** Removes a file this transaction created and could not verify. */
  remove: (tenantId: string, fileId: string) => Promise<void>;
  /** The institution account digest every file must be owned by. */
  expectedOwnerDigest: string;
  digestOf: (value: string) => string;
}

export interface DriveObject {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string | number;
  sha256Checksum?: string;
  trashed?: boolean;
  owners?: Array<{ emailAddress?: string }>;
  appProperties?: Record<string, string>;
}

export interface UploadResult {
  objectPath: string;
  fileId: string;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  folderSegments: string[];
  reused: boolean;
}

// A separator that cannot occur in a tenant id, project id, category or
// filename, written as an escape rather than a literal control character:
// a raw NUL in source makes the file binary to git and unreviewable.
const SEPARATOR = String.fromCharCode(31);  // ASCII unit separator
const MAX_SEGMENT = 120;
const MAX_FILENAME = 180;

/**
 * The folder path a document belongs in.
 *
 * Institution -> 01 Projects -> <project> -> <category>. The project folder
 * carries the project id, so renaming the project in ArchHive never has to
 * rename or find a folder - the id is what makes it unambiguous and the
 * label is decoration.
 */
export function folderSegmentsFor(input: { projectId: string; projectLabel: string; category: string }) {
  const label = sanitiseSegment(input.projectLabel) || "project";
  const shortId = String(input.projectId).slice(0, 8);
  return ["01 Projects", `${label} (${shortId})`, sanitiseSegment(input.category) || "99 Other"];
}

function sanitiseSegment(value: string) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N}._ ()-]/gu, "_")
    .trim()
    .slice(0, MAX_SEGMENT);
}

/**
 * The idempotency key for one upload attempt.
 *
 * Deterministic in the content AND the destination, so the same file sent
 * twice to the same place is one upload, while the same file deliberately
 * filed under two categories stays two documents. Truncated to fit Drive's
 * 124-byte combined key+value property limit.
 */
export function uploadKeyFor(input: {
  tenantId: string; projectId: string; category: string; filename: string; bytes: Buffer;
}) {
  const content = createHash("sha256").update(input.bytes).digest("hex");
  return createHash("sha256")
    .update([input.tenantId, input.projectId, input.category, input.filename, content].join(SEPARATOR))
    .digest("hex")
    .slice(0, 40);
}

/** Drive permits duplicate names; humans do not cope with them. */
export function disambiguate(filename: string, uploadKey: string, collides: boolean) {
  const safe = String(filename).normalize("NFKC").trim().slice(0, MAX_FILENAME);
  if (!collides) return safe;
  const dot = safe.lastIndexOf(".");
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : "";
  return `${stem} (${uploadKey.slice(0, 6)})${ext}`;
}

function classify(error: unknown): DriveUploadFailure {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/invalid_grant/i.test(message)) return "auth-revoked";
  if (/انتهت صلاحية ربط|يلزم ربط/.test(message)) return "auth-revoked";
  if (/\(401\)/.test(message)) return "auth-revoked";
  if (/\(403\)/.test(message) || /AccessDenied/i.test(message)) return "denied";
  if (/\(429\)/.test(message) || /rateLimit|userRateLimit|quota/i.test(message)) return "rate-limited";
  if (/\(5\d\d\)/.test(message)) return "transient";
  if (/إعداد Google Drive غير مكتمل|تم إيقاف الرفع/.test(message)) return "not-configured";
  return "transient";
}

/**
 * Uploads one document and proves it arrived before saying so.
 *
 * The order is the contract: enabled, validated, deduplicated, uploaded,
 * VERIFIED, and only then returned. A caller that writes its database row on
 * the returned value cannot record a file that is not really there.
 */
export async function uploadDocumentToDrive(
  request: UploadRequest,
  deps: UploadDeps,
): Promise<UploadResult> {
  // 1. the flag. Off is the default, and off means this tenant is untouched.
  if (!deps.isEnabled(request.tenantId)) {
    throw new DriveUploadError("not-enabled", "التخزين المباشر في Google Drive غير مفعّل لهذه المؤسسة");
  }
  // 2. input, before anything leaves the process
  for (const [field, value] of [["tenantId", request.tenantId], ["projectId", request.projectId],
    ["filename", request.filename], ["category", request.category]] as const) {
    if (typeof value !== "string" || !value.trim()) {
      throw new DriveUploadError("invalid-input", "بيانات الرفع غير مكتملة", { field });
    }
  }
  if (!Buffer.isBuffer(request.bytes) || request.bytes.length === 0) {
    throw new DriveUploadError("invalid-input", "الملف المحدد فارغ");
  }

  const sha256 = createHash("sha256").update(request.bytes).digest("hex");
  const uploadKey = uploadKeyFor(request);
  const folderSegments = request.folderSegments ?? folderSegmentsFor(request);

  // 3. idempotency. A retry must find its own earlier file, not make another.
  let existing: DriveObject | null = null;
  try {
    existing = await deps.findByUploadKey(request.tenantId, uploadKey);
  } catch (error) {
    // A failed lookup must not become a duplicate upload.
    throw new DriveUploadError(classify(error), "تعذر التحقق من حالة الرفع السابقة", { uploadKey });
  }
  if (existing?.id) {
    const verified = verify(existing, { sha256, size: request.bytes.length, deps });
    if (verified.ok) {
      return result(existing.id, existing, request, folderSegments, sha256, true);
    }
    // An earlier attempt left something that does not match. Do NOT overwrite
    // and do NOT silently upload beside it - that is how duplicates breed.
    throw new DriveUploadError("verification-failed",
      "يوجد ملف سابق بنفس المعرّف لا يطابق المحتوى الحالي", {
        uploadKey, fileId: existing.id, reason: verified.reason,
      });
  }

  // 4. upload, as the institution
  let objectName: string;
  try {
    const saved = await deps.upload({
      tenantId: request.tenantId,
      filename: disambiguate(request.filename, uploadKey, false),
      bytes: request.bytes,
      contentType: request.contentType || "application/octet-stream",
      folderSegments,
      appProperties: {
        [UPLOAD_KEY_PROPERTY]: uploadKey,
        [ORIGIN_PROPERTY]: ORIGIN_NATIVE,
        archhiveProjectId: String(request.projectId).slice(0, 40),
      },
    });
    objectName = saved.objectName;
  } catch (error) {
    throw new DriveUploadError(classify(error),
      error instanceof Error ? error.message : "فشل رفع الملف إلى Google Drive", { uploadKey });
  }

  const fileId = objectName.startsWith("drive://") ? objectName.slice("drive://".length) : "";
  if (!fileId) {
    throw new DriveUploadError("verification-failed", "لم تُرجع Google Drive معرّف ملف صالحاً", { uploadKey });
  }

  // 5. VERIFY before recording. This is the step that makes success honest.
  let stored: DriveObject;
  try {
    stored = await deps.getMetadata(request.tenantId, fileId);
  } catch (error) {
    throw new DriveUploadError(classify(error),
      "تم الرفع ولكن تعذّر التحقق منه", { uploadKey, fileId, orphan: true });
  }
  const verdict = verify(stored, { sha256, size: request.bytes.length, deps });
  if (!verdict.ok) {
    // Remove what we created rather than leave an unverifiable file behind.
    try {
      await deps.remove(request.tenantId, fileId);
    } catch {
      throw new DriveUploadError("orphan-left",
        "فشل التحقق من الرفع وتعذّر حذف الملف غير المؤكد", {
          uploadKey, fileId, reason: verdict.reason, orphan: true,
        });
    }
    throw new DriveUploadError("verification-failed",
      "لم يطابق الملف المخزّن المحتوى المرسل", { uploadKey, fileId, reason: verdict.reason });
  }

  return result(fileId, stored, request, folderSegments, sha256, false);
}

function verify(
  stored: DriveObject,
  ctx: { sha256: string; size: number; deps: UploadDeps },
): { ok: boolean; reason?: string } {
  if (stored.trashed) return { ok: false, reason: "trashed" };
  if (Number(stored.size ?? -1) !== ctx.size) return { ok: false, reason: "size" };
  // Google computes this itself, which is what makes it evidence rather than
  // an echo of what we claimed.
  if (!stored.sha256Checksum) return { ok: false, reason: "no-checksum" };
  if (String(stored.sha256Checksum).toLowerCase() !== ctx.sha256) {
    return { ok: false, reason: "checksum" };
  }
  const owner = ctx.deps.digestOf(stored.owners?.[0]?.emailAddress ?? "");
  if (owner !== ctx.deps.expectedOwnerDigest) return { ok: false, reason: "owner" };
  return { ok: true };
}

function result(
  fileId: string, stored: DriveObject, request: UploadRequest,
  folderSegments: string[], sha256: string, reused: boolean,
): UploadResult {
  return {
    objectPath: `drive://${fileId}`,
    fileId,
    filename: stored.name ?? request.filename,
    contentType: stored.mimeType ?? request.contentType,
    size: Number(stored.size ?? request.bytes.length),
    sha256,
    folderSegments,
    reused,
  };
}
