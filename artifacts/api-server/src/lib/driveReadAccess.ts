// Wiring for the provider-aware Drive read path.
//
// Kept separate from driveRead.ts for the same reason legacyDriveAccess is
// kept separate from legacyDriveReader: the decision logic stays free of the
// database and the Google SDK, so it can be tested without either. This file
// is the only place that knows how to reach the real world.

import { downloadTenantFile } from "./tenantDrive";
import { readLegacyDriveContent } from "./legacyDriveReader";
import { legacyDriveDepsFor, tenantUsesLegacyDriveConnection } from "./legacyDriveAccess";
import type { DriveProvider, DriveReadDeps } from "./driveRead";

/**
 * Resolves the provider from the tenant's own connection record.
 *
 * tenantUsesLegacyDriveConnection performs a plain SELECT - no upsert, no
 * folder creation - and returns false on anything unexpected, so an
 * unreadable record takes the OAuth path rather than silently escalating to
 * the service account. That is the existing, deliberate behaviour and it is
 * preserved exactly.
 */
export async function resolveDriveProvider(tenantId: string): Promise<DriveProvider | null> {
  if (!tenantId) return null;
  return (await tenantUsesLegacyDriveConnection(tenantId)) ? "legacy-service-account" : "oauth";
}

/**
 * Assembles the read dependencies for one tenant.
 *
 * Both readers are bound to THIS tenant id. Neither can be pointed at
 * another tenant by anything a request carries.
 */
export function driveReadDepsFor(tenantId: string): DriveReadDeps {
  return {
    resolveProvider: () => resolveDriveProvider(tenantId),
    readLegacy: (fileId, maxBytes) =>
      readLegacyDriveContent(fileId, legacyDriveDepsFor(tenantId), maxBytes),
    readOAuth: (fileId, maxBytes) => downloadTenantFile(tenantId, fileId, maxBytes),
  };
}
