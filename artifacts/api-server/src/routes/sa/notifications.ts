import { Router, type IRouter } from "express";
import { newId } from "./store";
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  setNotificationRead,
} from "./notificationDb";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { verifyEmailArchiveSession } from "../../lib/emailArchiveAuth";

const router: IRouter = Router();

router.use((req, res, next) => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor || actor.role !== "admin") {
    res.status(403).json({ error: "الإشعارات الإدارية متاحة لمدير المؤسسة فقط" });
    return;
  }
  next();
});

async function syncPendingUserNotifications(tenantId: string) {
  const [{ data: memberships, error: membershipError }, notifications] = await Promise.all([
    supabaseAdmin()
      .from("organization_memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("status", "pending"),
    listNotifications(),
  ]);
  if (membershipError) throw new Error(membershipError.message);

  const profileIds = (memberships ?? [])
    .map((membership) => membership.user_id)
    .filter((id): id is string =>
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    );
  if (!profileIds.length) return;
  const { data: pendingProfiles, error } = await supabaseAdmin()
    .from("profiles")
    .select("id,email")
    .in("id", profileIds)
    .eq("status", "pending");
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
  const actor = verifyEmailArchiveSession(_req.cookies?.sa_email_archive_session);
  if (!actor) {
    res.status(401).json({ error: "جلسة المؤسسة غير صالحة" });
    return;
  }
  await syncPendingUserNotifications(actor.tenantId);
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