/**
 * Shared auth-aware fetch helpers.
 * All SA API calls should go through these functions.
 */
import { supabase } from "./supabase";

export const SA = "/api/sa";

async function getToken(): Promise<string | null> {
  const demo = localStorage.getItem("sa_demo_token");
  if (demo) return demo;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch { return null; }
}

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const r = await fetch(path, { headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  const r = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  const r = await fetch(path, { method: "PATCH", headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

export async function apiDel(path: string): Promise<void> {
  const headers = await authHeaders();
  const r = await fetch(path, { method: "DELETE", headers });
  if (!r.ok) throw new Error(await r.text());
}
