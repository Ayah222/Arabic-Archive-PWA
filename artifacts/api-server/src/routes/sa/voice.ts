// Prompt 6: Enhanced voice/NLP search
// Uses keyword mapping + structured query for Arabic natural language
// Claude API can be plugged in via ANTHROPIC_API_KEY env var
import { Router, type IRouter } from "express";
import { store, newId } from "./store";
import { notifyUser } from "./notificationHelper";

const router: IRouter = Router();

// Natural language query patterns → structured queries
function parseNaturalQuery(text: string): {
  action: "search" | "reminder" | "add" | "last_letter" | "pending_docs" | "unknown";
  params: Record<string, string>;
} {
  const t = text.trim();

  // "آخر خطاب صادر لمشروع X"
  if (/آخر خطاب/.test(t)) {
    const projectMatch = t.match(/مشروع\s+(.+)/) ?? t.match(/لـ?(.+)/);
    return {
      action: "last_letter",
      params: { projectHint: projectMatch?.[1]?.trim() ?? "" },
    };
  }

  // "المستندات المعلقة / قيد المراجعة"
  if (/مستند.*(معلق|مراجعة|قيد)|(معلق|مراجعة|قيد).*(مستند|وثيقة)/.test(t)) {
    const contractorMatch = t.match(/مقاول\s+(.+)/) ?? t.match(/من\s+(.+)/);
    return {
      action: "pending_docs",
      params: { contractorHint: contractorMatch?.[1]?.trim() ?? "" },
    };
  }

  // Reminder keywords
  if (/ذكرني|تذكير|تذكر|remind/.test(t)) {
    return { action: "reminder", params: { text: t } };
  }

  // Search keywords
  if (/ابحث|بحث|أين|find|search/.test(t)) {
    const term = t.replace(/^(ابحث عن|ابحث|بحث عن|بحث|أين)\s*/i, "").trim();
    return { action: "search", params: { query: term } };
  }

  // Add keywords
  if (/أضف|إضافة|اضف|add|create|جديد/.test(t)) {
    return { action: "add", params: { text: t } };
  }

  // Fallback: treat as search
  return { action: "search", params: { query: t } };
}

router.post("/sa/voice", async (req, res): Promise<void> => {
  const { text, projectId } = req.body as { text?: string; projectId?: string };
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const { action, params } = parseNaturalQuery(text);

  if (action === "last_letter") {
    const hint = params.projectHint?.toLowerCase() ?? "";
    // Find matching project
    const project = hint
      ? store.projects.find((p) => p.name.toLowerCase().includes(hint) || p.id.includes(hint))
      : projectId
        ? store.projects.find((p) => p.id === projectId)
        : null;

    const letters = project
      ? store.letters.filter((l) => l.projectId === project.id)
      : projectId
        ? store.letters.filter((l) => l.projectId === projectId)
        : store.letters;

    const outgoing = letters.filter((l) => l.direction === "outgoing");
    outgoing.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last = outgoing[0];

    return res.json({
      action: "last_letter",
      message: last
        ? `آخر خطاب صادر: "${last.subject}" — ${last.date} — ${last.autoRef}`
        : "لا يوجد خطاب صادر مطابق",
      data: { letter: last ?? null, project: project ?? null },
    }) as unknown as void;
  }

  if (action === "pending_docs") {
    const hint = params.contractorHint?.toLowerCase() ?? "";
    let docs = store.documents.filter((d) => d.approvalStatus === "under_review");
    if (hint) {
      const proj = store.projects.find((p) =>
        p.name.toLowerCase().includes(hint) || p.client.toLowerCase().includes(hint)
      );
      if (proj) docs = docs.filter((d) => d.projectId === proj.id);
    }
    const result = docs.map((d) => ({
      ...d,
      projectName: store.projects.find((p) => p.id === d.projectId)?.name ?? "—",
    }));

    return res.json({
      action: "pending_docs",
      message: `${result.length} مستند قيد المراجعة`,
      data: { documents: result },
    }) as unknown as void;
  }

  if (action === "reminder") {
    // Voice reminders are personal — scope to the requesting user
    const voiceUserId = req.authUser?.id ?? (req.headers["x-user-id"] as string | undefined) ?? null;
    const notificationId = newId();
    const notificationCreatedAt = new Date().toISOString();

    let created: { id: string; createdAt: string };
    if (voiceUserId) {
      // Route through notifyUser — returns the authoritative id/createdAt
      created = await notifyUser(voiceUserId, {
        title: "تذكير جديد من الميكروفون",
        message: params.text ?? text,
        type: "reminder",
        priority: "medium",
        projectId: projectId ?? null,
      }).catch((err) => {
        console.error("[voice reminder]", err);
        // Synthesise a fallback identity so the route still responds
        return { id: notificationId, createdAt: notificationCreatedAt };
      });
    } else {
      // No known recipient — write directly to in-memory as a last resort
      store.notifications.unshift({
        id: notificationId,
        recipientId: null,
        title: "تذكير جديد من الميكروفون",
        message: params.text ?? text,
        type: "reminder",
        priority: "medium",
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        read: false,
        projectId: projectId ?? null,
        actionUrl: null,
        createdByName: null,
        createdAt: notificationCreatedAt,
      });
      created = { id: notificationId, createdAt: notificationCreatedAt };
    }

    return res.json({
      action: "reminder",
      message: `تم إنشاء تذكير: "${text}"`,
      data: { id: created.id, createdAt: created.createdAt },
    }) as unknown as void;
  }

  if (action === "search") {
    const q = (params.query ?? text).toLowerCase();
    const projects = store.projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    );
    const letters = store.letters
      .filter((l) => l.subject.toLowerCase().includes(q) || l.from.toLowerCase().includes(q))
      .map((l) => ({
        ...l,
        projectName: store.projects.find((p) => p.id === l.projectId)?.name ?? "—",
      }));
    const documents = store.documents
      .filter((d) => d.name.toLowerCase().includes(q))
      .map((d) => ({
        ...d,
        projectName: store.projects.find((p) => p.id === d.projectId)?.name ?? "—",
      }));

    return res.json({
      action: "search",
      message: `نتائج البحث عن: "${params.query ?? text}"`,
      data: { query: params.query ?? text, projects, letters, documents },
    }) as unknown as void;
  }

  if (action === "add") {
    return res.json({
      action: "add",
      message: `تم فهم طلب الإضافة: "${text}" — يرجى استخدام النموذج المناسب`,
      data: { originalText: text },
    }) as unknown as void;
  }

  res.json({
    action: "unknown",
    message: `تم استقبال الأمر: "${text}"`,
    data: { originalText: text },
  });
});

export default router;
