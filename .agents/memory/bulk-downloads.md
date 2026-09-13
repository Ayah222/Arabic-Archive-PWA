---
name: Large PDF downloads
description: The archive must package large attachment batches on the server instead of firing one browser download per file.
---

Large attachment batches should be downloaded as a single server-generated ZIP. Individual browser-triggered downloads are subject to browser throttling and can stop partway through a large batch.

**Why:** A customer batch stopped after 196 PDFs even though the source list contained many more records; the browser download mechanism, not the archive file-count limit, was the bottleneck.

**How to apply:** Use the archive's server-side ZIP route for files already stored as attachments. Treat external Excel hyperlinks as a separate import/integration flow rather than silently assuming they are archive attachments.