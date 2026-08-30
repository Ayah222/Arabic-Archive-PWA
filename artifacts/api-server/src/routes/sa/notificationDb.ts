import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { SANotification } from "./store";

function toNotification(row: Record<string, unknown>): SANotification {
  return {
    id: row.id as string,
    title: row.title as string,
    message: row.message as string,
    type: row.type as SANotification["type"],
    audience: (row.audience as SANotification["audience"]) ?? "all",
    scheduledAt: (row.scheduled_at as string) ?? null,
    read: Boolean(row.read),
    projectId: (row.project_id as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function toRow(notification: SANotification) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    audience: notification.audience ?? "all",
    scheduled_at: notification.scheduledAt,
    read: notification.read,
    project_id: notification.projectId,
    created_at: notification.createdAt,
  };
}

export async function listNotifications(limit = 500): Promise<SANotification[]> {
  const { data, error } = await supabaseAdmin()
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toNotification);
}

export async function createNotification(notification: SANotification): Promise<SANotification> {
  const { data, error } = await supabaseAdmin()
    .from("notifications")
    .insert(toRow(notification))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toNotification(data);
}

export async function persistNotifications(notifications: SANotification[]) {
  const retained = notifications.slice(0, 200);
  if (retained.length) {
    const { error } = await supabaseAdmin().from("notifications").upsert(retained.map(toRow));
    if (error) throw new Error(error.message);
  }
  const cutoff = retained.at(-1)?.createdAt;
  if (cutoff) {
    const { error } = await supabaseAdmin().from("notifications").delete().lt("created_at", cutoff);
    if (error) throw new Error(error.message);
  }
}

export async function setNotificationRead(id: string, read: boolean): Promise<SANotification | null> {
  const { data, error } = await supabaseAdmin()
    .from("notifications")
    .update({ read })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toNotification(data) : null;
}

export async function markAllNotificationsRead() {
  const { error, count } = await supabaseAdmin()
    .from("notifications")
    .update({ read: true }, { count: "exact" })
    .eq("read", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function deleteNotificationsContaining(marker: string) {
  const { error } = await supabaseAdmin()
    .from("notifications")
    .delete()
    .ilike("message", `%${marker}%`);
  if (error) throw new Error(error.message);
}