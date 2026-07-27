import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications,
  useMarkNotificationRead,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";

export function useNotifications() {
  const qc = useQueryClient();
  const list = useListNotifications();
  const markReadMutation = useMarkNotificationRead({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    },
  });

  const unreadCount = list.data?.filter((n) => !n.read).length ?? 0;

  // Simple function — call markRead(id) from anywhere
  const markRead = (nid: string) =>
    markReadMutation.mutate({ nid, data: { read: true } });

  const markAllRead = async () => {
    const unread = list.data?.filter((n) => !n.read) ?? [];
    for (const n of unread) {
      await markReadMutation.mutateAsync({ nid: n.id, data: { read: true } });
    }
    qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };

  return { notifications: list.data ?? [], list, markRead, unreadCount, markAllRead };
}
