---
name: Private document opening
description: Open tenant archive attachments natively without exposing Google Drive files
---

Open Word, PDF, and other attachments in a new browser tab through the authenticated, tenant-scoped file endpoint so the browser or installed app can handle each type. For same-origin API URLs, fetch with the app's auth headers and cookies, then display the returned blob; direct tab navigation drops custom auth headers. Do not pass protected Drive URLs to Office Online or make files public.

**Why:** The archive's private file URLs require its signed-in session, and the API uses custom authorization headers that are not sent by `window.open(url)`. Fetching as the signed-in user avoids a blank/error tab while preserving tenant checks.

**How to apply:** Open a blank tab synchronously to avoid popup blocking, fetch same-origin URLs with the shared auth headers and credentials, then navigate the tab to an object URL using the response MIME type. Keep downloads behind the tenant-authenticated API and never create public Drive links for previews.
