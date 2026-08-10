import { Router, type IRouter } from "express";
import { store, newId } from "./store";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sa/projects", async (req, res): Promise<void> => {
  let projects = [...store.projects];
  const { q, status } = req.query as { q?: string; status?: string };
  if (q) {
    const term = q.toLowerCase();
    projects = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.client.toLowerCase().includes(term) ||
        p.location?.toLowerCase().includes(term)
    );
  }
  if (status) {
    projects = projects.filter((p) => p.status === status);
  }
  res.json(projects);
});

router.post("/sa/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const now = new Date().toISOString();
  const project = {
    id: newId(),
    ...parsed.data,
    endDate: parsed.data.endDate ?? null,
    budget: parsed.data.budget ?? null,
    location: parsed.data.location ?? null,
    coverImage: parsed.data.coverImage ?? null,
    mapsUrl: null,
    createdAt: now,
    updatedAt: now,
  };
  store.projects.push(project);
  res.status(201).json(project);
});

router.get("/sa/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const project = store.projects.find((p) => p.id === params.data.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

router.patch("/sa/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const idx = store.projects.findIndex((p) => p.id === params.data.id);
  if (idx === -1) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  store.projects[idx] = {
    ...store.projects[idx],
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };
  res.json(store.projects[idx]);
});

// PATCH /sa/projects/:id/extra — lightweight fields not in Zod schema (mapsUrl, etc.)
router.patch("/sa/projects/:id/extra", async (req, res): Promise<void> => {
  const { id } = req.params;
  const idx = store.projects.findIndex((p) => p.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const { mapsUrl } = req.body as { mapsUrl?: string | null };
  if (mapsUrl !== undefined) {
    (store.projects[idx] as unknown as Record<string, unknown>).mapsUrl = mapsUrl ?? null;
  }
  store.projects[idx].updatedAt = new Date().toISOString();
  res.json(store.projects[idx]);
});

router.delete("/sa/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const idx = store.projects.findIndex((p) => p.id === params.data.id);
  if (idx === -1) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  store.projects.splice(idx, 1);
  store.contracts = store.contracts.filter((c) => c.projectId !== params.data.id);
  store.contractors = store.contractors.filter((c) => c.projectId !== params.data.id);
  store.documents = store.documents.filter((d) => d.projectId !== params.data.id);
  store.meetings = store.meetings.filter((m) => m.projectId !== params.data.id);
  store.letters = store.letters.filter((l) => l.projectId !== params.data.id);
  res.sendStatus(204);
});

export default router;
