import { Router, type IRouter } from "express";
import { store, newId } from "./store";

const router: IRouter = Router();

router.post("/sa/voice", async (req, res): Promise<void> => {
  const { text, projectId } = req.body as { text?: string; projectId?: string };
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const t = text.trim();

  const reminderKeywords = ["ذكرني", "تذكير", "موعد", "ذكر", "تذكر", "remind", "reminder"];
  const searchKeywords = ["ابحث", "بحث", "ابحث عن", "أين", "search", "find"];
  const addKeywords = ["أضف", "إضافة", "أنشئ", "اضف", "add", "create", "جديد"];

  const isReminder = reminderKeywords.some((kw) => t.includes(kw));
  const isSearch = searchKeywords.some((kw) => t.includes(kw));
  const isAdd = addKeywords.some((kw) => t.includes(kw));

  if (isReminder) {
    const notification = {
      id: newId(),
      title: "تذكير جديد من الميكروفون",
      message: t,
      type: "reminder" as const,
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      read: false,
      projectId: projectId ?? null,
      createdAt: new Date().toISOString(),
    };
    store.notifications.unshift(notification);
    res.json({
      action: "reminder",
      message: `تم إنشاء تذكير: "${t}"`,
      data: { notification },
    });
    return;
  }

  if (isSearch) {
    const term = t
      .replace(/^(ابحث عن|ابحث|بحث عن|بحث)\s*/i, "")
      .trim();
    const projects = store.projects.filter(
      (p) =>
        p.name.includes(term) ||
        p.client.includes(term) ||
        p.description.includes(term)
    );
    res.json({
      action: "search",
      message: `نتائج البحث عن: "${term}"`,
      data: { query: term, projects },
    });
    return;
  }

  if (isAdd) {
    res.json({
      action: "add",
      message: `تم فهم طلب الإضافة: "${t}" — يرجى استخدام النموذج المناسب`,
      data: { originalText: t },
    });
    return;
  }

  res.json({
    action: "unknown",
    message: `تم استقبال الأمر: "${t}" — لم يتم التعرف على نوع الأمر`,
    data: { originalText: t },
  });
});

export default router;
