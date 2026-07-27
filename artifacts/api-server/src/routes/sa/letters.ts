import { Router, type IRouter } from "express";
import { store, newId, nextLetterRef, addAuditLog } from "./store";

const router: IRouter = Router();

// GET all letters for a project
router.get("/sa/projects/:id/letters", async (req, res): Promise<void> => {
  const { id } = req.params;
  const letters = store.letters.filter((l) => l.projectId === id);
  res.json(letters);
});

// POST create a letter (Prompt 1: auto-ref, recipients, distributionStatus)
router.post("/sa/projects/:id/letters", async (req, res): Promise<void> => {
  const { id } = req.params;
  const {
    subject, direction, from, to, date, reference, notes, fileUrl,
    recipients, distributionStatus,
  } = req.body as {
    subject?: string; direction?: string; from?: string; to?: string;
    date?: string; reference?: string; notes?: string; fileUrl?: string;
    recipients?: string[]; distributionStatus?: string;
  };

  if (!subject || !direction || !from || !to || !date) {
    res.status(400).json({ error: "subject, direction, from, to, date are required" });
    return;
  }

  const letter = {
    id: newId(),
    projectId: id,
    subject,
    direction: direction as "incoming" | "outgoing",
    from,
    to,
    date,
    reference: reference ?? null,
    autoRef: nextLetterRef(),
    recipients: (recipients ?? []) as Array<"owner" | "consultant" | "contractor" | "technical_office">,
    distributionStatus: (distributionStatus ?? "not_sent") as "not_sent" | "sent" | "received",
    notes: notes ?? null,
    fileUrl: fileUrl ?? null,
    createdAt: new Date().toISOString(),
  };
  store.letters.push(letter);

  // Audit log
  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  addAuditLog(userId, userLabel, "create", "letter", letter.id, `إضافة خطاب: ${subject}`);

  res.status(201).json(letter);
});

// PATCH update distribution status
router.patch("/sa/projects/:id/letters/:lid", async (req, res): Promise<void> => {
  const { id, lid } = req.params;
  const { distributionStatus, recipients } = req.body as {
    distributionStatus?: string; recipients?: string[];
  };
  const idx = store.letters.findIndex((l) => l.id === lid && l.projectId === id);
  if (idx === -1) {
    res.status(404).json({ error: "Letter not found" });
    return;
  }
  if (distributionStatus) {
    store.letters[idx].distributionStatus = distributionStatus as "not_sent" | "sent" | "received";
  }
  if (recipients) {
    store.letters[idx].recipients = recipients as Array<"owner" | "consultant" | "contractor" | "technical_office">;
  }

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  addAuditLog(userId, userLabel, "update", "letter", lid, `تحديث خطاب: ${store.letters[idx].subject}`);

  res.json(store.letters[idx]);
});

// DELETE a letter
router.delete("/sa/projects/:id/letters/:lid", async (req, res): Promise<void> => {
  const { id, lid } = req.params;
  const idx = store.letters.findIndex((l) => l.id === lid && l.projectId === id);
  if (idx === -1) {
    res.status(404).json({ error: "Letter not found" });
    return;
  }
  const subject = store.letters[idx].subject;
  store.letters.splice(idx, 1);

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  addAuditLog(userId, userLabel, "delete", "letter", lid, `حذف خطاب: ${subject}`);

  res.sendStatus(204);
});

export default router;
