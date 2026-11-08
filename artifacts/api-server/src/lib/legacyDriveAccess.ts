// Wiring for the historical Drive reader: the three things it needs from the
// outside world, and nothing else.
//
// Kept separate from legacyDriveReader so that module stays free of the
// database and the Google SDK, and its security gates stay testable without
// either. What lives here is deliberately thin:
//
//   - a READ-ONLY look at the connection record, to decide whether this tenant
//     is on the historical marker at all;
//   - a tenant-scoped lookup that answers "does this tenant actually reference
//     that Drive id?";
//   - a short-lived read-only access token minted from the service account.
//
// Note what is NOT here: getConnection. That function upserts the connection
// row and calls ensureFolder on every single call, so using it on a download
// would write to production and could create a Drive folder. This path reads.

import { JWT } from "google-auth-library";
import { supabaseAdmin } from "./supabaseAdmin";
import { runWithTenant } from "./tenantContext";
import {
  isLegacyServiceAccountCredentials,
  LegacyDriveError,
  type LegacyDriveDeps,
  type LegacyReference,
} from "./legacyDriveReader";

/** Read-only Drive scope. Narrowest scope that can read metadata and content. */
const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/**
 * Whether this tenant is still on the historical service-account marker.
 *
 * A plain select: no upsert, no folder creation. Returns false on anything
 * unexpected, so an unreadable record keeps the normal OAuth path rather than
 * silently escalating to the service account.
 */
export async function tenantUsesLegacyDriveConnection(tenantId: string): Promise<boolean> {
  const { data, error } = await runWithTenant(tenantId, () => supabaseAdmin()
    .from("tenant_storage_connections")
    .select("provider,encrypted_credentials")
    .eq("tenant_id", tenantId)
    .maybeSingle());
  if (error || !data) return false;
  if (data.provider !== "google_drive") return false;
  return isLegacyServiceAccountCredentials(data.encrypted_credentials);
}

/**
 * Finds `drive://<fileId>` among this tenant's own attachments.
 *
 * This is the ownership check. The historical files carry none of the
 * appProperties the OAuth reader uses to prove tenancy, so our own reference
 * is the only trustworthy evidence that the caller is entitled to the file.
 *
 * Scoped by runWithTenant, which the supabaseAdmin proxy turns into a
 * tenant_id predicate on the select. A second tenant asking for the same id
 * gets null.
 */
export async function lookupLegacyReference(
  tenantId: string,
  fileId: string,
): Promise<LegacyReference | null> {
  const { data, error } = await runWithTenant(tenantId, () => supabaseAdmin()
    .from("attachments")
    .select("project_id,size")
    .eq("object_path", `drive://${fileId}`)
    .limit(2));
  if (error) throw new LegacyDriveError("transient", "تعذر التحقق من مرجع الملف");
  const rows = (data ?? []) as Array<{ project_id?: unknown; size?: unknown }>;
  // More than one row means the reference does not identify a single
  // attachment; treat that as unproven rather than picking one.
  if (rows.length !== 1) return null;
  const projectId = rows[0]?.project_id;
  if (typeof projectId !== "string" || !projectId) return null;
  const size = Number(rows[0]?.size);
  return { projectId, recordedSize: Number.isFinite(size) && size > 0 ? size : null };
}

/**
 * Mints a short-lived read-only Google token from the service account.
 *
 * The key is read from the environment here and never returned, logged or
 * stored. Failures are deliberately opaque: the caller maps them onto
 * "auth-failed" without the underlying text, which can carry key material.
 */
export async function serviceAccountAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new LegacyDriveError("not-configured", "لم يتم إعداد الوصول التاريخي إلى Google Drive");
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
  } catch {
    throw new LegacyDriveError("not-configured", "إعداد الوصول التاريخي غير صالح");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new LegacyDriveError("not-configured", "إعداد الوصول التاريخي غير مكتمل");
  }
  const jwt = new JWT({
    email: parsed.client_email,
    key: parsed.private_key,
    scopes: [DRIVE_READONLY_SCOPE],
  });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new LegacyDriveError("auth-failed", "فشل اعتماد الوصول التاريخي إلى Google Drive");
  return token;
}

/**
 * Whether the project named by the attachment is one this tenant can see.
 *
 * WHAT THIS DOES AND DOES NOT ENFORCE
 *
 * This application has no per-project permission model. There is no
 * project_members or project_permissions table and no project access helper
 * anywhere in the source; the download routes that already exist
 * (/sa/files/:objectRef for Replit objects, and the OAuth Drive path) gate on
 * exactly three things, enforced by the tenantContext middleware: a
 * signature-verified session, a verified organization_memberships row for that
 * tenant, and tenant-scoped data access. Role is used for admin actions such
 * as delete and invite, never to decide who may read a file.
 *
 * So the honest strongest check available is project-to-tenant consistency:
 * the project referenced by the attachment must itself be visible inside the
 * caller's tenant. That closes a real hole -- an attachment row whose
 * project_id points into another tenant, whether by corruption or by a crafted
 * row, is refused -- without inventing a permission policy this application
 * does not have.
 *
 * Fails closed: an unreadable or missing project denies access.
 */
export async function projectBelongsToTenant(
  tenantId: string,
  projectId: string,
): Promise<boolean> {
  if (!projectId) return false;
  const { data, error } = await runWithTenant(tenantId, () => supabaseAdmin()
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle());
  if (error || !data) return false;
  return true;
}

/**
 * Assembles the reader's dependencies for one tenant.
 *
 * `authorizeProject` defaults to the project-to-tenant check above, so the
 * gate is wired rather than optional. A caller may pass a stricter check; it
 * cannot pass a weaker one by omission.
 */
export function legacyDriveDepsFor(
  tenantId: string,
  authorizeProject?: (projectId: string) => Promise<boolean>,
): LegacyDriveDeps {
  return {
    lookupReference: (fileId) => lookupLegacyReference(tenantId, fileId),
    getAccessToken: serviceAccountAccessToken,
    fetchImpl: fetch,
    authorizeProject: authorizeProject ?? ((projectId) => projectBelongsToTenant(tenantId, projectId)),
  };
}
