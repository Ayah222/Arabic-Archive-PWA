// Prompt 3: Per-project reports
import { Router, type IRouter } from "express";
import { store } from "./store";

const router: IRouter = Router();

const REVIEW_DAYS_THRESHOLD = 5; // configurable

function daysBetween(a: string, b: string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function buildProjectReport(projectId: string, period: "weekly" | "monthly") {
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) return null;

  const now = new Date();
  const periodMs = period === "weekly" ? 7 * 86400000 : 30 * 86400000;
  const periodStart = new Date(now.getTime() - periodMs).toISOString();

  const docs = store.documents.filter((d) => d.projectId === projectId);
  const letters = store.letters.filter((l) => l.projectId === projectId);
  const contracts = store.contracts.filter((c) => c.projectId === projectId);
  const meetings = store.meetings.filter((m) => m.projectId === projectId);
  const contacts = store.contacts.filter((c) => c.projectId === projectId);

  // New in period
  const newDocs = docs.filter((d) => d.createdAt >= periodStart);
  const newLetters = letters.filter((l) => l.createdAt >= periodStart);

  // Document status counts
  const underReview = docs.filter((d) => d.approvalStatus === "under_review");
  const approved = docs.filter((d) => d.approvalStatus === "approved");
  const rejected = docs.filter((d) => d.approvalStatus === "rejected");
  const approvedWithNotes = docs.filter((d) => d.approvalStatus === "approved_with_notes");

  // Overdue documents: under_review for more than REVIEW_DAYS_THRESHOLD days
  const overdue = underReview.filter((d) => {
    const latestRev = d.revisions[d.currentRevision] ?? d.revisions.at(-1);
    if (!latestRev) return false;
    return daysBetween(latestRev.uploadedAt, now.toISOString()) > REVIEW_DAYS_THRESHOLD;
  });

  // Revision changes in period
  const revisionChanges: Array<{ docName: string; fromRev: number; toRev: number; date: string }> = [];
  for (const doc of docs) {
    const recentRevs = doc.revisions.filter((r) => r.uploadedAt >= periodStart);
    if (recentRevs.length > 0 && doc.revisions.length > 1) {
      const firstRevInPeriod = recentRevs[0];
      const prevRev = doc.revisions.find((r) => r.revNumber === firstRevInPeriod.revNumber - 1);
      if (prevRev) {
        revisionChanges.push({
          docName: doc.name,
          fromRev: prevRev.revNumber,
          toRev: firstRevInPeriod.revNumber,
          date: firstRevInPeriod.uploadedAt.split("T")[0],
        });
      }
    }
  }

  // Outgoing letters pending confirmation
  const pendingLetters = letters.filter(
    (l) => l.direction === "outgoing" && l.distributionStatus !== "received"
  );

  // Contracts expiring soon (within 60 days)
  const expiringContracts = contracts.filter((c) => {
    if (c.status !== "active" || !c.endDate) return false;
    const daysLeft = daysBetween(now.toISOString(), c.endDate + "T00:00:00Z");
    return daysLeft >= 0 && daysLeft <= 60;
  });

  return {
    generatedAt: now.toISOString(),
    period,
    project: {
      id: project.id,
      name: project.name,
      client: project.client,
      status: project.status,
      progress: project.progress,
      location: project.location,
    },
    summary: {
      totalDocuments: docs.length,
      totalLetters: letters.length,
      totalContracts: contracts.length,
      totalMeetings: meetings.length,
      totalContacts: contacts.length,
      newDocumentsInPeriod: newDocs.length,
      newLettersInPeriod: newLetters.length,
    },
    documentStatus: {
      underReview: underReview.length,
      approved: approved.length,
      rejected: rejected.length,
      approvedWithNotes: approvedWithNotes.length,
      overdue: overdue.length,
    },
    overdueDocuments: overdue.map((d) => {
      const latestRev = d.revisions[d.currentRevision] ?? d.revisions.at(-1);
      return {
        id: d.id,
        name: d.name,
        daysPending: latestRev
          ? daysBetween(latestRev.uploadedAt, now.toISOString())
          : 0,
        uploadedAt: latestRev?.uploadedAt,
      };
    }),
    revisionChanges,
    pendingLetters: pendingLetters.map((l) => ({
      id: l.id,
      subject: l.subject,
      to: l.to,
      date: l.date,
      autoRef: l.autoRef,
      distributionStatus: l.distributionStatus,
    })),
    expiringContracts: expiringContracts.map((c) => ({
      id: c.id,
      title: c.title,
      party: c.party,
      endDate: c.endDate,
      daysLeft: daysBetween(now.toISOString(), c.endDate + "T00:00:00Z"),
    })),
  };
}

// GET report for a single project
router.get("/sa/reports/:projectId", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const period = (req.query.period as string) === "monthly" ? "monthly" : "weekly";
  const report = buildProjectReport(projectId, period);
  if (!report) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(report);
});

// GET all project reports list (summary only)
router.get("/sa/reports", async (req, res): Promise<void> => {
  const period = (req.query.period as string) === "monthly" ? "monthly" : "weekly";
  const reports = store.projects
    .map((p) => buildProjectReport(p.id, period))
    .filter(Boolean);
  res.json(reports);
});

export default router;
