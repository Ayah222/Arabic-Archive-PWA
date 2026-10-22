---
name: Google Drive tenant isolation
description: Keep each organization's Google Drive credentials and root folder isolated.
---

Use Replit App Storage for new tenant files, with tenant-scoped object paths and private serving. Keep legacy Google Drive objects readable by their existing file IDs; do not bulk-move them. The configured Google service account may remain for legacy reads, but do not use it to write into My Drive.

**Why:** Google returned `storageQuotaExceeded` for service-account content uploads, and the owner cannot create a Google Workspace Shared Drive. New files therefore need a storage backend that does not depend on Google Drive service-account quota.

**How to apply:** Save new files under `tenants/<tenant-id>/<module>/...` in private App Storage. Verify tenant ownership on every serving route, retain existing Google Drive reads, and preserve each module's authorization rules—especially HR files.

For multipart uploads to Drive, configure Multer's `defParamCharset` as UTF-8; its default Latin-1 decoding can corrupt Arabic `originalname` before Drive receives the UTF-8 JSON metadata. Never substitute generic project/folder names for missing upload context, and prune only empty app-owned folders after failed uploads or deletions.
**Why:** The Drive API metadata request can be UTF-8-correct while the filename has already been corrupted by multipart parsing, and failed DB writes can leave empty Drive parents behind.
**How to apply:** Preserve Arabic combining marks during filename sanitization, require real project/section context where needed, and check that an app-marked folder is empty before removing it.
