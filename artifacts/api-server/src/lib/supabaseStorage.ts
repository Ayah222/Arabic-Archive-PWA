import { supabaseAdmin } from "./supabaseAdmin";

export const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "smart-archive-files";
export const SUPABASE_STORAGE_DISABLED_MESSAGE = "رفع الملفات إلى Supabase متوقف مؤقتًا حتى ربط مساحة تخزين خارجية.";
const SUPABASE_MARKER = `supabase://${SUPABASE_STORAGE_BUCKET}/`;

export function supabaseObjectPath(storagePath: string) {
  return `${SUPABASE_MARKER}${storagePath}`;
}

export function parseSupabaseObjectPath(value: unknown): string | null {
  return typeof value === "string" && value.startsWith(SUPABASE_MARKER)
    ? value.slice(SUPABASE_MARKER.length)
    : null;
}

export function encodeSupabasePath(storagePath: string) {
  return Buffer.from(storagePath, "utf8").toString("base64url");
}

export function decodeSupabasePath(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export async function createSupabaseUploadTarget(_input: {
  namespace: string;
  filename: string;
}): Promise<never> {
  throw new Error(SUPABASE_STORAGE_DISABLED_MESSAGE);
}

export async function uploadSupabaseObject(_input: {
  storagePath: string;
  bytes: Buffer;
  contentType?: string;
}): Promise<never> {
  throw new Error(SUPABASE_STORAGE_DISABLED_MESSAGE);
}

export async function downloadSupabaseObject(storagePath: string, maxBytes?: number) {
  const { data, error } = await supabaseAdmin().storage.from(SUPABASE_STORAGE_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message || "تعذر قراءة الملف");
  if (maxBytes && data.size > maxBytes) throw new Error("حجم الملف المضغوط يتجاوز الحد المسموح");
  return Buffer.from(await data.arrayBuffer());
}

export async function signedSupabaseUrl(storagePath: string, expiresIn = 86400) {
  const { data, error } = await supabaseAdmin().storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) throw new Error(error?.message || "تعذر إنشاء رابط الملف");
  return data.signedUrl;
}

export async function deleteSupabaseObject(storagePath: string) {
  const { error } = await supabaseAdmin().storage.from(SUPABASE_STORAGE_BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}