import { Router, type Request } from "express";
import { createClient } from "@supabase/supabase-js";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { deleteNotificationsContaining } from "./notificationDb";

const router = Router();
const gmail = new ReplitConnectors();

function adminClient() {
  const url = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function appOrigin(req: Request): string {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  if (origin) return origin.replace(/\/$/, "");
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  return host ? `${proto ?? "https"}://${host}` : "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char] ?? char);
}

async function sendActivationEmail(email: string, name: string, loginUrl: string): Promise<void> {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(loginUrl);
  const subject = "تم تفعيل حسابك في نظام الأرشيف الداخلي";
  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033">
      <p>مرحباً ${safeName}،</p>
      <p>تمت الموافقة على حسابك وتفعيله بنجاح في نظام الأرشيف الداخلي.</p>
      <p><a href="${safeUrl}" style="display:inline-block;padding:12px 22px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">الدخول إلى النظام</a></p>
      <p style="color:#667085;font-size:13px">يمكنك تسجيل الدخول باستخدام بريدك الإلكتروني وكلمة المرور التي قمت بتعيينها.</p>
    </div>`;
  const rawMessage = [
    `To: ${email}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");
  const raw = Buffer.from(rawMessage).toString("base64url");
  const response = await gmail.proxy("google-mail", "/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { raw },
  });
  if (!response.ok) {
    throw new Error(`Activation email failed (${response.status}): ${await response.text()}`);
  }
}

// GET /api/sa/profiles  — all profiles
router.get("/sa/profiles", async (_req, res) => {
  await adminClient().from("profiles").update({ role: "admin" }).eq("role", "super_admin");
  await adminClient().from("profiles").update({ role: "data_entry" }).eq("role", "employee");

  const { data, error } = await adminClient()
    .from("profiles")
    .select("*")
    .order("email");
  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

// Fallback profile lookup used after a Supabase employee login.
router.get("/sa/profiles/:id", async (req, res) => {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("id,email,role,status,hr_access")
    .eq("id", req.params.id)
    .single();
  if (error || !data) return res.status(404).json({ error: "Profile not found" });
  return res.json(
    data.role === "super_admin"
      ? { ...data, role: "admin" }
      : data.role === "employee"
        ? { ...data, role: "data_entry" }
        : data,
  );
});

// PATCH /api/sa/profiles/:id  — update role and/or status
router.patch("/sa/profiles/:id", async (req, res) => {
  const { id } = req.params;
  const { role, status, hr_access } = req.body as { role?: string; status?: string; hr_access?: boolean };
  const normalizedRole = role === "employee" ? "data_entry" : role;
  if (normalizedRole && !["admin", "data_entry", "viewer"].includes(normalizedRole)) {
    return res.status(400).json({ error: "role must be admin, data_entry, or viewer" });
  }
  const updates: Record<string, string | boolean> = {};
  if (normalizedRole) updates.role = normalizedRole;
  if (status) updates.status = status;
  if (typeof hr_access === "boolean") updates.hr_access = hr_access;

  const admin = adminClient();
  const { data: previousProfile } = await admin
    .from("profiles")
    .select("email,status")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  let activationEmailSent: boolean | undefined;
  if (status === "active") {
    await deleteNotificationsContaining(`[pending-user:${id}]`);
    if (previousProfile?.status !== "active" && data.email) {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(id);
        const name = String(authUser.user?.user_metadata?.name ?? data.email.split("@")[0]);
        const origin = appOrigin(req);
        if (!origin) throw new Error("Application origin is unavailable");
        await sendActivationEmail(data.email, name, `${origin}/login`);
        activationEmailSent = true;
      } catch (emailError) {
        activationEmailSent = false;
        console.error("Unable to send activation email", emailError);
      }
    }
  }
  return res.json({ ...data, activationEmailSent });
});

// Reject a pending invitation and completely remove the auth account/profile.
router.delete("/sa/profiles/:id", async (req, res) => {
  const { id } = req.params;
  const admin = adminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,status")
    .eq("id", id)
    .single();

  if (profileError || !profile) return res.status(404).json({ error: "Profile not found" });
  if (profile.status !== "pending") {
    return res.status(409).json({ error: "Only pending invitations can be rejected" });
  }

  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) return res.status(400).json({ error: authError.message });

  await admin.from("profiles").delete().eq("id", id);
  await deleteNotificationsContaining(`[pending-user:${id}]`);
  return res.json({ id });
});

export default router;
