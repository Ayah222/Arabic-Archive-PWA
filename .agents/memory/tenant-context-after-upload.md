---
name: Tenant context across async boundaries
description: Preserve tenant-scoped database access across external awaits and response lifecycle callbacks.
---

Explicitly re-enter the tenant AsyncLocalStorage scope for database work after external storage awaits and inside callbacks triggered after the HTTP response, such as `res.on("finish")`. Capture the tenant ID before the callback and wrap the database helper with `runWithTenant`. Catch and log callback failures so audit or other secondary work cannot crash the server after the response has been committed.

**Why:** External-storage awaits can lose request scope, and response-finish callbacks run outside the original request context. Missing scope can fail tenant-filtered inserts or crash the server during audit logging.

**How to apply:** In upload routes, wrap post-storage tenant-filtered inserts with `runWithTenant(res.locals.tenantId, ...)` and keep cleanup scoped to that tenant. For response-finish work, capture `res.locals.tenantId`, re-enter it with `runWithTenant`, and handle any rejected promise without throwing from the event callback.
