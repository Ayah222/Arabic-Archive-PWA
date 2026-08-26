---
name: pdf-parse v2 breaking API change
description: pdf-parse@2.x replaced the v1 default-function export with a PDFParse class — code written against the v1 API silently fails.
---

`pdf-parse` v2 dropped the v1 default-export function (`pdfParse(buffer) => {text}`) for a `PDFParse` class (`new PDFParse({data}).getText()`, then `.destroy()`). Code still using the v1 call shape doesn't throw visibly — it resolves to a non-function and gets swallowed by whatever try/catch treats extraction failure as "no text layer", so a real bug looks identical to a genuinely text-less PDF.

**How to apply:** check the installed major version before writing or debugging PDF text extraction with this library; use the class API for v2+.
