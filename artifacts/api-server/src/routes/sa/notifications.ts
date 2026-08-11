import { Router, type IRouter } from "express";
import { store } from "./store";

const router: IRouter = Router();

router.get("/sa/notifications", async (_req, res): Promise<void> => {
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
