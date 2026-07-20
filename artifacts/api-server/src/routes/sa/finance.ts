import { Router, type IRouter } from "express";
import { store, newId } from "./store";

const router: IRouter = Router();

router.get("/sa/finance", async (req, res): Promise<void> => {
  const list = [...store.finance].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json(list);
});

router.post("/sa/finance", async (req, res): Promise<void> => {
  const { title, amount, type, category, date, reminderDate, notes, projectId } = req.body;
  if (!title || !amount || !type || !category || !date) {
    res.status(400).json({ error: "title, amount, type, category, date required" });
    return;
  }
  const record = {
    id: newId(),
    title,
    amount: Number(amount),
    type,
    category,
    date,
    reminderDate: reminderDate ?? null,
    notes: notes ?? null,
    projectId: projectId ?? null,
    createdAt: new Date().toISOString(),
  };
  store.finance.push(record);
  res.status(201).json(record);
});

router.put("/sa/finance/:id", async (req, res): Promise<void> => {
  const idx = store.finance.findIndex((f) => f.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  const { title, amount, type, category, date, reminderDate, notes, projectId } = req.body;
  store.finance[idx] = {
    ...store.finance[idx],
    ...(title !== undefined && { title }),
    ...(amount !== undefined && { amount: Number(amount) }),
    ...(type !== undefined && { type }),
    ...(category !== undefined && { category }),
    ...(date !== undefined && { date }),
    ...(reminderDate !== undefined && { reminderDate }),
    ...(notes !== undefined && { notes }),
    ...(projectId !== undefined && { projectId }),
  };
  res.json(store.finance[idx]);
});

router.delete("/sa/finance/:id", async (req, res): Promise<void> => {
  const idx = store.finance.findIndex((f) => f.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  store.finance.splice(idx, 1);
  res.status(204).end();
});

export default router;
