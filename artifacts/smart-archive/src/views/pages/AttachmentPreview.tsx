import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import mammoth from "mammoth";
import { getUserRequestHeaders, type SAAttachment } from "../../controllers/useGlobal";

type PreviewContent =
  | { kind: "pdf" | "image"; url: string }
  | { kind: "text"; text: string }
  | { kind: "html"; html: string }
  | null;

const SAFE_DOCX_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "br",
  "strong", "em", "b", "i", "u", "s", "del", "ins", "sub", "sup",
  "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "a", "img",
]);
const DROP_DOCX_TAGS = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "form"]);

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character] ?? character);
}

function sanitizeDocxHtml(source: string) {
  const document = new DOMParser().parseFromString(source, "text/html");
  const render = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
    if (!(node instanceof Element)) return "";
    const tag = node.tagName.toLowerCase();
    if (DROP_DOCX_TAGS.has(tag)) return "";
    const children = Array.from(node.childNodes, render).join("");
    if (!SAFE_DOCX_TAGS.has(tag)) return children;

    let attributes = "";
    if (tag === "a") {
      const href = node.getAttribute("href") ?? "";
      try {
        const url = new URL(href, window.location.origin);
        if (["https:", "http:", "mailto:"].includes(url.protocol)) {
          attributes += ` href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer"`;
        }
      } catch {
        // Ignore malformed links from the document.
      }
    } else if (tag === "td" || tag === "th") {
      for (const name of ["colspan", "rowspan"]) {
        const value = Number(node.getAttribute(name));
        if (Number.isInteger(value) && value >= 1 && value <= 20) {
          attributes += ` ${name}="${value}"`;
        }
      }
    } else if (tag === "img") {
      const src = node.getAttribute("src") ?? "";
      if (!/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(src)) return "";
      attributes = ` src="${src}" alt="${escapeHtml(node.getAttribute("alt") ?? "")}" loading="lazy"`;
    }
    return `<${tag}${attributes}>${children}</${tag}>`;
  };
  return Array.from(document.body.childNodes, render).join("");
}

export default function AttachmentPreview() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") || "";
  const entityType = searchParams.get("entityType") || "";
  const entityId = searchParams.get("entityId") || "";
  const attachmentId = searchParams.get("attachmentId") || "";
  const [filename, setFilename] = useState("معاينة المستند");
  const [preview, setPreview] = useState<PreviewContent>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError("");
    setPreview(null);

    void (async () => {
      try {
        if (!projectId || !entityType || !entityId || !attachmentId) {
          throw new Error("رابط المعاينة غير مكتمل.");
        }
        const query = new URLSearchParams({ entityType, entityId });
        const listResponse = await fetch(
          `/api/sa/projects/${encodeURIComponent(projectId)}/attachments?${query}`,
          { credentials: "include", headers: getUserRequestHeaders() },
        );
        if (!listResponse.ok) throw new Error("تعذر الوصول إلى مرفقات المشروع.");
        const attachments = await listResponse.json() as SAAttachment[];
        const attachment = attachments.find((item) => item.id === attachmentId);
        if (!attachment) throw new Error("لم يعد هذا الملف متاحاً في المؤسسة الحالية.");
        if (!cancelled) setFilename(attachment.name);

        const fileUrl = new URL(attachment.dataUrl, window.location.href);
        const sameOrigin = fileUrl.origin === window.location.origin;
        const response = await fetch(fileUrl, {
          credentials: sameOrigin ? "include" : "omit",
          headers: sameOrigin ? getUserRequestHeaders() : undefined,
        });
        if (!response.ok) throw new Error(`تعذر جلب الملف للمعاينة (${response.status}).`);
        const bytes = await response.arrayBuffer();
        const fileName = attachment.name.split(/[\\/]/).pop() || attachment.name;
        const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

        if (extension === "docx" || attachment.mimeType.includes("wordprocessingml")) {
          const result = await mammoth.convertToHtml({ arrayBuffer: bytes });
          const html = sanitizeDocxHtml(result.value);
          if (!html) throw new Error("لا يحتوي ملف Word على محتوى قابل للمعاينة.");
          if (!cancelled) setPreview({ kind: "html", html });
        } else if (extension === "doc" || attachment.mimeType === "application/msword") {
          throw new Error("معاينة ملفات Word القديمة (.doc) غير مدعومة؛ احفظ الملف بصيغة DOCX ثم أعد رفعه.");
        } else if (extension === "pdf" || attachment.mimeType === "application/pdf") {
          objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
          if (!cancelled) setPreview({ kind: "pdf", url: objectUrl });
        } else if (attachment.mimeType.startsWith("image/")) {
          objectUrl = URL.createObjectURL(new Blob([bytes], { type: attachment.mimeType }));
          if (!cancelled) setPreview({ kind: "image", url: objectUrl });
        } else if (attachment.mimeType.startsWith("text/") || ["txt", "csv"].includes(extension)) {
          if (!cancelled) setPreview({ kind: "text", text: new TextDecoder().decode(bytes) });
        } else {
          throw new Error("لا تتوفر معاينة داخلية لهذا النوع من الملفات.");
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "تعذر معاينة الملف.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, entityType, entityId, attachmentId]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${filename} — معاينة`;
    return () => { document.title = previousTitle; };
  }, [filename]);

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6" dir="rtl">
      <header className="mx-auto mb-4 flex max-w-5xl items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold sm:text-base">{filename}</h1>
          <p className="text-xs text-muted-foreground">معاينة آمنة داخل النظام</p>
        </div>
        <button
          type="button"
          onClick={() => window.close()}
          className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
        >
          إغلاق التبويب
        </button>
      </header>
      <section className="mx-auto flex min-h-[75vh] max-w-5xl items-center justify-center overflow-auto rounded-xl border border-border bg-card p-4">
        {loading && <p className="text-sm text-muted-foreground">جارٍ تجهيز المعاينة…</p>}
        {error && <p role="alert" className="max-w-xl text-center text-sm text-destructive">{error}</p>}
        {preview?.kind === "pdf" && (
          <iframe src={preview.url} title={filename} className="h-[75vh] w-full rounded-lg" />
        )}
        {preview?.kind === "image" && (
          <img src={preview.url} alt={filename} className="max-h-[75vh] max-w-full object-contain" />
        )}
        {preview?.kind === "text" && (
          <pre dir="auto" className="min-h-[70vh] w-full whitespace-pre-wrap break-words p-5 text-sm leading-8">
            {preview.text}
          </pre>
        )}
        {preview?.kind === "html" && (
          <article
            dir="auto"
            className="prose prose-slate min-h-[70vh] w-full max-w-none overflow-auto bg-white p-6 text-slate-900 sm:p-10"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        )}
      </section>
    </main>
  );
}
