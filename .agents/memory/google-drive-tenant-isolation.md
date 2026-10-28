---
name: Google Drive tenant isolation
description: Keep each organization's Google Drive credentials and root folder isolated.
---

The user explicitly requested that all new company files go only to the existing Google Drive service-account destination configured by `GOOGLE_DRIVE_ROOT_FOLDER_ID`. Preserve legacy Drive reads and existing Replit objects until each copy is verified; never delete the source during migration.

**Why:** On 2026-10-28 the user explicitly authorized the permanent Google Drive-only destination and a migration after earlier concern about damaging the existing setup. Google Drive has rejected a migration upload with HTTP 403, so existing Replit copies must remain until permissions are corrected and Drive copies are verified.

**How to apply:** All new user-file writes must use the existing service-account Drive path and fail explicitly if Drive rejects them; never silently fall back to Replit. Preserve existing Replit objects for reads/rollback until a byte-verified Drive copy is confirmed and its database reference is updated. Keep tenant isolation and existing Gmail configuration untouched.

For multipart uploads to Drive, configure Multer's `defParamCharset` as UTF-8; its default Latin-1 decoding can corrupt Arabic `originalname` before Drive receives the UTF-8 JSON metadata. Never substitute generic project/folder names for missing upload context, and prune only empty app-owned folders after failed uploads or deletions.
**Why:** The Drive API metadata request can be UTF-8-correct while the filename has already been corrupted by multipart parsing, and failed DB writes can leave empty Drive parents behind.
**How to apply:** Preserve Arabic combining marks during filename sanitization, require real project/section context where needed, and check that an app-marked folder is empty before removing it.
