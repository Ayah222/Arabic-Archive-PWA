import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Shared service-role Supabase client for the archive domain (projects,
// contracts, contractors, documents, meetings, letters, finance, contacts,
// categories, attachments, audit logs). Bypasses RLS — only ever used from
// trusted server-side route handlers, never exposed to the browser.
export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  if (!url || !key) {
    throw new Error("Supabase is not configured: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}

export function throwIfSupabaseError<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
