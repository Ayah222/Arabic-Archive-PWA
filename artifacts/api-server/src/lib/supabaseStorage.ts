import path from "node:path";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";

export const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "smart-archive-files";
const SUPABASE_MARKER = `supabase://${SUPABASE_STORAGE_BUCKET}/`;
let bucketReady: Promise<void> | null = null;

function safeFilename(filename: string) {
  const base = path.basename(filename).normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 160);
  return base || "file";
}

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

async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const admin = supabaseAdmin();
      const { data, error } = await admin.storage.listBuckets();
      if (error) throw new Error(error.message);
      if (!data?.some((bucket) => bucket.name === SUPABASE_STORAGE_BUCKET)) {
        const created = await admin.storage.createBucket(SUPABASE_STORAGE_BUCKET, { public: false });
        if (created.error && !created.error.message.toLowerCase().includes("already exists")) {
          throw new Error(created.error.message);
        }
      }
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  return bucketReady;
}

export async function createSupabaseUploadTarget(input: {
  namespace: string;
  filename: string;
}) {
  await ensureBucket();
  const storagePath = `${input.namespace.replace(/^\/+|\/+$/g, "")}/${randomUUID()}-${safeFilename(input.filename)}`;
  const { data, error } = await supabaseAdmin().storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error || !data?.token) throw new Error(error?.message || "تعذر إنشاء رابط الرفع");
  return { bucket: SUPABASE_STORAGE_BUCKET, path: storagePath, token: data.token };
}

export async function uploadSupabaseObject(input: {
  storagePath: string;
  bytes: Buffer;
  contentType?: string;
}) {
  await ensureBucket();
  const { error } = await supabaseAdmin().storage.from(SUPABASE_STORAGE_BUCKET).upload(input.storagePath, input.bytes, {
    contentType: input.contentType || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabaseObjectPath(input.storagePath);
}

export async function downloadSupabaseObject(storagePath: string, maxBytes?: number) {
  await ensureBucket();
  const { data, error } = await supabaseAdmin().storage.from(SUPABASE_STORAGE_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message || "تعذر قراءة الملف");
  if (maxBytes && data.size > maxBytes) throw new Error("حجم الملف المضغوط يتجاوز الحد المسموح");
  return Buffer.from(await data.arrayBuffer());
}

export async function signedSupabaseUrl(storagePath: string, expiresIn = 86400) {
  await ensureBucket();
  const { data, error } = await supabaseAdmin().storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) throw new Error(error?.message || "تعذر إنشاء رابط الملف");
  return data.signedUrl;
}

export async function deleteSupabaseObject(storagePath: string) {
  await ensureBucket();
  const { error } = await supabaseAdmin().storage.from(SUPABASE_STORAGE_BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}