import { Router, type IRouter } from "express";
import { store, newId } from "./store";
import {
  ListProjectContractorsParams,
  CreateProjectContractorParams,
  CreateProjectContractorBody,
  UpdateProjectContractorParams,
  UpdateProjectContractorBody,
  DeleteProjectContractorParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sa/projects/:id/contractors", async (req, res): Promise<void> => {
  const params = ListProjectContractorsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  res.json(store.contractors.filter((c) => c.projectId === params.data.id));
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
  const contractor = {
    id: newId(),
    projectId: params.data.id,
    ...parsed.data,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    notes: parsed.data.notes ?? null,
    createdAt: new Date().toISOString(),
  };
  store.contractors.push(contractor);
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
  const idx = store.contractors.findIndex(
    (c) => c.id === params.data.cid && c.projectId === params.data.id
  );
  if (idx === -1) {
    res.status(404).json({ error: "Contractor not found" });
    return;
  }
  store.contractors[idx] = { ...store.contractors[idx], ...parsed.data };
  res.json(store.contractors[idx]);
});

/* ── Rating endpoint ── */
router.patch("/sa/projects/:id/contractors/:cid/rating", async (req, res): Promise<void> => {
  const { id, cid } = req.params;
  const { workQuality, scheduleCompliance, safetyStandards, executionSpeed } = req.body as {
    workQuality: number; scheduleCompliance: number; safetyStandards: number; executionSpeed: number;
  };
  const idx = store.contractors.findIndex((c) => c.id === cid && c.projectId === id);
  if (idx === -1) { res.status(404).json({ error: "Contractor not found" }); return; }
  const avg = Math.round((workQuality + scheduleCompliance + safetyStandards + executionSpeed) / 4);
  (store.contractors[idx] as import("./store").SAProjectContractor).rating = {
    workQuality, scheduleCompliance, safetyStandards, executionSpeed, average: avg,
    updatedAt: new Date().toISOString(),
  };
  res.json(store.contractors[idx]);
});

router.delete("/sa/projects/:id/contractors/:cid", async (req, res): Promise<void> => {
  const params = DeleteProjectContractorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const idx = store.contractors.findIndex(
    (c) => c.id === params.data.cid && c.projectId === params.data.id
  );
  if (idx === -1) {
    res.status(404).json({ error: "Contractor not found" });
    return;
  }
  store.contractors.splice(idx, 1);
  res.sendStatus(204);
});

export default router;
