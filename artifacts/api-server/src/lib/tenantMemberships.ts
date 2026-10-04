import { supabaseAdmin } from "./supabaseAdmin";
import { DEFAULT_TENANT_ID } from "./tenantContext";

export interface TenantMembership {
  tenantId: string;
  role: "admin" | "data_entry" | "viewer";
  status: "active" | "pending" | "disabled";
  hrAccess: boolean;
}

export async function getTenantMembership(userId: string, tenantId?: string): Promise<TenantMembership | null> {
  let query = supabaseAdmin()
    .from("organization_memberships")
    .select("tenant_id,role,status,hr_access")
    .eq("user_id", userId)
    .eq("status", "active");
  if (tenantId) query = query.eq("tenant_id", tenantId);
  else query = query.order("tenant_id", { ascending: true });

  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data) return null;
  return {
    tenantId: String(data.tenant_id),
    role: data.role as TenantMembership["role"],
    status: data.status as TenantMembership["status"],
    hrAccess: data.hr_access === true,
  };
}

export async function listTenantMemberships(userId: string): Promise<TenantMembership[]> {
  const { data, error } = await supabaseAdmin()
    .from("organization_memberships")
    .select("tenant_id,role,status,hr_access")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("tenant_id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    tenantId: String(row.tenant_id),
    role: row.role as TenantMembership["role"],
    status: row.status as TenantMembership["status"],
    hrAccess: row.hr_access === true,
  }));
}

export async function getDefaultTenantId(): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("organizations")
    .select("id")
    .eq("id", DEFAULT_TENANT_ID)
    .maybeSingle();
  if (error || !data) throw new Error("Multi-tenant migration is required before sign-in");
  return String(data.id);
}