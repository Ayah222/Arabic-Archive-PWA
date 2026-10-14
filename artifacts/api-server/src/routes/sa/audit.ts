// Prompt 7: Audit log endpoint
import { Router, type IRouter } from "express";
import { listAuditLogs } from "./archiveDb";
import { verifyEmailArchiveSession } from "../../lib/emailArchiveAuth";

const router: IRouter = Router();

// GET audit log with optional filters
router.get("/sa/audit", async (req, res): Promise<void> => {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor || actor.role !== "admin") {
    res.status(403).json({ error: "سجل النشاط متاح لمدير المؤسسة فقط" });
    return;
  }
  const { entity, userId, limit } = req.query as {
    entity?: string; userId?: string; limit?: string;
  };

  const maxItems = Math.min(parseInt(limit ?? "100"), 500);
  res.json(await listAuditLogs({ entity, userId, limit: maxItems }));
});

export default router;
