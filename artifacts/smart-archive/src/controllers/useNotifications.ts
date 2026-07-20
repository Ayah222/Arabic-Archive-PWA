import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications,
  useMarkNotificationRead,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";

export function useNotifications() {
  const qc = useQueryClient();
  const list = useListNotifications();
  const markRead = useMarkNotificationRead({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    },
  });

  const unreadCount = list.data?.filter((n) => !n.read).length ?? 0;

  const markAllRead = async () => {
    const unread = list.data?.filter((n) => !n.read) ?? [];
    for (const n of unread) {
      await markRead.mutateAsync({ nid: n.id, data: { read: true } });
    }
  };

  return { list, markRead, unreadCount, markAllRead };
}
