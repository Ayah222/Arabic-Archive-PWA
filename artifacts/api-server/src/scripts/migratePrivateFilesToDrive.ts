import path from "node:path";
import { runWithTenant } from "../lib/tenantContext";
import { downloadPrivateObject, getPrivateObjectMetadata, privateObjectLocation } from "../lib/objectStorage";
import { downloadTenantFile, GoogleDriveAccessDeniedError, parseTenantDriveObjectPath, saveTenantFile } from "../lib/tenantDrive";
import { supabaseAdmin } from "../lib/supabaseAdmin";

type MigrationRow = {
  id: string;
  tenant_id: string;
  object_path?: string | null;
  attachment_path?: string | null;
  name?: string | null;
  mime_type?: string | null;
  project_id?: string | null;
  entity_type?: string | null;
};

function isPrivatePath(value: unknown, tenantId: string) {
  if (typeof value !== "string") return false;
  const { objectName: prefix } = privateObjectLocation();
  const root = `${prefix ? `${prefix}/` : ""}tenants/${tenantId}/`;
  return value.startsWith(root);
}

async function migrateObject(tenantId: string, objectPath: string, displayName?: string | null, mimeType?: string | null) {
  const metadata = await getPrivateObjectMetadata(objectPath);
  const bytes = await downloadPrivateObject(objectPath);
  const originalName = String(metadata.metadata?.originalName || displayName || path.basename(objectPath));
  const { objectName: prefix } = privateObjectLocation();
  const tenantRoot = `${prefix ? `${prefix}/` : ""}tenants/${tenantId}/`;
  const relativePath = objectPath.startsWith(tenantRoot) ? objectPath.slice(tenantRoot.length) : "";
  if (!relativePath) throw new Error("Source file is outside the tenant storage folder");
  const saved = await saveTenantFile({
    tenantId,
    filename: path.basename(originalName),
    bytes,
    contentType: mimeType || String(metadata.contentType || "application/octet-stream"),
    folderSegments: relativePath.split("/").slice(0, -1),
  });
  const fileId = parseTenantDriveObjectPath(saved.objectName);
  if (!fileId) throw new Error("Google Drive did not return a file reference");
  const verified = await downloadTenantFile(tenantId, fileId);
  if (verified.bytes.length !== bytes.length || !verified.bytes.equals(bytes)) {
    await import("../lib/tenantDrive").then(({ deleteTenantFile }) => deleteTenantFile(tenantId, fileId));
    throw new Error("Google Drive verification failed");
  }
  return saved.objectName;
}

async function migrateTenantRows(
  tenantId: string,
  table: "attachments" | "project_photos" | "agencies",
  pathColumn: "object_path" | "attachment_path",
) {
  let migrated = 0;
  let failed = 0;
  const { objectName: prefix } = privateObjectLocation();
  const tenantRoot = `${prefix ? `${prefix}/` : ""}tenants/${tenantId}/`;
  const rowsResult = await runWithTenant(tenantId, () => supabaseAdmin()
    .from(table)
    .select("*")
    .like(pathColumn, `${tenantRoot}%`)
    .order("id")
    .range(0, 4999));
  if (rowsResult.error) throw new Error(`${table} read failed: ${rowsResult.error.message}`);
  const rows = (rowsResult.data ?? []) as MigrationRow[];
  for (const row of rows) {
    const oldPath = row[pathColumn];
    if (!isPrivatePath(oldPath, tenantId)) continue;
    try {
      const newPath = await migrateObject(tenantId, oldPath!, row.name, row.mime_type);
      const updates = pathColumn === "object_path"
        ? { object_path: newPath, ...(table === "attachments" ? { data_url: null } : {}) }
        : { attachment_path: newPath };
      const updated = await runWithTenant(tenantId, () => supabaseAdmin()
        .from(table)
        .update(updates)
        .eq("id", row.id)
        .eq(pathColumn, oldPath)
        .select("id")
        .maybeSingle());
      if (updated.error || !updated.data) {
        throw new Error(updated.error?.message || "database reference changed during migration");
      }
      migrated += 1;
    } catch (error) {
      if (error instanceof GoogleDriveAccessDeniedError) throw error;
      if (error instanceof Error && /Google Drive|حساب خدمة Google Drive|مجلد تخزين المؤسسة/.test(error.message)) throw error;
      failed += 1;
      console.error(JSON.stringify({
        table,
        rowId: row.id,
        error: error instanceof Error ? error.message : "unknown migration failure",
      }));
    }
  }
  console.log(JSON.stringify({ tenantId, table, migrated, failed }));
}

async function main() {
  // Fail before touching source objects if Drive service-account configuration is absent.
  const orgs = await supabaseAdmin().from("organizations").select("id");
  if (orgs.error) throw new Error(`Organization list failed: ${orgs.error.message}`);
  for (const org of orgs.data ?? []) {
    const tenantId = String(org.id);
    await migrateTenantRows(tenantId, "attachments", "object_path");
    await migrateTenantRows(tenantId, "project_photos", "object_path");
    await migrateTenantRows(tenantId, "agencies", "attachment_path");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
