---
name: Private document opening
description: Open tenant archive attachments natively without exposing Google Drive files
---

Open browser-native previews for PDF, raster images, plain text, CSV, JSON, audio, and video in a new browser tab, including files stored in Google Drive. Fetch protected same-origin URLs with the app's auth headers and cookies, then open a Blob URL because direct navigation drops custom headers. Do not show a custom archive preview page for browser-native formats, redirect to Google Drive, pass protected Drive URLs to Office Online, or make files public. Formats without native browser support remain download-only.

**Why:** The owner wants browser-native file viewing rather than an archive-styled viewer or Google Drive page, while keeping private tenant files protected.

**How to apply:** Start the browser tab synchronously from the click, fetch with same-origin auth headers and cookies, clear `window.opener`, then navigate the tab to an object URL. Keep formats without safe native browser rendering as download-only.
