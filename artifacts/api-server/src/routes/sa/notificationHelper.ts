/**
 * Cross-user notification helper.
 *
 * Design:
 * - `wasNotifiedToday(entityId)` — dedup check before creating a notification.
 * - `notifyUser(recipientId, input)`  — delivers to one user; returns the created id + createdAt.
 * - `notifyAdmins(input)`             — delivers to every active admin.
 *
 * Storage strategy:
 *   Supabase mode (service-role key present):
 *     • `wasNotifiedToday` queries Supabase — durable, recipient-independent.
 *     • `notifyAdmins` inserts per-recipient rows in Supabase only;
 *       no in-memory sentinel is written, so a failed Supabase insert
 *       does not suppress later retries.
 *   In-memory fallback (no Supabase):
 *     • `wasNotifiedToday` inspects store.notifications.
 *     • `notifyAdmins` creates one scoped row per admin in store.users,
 *       giving each admin independent read-state (no shared broadcast row).
 *
 * Comment on recipientId === null:
 *   Only used in `notifyUser` when the caller supplies no known recipient
 *   (edge case in voice.ts). The GET endpoint shows such rows only to
 *   admin/super_admin users.
 */
import { supabaseAdmin } from "../../lib/supabase";
import { store, newId } from "./store";

export interface NotificationInput {
  title: string;
  message: string;
  type: "reminder" | "info" | "warning" | "success";
  priority?: "high" | "medium" | "low" | null;
  projectId?: string | null;
  /** Frontend route to navigate to when the notification is clicked */
  actionUrl?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
}

export interface CreatedNotification {
  id: string;
  createdAt: string;
}

/**
 * Recipient-independent dedup check: returns true if any notification
 * containing `entityId` in its message was already created today.
 *
 * With Supabase: queries the database (durable across restarts).
 * Without Supabase: scans the in-memory store.
 */
export async function wasNotifiedToday(entityId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  if (supabaseAdmin) {
    const { count, error } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .ilike("message", `%${entityId}%`)
      .gte("created_at", `${today}T00:00:00Z`);

    if (error) {
      console.error("[wasNotifiedToday] Supabase error:", error.message, "— assuming not notified");
      return false;
    }
    return (count ?? 0) > 0;
  }

  // In-memory fallback
  return store.notifications.some(
    (n) => n.message.includes(entityId) && n.createdAt.startsWith(today),
  );
}

/**
 * Send a notification to a specific user.
 * Returns the identity (id + createdAt) of the stored record.
 */
export async function notifyUser(
  recipientId: string,
  input: NotificationInput,
): Promise<CreatedNotification> {
  const id = newId();
  const createdAt = new Date().toISOString();

  // Always write to in-memory for fallback display.
  store.notifications.unshift({
    id,
    recipientId,
    title: input.title,
    message: input.message,
    type: input.type,
    priority: input.priority ?? null,
    scheduledAt: null,
    read: false,
    projectId: input.projectId ?? null,
    actionUrl: input.actionUrl ?? null,
    createdByName: input.createdByName ?? null,
    createdAt,
  });
  if (store.notifications.length > 200) store.notifications.length = 200;

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        recipient_id: recipientId,
        title: input.title,
        message: input.message,
        type: input.type,
        priority: input.priority ?? null,
        read: false,
        project_id: input.projectId ?? null,
        action_url: input.actionUrl ?? null,
        created_by: input.createdById ?? null,
        created_by_name: input.createdByName ?? null,
      })
      .select("id, created_at")
      .single();

    if (!error && data) {
      // Return the Supabase-assigned identity so callers reference the authoritative record.
      return { id: data.id as string, createdAt: data.created_at as string };
    }
    if (error) {
      console.error("[notifyUser] Supabase insert error:", error.message);
    }
  }

  return { id, createdAt };
}

/**
 * Broadcast a notification to all active admin/super_admin users.
 *
 * Supabase mode:
 *   Queries `profiles` for admin recipient IDs, inserts one row per admin.
 *   Does NOT write in-memory sentinels — dedup is handled by `wasNotifiedToday`
 *   which queries Supabase directly.
 *
 * In-memory fallback:
 *   Creates one scoped row per admin found in store.users (independent read-state).
 *   These rows also serve as dedup sentinels for `wasNotifiedToday` in fallback mode.
 */
export async function notifyAdmins(input: NotificationInput): Promise<void> {
  const now = new Date().toISOString();

  if (supabaseAdmin) {
    // ── Supabase path: per-recipient rows, no in-memory sentinel ────────────
    const { data: admins, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("role", ["admin", "super_admin"])
      .eq("is_active", true);

    if (fetchError) {
      console.error("[notifyAdmins] Error fetching admins:", fetchError.message);
      return;
    }
    if (!admins || admins.length === 0) return;

    const rows = (admins as { id: string }[]).map((admin) => ({
      recipient_id: admin.id,
      title: input.title,
      message: input.message,
      type: input.type,
      priority: input.priority ?? null,
      read: false,
      project_id: input.projectId ?? null,
      action_url: input.actionUrl ?? null,
      created_by: input.createdById ?? null,
      created_by_name: input.createdByName ?? null,
    }));

    const { error } = await supabaseAdmin.from("notifications").insert(rows);
    if (error) {
      console.error("[notifyAdmins] Supabase bulk insert error:", error.message);
    }
    return; // Supabase-mode dedup is handled via wasNotifiedToday querying Supabase
  }

  // ── In-memory fallback: one scoped row per admin ─────────────────────────
  // Uses store.users (seeded admin list) as the recipient source.
  // Each admin gets their own row (independent read-state).
  const adminUsers = store.users.filter((u) => u.role === "admin");
  const recipients = adminUsers.length > 0
    ? adminUsers.map((u) => u.id)
    : [null]; // null means admin-visible only (shown to admin-role users in GET)

  for (const recipientId of recipients) {
    store.notifications.unshift({
      id: newId(),
      recipientId,
      title: input.title,
      message: input.message,
      type: input.type,
      priority: input.priority ?? null,
      scheduledAt: null,
      read: false,
      projectId: input.projectId ?? null,
      actionUrl: input.actionUrl ?? null,
      createdByName: input.createdByName ?? null,
      createdAt: now,
    });
  }
  if (store.notifications.length > 200) store.notifications.length = 200;
}
