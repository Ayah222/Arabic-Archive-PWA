---
name: Private document opening
description: Open tenant archive attachments natively without exposing Google Drive files
---

Open browser-native previews for PDF, raster images, plain text, CSV, JSON, audio, and video in a new browser tab, including files stored in Google Drive. For DOCX and PPTX, show a text-only preview inside the app because browsers do not render those formats natively. Fetch protected same-origin URLs with the app's auth headers and cookies. Never redirect to Google Drive, pass protected files to Office Online, or make files public.

**Why:** The owner wants useful in-app document previews while keeping private tenant files protected; Office Online would require exposing protected files outside the archive.

**How to apply:** Start the preview tab synchronously from the click, fetch with same-origin auth headers and cookies, and clear `window.opener`. Use a Blob URL for browser-native formats; render Office text via safe DOM `textContent` inside the preview tab. Explain that Office previews do not preserve original slide/page layout, imagery, or transitions.
