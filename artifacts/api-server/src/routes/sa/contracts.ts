import { Router, type IRouter } from "express";
import {
  ListContractsParams,
  CreateContractParams,
  CreateContractBody,
  UpdateContractParams,
  UpdateContractBody,
  DeleteContractParams,
} from "@workspace/api-zod";
import { listContracts, createContract, updateContract, deleteContract } from "./archiveDb";

const router: IRouter = Router();

router.get("/sa/projects/:id/contracts", async (req, res): Promise<void> => {
  const params = ListContractsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  res.json(await listContracts(params.data.id));
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
  const contract = await createContract(params.data.id, parsed.data);
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
  const contract = await updateContract(params.data.id, params.data.cid, parsed.data);
  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  res.json(contract);
});

router.delete("/sa/projects/:id/contracts/:cid", async (req, res): Promise<void> => {
  const params = DeleteContractParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await deleteContract(params.data.id, params.data.cid);
  if (!deleted) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
