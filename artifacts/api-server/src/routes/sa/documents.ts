import { Router, type IRouter } from "express";
import { store, newId } from "./store";
import {
  ListDocumentsParams,
  CreateDocumentParams,
  CreateDocumentBody,
  DeleteDocumentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sa/projects/:id/documents", async (req, res): Promise<void> => {
  const params = ListDocumentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  res.json(store.documents.filter((d) => d.projectId === params.data.id));
});

router.post("/sa/projects/:id/documents", async (req, res): Promise<void> => {
  const params = CreateDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const document = {
    id: newId(),
    projectId: params.data.id,
    ...parsed.data,
    size: parsed.data.size ?? null,
    notes: parsed.data.notes ?? null,
    createdAt: new Date().toISOString(),
  };
  store.documents.push(document);
  res.status(201).json(document);
});

router.delete("/sa/projects/:id/documents/:did", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const idx = store.documents.findIndex(
    (d) => d.id === params.data.did && d.projectId === params.data.id
  );
  if (idx === -1) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  store.documents.splice(idx, 1);
  res.sendStatus(204);
});

export default router;
