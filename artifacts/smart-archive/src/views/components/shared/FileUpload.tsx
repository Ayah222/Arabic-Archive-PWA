import { useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface FileUploadProps {
  onUpload: (result: { url: string; filename: string; size: number; mimetype: string }) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  projectId: string;
  section: string;
}

export default function FileUpload({
  onUpload,
  accept = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx",
  maxSizeMB = 20,
  label = "رفع ملف",
  projectId,
  section,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = async (file: File) => {
    setError(null);
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`حجم الملف يتجاوز ${maxSizeMB}MB`);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      form.append("section", section);
      // Attach auth token — demo token takes priority over Supabase JWT
      // Do NOT set Content-Type for FormData (browser sets it with boundary)
      const demoToken = localStorage.getItem("sa_demo_token");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = demoToken ?? sessionData.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/sa/upload", { method: "POST", headers, body: form });
      if (!res.ok) throw new Error("فشل في رفع الملف");
      const data = (await res.json()) as { url: string; filename: string; size: number; mimetype: string };
      onUpload(data);
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
              PDF، صورة، Word، Excel — حجم أقصى {maxSizeMB}MB
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
