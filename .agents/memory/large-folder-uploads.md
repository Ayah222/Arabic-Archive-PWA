---
name: Large folder uploads
description: Reliability rules for mixed PDF/Excel folder uploads from the archive UI.
---

Large folder uploads must continue after an individual file fails, retry transient upload errors, and expose partial success instead of silently stopping at a browser-dependent count.

**Why:** A daily municipal transaction folder containing PDFs and Excel files stopped partway through the browser upload, making a fixed count such as 196 look like a system limit even though the configured folder limit was higher.

**How to apply:** Use bounded concurrency and per-file retries for direct folder uploads. Preserve relative paths without cloning file bytes in memory, and report the successful and failed counts so the operator can retry only the missing files.

The browser's native directory picker does not automatically include the selected root directory in a file's relative path; callers must seed traversal with the selected directory name. Every upload attempt also needs a timeout so one stalled network request cannot block the worker pool indefinitely.