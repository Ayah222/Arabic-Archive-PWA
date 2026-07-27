// Prompt 7: Audit log endpoint
import { Router, type IRouter } from "express";
import { store } from "./store";

const router: IRouter = Router();

// GET audit log with optional filters
router.get("/sa/audit", async (req, res): Promise<void> => {
  const { entity, userId, limit } = req.query as {
    entity?: string; userId?: string; limit?: string;
  };

  let logs = [...store.auditLogs];

  if (entity) logs = logs.filter((l) => l.entity === entity);
  if (userId) logs = logs.filter((l) => l.userId === userId);

  const maxItems = Math.min(parseInt(limit ?? "100"), 500);
  logs = logs.slice(0, maxItems);

  res.json(logs);
});

export default router;
