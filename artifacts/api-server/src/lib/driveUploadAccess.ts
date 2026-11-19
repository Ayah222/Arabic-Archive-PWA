// Wiring for the verified upload transaction.
//
// Same separation as driveReadAccess: the decision logic in driveUpload.ts
// and storeDocument.ts stays free of the database and the Google SDK so it
// can be tested without either, and this file is the only place that reaches
// the real world.
//
// RECONCILED IN PHASE 18DS. The original on fix/legacy-drive-read also
// exported healthDepsFor, backed by a driveHealth module. That is NOT brought
// forward: the current line already monitors connection health in
// driveMonitor/driveMonitorAccess, and two health implementations would be
// two rules that must never disagree - the exact duplication that caused the
// earlier selection-rule and scope defects.
//
// It also means the provider decision has NO health input at all, which is
// deliberate: a degraded probe must never, on its own, move a tenant's
// storage from Drive to Replit. Only the explicit allowlist decides.

import { createHash } from "node:crypto";
import {
  deleteTenantFile,
  findTenantFileByAppProperty,
  getTenantDriveMetadata,
  saveTenantFile,
} from "./tenantDrive";
import { directDriveUploadEnabled } from "./driveFlags";
import { saveTenantPrivateObject, storageObjectUrl } from "./objectStorage";
import type { UploadDeps } from "./driveUpload";
import type { StoreDeps } from "./storeDocument";

/**
 * The verified institution account every uploaded file must be owned by.
 *
 * A digest rather than the address itself, so the account cannot be read out
 * of the source, a log line or a screenshot. Pinning ONE account is the point:
 * it is what stops a file created under some other Google identity - a
 * personal account picked by mistake at the consent screen, say - from being
 * accepted as institution storage.
 */
export const INSTITUTION_ACCOUNT_DIGEST = "fb086ffd3438";

/**
 * Normalised before digesting. Google returns a canonical lowercase address
 * today, but a stray capital or a trailing space would otherwise produce a
 * different digest and fail every upload for a reason nobody could see.
 */
export const digest12 = (value: string) =>
  createHash("sha256").update(String(value ?? "").trim().toLowerCase()).digest("hex").slice(0, 12);

export function uploadDepsFor(): UploadDeps {
  return {
    isEnabled: (tenantId) => directDriveUploadEnabled(tenantId),
    findByUploadKey: (tenantId, key) =>
      findTenantFileByAppProperty(tenantId, "archhiveUploadKey", key),
    upload: (input) => saveTenantFile(input),
    getMetadata: (tenantId, fileId) => getTenantDriveMetadata(tenantId, fileId),
    remove: (tenantId, fileId) => deleteTenantFile(tenantId, fileId),
    expectedOwnerDigest: INSTITUTION_ACCOUNT_DIGEST,
    digestOf: digest12,
  };
}

/**
 * Dependencies for the one storage decision.
 *
 * saveToObjectStorage is the UNCHANGED Replit call, so the flag-off path is
 * the original behaviour rather than a reimplementation of it.
 */
export function storeDepsFor(): StoreDeps {
  return {
    isEnabled: (tenantId) => directDriveUploadEnabled(tenantId),
    saveToObjectStorage: (input) => saveTenantPrivateObject(input),
    uploadDeps: uploadDepsFor(),
    urlFor: (objectName) => storageObjectUrl(objectName),
  };
}
