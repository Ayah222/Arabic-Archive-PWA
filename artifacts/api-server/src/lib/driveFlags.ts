// Which tenants may write to Google Drive directly.
//
// DELIBERATELY AN ENVIRONMENT VARIABLE, NOT A DATABASE COLUMN. A column would
// need a production migration before anything could be tested, and the flag
// has to exist before the first synthetic upload. An environment variable is
// also the fastest possible rollback: clear it and every tenant is back on
// Replit Object Storage on the next request, with no deploy and no migration.
//
//   DRIVE_DIRECT_UPLOAD_TENANTS=<tenant-id>[,<tenant-id>...]
//
// Absent or empty means OFF FOR EVERYONE, which is the default and the safe
// direction. "*" is deliberately NOT supported: switching every tenant at
// once is exactly what the owner asked not to be possible.

const SEPARATOR = /[\s,]+/;

export function directDriveUploadTenants(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.DRIVE_DIRECT_UPLOAD_TENANTS;
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(SEPARATOR)
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== "*");
}

/** True only for a tenant the owner listed explicitly. */
export function directDriveUploadEnabled(
  tenantId: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (typeof tenantId !== "string" || !tenantId.trim()) return false;
  return directDriveUploadTenants(env).includes(tenantId.trim());
}

/** What to show an administrator, without revealing other tenants' ids. */
export function directDriveUploadSummary(
  tenantId: string,
  env: NodeJS.ProcessEnv = process.env,
): { enabled: boolean; configured: number } {
  const list = directDriveUploadTenants(env);
  return { enabled: directDriveUploadEnabled(tenantId, env), configured: list.length };
}
