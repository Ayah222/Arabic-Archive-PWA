// Validation for a client-supplied storage reference.
//
// THE HOLE THIS CLOSES
// POST /sa/projects/:id/attachments accepts a `storagePath` body field when
// no file is attached, and stores it as
//   supabase://<bucket>/<whatever the client sent>
// with no validation at all. Downloads later hand that string straight to
//   supabaseAdmin().storage.from(BUCKET).download(path)
// which runs with the SERVICE-ROLE key. So any authenticated user could
// register a path pointing anywhere in that bucket - including another
// tenant's objects - and then read it through the ordinary attachment
// download route. The attachment row is tenant-scoped, which hides the
// problem: the attacker owns the row, so every downstream tenant check
// passes. The path inside it was never checked at all.
//
// WHAT IS NOT CHANGED
// Writing to Supabase is already impossible - uploadSupabaseObject is a stub
// that always throws - and existing rows are untouched. This only constrains
// what a NEW reference may name.

export class StorageReferenceError extends Error {
  readonly code: "invalid-path" | "outside-project" | "provider-mismatch";
  constructor(code: StorageReferenceError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "StorageReferenceError";
  }
}

/**
 * Characters a storage key may contain. Deliberately narrow: letters,
 * marks, digits, and the few separators real filenames need. A path
 * segment may not be empty, "." or "..".
 */
const SEGMENT = /^[\p{L}\p{M}\p{N}._ ()-]{1,120}$/u;

export function isSafeStorageKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const path = value.trim();
  if (!path || path.length > 1024) return false;
  if (path.startsWith("/") || path.includes("\\")) return false;
  if (path.includes("//") || path.includes("\0")) return false;
  const segments = path.split("/");
  if (segments.length > 24) return false;
  return segments.every((segment) => segment !== "." && segment !== ".." && SEGMENT.test(segment));
}

/**
 * Accepts a client-supplied reference only when it names a location inside
 * THIS project's own attachment prefix.
 *
 * The prefix is the same one the server itself writes:
 *   attachments/<projectId>/<entityType>/...
 * so a legitimate client registering a file it placed where the server would
 * have placed it still works, and nothing else does.
 */
export function assertClientStoragePath(input: {
  storagePath: unknown;
  projectId: string;
  entityType: string;
  /** True when this tenant's authoritative storage is Google Drive. */
  driveEnabled: boolean;
}): string {
  if (input.driveEnabled) {
    // With Drive as the authoritative provider, accepting a reference to
    // some other storage would quietly create a document that does not live
    // where the institution believes its documents live.
    throw new StorageReferenceError(
      "provider-mismatch",
      "لا يمكن تسجيل مرجع تخزين خارجي بينما التخزين المعتمد هو Google Drive",
    );
  }
  if (!isSafeStorageKey(input.storagePath)) {
    throw new StorageReferenceError("invalid-path", "مسار التخزين المحدد غير صالح");
  }
  const path = String(input.storagePath).trim();
  const expectedPrefix = `attachments/${input.projectId}/${input.entityType}/`;
  if (!path.startsWith(expectedPrefix)) {
    throw new StorageReferenceError(
      "outside-project",
      "مسار التخزين لا يخص هذا المشروع",
    );
  }
  return path;
}

/** HTTP status for a rejected reference. */
export function storageReferenceStatus(code: StorageReferenceError["code"]): number {
  return code === "provider-mismatch" ? 409 : 400;
}
