import { Router, type IRouter } from "express";
import { newId } from "./store";
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  setNotificationRead,
} from "./notificationDb";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const router: IRouter = Router();

async function syncPendingUserNotifications() {
  const [{ data: pendingProfiles, error }, notifications] = await Promise.all([
    supabaseAdmin().from("profiles").select("id,email").eq("status", "pending"),
    listNotifications(),
  ]);
  if (error) throw new Error(error.message);

  for (const profile of pendingProfiles ?? []) {
    const marker = `[pending-user:${profile.id}]`;
    if (notifications.some((notification) => notification.message.includes(marker))) continue;
    notifications.unshift(await createNotification({
      id: newId(),
      title: "طلب تفعيل مستخدم جديد",
      message: `المستخدم ${profile.email} بانتظار الموافقة أو الرفض. ${marker}`,
      type: "warning",
      audience: "admin",
      scheduledAt: null,
      read: false,
      projectId: null,
      createdAt: new Date().toISOString(),
    }));
  }
}

router.get("/sa/notifications", async (_req, res): Promise<void> => {
  await syncPendingUserNotifications();
  res.json(await listNotifications());
});

router.patch("/sa/notifications/:nid/read", async (req, res): Promise<void> => {
  const { read } = req.body as { read?: boolean };
  if (read === undefined) {
    res.status(400).json({ error: "read is required" });
    return;
  }
  const notification = await setNotificationRead(req.params.nid, read);
  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(notification);
});

router.patch("/sa/notifications/read-all", async (_req, res): Promise<void> => {
  res.json({ marked: await markAllNotificationsRead() });
});

export default router;