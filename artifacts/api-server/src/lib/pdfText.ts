// Best-effort text-layer PDF extraction for CV skill parsing. No OCR — scanned
// (image-only) PDFs simply yield no text, and callers must fall back to
// manual skill entry in that case rather than blocking the upload.
import fs from "fs";

export async function extractPdfText(filePath: string): Promise<string | null> {
  try {
    const buffer = await fs.promises.readFile(filePath);
    const mod: any = await import("pdf-parse");
    const pdfParse = mod.default ?? mod;
    const result = await pdfParse(buffer);
    const text = result.text?.trim();
    return text ? text : null;
  } catch {
    return null;
  }
}
