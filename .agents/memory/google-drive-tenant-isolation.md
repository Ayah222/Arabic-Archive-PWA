---
name: Google Drive tenant isolation
description: Keep each organization's Google Drive credentials and root folder isolated.
---

The user approved OAuth for the office's personal Google account after the service account hit `storageQuotaExceeded`. Store its refresh token encrypted in the existing tenant connection record using `STORAGE_ENCRYPTION_KEY`; do not expose it to the browser or logs. New uploads must use the connected user's Drive quota. Preserve legacy Drive reads and existing Replit objects until each copy is verified; never delete the source during migration.

**Why:** A service-account upload to the personal Drive destination failed with `storageQuotaExceeded`; ownership transfer cannot help before creation succeeds. The user explicitly chose OAuth and encrypted database storage instead of exposing refresh tokens in Replit Secrets.

**How to apply:** Use each tenant's stored OAuth connection for Drive API calls; fail explicitly if the account is unlinked or revoked, never silently fall back to the service account or Replit storage. Preserve existing Replit objects for reads/rollback until a byte-verified Drive copy is confirmed and its database reference is updated. Keep tenant isolation and existing Gmail configuration untouched.

For multipart uploads to Drive, configure Multer's `defParamCharset` as UTF-8; its default Latin-1 decoding can corrupt Arabic `originalname` before Drive receives the UTF-8 JSON metadata. Never substitute generic project/folder names for missing upload context, and prune only empty app-owned folders after failed uploads or deletions.
**Why:** The Drive API metadata request can be UTF-8-correct while the filename has already been corrupted by multipart parsing, and failed DB writes can leave empty Drive parents behind.
**How to apply:** Preserve Arabic combining marks during filename sanitization, require real project/section context where needed, and check that an app-marked folder is empty before removing it.
