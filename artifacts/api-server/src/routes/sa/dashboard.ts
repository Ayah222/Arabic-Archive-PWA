import { Router, type IRouter } from "express";
import { store } from "./store";

const router: IRouter = Router();

router.get("/sa/dashboard", async (_req, res): Promise<void> => {
  const unread = store.notifications.filter((n) => !n.read).length;
  res.json({
    totalProjects: store.projects.length,
    activeProjects: store.projects.filter((p) => p.status === "active").length,
    completedProjects: store.projects.filter((p) => p.status === "completed").length,
    onHoldProjects: store.projects.filter((p) => p.status === "on_hold").length,
    totalContracts: store.contracts.length,
    totalDocuments: store.documents.length,
    totalMeetings: store.meetings.length,
    totalLetters: store.letters.length,
    recentProjects: [...store.projects]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5),
    unreadNotifications: unread,
  });
});

export default router;
