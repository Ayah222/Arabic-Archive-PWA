import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications,
  useMarkNotificationRead,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { getCurrentUser } from "./useGlobal";

export function isAdminNotification(notification: {
  title: string;
  message: string;
  audience?: string;
}) {
  return (
    notification.audience === "admin" ||
    notification.message.includes("[pending-user:") ||
    notification.title.includes("طلب تفعيل مستخدم")
  );
}

export function getNotificationTarget(notification: {
  title: string;
  message: string;
  projectId?: string | null;
}) {
  if (
    notification.message.includes("[pending-user:") ||
    notification.title.includes("طلب تفعيل مستخدم")
  ) {
    return "/users";
  }

  if (notification.projectId) {
    return `/projects/${notification.projectId}`;
  }

  return "/notifications";
}

export function useNotifications() {
  const qc = useQueryClient();
  const list = useListNotifications({ query: {
    queryKey: getListNotificationsQueryKey(),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  } });
  const markReadMutation = useMarkNotificationRead({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    },
  });

  const isAdmin = getCurrentUser()?.role === "admin";
  const notifications = (list.data ?? []).filter((notification) =>
    isAdmin || !isAdminNotification(notification as typeof notification & { audience?: string }),
  );
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Simple function — call markRead(id) from anywhere
  const markRead = (nid: string) =>
    markReadMutation.mutate({ nid, data: { read: true } });

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    for (const n of unread) {
      await markReadMutation.mutateAsync({ nid: n.id, data: { read: true } });
    }
    qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };

  return { notifications, list, markRead, unreadCount, markAllRead };
}
