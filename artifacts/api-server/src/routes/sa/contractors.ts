import { Router, type IRouter } from "express";
import {
  ListProjectContractorsParams,
  CreateProjectContractorParams,
  CreateProjectContractorBody,
  UpdateProjectContractorParams,
  UpdateProjectContractorBody,
  DeleteProjectContractorParams,
} from "@workspace/api-zod";
import { listContractors, createContractor, updateContractor, updateContractorRating, deleteContractor } from "./archiveDb";

const router: IRouter = Router();

router.get("/sa/projects/:id/contractors", async (req, res): Promise<void> => {
  const params = ListProjectContractorsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  res.json(await listContractors(params.data.id));
});

router.post("/sa/projects/:id/contractors", async (req, res): Promise<void> => {
  const params = CreateProjectContractorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateProjectContractorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const contractor = await createContractor(params.data.id, parsed.data);
  res.status(201).json(contractor);
});

router.patch("/sa/projects/:id/contractors/:cid", async (req, res): Promise<void> => {
  const params = UpdateProjectContractorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectContractorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const contractor = await updateContractor(params.data.id, params.data.cid, parsed.data);
  if (!contractor) {
    res.status(404).json({ error: "Contractor not found" });
    return;
  }
  res.json(contractor);
});

/* ── Rating endpoint ── */
router.patch("/sa/projects/:id/contractors/:cid/rating", async (req, res): Promise<void> => {
  const { id, cid } = req.params;
  const { workQuality, scheduleCompliance, safetyStandards, executionSpeed } = req.body as {
    workQuality: number; scheduleCompliance: number; safetyStandards: number; executionSpeed: number;
  };
  const avg = Math.round((workQuality + scheduleCompliance + safetyStandards + executionSpeed) / 4);
  const contractor = await updateContractorRating(id, cid, {
    workQuality, scheduleCompliance, safetyStandards, executionSpeed, average: avg,
    updatedAt: new Date().toISOString(),
  });
  if (!contractor) {
    res.status(404).json({ error: "Contractor not found" });
    return;
  }
  res.json(contractor);
});

router.delete("/sa/projects/:id/contractors/:cid", async (req, res): Promise<void> => {
  const params = DeleteProjectContractorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await deleteContractor(params.data.id, params.data.cid);
  if (!deleted) {
    res.status(404).json({ error: "Contractor not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
