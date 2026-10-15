---
name: Tenant context after external uploads
description: Preserve tenant-scoped database access when an upload handler awaits external storage first.
---

After a route awaits an external storage operation and then inserts tenant-scoped rows, explicitly re-enter the tenant AsyncLocalStorage scope around the database helper. Do not assume the request middleware's scope is still present across the full external upload lifecycle.

**Why:** A folder attachment request intermittently reached its database insert without a tenant context after saving the file to Google Drive, producing a 500 and relying on a retry.

**How to apply:** In multi-file upload routes, wrap the post-storage tenant-filtered insert with `runWithTenant(res.locals.tenantId, ...)`, and keep cleanup operations scoped to the same tenant.
