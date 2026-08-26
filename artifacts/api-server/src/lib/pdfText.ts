// Best-effort text-layer PDF extraction for CV skill parsing. No OCR — scanned
// (image-only) PDFs simply yield no text, and callers must fall back to
// manual skill entry in that case rather than blocking the upload.
import fs from "fs";

export async function extractPdfText(filePath: string): Promise<string | null> {
  let parser: { getText: () => Promise<{ text?: string }>; destroy: () => Promise<void> } | undefined;
  try {
    const buffer = await fs.promises.readFile(filePath);
    // pdf-parse v2 dropped the v1 default-function API in favor of a
    // `PDFParse` class with a `getText()` method — see its README's
    // "Getting Started with v2 (Coming from v1)" section.
    const { PDFParse } = await import("pdf-parse");
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text?.trim();
    return text ? text : null;
  } catch {
    return null;
  } finally {
    await parser?.destroy().catch(() => {});
  }
}
