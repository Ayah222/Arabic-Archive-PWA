// Prompt 4 + Prompt 12: Scheduled jobs for automatic reminders
// Runs every hour to check for overdue documents and pending letters
import { newId } from "./store";
import { syncEmailArchive } from "./emailArchive";
import { listAllDocuments, listAllLetters, listAllContracts, listFinance, listProjects } from "./archiveDb";
import { listEmployees, listAllEmployeeDocuments, listAllEmployeeLeaves, listAllLicenses } from "./hrDb";
import { listNotifications, persistNotifications } from "./notificationDb";

const REVIEW_DAYS_THRESHOLD = 5; // documents under review for more than N days trigger alert

function daysBetween(a: string, b: string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

async function runScheduledChecks() {
  const now = new Date();
  const todayStr = now.toISOString();
  const notifications = await listNotifications(500);

  const [documents, letters, contracts, finance, projects] = await Promise.all([
    listAllDocuments(),
    listAllLetters(),
    listAllContracts(),
    listFinance(),
    listProjects(),
  ]);

  // Check 1: Documents under review for more than REVIEW_DAYS_THRESHOLD days (Prompt 4)
  for (const doc of documents) {
    if (doc.approvalStatus !== "under_review") continue;
    const latestRev = doc.revisions[doc.currentRevision] ?? doc.revisions.at(-1);
    if (!latestRev) continue;
    const days = daysBetween(latestRev.uploadedAt, todayStr);
    if (days <= REVIEW_DAYS_THRESHOLD) continue;

    // Check if we already have a recent notification for this doc
    const alreadyNotified = notifications.some(
      (n) =>
        n.projectId === doc.projectId &&
        n.message.includes(doc.id) &&
        daysBetween(n.createdAt, todayStr) < 1
    );
    if (alreadyNotified) continue;

    const project = projects.find((p) => p.id === doc.projectId);
    notifications.unshift({
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
  for (const letter of letters) {
    if (letter.direction !== "outgoing") continue;
    if (letter.distributionStatus === "received") continue;
    const daysPending = daysBetween(letter.createdAt, todayStr);
    if (daysPending < 7) continue; // Only alert after 7 days

    const alreadyNotified = notifications.some(
      (n) =>
        n.message.includes(letter.id) &&
        daysBetween(n.createdAt, todayStr) < 1
    );
    if (alreadyNotified) continue;

    const project = projects.find((p) => p.id === letter.projectId);
    notifications.unshift({
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
  for (const contract of contracts) {
    if (contract.status !== "active") continue;
    const daysLeft = daysBetween(todayStr, contract.endDate + "T00:00:00Z");
    if (daysLeft < 0 || daysLeft > 30) continue;

    const alreadyNotified = notifications.some(
      (n) =>
        n.message.includes(contract.id) &&
        daysBetween(n.createdAt, todayStr) < 1
    );
    if (alreadyNotified) continue;

    const project = projects.find((p) => p.id === contract.projectId);
    notifications.unshift({
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
  for (const record of finance) {
    if (!record.reminderDate) continue;
    const daysLeft = daysBetween(todayStr, record.reminderDate + "T00:00:00Z");
    if (daysLeft < 0 || daysLeft > 3) continue; // Alert 3 days before

    const alreadyNotified = notifications.some(
      (n) =>
        n.message.includes(record.id) &&
        daysBetween(n.createdAt, todayStr) < 1
    );
    if (alreadyNotified) continue;

    notifications.unshift({
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

  // Check 5 (HR): Employee document expiry within 30 days
  const [employees, employeeDocuments, employeeLeaves, licenses] = await Promise.all([
    listEmployees(),
    listAllEmployeeDocuments(),
    listAllEmployeeLeaves(),
    listAllLicenses(),
  ]);

  for (const doc of employeeDocuments) {
    if (!doc.expiryDate) continue;
    const daysLeft = daysBetween(todayStr, doc.expiryDate + "T00:00:00Z");
    if (daysLeft < 0 || daysLeft > 30) continue;

    const alreadyNotified = notifications.some(
      (n) => n.message.includes(doc.id) && daysBetween(n.createdAt, todayStr) < 1
    );
    if (alreadyNotified) continue;

    const employee = employees.find((e) => e.id === doc.employeeId);
    notifications.unshift({
      id: newId(),
      title: `مستند موظف يقترب من انتهائه`,
      message: `مستند "${doc.name}" للموظف "${employee?.name ?? "—"}" ينتهي خلال ${daysLeft} يوم. [${doc.id}]`,
      type: "reminder",
      audience: "admin",
      scheduledAt: null,
      read: false,
      projectId: null,
      createdAt: todayStr,
    });
  }

  // Check 6 (HR): Upcoming leave start/return within 3 days
  for (const leave of employeeLeaves) {
    const employee = employees.find((e) => e.id === leave.employeeId);
    const daysToStart = daysBetween(todayStr, leave.startDate + "T00:00:00Z");
    const daysToEnd = daysBetween(todayStr, leave.endDate + "T00:00:00Z");

    if (daysToStart >= 0 && daysToStart <= 3) {
      const alreadyNotified = notifications.some(
        (n) => n.message.includes(`leave-start:${leave.id}`) && daysBetween(n.createdAt, todayStr) < 1
      );
      if (!alreadyNotified) {
        notifications.unshift({
          id: newId(),
          title: `إجازة موظف تبدأ قريباً`,
          message: `إجازة "${employee?.name ?? "—"}" تبدأ خلال ${daysToStart} يوم. [leave-start:${leave.id}]`,
          type: "reminder",
          audience: "admin",
          scheduledAt: null,
          read: false,
          projectId: null,
          createdAt: todayStr,
        });
      }
    }

    if (daysToEnd >= 0 && daysToEnd <= 3) {
      const alreadyNotified = notifications.some(
        (n) => n.message.includes(`leave-end:${leave.id}`) && daysBetween(n.createdAt, todayStr) < 1
      );
      if (!alreadyNotified) {
        notifications.unshift({
          id: newId(),
          title: `عودة موظف من الإجازة قريباً`,
          message: `عودة "${employee?.name ?? "—"}" من الإجازة خلال ${daysToEnd} يوم. [leave-end:${leave.id}]`,
          type: "reminder",
          audience: "admin",
          scheduledAt: null,
          read: false,
          projectId: null,
          createdAt: todayStr,
        });
      }
    }
  }

  // Check 7 (HR): Probation end within 7 days (hireDate + probationDays)
  for (const employee of employees) {
    if (!employee.hireDate || employee.status !== "active") continue;
    const probationEnd = new Date(employee.hireDate);
    probationEnd.setDate(probationEnd.getDate() + employee.probationDays);
    const daysLeft = daysBetween(todayStr, probationEnd.toISOString());
    if (daysLeft < 0 || daysLeft > 7) continue;

    const alreadyNotified = notifications.some(
      (n) => n.message.includes(`probation:${employee.id}`) && daysBetween(n.createdAt, todayStr) < 1
    );
    if (alreadyNotified) continue;

    notifications.unshift({
      id: newId(),
      title: `انتهاء فترة تجربة موظف`,
      message: `فترة تجربة "${employee.name}" تنتهي خلال ${daysLeft} يوم. [probation:${employee.id}]`,
      type: "reminder",
      audience: "admin",
      scheduledAt: null,
      read: false,
      projectId: null,
      createdAt: todayStr,
    });
  }

  // Check 8 (HR): Government/company license expiry within 30 days
  for (const license of licenses) {
    if (!license.expiryDate) continue;
    const daysLeft = daysBetween(todayStr, license.expiryDate + "T00:00:00Z");
    if (daysLeft < 0 || daysLeft > 30) continue;

    const alreadyNotified = notifications.some(
      (n) => n.message.includes(license.id) && daysBetween(n.createdAt, todayStr) < 1
    );
    if (alreadyNotified) continue;

    notifications.unshift({
      id: newId(),
      title: `ترخيص يقترب من انتهائه`,
      message: `ترخيص "${license.name}" ينتهي خلال ${daysLeft} يوم. [${license.id}]`,
      type: "warning",
      audience: "admin",
      scheduledAt: null,
      read: false,
      projectId: null,
      createdAt: todayStr,
    });
  }

  // Trim notifications to max 200
  if (notifications.length > 200) notifications.splice(200);
  await persistNotifications(notifications);
}

export function startScheduler() {
  // Run once on startup
  void runScheduledChecks().catch((error) => console.error("Initial scheduled checks failed", error));

  // Then every hour
  setInterval(() => {
    void runScheduledChecks().catch((error) => console.error("Scheduled checks failed", error));
  }, 60 * 60 * 1000);

  // Gmail is read-only through the Replit connector. Sync is intentionally
  // isolated so an external API error never interrupts the archive scheduler.
  void syncEmailArchive().catch((error) => console.error("Initial Gmail archive sync failed", error));
  setInterval(() => {
    void syncEmailArchive().catch((error) => console.error("Scheduled Gmail archive sync failed", error));
  }, 30 * 60 * 1000);
}
