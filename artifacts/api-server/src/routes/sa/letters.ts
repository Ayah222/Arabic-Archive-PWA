import { Router, type IRouter } from "express";
import { store, newId } from "./store";
import {
  ListLettersParams,
  CreateLetterParams,
  CreateLetterBody,
  DeleteLetterParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sa/projects/:id/letters", async (req, res): Promise<void> => {
  const params = ListLettersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  res.json(store.letters.filter((l) => l.projectId === params.data.id));
});

router.post("/sa/projects/:id/letters", async (req, res): Promise<void> => {
  const params = CreateLetterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateLetterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const letter = {
    id: newId(),
    projectId: params.data.id,
    ...parsed.data,
    reference: parsed.data.reference ?? null,
    notes: parsed.data.notes ?? null,
    fileUrl: parsed.data.fileUrl ?? null,
    createdAt: new Date().toISOString(),
  };
  store.letters.push(letter);
  res.status(201).json(letter);
});

router.delete("/sa/projects/:id/letters/:lid", async (req, res): Promise<void> => {
  const params = DeleteLetterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const idx = store.letters.findIndex(
    (l) => l.id === params.data.lid && l.projectId === params.data.id
  );
  if (idx === -1) {
    res.status(404).json({ error: "Letter not found" });
    return;
  }
  store.letters.splice(idx, 1);
  res.sendStatus(204);
});

export default router;
