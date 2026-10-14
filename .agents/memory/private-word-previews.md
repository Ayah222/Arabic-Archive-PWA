---
name: Private Word previews
description: Safe in-app previews for DOCX files stored in organization Google Drives
---

Preview private `.docx` files inside Smart Archive by fetching them through the authenticated, tenant-scoped API and converting them in the browser. Do not pass protected Drive URLs to Office Online or make files public for preview.

**Why:** Office Online cannot read URLs protected by the archive session. Public sharing would weaken organization isolation for private documents.

**How to apply:** Keep Drive access behind the tenant-authenticated API; use a sandboxed in-app renderer for DOCX and provide download as a fallback. Legacy `.doc` files may remain download-only.
