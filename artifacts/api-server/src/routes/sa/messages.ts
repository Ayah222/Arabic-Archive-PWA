import { Router, type Request, type Response } from "express";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { verifyEmailArchiveSession, type EmailArchiveActor } from "../../lib/emailArchiveAuth";
import { store } from "./store";

const router = Router();
const MANAGER_ID = "admin";

function actorFrom(req: Request, res: Response): EmailArchiveActor | null {
  const actor = verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
  if (!actor) res.status(401).json({ error: "يلزم تسجيل الدخول" });
  return actor;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function canChatWith(actor: EmailArchiveActor, userId: string) {
  return actor.role === "admin" ? userId !== MANAGER_ID && userId !== actor.id : userId === MANAGER_ID;
}

async function profileContacts() {
  const admin = supabaseAdmin();
  const withStatus = await admin
    .from("profiles")
    .select("id,email,role,status")
    .order("email");

  if (!withStatus.error) {
    return (withStatus.data ?? [])
      .filter((profile) => profile.status === "active" && profile.role !== "admin" && profile.role !== "super_admin")
      .map((profile) => ({
        id: profile.id,
        name: profile.email || "مستخدم",
        email: profile.email,
      }));
  }

  const fallback = await admin
    .from("profiles")
    .select("id,email,role,is_active")
    .order("email");
  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? [])
    .filter((profile) => profile.is_active !== false && profile.role !== "admin" && profile.role !== "super_admin")
    .map((profile) => ({
      id: profile.id,
      name: profile.email || "مستخدم",
      email: profile.email,
    }));
}

router.get("/sa/messages/contacts", async (req, res): Promise<void> => {
  const actor = actorFrom(req, res);
  if (!actor) return;

  if (actor.role !== "admin") {
    res.json([{ id: MANAGER_ID, name: "مدير النظام", email: null }]);
    return;
  }

  try {
    const supabaseContacts = await profileContacts();
    const localContacts = store.users
      .filter((user) => user.id !== MANAGER_ID && user.role !== "admin")
      .map((user) => ({ id: user.id, name: user.name, email: user.username }));
    const contacts = [...localContacts, ...supabaseContacts];
    const unique = Array.from(new Map(contacts.map((contact) => [contact.id, contact])).values());
    res.json(unique);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "تعذر تحميل المستخدمين" });
  }
});

router.get("/sa/messages", async (req, res): Promise<void> => {
  const actor = actorFrom(req, res);
  if (!actor) return;

  const partnerId = req.query.with;
  if (!validId(partnerId) || !canChatWith(actor, partnerId)) {
    res.status(403).json({ error: "لا تملك صلاحية هذه المحادثة" });
    return;
  }

  const { data, error } = await supabaseAdmin()
    .from("messages")
    .select("id,sender_id,receiver_id,message,created_at")
    .in("sender_id", [actor.id, partnerId])
    .in("receiver_id", [actor.id, partnerId])
    .order("created_at", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json((data ?? []).filter(
    (item) =>
      (item.sender_id === actor.id && item.receiver_id === partnerId) ||
      (item.sender_id === partnerId && item.receiver_id === actor.id),
  ));
});

router.post("/sa/messages", async (req, res): Promise<void> => {
  const actor = actorFrom(req, res);
  if (!actor) return;

  const { receiver_id, message } = req.body as { receiver_id?: unknown; message?: unknown };
  if (!validId(receiver_id) || !canChatWith(actor, receiver_id)) {
    res.status(403).json({ error: "لا تملك صلاحية إرسال رسالة لهذا المستخدم" });
    return;
  }
  if (typeof message !== "string" || !message.trim() || message.trim().length > 2000) {
    res.status(400).json({ error: "الرسالة مطلوبة وبحد أقصى 2000 حرف" });
    return;
  }

  const { data, error } = await supabaseAdmin()
    .from("messages")
    .insert({
      sender_id: actor.id,
      receiver_id,
      message: message.trim(),
    })
    .select("id,sender_id,receiver_id,message,created_at")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

export default router;