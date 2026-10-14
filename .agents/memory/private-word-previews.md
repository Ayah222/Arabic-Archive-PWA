---
name: Private document opening
description: Open tenant archive attachments natively without exposing Google Drive files
---

Open PDF and browser-viewable attachments in a new browser tab through the authenticated, tenant-scoped endpoint. For same-origin API URLs, fetch with the app's auth headers and cookies, then display the returned blob; direct tab navigation drops custom auth headers. Chromium cannot render Office formats natively, so download Office files with their original filename for the installed app. Do not pass protected Drive URLs to Office Online or make files public.

**Why:** The archive's private file URLs require its signed-in session, and the API uses custom authorization headers that are not sent by `window.open(url)`. Fetching as the signed-in user avoids a blank/error tab while preserving tenant checks; sending DOCX to a blob tab only downloads it because Chrome has no built-in Office renderer.

**How to apply:** For inline-viewable files, open a blank tab synchronously, fetch same-origin URLs with shared auth headers and credentials, then navigate to a blob URL using the response MIME type. For DOC/DOCX/XLS/XLSX/PPT/PPTX, fetch the same way and trigger a download using the original filename. Keep downloads behind the tenant-authenticated API and never create public Drive links for previews.
