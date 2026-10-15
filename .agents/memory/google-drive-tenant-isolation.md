---
name: Google Drive tenant isolation
description: Keep each organization's Google Drive credentials and root folder isolated.
---

Require a verified Google account dedicated to each organization and bind its encrypted credentials and Drive root to that organization ID. Never fall back to a shared/default Drive account. Each saved file and root folder must carry the matching tenant marker. Do not silently replace a populated tenant's Drive connection because stored file IDs would stop resolving; any migration must preserve existing access.

**Why:** The archive is intended for separate offices, and using one Google account across organizations can expose a combined Drive view and quota even when folders are distinct.

**How to apply:** Force account selection during OAuth, reject account reuse across tenants, validate the tenant root before writes, and verify file tenant markers before reads/deletes. Review existing links before applying a unique-account database constraint; do not delete or move files automatically.
