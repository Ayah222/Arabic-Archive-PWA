// Prompt 7: Audit log endpoint
import { Router, type IRouter } from "express";
import { listAuditLogs } from "./archiveDb";

const router: IRouter = Router();

// GET audit log with optional filters
router.get("/sa/audit", async (req, res): Promise<void> => {
  const { entity, userId, limit } = req.query as {
    entity?: string; userId?: string; limit?: string;
  };

  const maxItems = Math.min(parseInt(limit ?? "100"), 500);
  res.json(await listAuditLogs({ entity, userId, limit: maxItems }));
});

export default router;
