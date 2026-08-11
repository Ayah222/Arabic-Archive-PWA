/**
 * Notifications controller — uses shared apiClient helpers.
 * Does NOT import from @workspace/api-client-react.
 * Supabase Realtime is used when credentials are available; 30 s polling is the fallback.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SA, apiGet, apiPatch } from "../lib/apiClient";
import { supabase } from "../lib/supabase";
import { useEffect, useRef } from "react";
import { getCurrentUser } from "./useGlobal";

export interface SANotification {
  id: string;
  title: string;
  message: string;
  type: "reminder" | "info" | "warning" | "success";
  priority?: "high" | "medium" | "low";
  actionUrl?: string | null;
  createdByName?: string | null;
  scheduledAt: string | null;
  read: boolean;
  projectId: string | null;
  createdAt: string;
}

const QK = ["sa-notifications"] as const;
const POLL_INTERVAL = 30_000; // 30 s fallback poll when Supabase Realtime is unavailable

export function useNotifications() {
  const qc = useQueryClient();

  const list = useQuery<SANotification[]>({
    queryKey: [...QK],
    queryFn: () => apiGet<SANotification[]>(`${SA}/notifications`),
    staleTime: 15_000,
    refetchInterval: POLL_INTERVAL,
  });

  const markReadMutation = useMutation({
    mutationFn: (nid: string) =>
      apiPatch<SANotification>(`${SA}/notifications/${nid}/read`, { read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      apiPatch<{ marked: number }>(`${SA}/notifications/read-all`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK] }),
  });

  // Supabase Realtime subscription — invalidates the query on INSERT/UPDATE
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.id) return;

    // Only connect when real Supabase credentials are present
    const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
    if (!url || url.includes("placeholder")) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => qc.invalidateQueries({ queryKey: [...QK] }),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => qc.invalidateQueries({ queryKey: [...QK] }),
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadCount = list.data?.filter((n) => !n.read).length ?? 0;
  const markRead = (nid: string) => markReadMutation.mutate(nid);
  const markAllRead = () => markAllReadMutation.mutate();

  return { notifications: list.data ?? [], list, markRead, unreadCount, markAllRead };
}
