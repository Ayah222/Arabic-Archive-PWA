// HR — Recruitment: candidates, CV-driven skill extraction, and lightweight
// offer tracking (folded into the candidate record to keep things simple).
import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import {
  listCandidates, getCandidate, createCandidate, updateCandidate, deleteCandidate,
} from "../hrDb";
import { addAuditLog } from "../archiveDb";
import { extractCvSkills } from "../../../lib/ai";
import { extractPdfText } from "../../../lib/pdfText";
import { hrActorFrom } from "./permissions";
import { resolveHrFilePath } from "./files";

const router: IRouter = Router();

function userInfo(_req: import("express").Request, res: import("express").Response) {
  // hrActorFrom reads the verified sa_hr_session actor set by requireHrAccess
  // — never trust client-supplied x-user-id/x-user-label headers here.
  const actor = hrActorFrom(res);
  return {
    userId: actor?.id ?? "system",
    userLabel: actor?.name ?? "مستخدم",
  };
}

router.get("/sa/hr/candidates", async (_req, res): Promise<void> => {
  res.json(await listCandidates());
});

router.get("/sa/hr/candidates/:id", async (req, res): Promise<void> => {
  const candidate = await getCandidate(req.params.id);
  if (!candidate) {
    res.status(404).json({ error: "المرشح غير موجود" });
    return;
  }
  res.json(candidate);
});

router.post("/sa/hr/candidates", async (req, res): Promise<void> => {
  const { name, phone, email, positionApplied, cvUrl, notes } = req.body as {
    name?: string; phone?: string; email?: string; positionApplied?: string; cvUrl?: string; notes?: string;
  };
  if (!name) {
    res.status(400).json({ error: "اسم المرشح مطلوب" });
    return;
  }
  const candidate = await createCandidate({ name, phone, email, positionApplied, cvUrl, notes });
  const { userId, userLabel } = userInfo(req, res);
  await addAuditLog(userId, userLabel, "create", "مرشح", candidate.id, `إضافة مرشح: ${name}`);
  res.status(201).json(candidate);
});

router.patch("/sa/hr/candidates/:id", async (req, res): Promise<void> => {
  const candidate = await updateCandidate(req.params.id, req.body as Record<string, unknown>);
  if (!candidate) {
    res.status(404).json({ error: "المرشح غير موجود" });
    return;
  }
  const { userId, userLabel } = userInfo(req, res);
  await addAuditLog(userId, userLabel, "update", "مرشح", candidate.id, `تحديث بيانات مرشح: ${candidate.name}`);
  res.json(candidate);
});

router.delete("/sa/hr/candidates/:id", async (req, res): Promise<void> => {
  const candidate = await getCandidate(req.params.id);
  const deleted = await deleteCandidate(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "المرشح غير موجود" });
    return;
  }
  const { userId, userLabel } = userInfo(req, res);
  await addAuditLog(userId, userLabel, "delete", "مرشح", req.params.id, `حذف مرشح: ${candidate?.name ?? ""}`);
  res.sendStatus(204);
});

// Attempts text-layer extraction (no OCR) from the uploaded CV, then asks the
// AI for a short skills list. Always returns 200 — `extracted: false` tells
// the client to fall back to manual skill entry rather than treating this as
// a hard failure.
router.post("/sa/hr/candidates/:id/extract-skills", async (req, res): Promise<void> => {
  const { cvUrl } = req.body as { cvUrl?: string };
  const candidate = await getCandidate(req.params.id);
  if (!candidate) {
    res.status(404).json({ error: "المرشح غير موجود" });
    return;
  }
  const urlToUse = cvUrl ?? candidate.cvUrl;
  if (!urlToUse) {
    res.json({ skills: [], extracted: false });
    return;
  }

  const filename = path.basename(new URL(urlToUse, "http://internal").pathname);
  const filePath = resolveHrFilePath(filename);
  if (!fs.existsSync(filePath) || !filename.toLowerCase().endsWith(".pdf")) {
    res.json({ skills: [], extracted: false });
    return;
  }

  const text = await extractPdfText(filePath);
  if (!text) {
    res.json({ skills: [], extracted: false });
    return;
  }

  const skills = await extractCvSkills(text);
  if (skills.length === 0) {
    res.json({ skills: [], extracted: false });
    return;
  }

  const updated = await updateCandidate(req.params.id, { skills, cvUrl: urlToUse });
  res.json({ skills, extracted: true, candidate: updated });
});

export default router;
