import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { hasAdminAccess, verifyEmailArchiveSession } from "../../lib/emailArchiveAuth";
import type { Request } from "express";

const router = Router();

function appOrigin(req: Request): string {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  if (origin) return origin.replace(/\/$/, "");
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  return host ? `${proto ?? "https"}://${host}` : "";
}

router.post("/sa/invite", async (req, res): Promise<void> => {
  const { email: rawEmail, role } = req.body as {
    email?: string;
    role?: string;
  };
  const email = rawEmail?.trim().toLowerCase();
  const normalizedRole = role === "employee" ? "data_entry" : role ?? "data_entry";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "أدخلي بريداً إلكترونياً صحيحاً." });
    return;
  }
  if (!["admin", "data_entry", "viewer"].includes(normalizedRole)) {
    res.status(400).json({ error: "الصلاحية المحددة غير صالحة." });
    return;
  }

  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor || !hasAdminAccess(actor)) {
    res.status(403).json({ error: "إضافة المستخدمين متاحة لمدير المؤسسة فقط." });
    return;
  }

  const supabaseUrl = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "إعداد اتصال Supabase غير مكتمل." });
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingProfile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profileLookupError) {
    res.status(500).json({ error: "تعذر التحقق من البريد الإلكتروني." });
    return;
  }
  if (existingProfile) {
    res.status(409).json({ error: "يوجد حساب بهذا البريد الإلكتروني مسبقاً." });
    return;
  }

  const origin = appOrigin(req);
  if (!origin) {
    res.status(500).json({ error: "تعذر تحديد رابط التطبيق لإرسال الدعوة." });
    return;
  }
  const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role: normalizedRole },
    redirectTo: `${origin}/accept-invite`,
  });
  if (createError || !created.user) {
    const duplicate = /already|registered|exists/i.test(createError?.message ?? "");
    res.status(duplicate ? 409 : 400).json({
      error: duplicate
        ? "يوجد حساب بهذا البريد الإلكتروني مسبقاً."
        : "تعذر إنشاء الحساب في Supabase.",
    });
    return;
  }

  const userId = created.user.id;
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email,
    name: email.split("@")[0],
    role: normalizedRole,
    hr_access: false,
    status: "pending",
    is_active: false,
    invited_by: actor.id,
  }, { onConflict: "id" });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    res.status(500).json({ error: "تعذر حفظ ملف الموظف؛ أُلغي إنشاء الحساب." });
    return;
  }

  const { error: membershipError } = await admin.from("organization_memberships").insert({
    tenant_id: actor.tenantId,
    user_id: userId,
    role: normalizedRole,
    hr_access: false,
    status: "pending",
  });

  if (membershipError) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    res.status(500).json({ error: "تعذر ربط الموظف بمؤسستك؛ أُلغي إنشاء الحساب." });
    return;
  }

  res.status(201).json({
    success: true,
    user: { id: userId, email, role: normalizedRole, status: "pending" },
  });
});

export default router;
