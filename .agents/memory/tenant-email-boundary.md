---
name: Tenant email boundary
description: Isolation rule for the workspace-level Gmail connector and organization-specific email archives.
---

The connected Gmail integration is workspace-level, not an independent mailbox connection for each organization. Keep its archive data and sync actions limited to the legacy organization until a separate per-organization mail connection exists.

**Why:** Reusing one workspace mailbox across tenant contexts could expose one organization's correspondence to another.

**How to apply:** Any Gmail sync job or endpoint must run under the legacy tenant unless it verifies an organization-specific mail connection and mailbox.