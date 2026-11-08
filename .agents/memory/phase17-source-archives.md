---
name: Phase 17 source archive handling
description: Format and integrity expectations for sanitized source-only recovery packages.
---

The reviewed pre-patch and patched source snapshots use the `.tar` suffix but are plain POSIX tar streams, not gzip-compressed archives. GNU `tar -t` displays directory names with a trailing slash while Python's `tarfile` may omit it.

**Why:** Backup validation can fail if a future export assumes compression from the suffix or compares directory inventory strings without normalization.

**How to apply:** Before packaging a Phase 17 source-only export, identify the archive format, compare normalized inventories to the stored lists, verify the source-file hashes against each allowlist, and include only explicitly reviewed package files.
