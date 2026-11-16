// Wiring for the monitoring cycle.
//
// The decision logic in monitorRunner.ts, driveMonitor.ts, driveAlerts.ts and
// driveMonitorStore.ts reaches nothing real. This file is the only place that
// does - and it is deliberately the only file that would need changing when
// the durable table is created.

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";
import { createNotification } from "../routes/sa/notificationDb";
import { probeTenantConnection } from "./driveMonitorAccess";
import {
  InMemoryMonitorStore,
  type HealthRow,
  type MonitorStore,
} from "./driveMonitorStore";
import { inAppAlertChannel, recordingAlertChannel, type AlertChannel } from "./driveAlerts";

/**
 * Identifies this process in a claim, so a stuck lease can be traced to an
 * instance. Diagnostic only - nothing depends on its value.
 */
export const INSTANCE_ID = `${process.env.REPLIT_DEPLOYMENT_ID ?? "local"}:${randomUUID().slice(0, 8)}`;

/** The table the prepared migration creates. */
const HEALTH_TABLE = "drive_connection_health";

function toRow(record: Record<string, unknown>): HealthRow {
  return {
    tenantId: String(record.tenant_id),
    state: record.state as HealthRow["state"],
    reason: String(record.reason ?? ""),
    consecutiveFailures: Number(record.consecutive_failures ?? 0),
    lastCheckedAt: (record.last_checked_at as string) ?? null,
    lastSuccessAt: (record.last_success_at as string) ?? null,
    lastFailureAt: (record.last_failure_at as string) ?? null,
    lastFailureReason: (record.last_failure_reason as string) ?? null,
    nextDueAt: String(record.next_due_at),
    claimedBy: (record.claimed_by as string) ?? null,
    claimedAt: (record.claimed_at as string) ?? null,
    lastAlertState: (record.last_alert_state as HealthRow["lastAlertState"]) ?? null,
    lastAlertAt: (record.last_alert_at as string) ?? null,
    lastDeliveryStatus: (record.last_delivery_status as HealthRow["lastDeliveryStatus"]) ?? null,
    lastDeliveryError: (record.last_delivery_error as string) ?? null,
    transitions: Array.isArray(record.transitions) ? record.transitions as HealthRow["transitions"] : [],
  };
}

function toRecord(row: HealthRow) {
  return {
    tenant_id: row.tenantId,
    state: row.state,
    reason: row.reason,
    consecutive_failures: row.consecutiveFailures,
    last_checked_at: row.lastCheckedAt,
    last_success_at: row.lastSuccessAt,
    last_failure_at: row.lastFailureAt,
    last_failure_reason: row.lastFailureReason,
    next_due_at: row.nextDueAt,
    claimed_by: row.claimedBy,
    claimed_at: row.claimedAt,
    last_alert_state: row.lastAlertState,
    last_alert_at: row.lastAlertAt,
    last_delivery_status: row.lastDeliveryStatus,
    last_delivery_error: row.lastDeliveryError,
    transitions: row.transitions,
    updated_at: new Date().toISOString(),
  };
}

/**
 * The durable store.
 *
 * NOT USED UNTIL THE MIGRATION IS APPLIED. monitorStore() below returns the
 * in-memory store while the table is absent, so nothing breaks and nothing
 * silently half-works: a single instance still monitors correctly, it simply
 * forgets across restarts.
 */
export class SupabaseMonitorStore implements MonitorStore {
  async claimDue(now: Date, leaseMs: number, limit: number, instanceId: string): Promise<HealthRow[]> {
    const { data, error } = await supabaseAdmin().rpc("claim_drive_health_rows", {
      p_now: now.toISOString(),
      p_lease_seconds: Math.round(leaseMs / 1000),
      p_limit: limit,
      p_instance: instanceId,
    });
    if (error) throw new Error(error.message);
    return (data as Array<Record<string, unknown>> ?? []).map(toRow);
  }

  async get(tenantId: string): Promise<HealthRow | null> {
    const { data, error } = await supabaseAdmin()
      .from(HEALTH_TABLE).select("*").eq("tenant_id", tenantId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toRow(data as Record<string, unknown>) : null;
  }

  async save(row: HealthRow): Promise<void> {
    const { error } = await supabaseAdmin().from(HEALTH_TABLE).upsert(toRecord(row));
    if (error) throw new Error(error.message);
  }

  async ensure(tenantId: string, now: Date): Promise<HealthRow> {
    const existing = await this.get(tenantId);
    if (existing) return existing;
    const { emptyHealthRow } = await import("./driveMonitorStore");
    const row = emptyHealthRow(tenantId, now);
    await this.save(row);
    return row;
  }

  async list(): Promise<HealthRow[]> {
    const { data, error } = await supabaseAdmin().from(HEALTH_TABLE).select("*").limit(500);
    if (error) throw new Error(error.message);
    return (data as Array<Record<string, unknown>> ?? []).map(toRow);
  }
}

const fallbackStore = new InMemoryMonitorStore();

/**
 * Durable when the table exists, in-memory when it does not.
 *
 * DRIVE_MONITOR_DURABLE must be set explicitly. Probing for the table at
 * runtime would mean a failed query on every boot and an ambiguous answer
 * when the database is merely slow; an explicit switch says what the operator
 * intended.
 */
export function monitorStore(env: NodeJS.ProcessEnv = process.env): MonitorStore {
  return env.DRIVE_MONITOR_DURABLE === "true" ? new SupabaseMonitorStore() : fallbackStore;
}

const recordedAlerts: Array<{ tenantId: string; message: unknown }> = [];

/**
 * The alert channel.
 *
 * DEFAULTS TO RECORDING, NOT SENDING. Until the owner confirms the channel,
 * an alert is kept and surfaced in diagnostics rather than delivered to a
 * recipient nobody chose. Setting DRIVE_ALERT_CHANNEL=in-app switches to the
 * existing in-app notification table, audience "admin".
 */
export function alertChannel(env: NodeJS.ProcessEnv = process.env): AlertChannel {
  if (env.DRIVE_ALERT_CHANNEL === "in-app") {
    return inAppAlertChannel({ createNotification });
  }
  return recordingAlertChannel(recordedAlerts as Array<{ tenantId: string; message: never }>);
}

export function recordedAlertCount(): number {
  return recordedAlerts.length;
}

export const monitorCycleDeps = () => ({
  store: monitorStore(),
  probe: probeTenantConnection,
  channel: alertChannel(),
  instanceId: INSTANCE_ID,
});
