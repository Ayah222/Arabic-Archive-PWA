// Prompt 4 + Prompt 12: Scheduled jobs for automatic reminders
// Runs every hour to check for overdue documents and pending letters
import { store, newId } from "./store";

const REVIEW_DAYS_THRESHOLD = 5; // documents under review for more than N days trigger alert

function daysBetween(a: string, b: string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function runScheduledChecks() {
  const now = new Date();
  const todayStr = now.toISOString();

  // Check 1: Documents under review for more than REVIEW_DAYS_THRESHOLD days (Prompt 4)
  for (const doc of store.documents) {
    if (doc.approvalStatus !== "under_review") continue;
    const latestRev = doc.revisions[doc.currentRevision] ?? doc.revisions.at(-1);
    if (!latestRev) continue;
    const days = daysBetween(latestRev.uploadedAt, todayStr);
    if (days <= REVIEW_DAYS_THRESHOLD) continue;

    // Check if we already have a recent notification for this doc
    const alreadyNotified = store.notifications.some(
      (n) =>
        n.projectId === doc.projectId &&
        n.message.includes(doc.id) &&
        daysBetween(n.createdAt, todayStr) < 1
    );
    if (alreadyNotified) continue;

    const project = store.projects.find((p) => p.id === doc.projectId);
    store.notifications.unshift({
      id: newId(),
      title: `مستند متأخر: ${doc.name}`,
      message: `مستند "${doc.name}" في مشروع "${project?.name ?? "—"}" قيد المراجعة منذ ${days} يوم — الرجاء المتابعة. [${doc.id}]`,
      type: "warning",
      scheduledAt: null,
      read: false,
      projectId: doc.projectId,
      createdAt: todayStr,
    });
  }

  // Check 2: Outgoing letters without confirmed receipt (Prompt 4)
  for (const letter of store.letters) {
    if (letter.direction !== "outgoing") continue;
    if (letter.distributionStatus === "received") continue;
    const daysPending = daysBetween(letter.createdAt, todayStr);
    if (daysPending < 7) continue; // Only alert after 7 days

    const alreadyNotified = store.notifications.some(
      (n) =>
        n.message.includes(letter.id) &&
        daysBetween(n.createdAt, todayStr) < 1
    );
    if (alreadyNotified) continue;

    const project = store.projects.find((p) => p.id === letter.projectId);
    store.notifications.unshift({
      id: newId(),
      title: `متابعة مطلوبة: خطاب لم يُؤكد استلامه`,
      message: `خطاب "${letter.subject}" (${letter.autoRef}) في مشروع "${project?.name ?? "—"}" لم يُؤكد استلامه منذ ${daysPending} يوم. [${letter.id}]`,
      type: "warning",
      scheduledAt: null,
      read: false,
      projectId: letter.projectId,
      createdAt: todayStr,
    });
  }

  // Check 3: Contracts expiring within 30 days (Prompt 12)
  for (const contract of store.contracts) {
    if (contract.status !== "active") continue;
    const daysLeft = daysBetween(todayStr, contract.endDate + "T00:00:00Z");
    if (daysLeft < 0 || daysLeft > 30) continue;

    const alreadyNotified = store.notifications.some(
      (n) =>
        n.message.includes(contract.id) &&
        daysBetween(n.createdAt, todayStr) < 1
    );
    if (alreadyNotified) continue;

    const project = store.projects.find((p) => p.id === contract.projectId);
    store.notifications.unshift({
      id: newId(),
      title: `عقد يقترب من انتهائه`,
      message: `عقد "${contract.title}" في مشروع "${project?.name ?? "—"}" ينتهي خلال ${daysLeft} يوم. [${contract.id}]`,
      type: "reminder",
      scheduledAt: null,
      read: false,
      projectId: contract.projectId,
      createdAt: todayStr,
    });
  }

  // Check 4: Finance reminder dates (Prompt 12)
  for (const record of store.finance) {
    if (!record.reminderDate) continue;
    const daysLeft = daysBetween(todayStr, record.reminderDate + "T00:00:00Z");
    if (daysLeft < 0 || daysLeft > 3) continue; // Alert 3 days before

    const alreadyNotified = store.notifications.some(
      (n) =>
        n.message.includes(record.id) &&
        daysBetween(n.createdAt, todayStr) < 1
    );
    if (alreadyNotified) continue;

    store.notifications.unshift({
      id: newId(),
      title: `تذكير مالي: ${record.title}`,
      message: `${record.title} — ${daysLeft === 0 ? "اليوم" : `خلال ${daysLeft} أيام`}. المبلغ: ${record.amount.toLocaleString("ar-SA")} ر.س. [${record.id}]`,
      type: "reminder",
      scheduledAt: null,
      read: false,
      projectId: record.projectId,
      createdAt: todayStr,
    });
  }

  // Trim notifications to max 200
  if (store.notifications.length > 200) store.notifications.splice(200);
}

export function startScheduler() {
  // Run once on startup
  runScheduledChecks();

  // Then every hour
  setInterval(runScheduledChecks, 60 * 60 * 1000);
}
