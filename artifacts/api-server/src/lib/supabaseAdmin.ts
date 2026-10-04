import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { currentTenantId } from "./tenantContext";

let client: SupabaseClient | null = null;

const tenantScopedTables = new Set([
  "projects",
  "contracts",
  "contractors",
  "documents",
  "meetings",
  "letters",
  "finance_records",
  "contacts",
  "categories",
  "attachments",
  "audit_logs",
  "project_photos",
  "notifications",
  "agencies",
  "employees",
  "employee_documents",
  "employee_leaves",
  "job_candidates",
  "company_policies",
  "company_licenses",
  "gov_correspondence",
  "messages",
  "invitations",
]);

function addTenantToPayload(value: unknown, tenantId: string): unknown {
  const addToRow = (row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Tenant-scoped writes must contain object rows");
    }
    const existingTenantId = (row as Record<string, unknown>).tenant_id;
    if (existingTenantId !== undefined && existingTenantId !== tenantId) {
      throw new Error("A write cannot target a different tenant");
    }
    return { ...row, tenant_id: tenantId };
  };
  return Array.isArray(value) ? value.map(addToRow) : addToRow(value);
}

function scopeQueryBuilder<T extends object>(builder: T, tenantId: string): T {
  return new Proxy(builder, {
    get(target, property, receiver) {
      const member = Reflect.get(target, property, receiver) as unknown;
      if (typeof member !== "function") return member;

      return (...args: unknown[]) => {
        let query: object;
        if (property === "insert" || property === "upsert") {
          const [payload, options] = args;
          const safePayload = addTenantToPayload(payload, tenantId);
          if (property === "upsert") {
            const safeOptions = options && typeof options === "object"
              ? { ...(options as Record<string, unknown>) }
              : {};
            const conflict = typeof safeOptions.onConflict === "string"
              ? safeOptions.onConflict.split(",").map((column) => column.trim()).filter(Boolean)
              : ["id"];
            if (!conflict.includes("tenant_id")) conflict.push("tenant_id");
            safeOptions.onConflict = conflict.join(",");
            query = (member as (...values: unknown[]) => object).call(target, safePayload, safeOptions);
          } else {
            query = (member as (...values: unknown[]) => object).call(target, safePayload, options);
          }
        } else {
          query = (member as (...values: unknown[]) => object).apply(target, args);
        }

        if (property === "update" || property === "delete" || property === "select") {
          query = (query as { eq(column: string, value: string): object }).eq("tenant_id", tenantId);
        }
        return scopeQueryBuilder(query, tenantId);
      };
    },
  }) as T;
}

function tenantScopedClient(rawClient: SupabaseClient): SupabaseClient {
  return new Proxy(rawClient, {
    get(target, property, receiver) {
      if (property === "from") {
        return (table: string) => {
          const builder = target.from(table);
          return tenantScopedTables.has(table)
            ? scopeQueryBuilder(builder, currentTenantId())
            : builder;
        };
      }
      const member = Reflect.get(target, property, receiver) as unknown;
      return typeof member === "function" ? member.bind(target) : member;
    },
  }) as SupabaseClient;
}

// Shared service-role Supabase client for the archive domain (projects,
// contracts, contractors, documents, meetings, letters, finance, contacts,
// categories, attachments, audit logs). Bypasses RLS — only ever used from
// trusted server-side route handlers, never exposed to the browser.
export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  if (!url || !key) {
    throw new Error("Supabase is not configured: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  client = tenantScopedClient(
    createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }),
  );
  return client;
}

export function throwIfSupabaseError<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
