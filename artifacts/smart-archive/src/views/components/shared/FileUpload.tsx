import { useRef, useState } from "react";
import { getUserRequestHeaders, useFileLimits } from "../../../controllers/useGlobal";
import { supabase } from "../../../lib/supabase";

interface FileUploadProps {
  onUpload: (result: { url: string; filename: string; size: number; mimetype: string }) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  projectId: string;
  section: string;
  // HR documents (national IDs, CVs, contracts) must never go through the
  // generic /sa/upload + unauthenticated /sa/files/:filename pair. HR pages
  // pass "/api/sa/hr/upload" here, which is gated by the signed HR session
  // and serves back only through the equally-gated /sa/hr/files/:filename.
  endpoint?: string;
}

export default function FileUpload({
  onUpload,
  accept = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx",
  maxSizeMB,
  label = "رفع ملف",
  projectId,
  section,
  endpoint = "/api/sa/upload",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const { data: fileLimits } = useFileLimits();
  const effectiveMaxSizeMB = maxSizeMB ?? Math.floor(fileLimits.maxFileBytes / (1024 * 1024));

  const uploadFile = async (file: File) => {
    setError(null);
    if (file.size > effectiveMaxSizeMB * 1024 * 1024) {
      setError(`حجم الملف يتجاوز ${effectiveMaxSizeMB}MB`);
      return;
    }
    setUploading(true);
    try {
      const storageBase = endpoint.includes("/hr/") ? "/api/sa/hr/storage" : "/api/sa/storage";
      const targetResponse = await fetch(`${storageBase}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getUserRequestHeaders() },
        body: JSON.stringify({ filename: file.name, projectId, section }),
      });
      if (!targetResponse.ok) throw new Error("تعذر إنشاء رابط الرفع");
      const target = (await targetResponse.json()) as { bucket: string; path: string; token: string; fileUrl: string };
      const { error: uploadError } = await supabase.storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, file);
      if (uploadError) throw new Error(uploadError.message);
      onUpload({
        url: target.fileUrl,
        filename: file.name,
        size: file.size,
        mimetype: file.type,
      });
    } catch {
      setError("فشل في رفع الملف، يرجى المحاولة مجدداً");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? "border-primary bg-accent"
            : "border-border hover:border-primary hover:bg-accent/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
        {uploading ? (
          <div className="text-primary animate-pulse">
            <div className="text-3xl mb-2">⬆️</div>
            <p className="text-sm font-medium">جاري الرفع...</p>
          </div>
        ) : (
          <div>
            <div className="text-3xl mb-2">📂</div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-1">
               PDF، صورة، Word، Excel — حجم أقصى {effectiveMaxSizeMB}MB
            </p>
            <p className="text-xs text-muted-foreground">اضغط أو اسحب الملف هنا</p>
          </div>
        )}
      </div>
      {error && (
        <p className="text-red-500 text-xs mt-2">{error}</p>
      )}
    </div>
  );
}
