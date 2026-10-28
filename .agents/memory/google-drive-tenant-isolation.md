---
name: Google Drive tenant isolation
description: Keep each organization's Google Drive credentials and root folder isolated.
---

The office's designated cloud storage is its only backup. New office files must be written there; Replit App Storage alone does not satisfy this requirement. Never silently redirect or claim backup while uploads only reach Replit storage. Keep legacy Google Drive objects readable by their existing file IDs; do not bulk-move them.

**Why:** The user stated that office cloud storage is the only backup and files must be visible there. Earlier service-account uploads received `storageQuotaExceeded`, so a verified writable organization-owned Drive connection is still required before routing new uploads back to Drive.

**How to apply:** Ensure every successful office upload reaches its designated cloud storage and verify the write before reporting success. If Drive is unavailable, make the failure explicit rather than storing only in Replit App Storage. Verify tenant ownership on every serving route, retain existing Google Drive reads, and preserve each module's authorization rules—especially HR files.

For multipart uploads to Drive, configure Multer's `defParamCharset` as UTF-8; its default Latin-1 decoding can corrupt Arabic `originalname` before Drive receives the UTF-8 JSON metadata. Never substitute generic project/folder names for missing upload context, and prune only empty app-owned folders after failed uploads or deletions.
**Why:** The Drive API metadata request can be UTF-8-correct while the filename has already been corrupted by multipart parsing, and failed DB writes can leave empty Drive parents behind.
**How to apply:** Preserve Arabic combining marks during filename sanitization, require real project/section context where needed, and check that an app-marked folder is empty before removing it.
