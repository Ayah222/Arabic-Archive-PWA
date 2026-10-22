---
name: Google Drive tenant isolation
description: Keep each organization's Google Drive credentials and root folder isolated.
---

Use the configured Google service account for Drive access and create each organization's active upload root beneath `GOOGLE_DRIVE_ROOT_FOLDER_ID`, with a tenant marker. Existing file IDs are resolved directly and must not be moved or invalidated when changing the active upload root. The shared service identity does not remove tenant ownership checks.

**Why:** Drive logs showed that a service-account upload was denied after resumable-upload setup, and an existing per-tenant root in the database could bypass the configured shared folder. Updating the active root preserves file IDs while making new uploads use the explicitly shared location.

**How to apply:** Read the service-account key and shared archive folder ID only from server-side Secrets. Resolve or provision a distinct tenant root beneath the configured shared folder for every organization, keep legacy files where they are, and verify tenant markers before reads or deletes. Log Google API denial reasons without logging credentials or file content.

For multipart uploads to Drive, configure Multer's `defParamCharset` as UTF-8; its default Latin-1 decoding can corrupt Arabic `originalname` before Drive receives the UTF-8 JSON metadata. Never substitute generic project/folder names for missing upload context, and prune only empty app-owned folders after failed uploads or deletions.
**Why:** The Drive API metadata request can be UTF-8-correct while the filename has already been corrupted by multipart parsing, and failed DB writes can leave empty Drive parents behind.
**How to apply:** Preserve Arabic combining marks during filename sanitization, require real project/section context where needed, and check that an app-marked folder is empty before removing it.
