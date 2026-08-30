import { Router, type IRouter } from "express";
import { listNotifications } from "./notificationDb";
import { listProjects, listAllContracts, listAllDocuments, listAllMeetings, listAllLetters } from "./archiveDb";

const router: IRouter = Router();

router.get("/sa/dashboard", async (_req, res): Promise<void> => {
  const [projects, contracts, documents, meetings, letters] = await Promise.all([
    listProjects(),
    listAllContracts(),
    listAllDocuments(),
    listAllMeetings(),
    listAllLetters(),
  ]);
  const unread = (await listNotifications()).filter((n) => !n.read).length;
  res.json({
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === "active").length,
    completedProjects: projects.filter((p) => p.status === "completed").length,
    onHoldProjects: projects.filter((p) => p.status === "on_hold").length,
    totalContracts: contracts.length,
    totalDocuments: documents.length,
    totalMeetings: meetings.length,
    totalLetters: letters.length,
    recentProjects: [...projects]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5),
    unreadNotifications: unread,
  });
});

export default router;
