/**
 * Notifications controller — uses direct fetch calls via shared apiClient.
 * Does NOT import from @workspace/api-client-react.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SA, apiGet, apiPatch } from "../lib/apiClient";

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

const QK = ["sa-notifications"] as const;

export function useNotifications() {
  const qc = useQueryClient();

  const list = useQuery<SANotification[]>({
    queryKey: [...QK],
    queryFn: () => apiGet<SANotification[]>(`${SA}/notifications`),
    staleTime: 15_000,
    refetchInterval: 30_000,
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

  const unreadCount = list.data?.filter((n) => !n.read).length ?? 0;
  const markRead = (nid: string) => markReadMutation.mutate(nid);
  const markAllRead = () => markAllReadMutation.mutate();

  return { notifications: list.data ?? [], list, markRead, unreadCount, markAllRead };
}
