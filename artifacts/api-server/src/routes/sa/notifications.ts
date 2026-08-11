import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../../lib/supabase";
import { store } from "./store";

const router: IRouter = Router();

/** Map a Supabase snake_case row to the camelCase API response shape */
function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    priority: row.priority ?? null,
    scheduledAt: null,
    read: row.read,
    projectId: row.project_id ?? null,
    actionUrl: row.action_url ?? null,
    createdByName: row.created_by_name ?? null,
    createdAt: row.created_at,
  };
}

// ─── GET /sa/notifications ────────────────────────────────────────────────────
// Returns only notifications intended for the current user (or system-wide ones).
router.get("/sa/notifications", async (req, res): Promise<void> => {
  const userId = req.authUser?.id;

  if (supabaseAdmin && userId) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error) {
      res.json((data ?? []).map(mapRow));
      return;
    }
    console.error("[notifications GET] Supabase error:", error.message, "— falling back to in-memory");
  }

  // ── In-memory fallback — strict recipient ownership ──────────────────────
  // recipientId === null = system/scheduler alerts, shown only to admins.
  // recipientId === uid  = personal notifications for this user only.
  const uid = req.authUser?.id ?? null;
  const role = req.authUser?.role ?? "employee";
  const isAdmin = role === "admin" || role === "super_admin";
  const visible = store.notifications.filter(
    (n) =>
      n.recipientId === uid ||
      (n.recipientId === null && isAdmin),
  );
  res.json(
    [...visible].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );
});

// ─── PATCH /sa/notifications/read-all ─────────────────────────────────────────
// Must be registered BEFORE /:nid/read to avoid route shadowing.
router.patch("/sa/notifications/read-all", async (req, res): Promise<void> => {
  const userId = req.authUser?.id;

  if (supabaseAdmin && userId) {
    // Count then update (two cheap queries avoids the select-on-update typing issue)
    const { count: unreadCount } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("read", false);

    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("recipient_id", userId)
      .eq("read", false);

    if (!error) {
      res.json({ marked: unreadCount ?? 0 });
      return;
    }
    console.error("[notifications read-all] Supabase error:", error.message);
  }

  // ── In-memory fallback — mark all notifications visible to this user ─────
  const uid = req.authUser?.id ?? null;
  const readAllRole = req.authUser?.role ?? "employee";
  const readAllIsAdmin = readAllRole === "admin" || readAllRole === "super_admin";
  let marked = 0;
  store.notifications.forEach((n) => {
    const owned = n.recipientId === uid;
    const broadcast = n.recipientId === null && readAllIsAdmin;
    if ((owned || broadcast) && !n.read) {
      n.read = true;
      marked++;
    }
  });
  res.json({ marked });
});

// ─── PATCH /sa/notifications/:nid/read ────────────────────────────────────────
router.patch("/sa/notifications/:nid/read", async (req, res): Promise<void> => {
  const { nid } = req.params;
  const { read } = req.body as { read?: boolean };
  const userId = req.authUser?.id;

  if (read === undefined) {
    res.status(400).json({ error: "read is required" });
    return;
  }

  if (supabaseAdmin && userId) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ read })
      .eq("id", nid)
      .eq("recipient_id", userId)
      .select("*")
      .single();

    if (!error && data) {
      res.json(mapRow(data as Record<string, unknown>));
      return;
    }
    if (error?.code === "PGRST116") {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    console.error("[notifications read] Supabase error:", error?.message);
  }

  // ── In-memory fallback — strict ownership check ───────────────────────────
  // System notifications (recipientId === null) are shared; allow admins to
  // mark them read individually (this updates shared state, acceptable for
  // single-user demo or single-admin deployments using the in-memory fallback).
  const uid = req.authUser?.id ?? null;
  const fallbackRole = req.authUser?.role ?? "employee";
  const fallbackIsAdmin = fallbackRole === "admin" || fallbackRole === "super_admin";
  const idx = store.notifications.findIndex(
    (n) =>
      n.id === nid &&
      (n.recipientId === uid || (n.recipientId === null && fallbackIsAdmin)),
  );
  if (idx === -1) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  store.notifications[idx].read = read;
  res.json(store.notifications[idx]);
});

export default router;
