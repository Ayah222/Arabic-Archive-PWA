// Prompt 4 + Prompt 12: Scheduled jobs for automatic reminders
// Runs every hour to check for overdue documents and pending letters
import { store } from "./store";
import { notifyAdmins, wasNotifiedToday } from "./notificationHelper";

const REVIEW_DAYS_THRESHOLD = 5; // documents under review for more than N days trigger alert

function daysBetween(a: string, b: string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

async function runScheduledChecks() {
  const now = new Date();
  const todayStr = now.toISOString();

  // Check 1: Documents under review for more than REVIEW_DAYS_THRESHOLD days (Prompt 4)
  for (const doc of store.documents) {
    if (doc.approvalStatus !== "under_review") continue;
    const latestRev = doc.revisions[doc.currentRevision] ?? doc.revisions.at(-1);
    if (!latestRev) continue;
    const days = daysBetween(latestRev.uploadedAt, todayStr);
    if (days <= REVIEW_DAYS_THRESHOLD) continue;

    // Dedup: recipient-independent check via wasNotifiedToday (Supabase-durable in Supabase mode)
    if (await wasNotifiedToday(doc.id)) continue;

    const project = store.projects.find((p) => p.id === doc.projectId);
    await notifyAdmins({
      title: `مستند متأخر: ${doc.name}`,
      message: `مستند "${doc.name}" في مشروع "${project?.name ?? "—"}" قيد المراجعة منذ ${days} يوم — الرجاء المتابعة. [${doc.id}]`,
      type: "warning",
      priority: "high",
      projectId: doc.projectId,
      actionUrl: `/projects/${doc.projectId}/documents`,
    });
  }

  // Check 2: Outgoing letters without confirmed receipt (Prompt 4)
  for (const letter of store.letters) {
    if (letter.direction !== "outgoing") continue;
    if (letter.distributionStatus === "received") continue;
    const daysPending = daysBetween(letter.createdAt, todayStr);
    if (daysPending < 7) continue;

    if (await wasNotifiedToday(letter.id)) continue;

    const project = store.projects.find((p) => p.id === letter.projectId);
    await notifyAdmins({
      title: `متابعة مطلوبة: خطاب لم يُؤكد استلامه`,
      message: `خطاب "${letter.subject}" (${letter.autoRef}) في مشروع "${project?.name ?? "—"}" لم يُؤكد استلامه منذ ${daysPending} يوم. [${letter.id}]`,
      type: "warning",
      priority: "medium",
      projectId: letter.projectId,
      actionUrl: `/projects/${letter.projectId}/letters`,
    });
  }

  // Check 3: Contracts expiring within 30 days (Prompt 12)
  for (const contract of store.contracts) {
    if (contract.status !== "active") continue;
    const daysLeft = daysBetween(todayStr, contract.endDate + "T00:00:00Z");
    if (daysLeft < 0 || daysLeft > 30) continue;

    if (await wasNotifiedToday(contract.id)) continue;

    const project = store.projects.find((p) => p.id === contract.projectId);
    await notifyAdmins({
      title: `عقد يقترب من انتهائه`,
      message: `عقد "${contract.title}" في مشروع "${project?.name ?? "—"}" ينتهي خلال ${daysLeft} يوم. [${contract.id}]`,
      type: "reminder",
      priority: daysLeft <= 7 ? "high" : "medium",
      projectId: contract.projectId,
      actionUrl: `/projects/${contract.projectId}/contracts`,
    });
  }

  // Check 4: Finance reminder dates (Prompt 12)
  for (const record of store.finance) {
    if (!record.reminderDate) continue;
    const daysLeft = daysBetween(todayStr, record.reminderDate + "T00:00:00Z");
    if (daysLeft < 0 || daysLeft > 3) continue;

    if (await wasNotifiedToday(record.id)) continue;

    await notifyAdmins({
      title: `تذكير مالي: ${record.title}`,
      message: `${record.title} — ${daysLeft === 0 ? "اليوم" : `خلال ${daysLeft} أيام`}. المبلغ: ${record.amount.toLocaleString("ar-SA")} ر.س. [${record.id}]`,
      type: "reminder",
      priority: "medium",
      projectId: record.projectId,
    });
  }
}

export function startScheduler() {
  // Run once on startup (fire-and-forget — errors are logged inside)
  runScheduledChecks().catch(console.error);

  // Then every hour
  setInterval(() => runScheduledChecks().catch(console.error), 60 * 60 * 1000);
}
