---
name: Private document opening
description: Open tenant archive attachments natively without exposing Google Drive files
---

Open browser-native previews for PDF, raster images, plain text, CSV, JSON, audio, and video in a new browser tab, including files stored in Google Drive. DOCX and PPTX previews must preserve page/slide appearance instead of extracting text: convert them locally on the authenticated archive server to PDF, then open that PDF in the browser. Fetch source files only through tenant-protected storage access, limit conversion size/time, use temporary files with restrictive permissions, and always remove them. Never redirect to Google Drive, pass protected files to Office Online, or make files public.

**Why:** The owner expects Word and PowerPoint attachments to look like their original documents/slides, not a text extraction, while keeping tenant files private; Office Online would require exposing protected files outside the archive.

**How to apply:** Start the preview tab synchronously from the click, fetch or navigate with same-origin auth, and clear `window.opener`. Use browser-native rendering for supported formats. For DOCX/PPTX, convert only after verifying the authenticated tenant attachment, use isolated temporary LibreOffice profiles, and show the resulting PDF pages/slides in the browser. Never describe text extraction as a document preview.
