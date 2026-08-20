import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { newId, store } from "./store";

const router: IRouter = Router();

function adminClient() {
  const url = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function syncPendingUserNotifications() {
  const { data: pendingProfiles } = await adminClient()
    .from("profiles")
    .select("id,email")
    .eq("status", "pending");

  for (const profile of pendingProfiles ?? []) {
    const marker = `[pending-user:${profile.id}]`;
    if (store.notifications.some((notification) => notification.message.includes(marker))) continue;

    store.notifications.unshift({
      id: newId(),
      title: "طلب تفعيل مستخدم جديد",
      message: `المستخدم ${profile.email} بانتظار الموافقة أو الرفض. ${marker}`,
      type: "warning",
      scheduledAt: null,
      read: false,
      projectId: null,
      createdAt: new Date().toISOString(),
    });
  }
}

router.get("/sa/notifications", async (_req, res): Promise<void> => {
  await syncPendingUserNotifications();
  res.json(
    [...store.notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  );
});

router.patch("/sa/notifications/:nid/read", async (req, res): Promise<void> => {
  const { nid } = req.params;
  const { read } = req.body as { read?: boolean };
  if (read === undefined) {
    res.status(400).json({ error: "read is required" });
    return;
  }
  const idx = store.notifications.findIndex((n) => n.id === nid);
  if (idx === -1) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  store.notifications[idx].read = read;
  res.json(store.notifications[idx]);
});

// PATCH mark all as read
router.patch("/sa/notifications/read-all", async (_req, res): Promise<void> => {
  store.notifications.forEach((n) => { n.read = true; });
  res.json({ marked: store.notifications.length });
});

export default router;
