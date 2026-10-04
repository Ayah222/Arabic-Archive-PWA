import { AsyncLocalStorage } from "node:async_hooks";

const tenantScope = new AsyncLocalStorage<string>();
export const DEFAULT_TENANT_ID = "00000000-0000-4000-8000-000000000001";

export function runWithTenant<T>(tenantId: string, callback: () => T): T {
  if (!tenantId) throw new Error("A tenant is required for this operation");
  return tenantScope.run(tenantId, callback);
}

export function currentTenantId(): string {
  const tenantId = tenantScope.getStore();
  if (!tenantId) throw new Error("Tenant context is missing; refusing an unscoped data access");
  return tenantId;
}

export function maybeCurrentTenantId(): string | undefined {
  return tenantScope.getStore();
}