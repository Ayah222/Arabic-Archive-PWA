---
name: Google Drive tenant isolation
description: Keep each organization's Google Drive credentials and root folder isolated.
---

Use the configured Google service account for Drive access and keep each organization's files inside a tenant-marked root folder. Retain existing root folder IDs when moving to the service account so stored file IDs continue to resolve; do not silently move populated archives. The shared service identity does not remove tenant ownership checks.

**Why:** The owner chose service-account access to avoid human OAuth and device-dependent verification, while existing database records depend on Drive file IDs and organization boundaries.

**How to apply:** Read the service-account key and shared archive folder ID only from server-side Secrets. Provision a distinct tenant root beneath the shared folder for new organizations, preserve valid existing tenant roots, and verify tenant markers before reads or deletes.

For multipart uploads to Drive, configure Multer's `defParamCharset` as UTF-8; its default Latin-1 decoding can corrupt Arabic `originalname` before Drive receives the UTF-8 JSON metadata. Never substitute generic project/folder names for missing upload context, and prune only empty app-owned folders after failed uploads or deletions.
**Why:** The Drive API metadata request can be UTF-8-correct while the filename has already been corrupted by multipart parsing, and failed DB writes can leave empty Drive parents behind.
**How to apply:** Preserve Arabic combining marks during filename sanitization, require real project/section context where needed, and check that an app-marked folder is empty before removing it.
