---
name: AI analysis isolation
description: Keep archive AI document analysis separate from sensitive data and file uploads
---

AI analysis must only run when a user explicitly requests analysis of a selected archive attachment. Never couple AI work to upload, retry, or file-save flows, and do not alter sensitive HR files or workflows as part of archive AI changes.

**Why:** The user explicitly required that AI work not touch sensitive files or delay or obstruct any organization upload.

**How to apply:** Keep AI routes and UI separate from upload endpoints; use explicit per-document actions and preserve the existing upload implementation.
