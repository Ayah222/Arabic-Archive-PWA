import { Router, type IRouter } from "express";
import { store, newId } from "./store";
import {
  ListMeetingsParams,
  CreateMeetingParams,
  CreateMeetingBody,
  UpdateMeetingParams,
  UpdateMeetingBody,
  DeleteMeetingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sa/projects/:id/meetings", async (req, res): Promise<void> => {
  const params = ListMeetingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  res.json(store.meetings.filter((m) => m.projectId === params.data.id));
});

router.post("/sa/projects/:id/meetings", async (req, res): Promise<void> => {
  const params = CreateMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const meeting = {
    id: newId(),
    projectId: params.data.id,
    ...parsed.data,
    location: parsed.data.location ?? null,
    agenda: parsed.data.agenda ?? null,
    notes: parsed.data.notes ?? null,
    createdAt: new Date().toISOString(),
  };
  store.meetings.push(meeting);
  res.status(201).json(meeting);
});

router.patch("/sa/projects/:id/meetings/:mid", async (req, res): Promise<void> => {
  const params = UpdateMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const idx = store.meetings.findIndex(
    (m) => m.id === params.data.mid && m.projectId === params.data.id
  );
  if (idx === -1) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  store.meetings[idx] = { ...store.meetings[idx], ...parsed.data };
  res.json(store.meetings[idx]);
});

router.delete("/sa/projects/:id/meetings/:mid", async (req, res): Promise<void> => {
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const idx = store.meetings.findIndex(
    (m) => m.id === params.data.mid && m.projectId === params.data.id
  );
  if (idx === -1) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  store.meetings.splice(idx, 1);
  res.sendStatus(204);
});

export default router;
