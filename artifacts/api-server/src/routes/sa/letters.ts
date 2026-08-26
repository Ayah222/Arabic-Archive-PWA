import { Router, type IRouter } from "express";
import { listLetters, createLetter, updateLetter, deleteLetter, nextLetterRef, addAuditLog } from "./archiveDb";

const router: IRouter = Router();

// GET all letters for a project
router.get("/sa/projects/:id/letters", async (req, res): Promise<void> => {
  const { id } = req.params;
  res.json(await listLetters(id));
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

  const autoRef = await nextLetterRef();
  const letter = await createLetter(id, {
    subject,
    direction,
    from,
    to,
    date,
    reference: reference ?? null,
    autoRef,
    recipients: recipients ?? [],
    distributionStatus: distributionStatus ?? "not_sent",
    notes: notes ?? null,
    fileUrl: fileUrl ?? null,
  });

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  await addAuditLog(userId, userLabel, "create", "letter", letter.id, `إضافة خطاب: ${subject}`);

  res.status(201).json(letter);
});

// PATCH update distribution status
router.patch("/sa/projects/:id/letters/:lid", async (req, res): Promise<void> => {
  const { id, lid } = req.params;
  const { distributionStatus, recipients } = req.body as {
    distributionStatus?: string; recipients?: string[];
  };
  const letter = await updateLetter(id, lid, { distributionStatus, recipients });
  if (!letter) {
    res.status(404).json({ error: "Letter not found" });
    return;
  }

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  await addAuditLog(userId, userLabel, "update", "letter", lid, `تحديث خطاب: ${letter.subject}`);

  res.json(letter);
});

// DELETE a letter
router.delete("/sa/projects/:id/letters/:lid", async (req, res): Promise<void> => {
  const { id, lid } = req.params;
  const letters = await listLetters(id);
  const letter = letters.find((l) => l.id === lid);
  const deleted = await deleteLetter(id, lid);
  if (!deleted) {
    res.status(404).json({ error: "Letter not found" });
    return;
  }

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  await addAuditLog(userId, userLabel, "delete", "letter", lid, `حذف خطاب: ${letter?.subject ?? ""}`);

  res.sendStatus(204);
});

export default router;
