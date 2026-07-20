import { Router, type IRouter } from "express";
import { store, newId } from "./store";
import {
  ListContractsParams,
  CreateContractParams,
  CreateContractBody,
  UpdateContractParams,
  UpdateContractBody,
  DeleteContractParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sa/projects/:id/contracts", async (req, res): Promise<void> => {
  const params = ListContractsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  res.json(store.contracts.filter((c) => c.projectId === params.data.id));
});

router.post("/sa/projects/:id/contracts", async (req, res): Promise<void> => {
  const params = CreateContractParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const contract = {
    id: newId(),
    projectId: params.data.id,
    ...parsed.data,
    notes: parsed.data.notes ?? null,
    fileUrl: parsed.data.fileUrl ?? null,
    createdAt: new Date().toISOString(),
  };
  store.contracts.push(contract);
  res.status(201).json(contract);
});

router.patch("/sa/projects/:id/contracts/:cid", async (req, res): Promise<void> => {
  const params = UpdateContractParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const idx = store.contracts.findIndex(
    (c) => c.id === params.data.cid && c.projectId === params.data.id
  );
  if (idx === -1) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  store.contracts[idx] = { ...store.contracts[idx], ...parsed.data };
  res.json(store.contracts[idx]);
});

router.delete("/sa/projects/:id/contracts/:cid", async (req, res): Promise<void> => {
  const params = DeleteContractParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const idx = store.contracts.findIndex(
    (c) => c.id === params.data.cid && c.projectId === params.data.id
  );
  if (idx === -1) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  store.contracts.splice(idx, 1);
  res.sendStatus(204);
});

export default router;
