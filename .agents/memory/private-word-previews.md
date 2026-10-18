---
name: Private document opening
description: Open tenant archive attachments natively without exposing Google Drive files
---

Preview PDF, images, text, audio, video, and DOCX inside the archive UI using the authenticated, tenant-scoped endpoint, including files stored in Google Drive. Never redirect supported previews to Google Drive. For same-origin API URLs, fetch with the app's auth headers and cookies; direct navigation drops custom auth headers. Use the browser PDF viewer in an embedded frame and extract DOCX text in-browser. Do not download files just to preview them, pass protected Drive URLs to Office Online, or make files public.

**Why:** The archive's private file URLs require its signed-in session, and the API uses custom authorization headers that are not sent by direct browser navigation. Chrome cannot natively render DOCX; Mammoth can extract its text locally without sending the private document to an external service.

**How to apply:** Fetch same-origin file URLs with the shared auth headers and credentials. Show PDF/images inline; extract DOCX text from the fetched ArrayBuffer and render as text (do not inject unsanitized HTML). Explain when a format such as legacy DOC is not supported. Keep all access behind the tenant-authenticated API.
