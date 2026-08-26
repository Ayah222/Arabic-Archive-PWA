import { Router, type IRouter } from "express";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
} from "@workspace/api-zod";
import { listProjects, getProject, createProject, updateProject, deleteProject } from "./archiveDb";

const router: IRouter = Router();

router.get("/sa/projects", async (req, res): Promise<void> => {
  let projects = await listProjects();
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
  const project = await createProject(parsed.data);
  res.status(201).json(project);
});

router.get("/sa/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const project = await getProject(params.data.id);
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
  const project = await updateProject(params.data.id, parsed.data);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

// PATCH /sa/projects/:id/extra — lightweight fields not in Zod schema (mapsUrl, etc.)
router.patch("/sa/projects/:id/extra", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { mapsUrl } = req.body as { mapsUrl?: string | null };
  const project = await updateProject(id, mapsUrl !== undefined ? { mapsUrl: mapsUrl ?? null } : {});
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

router.delete("/sa/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await deleteProject(params.data.id);
  if (!deleted) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
