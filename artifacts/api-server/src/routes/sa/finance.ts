import { Router, type IRouter } from "express";
import { listFinance, createFinanceRecord, updateFinanceRecord, deleteFinanceRecord } from "./archiveDb";

const router: IRouter = Router();

router.get("/sa/finance", async (_req, res): Promise<void> => {
  res.json(await listFinance());
});

router.post("/sa/finance", async (req, res): Promise<void> => {
  const { title, amount, type, category, date, reminderDate, notes, projectId } = req.body;
  if (!title || !amount || !type || !category || !date) {
    res.status(400).json({ error: "title, amount, type, category, date required" });
    return;
  }
  const record = await createFinanceRecord({
    title, amount: Number(amount), type, category, date,
    reminderDate: reminderDate ?? null, notes: notes ?? null, projectId: projectId ?? null,
  });
  res.status(201).json(record);
});

router.put("/sa/finance/:id", async (req, res): Promise<void> => {
  const { title, amount, type, category, date, reminderDate, notes, projectId } = req.body;
  const record = await updateFinanceRecord(req.params.id, {
    ...(title !== undefined && { title }),
    ...(amount !== undefined && { amount: Number(amount) }),
    ...(type !== undefined && { type }),
    ...(category !== undefined && { category }),
    ...(date !== undefined && { date }),
    ...(reminderDate !== undefined && { reminderDate }),
    ...(notes !== undefined && { notes }),
    ...(projectId !== undefined && { projectId }),
  });
  if (!record) { res.status(404).json({ error: "Not found" }); return; }
  res.json(record);
});

router.delete("/sa/finance/:id", async (req, res): Promise<void> => {
  const deleted = await deleteFinanceRecord(req.params.id);
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
