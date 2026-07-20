import { Router, type IRouter } from "express";
import { store } from "./store";
import { MarkNotificationReadParams, MarkNotificationReadBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sa/notifications", async (_req, res): Promise<void> => {
  res.json(
    [...store.notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  );
});

router.patch("/sa/notifications/:nid/read", async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = MarkNotificationReadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const idx = store.notifications.findIndex((n) => n.id === params.data.nid);
  if (idx === -1) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  store.notifications[idx].read = parsed.data.read;
  res.json(store.notifications[idx]);
});

export default router;
