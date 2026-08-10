/**
 * Notifications controller — uses direct fetch calls (same pattern as useGlobal.ts).
 * Does NOT import from @workspace/api-client-react to avoid missing-export crashes.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

const API = "/api/sa";

export interface SANotification {
  id: string;
  title: string;
  message: string;
  type: "reminder" | "info" | "warning" | "success";
  priority?: "high" | "medium" | "low";
  scheduledAt: string | null;
  read: boolean;
  projectId: string | null;
  createdAt: string;
}

/* ── Auth helpers (duplicated here to keep this file self-contained) ── */
async function getToken(): Promise<string | null> {
  const demo = localStorage.getItem("sa_demo_token");
  if (demo) return demo;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch { return null; }
}

async function authHdr(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHdr(
    init?.body ? { "Content-Type": "application/json" } : undefined
  );
  const r = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

/* ── Hook ── */
export function useNotifications() {
  const qc = useQueryClient();

  const list = useQuery<SANotification[]>({
    queryKey: ["sa-notifications"],
    queryFn: () => apiFetch<SANotification[]>(`${API}/notifications`),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (nid: string) =>
      apiFetch<SANotification>(`${API}/notifications/${nid}/read`, {
        method: "PATCH",
        body: JSON.stringify({ read: true }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sa-notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ marked: number }>(`${API}/notifications/read-all`, { method: "PATCH", body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sa-notifications"] }),
  });

  const unreadCount = list.data?.filter((n) => !n.read).length ?? 0;
  const markRead = (nid: string) => markReadMutation.mutate(nid);
  const markAllRead = () => markAllReadMutation.mutate();

  return { notifications: list.data ?? [], list, markRead, unreadCount, markAllRead };
}
