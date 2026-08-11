import { Router, type IRouter } from "express";
import { store, newId, addAuditLog, nextDocRef, type SADocumentRevision } from "./store";
import { notifyAdmins } from "./notificationHelper";

const router: IRouter = Router();

// GET all documents for a project
router.get("/sa/projects/:id/documents", async (req, res): Promise<void> => {
  const { id } = req.params;
  res.json(store.documents.filter((d) => d.projectId === id));
});

// POST create a new document (Rev 0)
router.post("/sa/projects/:id/documents", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { name, type, url, size, notes } = req.body as {
    name?: string; type?: string; url?: string;
    size?: number; notes?: string;
  };

  if (!name || !type || !url) {
    res.status(400).json({ error: "name, type, url are required" });
    return;
  }

  const rev0: SADocumentRevision = {
    revNumber: 0,
    url,
    notes: notes ?? null,
    approvalStatus: "under_review",
    uploadedAt: new Date().toISOString(),
  };

  const doc = {
    id: newId(),
    projectId: id,
    name,
    docRef: nextDocRef(),
    type: type as "pdf" | "image" | "word" | "excel" | "powerpoint" | "text" | "other",
    url,
    size: size ?? null,
    notes: notes ?? null,
    revisions: [rev0],
    currentRevision: 0,
    approvalStatus: "under_review" as const,
    createdAt: new Date().toISOString(),
  };
  store.documents.push(doc);

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  addAuditLog(userId, userLabel, "create", "document", doc.id, `رفع مستند جديد: ${name} (Rev 0)`);

  // Notify admins — fire and forget (don't block the response)
  notifyAdmins({
    title: "📄 مستند جديد بانتظار المراجعة",
    message: `${userLabel} رفع مستنداً جديداً: «${name}»`,
    type: "info",
    priority: "medium",
    projectId: id,
    actionUrl: `/projects/${id}/documents`,
    createdById: userId === "system" ? null : userId,
    createdByName: userLabel === "مستخدم" ? null : userLabel,
  }).catch(console.error);

  res.status(201).json(doc);
});

// POST add a new revision to existing document (Prompt 2)
router.post("/sa/projects/:id/documents/:did/revisions", async (req, res): Promise<void> => {
  const { id, did } = req.params;
  const { url, notes } = req.body as { url?: string; notes?: string };

  if (!url) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  const idx = store.documents.findIndex((d) => d.id === did && d.projectId === id);
  if (idx === -1) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const doc = store.documents[idx];
  const newRevNum = (doc.revisions.at(-1)?.revNumber ?? -1) + 1;
  const newRev: SADocumentRevision = {
    revNumber: newRevNum,
    url,
    notes: notes ?? null,
    approvalStatus: "under_review",
    uploadedAt: new Date().toISOString(),
  };

  doc.revisions.push(newRev);
  doc.currentRevision = newRevNum;
  doc.url = url;
  doc.approvalStatus = "under_review";

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  addAuditLog(userId, userLabel, "update", "document", did, `إضافة إصدار Rev ${newRevNum} لمستند: ${doc.name}`);

  res.json(doc);
});

// PATCH update approval status for a document's revision (Prompt 2)
router.patch("/sa/projects/:id/documents/:did/approval", async (req, res): Promise<void> => {
  const { id, did } = req.params;
  const { approvalStatus, revNumber } = req.body as {
    approvalStatus?: string; revNumber?: number;
  };

  const idx = store.documents.findIndex((d) => d.id === did && d.projectId === id);
  if (idx === -1) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const doc = store.documents[idx];
  const revIdx = revNumber !== undefined
    ? doc.revisions.findIndex((r) => r.revNumber === revNumber)
    : doc.revisions.length - 1;

  if (revIdx === -1) {
    res.status(404).json({ error: "Revision not found" });
    return;
  }

  const newStatus = approvalStatus as "under_review" | "approved" | "rejected" | "approved_with_notes";
  doc.revisions[revIdx].approvalStatus = newStatus;

  // Update document-level status to match current revision
  if (doc.revisions[revIdx].revNumber === doc.currentRevision) {
    doc.approvalStatus = newStatus;
  }

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  const statusMap: Record<string, string> = {
    under_review: "قيد المراجعة",
    approved: "معتمد",
    rejected: "مرفوض",
    approved_with_notes: "معتمد مع ملاحظات",
  };
  addAuditLog(userId, userLabel, "update", "document", did, `تحديث حالة اعتماد مستند ${doc.name}: ${statusMap[newStatus] ?? newStatus}`);

  res.json(doc);
});

// DELETE a document
router.delete("/sa/projects/:id/documents/:did", async (req, res): Promise<void> => {
  const { id, did } = req.params;
  const idx = store.documents.findIndex((d) => d.id === did && d.projectId === id);
  if (idx === -1) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  const name = store.documents[idx].name;
  store.documents.splice(idx, 1);

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  addAuditLog(userId, userLabel, "delete", "document", did, `حذف مستند: ${name}`);

  res.sendStatus(204);
});

export default router;
