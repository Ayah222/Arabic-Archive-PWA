import { Router, type IRouter } from "express";
import type { SADocumentRevision } from "./store";
import { listDocuments, getDocument, createDocument, saveDocumentRevisions, deleteDocument, nextDocRef, addAuditLog } from "./archiveDb";

const router: IRouter = Router();

// GET all documents for a project
router.get("/sa/projects/:id/documents", async (req, res): Promise<void> => {
  const { id } = req.params;
  res.json(await listDocuments(id));
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

  const docRef = await nextDocRef();
  const doc = await createDocument(id, {
    name,
    docRef,
    type,
    url,
    size: size ?? null,
    notes: notes ?? null,
    revisions: [rev0],
  });

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  await addAuditLog(userId, userLabel, "create", "document", doc.id, `رفع مستند جديد: ${name} (Rev 0)`);

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

  const doc = await getDocument(id, did);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const newRevNum = (doc.revisions.at(-1)?.revNumber ?? -1) + 1;
  const newRev: SADocumentRevision = {
    revNumber: newRevNum,
    url,
    notes: notes ?? null,
    approvalStatus: "under_review",
    uploadedAt: new Date().toISOString(),
  };

  const updated = await saveDocumentRevisions(id, did, {
    revisions: [...doc.revisions, newRev],
    currentRevision: newRevNum,
    url,
    approvalStatus: "under_review",
  });

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  await addAuditLog(userId, userLabel, "update", "document", did, `إضافة إصدار Rev ${newRevNum} لمستند: ${doc.name}`);

  res.json(updated);
});

// PATCH update approval status for a document's revision (Prompt 2)
router.patch("/sa/projects/:id/documents/:did/approval", async (req, res): Promise<void> => {
  const { id, did } = req.params;
  const { approvalStatus, revNumber } = req.body as {
    approvalStatus?: string; revNumber?: number;
  };

  const doc = await getDocument(id, did);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const revIdx = revNumber !== undefined
    ? doc.revisions.findIndex((r) => r.revNumber === revNumber)
    : doc.revisions.length - 1;

  if (revIdx === -1) {
    res.status(404).json({ error: "Revision not found" });
    return;
  }

  const newStatus = approvalStatus as "under_review" | "approved" | "rejected" | "approved_with_notes";
  const revisions = [...doc.revisions];
  revisions[revIdx] = { ...revisions[revIdx], approvalStatus: newStatus };

  // Update document-level status to match current revision
  const overallStatus = revisions[revIdx].revNumber === doc.currentRevision ? newStatus : doc.approvalStatus;

  const updated = await saveDocumentRevisions(id, did, {
    revisions,
    currentRevision: doc.currentRevision,
    url: doc.url,
    approvalStatus: overallStatus,
  });

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  const statusMap: Record<string, string> = {
    under_review: "قيد المراجعة",
    approved: "معتمد",
    rejected: "مرفوض",
    approved_with_notes: "معتمد مع ملاحظات",
  };
  await addAuditLog(userId, userLabel, "update", "document", did, `تحديث حالة اعتماد مستند ${doc.name}: ${statusMap[newStatus] ?? newStatus}`);

  res.json(updated);
});

// DELETE a document
router.delete("/sa/projects/:id/documents/:did", async (req, res): Promise<void> => {
  const { id, did } = req.params;
  const doc = await getDocument(id, did);
  const deleted = await deleteDocument(id, did);
  if (!deleted) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  await addAuditLog(userId, userLabel, "delete", "document", did, `حذف مستند: ${doc?.name ?? ""}`);

  res.sendStatus(204);
});

export default router;
