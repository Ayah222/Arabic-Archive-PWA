---
name: Google Drive tenant isolation
description: Keep each organization's Google Drive credentials and root folder isolated.
---

The user says the existing Replit cloud-storage setup connected with Gmail took substantial effort and must not be broken. Preserve the current Replit App Storage upload path and Gmail setup; do not replace them with a new Google Drive integration or change storage destinations without explicit approval. Keep legacy Google Drive objects readable by their existing file IDs; do not bulk-move them.

**Why:** The user clarified that their intended cloud-storage/backup setup is the existing Replit storage arrangement with Gmail, and warned that changing it could break extensive setup work. Earlier Google service-account uploads also received `storageQuotaExceeded`.

**How to apply:** Preserve the current Replit App Storage path and Gmail-related configuration. Verify where a file is stored before describing it to the user. Only change storage providers or authentication after the user explicitly asks; retain existing Google Drive reads and tenant isolation.

For multipart uploads to Drive, configure Multer's `defParamCharset` as UTF-8; its default Latin-1 decoding can corrupt Arabic `originalname` before Drive receives the UTF-8 JSON metadata. Never substitute generic project/folder names for missing upload context, and prune only empty app-owned folders after failed uploads or deletions.
**Why:** The Drive API metadata request can be UTF-8-correct while the filename has already been corrupted by multipart parsing, and failed DB writes can leave empty Drive parents behind.
**How to apply:** Preserve Arabic combining marks during filename sanitization, require real project/section context where needed, and check that an app-marked folder is empty before removing it.
