import { Router, type IRouter } from "express";
import {
  ListMeetingsParams,
  CreateMeetingParams,
  CreateMeetingBody,
  UpdateMeetingParams,
  UpdateMeetingBody,
  DeleteMeetingParams,
} from "@workspace/api-zod";
import { listMeetings, createMeeting, updateMeeting, deleteMeeting } from "./archiveDb";

const router: IRouter = Router();

router.get("/sa/projects/:id/meetings", async (req, res): Promise<void> => {
  const params = ListMeetingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  res.json(await listMeetings(params.data.id));
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
  const meeting = await createMeeting(params.data.id, parsed.data);
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
  const meeting = await updateMeeting(params.data.id, params.data.mid, parsed.data);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.json(meeting);
});

router.delete("/sa/projects/:id/meetings/:mid", async (req, res): Promise<void> => {
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await deleteMeeting(params.data.id, params.data.mid);
  if (!deleted) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
