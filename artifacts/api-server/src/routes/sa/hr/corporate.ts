// HR — Corporate/administrative affairs: company policies, government
// license tracking, and government correspondence.
import { Router, type IRouter } from "express";
import {
  listPolicies, createPolicy, updatePolicy, deletePolicy,
  listLicenses, createLicense, updateLicense, deleteLicense,
  listCorrespondence, createCorrespondence, updateCorrespondence, deleteCorrespondence,
} from "../hrDb";
import { addAuditLog } from "../archiveDb";

const router: IRouter = Router();

function userInfo(req: import("express").Request) {
  return {
    userId: (req.headers["x-user-id"] as string) ?? "system",
    userLabel: (req.headers["x-user-label"] as string) ?? "مستخدم",
  };
}

/* ─── Policies ─── */

router.get("/sa/hr/policies", async (_req, res): Promise<void> => {
  res.json(await listPolicies());
});

router.post("/sa/hr/policies", async (req, res): Promise<void> => {
  const { title, category, fileUrl, description, effectiveDate } = req.body as {
    title?: string; category?: string; fileUrl?: string; description?: string; effectiveDate?: string;
  };
  if (!title) {
    res.status(400).json({ error: "عنوان السياسة مطلوب" });
    return;
  }
  const policy = await createPolicy({ title, category, fileUrl, description, effectiveDate });
  const { userId, userLabel } = userInfo(req);
  await addAuditLog(userId, userLabel, "create", "سياسة", policy.id, `إضافة سياسة: ${title}`);
  res.status(201).json(policy);
});

router.patch("/sa/hr/policies/:id", async (req, res): Promise<void> => {
  const policy = await updatePolicy(req.params.id, req.body as Record<string, unknown>);
  if (!policy) {
    res.status(404).json({ error: "السياسة غير موجودة" });
    return;
  }
  res.json(policy);
});

router.delete("/sa/hr/policies/:id", async (req, res): Promise<void> => {
  const deleted = await deletePolicy(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "السياسة غير موجودة" });
    return;
  }
  const { userId, userLabel } = userInfo(req);
  await addAuditLog(userId, userLabel, "delete", "سياسة", req.params.id, "حذف سياسة");
  res.sendStatus(204);
});

/* ─── Licenses ─── */

router.get("/sa/hr/licenses", async (_req, res): Promise<void> => {
  res.json(await listLicenses());
});

router.post("/sa/hr/licenses", async (req, res): Promise<void> => {
  const { name, licenseNumber, issuingAuthority, issueDate, expiryDate, fileUrl, notes } = req.body as {
    name?: string; licenseNumber?: string; issuingAuthority?: string; issueDate?: string; expiryDate?: string; fileUrl?: string; notes?: string;
  };
  if (!name) {
    res.status(400).json({ error: "اسم الترخيص مطلوب" });
    return;
  }
  const license = await createLicense({ name, licenseNumber, issuingAuthority, issueDate, expiryDate, fileUrl, notes });
  const { userId, userLabel } = userInfo(req);
  await addAuditLog(userId, userLabel, "create", "ترخيص", license.id, `إضافة ترخيص: ${name}`);
  res.status(201).json(license);
});

router.patch("/sa/hr/licenses/:id", async (req, res): Promise<void> => {
  const license = await updateLicense(req.params.id, req.body as Record<string, unknown>);
  if (!license) {
    res.status(404).json({ error: "الترخيص غير موجود" });
    return;
  }
  res.json(license);
});

router.delete("/sa/hr/licenses/:id", async (req, res): Promise<void> => {
  const deleted = await deleteLicense(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "الترخيص غير موجود" });
    return;
  }
  const { userId, userLabel } = userInfo(req);
  await addAuditLog(userId, userLabel, "delete", "ترخيص", req.params.id, "حذف ترخيص");
  res.sendStatus(204);
});

/* ─── Government correspondence ─── */

router.get("/sa/hr/correspondence", async (_req, res): Promise<void> => {
  res.json(await listCorrespondence());
});

router.post("/sa/hr/correspondence", async (req, res): Promise<void> => {
  const { subject, direction, authority, date, reference, fileUrl, notes } = req.body as {
    subject?: string; direction?: string; authority?: string; date?: string; reference?: string; fileUrl?: string; notes?: string;
  };
  if (!subject) {
    res.status(400).json({ error: "موضوع المراسلة مطلوب" });
    return;
  }
  const correspondence = await createCorrespondence({ subject, direction, authority, date, reference, fileUrl, notes });
  const { userId, userLabel } = userInfo(req);
  await addAuditLog(userId, userLabel, "create", "مراسلة حكومية", correspondence.id, `إضافة مراسلة: ${subject}`);
  res.status(201).json(correspondence);
});

router.patch("/sa/hr/correspondence/:id", async (req, res): Promise<void> => {
  const correspondence = await updateCorrespondence(req.params.id, req.body as Record<string, unknown>);
  if (!correspondence) {
    res.status(404).json({ error: "المراسلة غير موجودة" });
    return;
  }
  res.json(correspondence);
});

router.delete("/sa/hr/correspondence/:id", async (req, res): Promise<void> => {
  const deleted = await deleteCorrespondence(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "المراسلة غير موجودة" });
    return;
  }
  const { userId, userLabel } = userInfo(req);
  await addAuditLog(userId, userLabel, "delete", "مراسلة حكومية", req.params.id, "حذف مراسلة");
  res.sendStatus(204);
});

export default router;
