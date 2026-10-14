---
name: Private document opening
description: Open tenant archive attachments natively without exposing Google Drive files
---

Open Word, PDF, and other attachments in a new browser tab through the authenticated, tenant-scoped file endpoint so the browser or installed app can handle each type. Do not pass protected Drive URLs to Office Online or make files public.

**Why:** The archive's private file URLs require its signed-in session; native browser handling avoids a separate viewer service and keeps organization isolation intact.

**How to apply:** Keep downloads behind the tenant-authenticated API, preserve the original MIME type and inline disposition, and offer download separately. Never create public Drive links for previews.
