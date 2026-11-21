// One monitoring cycle.
//
// Driven by an authenticated endpoint, not by a timer. An Autoscale instance
// can be stopped between any two ticks, so a setInterval is not a schedule -
// it is a hope that the instance survives. An external scheduler calling a
// route is the only arrangement that actually holds.
//
// EXACTLY ONE LOGICAL EXECUTION PER TENANT PER INTERVAL. Every instance may
// call runMonitorCycle at once; each tries to CLAIM due tenants, and the
// claim moves the lease forward in the same step. Instances that lose the
// race receive nothing and do nothing. There is no leader, no lock service
// and no coordination beyond the store.

import { alertForState, applyObservation, classifyProbe, type Alert, type ProbeOutcome } from "./driveMonitor";
import { deliverAlert, type AlertChannel, type DeliveryResult } from "./driveAlerts";
import {
  DEFAULT_LEASE_MS,
  MAX_TRANSITIONS,
  type HealthRow,
  type MonitorStore,
} from "./driveMonitorStore";

export interface CycleDeps {
  store: MonitorStore;
  probe: (tenantId: string) => Promise<ProbeOutcome>;
  channel: AlertChannel;
  instanceId: string;
  now?: () => Date;
  leaseMs?: number;
  limit?: number;
  maxAttempts?: number;
  /** Override only in tests. */
  retryAfterMs?: number;
}

export interface CycleResult {
  claimed: number;
  checked: number;
  /**
   * Results the store refused because a newer worker already holds the row.
   * The refusal is correct - the newer result is the true one - but it must
   * be visible, because a discarded result is NOT a completed check.
   */
  overtaken: number;
  alerts: Array<{ tenantId: string; alert: Alert; delivery: DeliveryResult }>;
  states: Array<{ tenantId: string; state: HealthRow["state"] }>;
}

/** The failure counter counts anything that is not healthy. */
function isFailure(state: HealthRow["state"]): boolean {
  return state !== "healthy";
}

/**
 * How long before an UNDELIVERED alert is attempted again.
 *
 * Matches the default cycle, so a retry costs at most one extra attempt per
 * cycle even if the scheduler is driven faster than intended.
 */
export const ALERT_RETRY_AFTER_MS = 15 * 60 * 1000;

/**
 * Which alert, if any, this cycle should try to deliver.
 *
 * PHASE 18EG - THE DEFECT THIS CLOSES, AND WHY THE OBVIOUS FIX IS NOT ENOUGH.
 * The runner recorded lastAlertState even when delivery FAILED, so an
 * identical state was then suppressed for ever: one failed notification
 * silenced a revoked connection permanently.
 *
 * Only recording the state on success does NOT fix it. decideAlert emits an
 * alert only on a TRANSITION, so on the next cycle there is no alert object
 * to retry - the notification is simply lost by a different route. The retry
 * has to be driven from the stored row, which is what this does.
 *
 * Two rules:
 *   a fresh transition alert is delivered unless that exact state has
 *   already been DELIVERED;
 *   with no transition, an alert whose delivery FAILED and whose state still
 *   stands is rebuilt and tried again, no more often than retryAfterMs.
 *
 * Retries are bounded in RATE, deliberately not in COUNT: giving up on an
 * undelivered critical alert is the failure being fixed, and lastDeliveryError
 * stays visible in diagnostics throughout.
 *
 * Cross-instance safety is unchanged. Everything here reads the CLAIMED row
 * and is written under the fence, so only the lease holder for a tenant can
 * alert for it, and a worker that was overtaken has its result discarded.
 */
export function alertToDeliver(
  row: Pick<HealthRow, "lastAlertState" | "lastAlertAt" | "lastDeliveryStatus">,
  next: Pick<HealthRow, "state" | "reason" | "lastCheckedAt">,
  fresh: Alert | null,
  now: Date,
  retryAfterMs: number = ALERT_RETRY_AFTER_MS,
): Alert | null {
  if (fresh) {
    const alreadyDelivered = row.lastAlertState === fresh.state
      && row.lastDeliveryStatus === "delivered";
    return alreadyDelivered ? null : fresh;
  }
  if (row.lastDeliveryStatus !== "failed") return null;
  if (!row.lastAlertState || row.lastAlertState !== next.state) return null;
  const last = row.lastAlertAt ? Date.parse(row.lastAlertAt) : Number.NaN;
  if (Number.isFinite(last) && now.getTime() - last < retryAfterMs) return null;
  // lastCheckedAt is nullable on the row; this cycle's clock is the
  // correct fallback, never an empty string that would read as unknown.
  return alertForState(next.state, next.reason, next.lastCheckedAt ?? now.toISOString());
}

export async function runMonitorCycle(deps: CycleDeps): Promise<CycleResult> {
  const now = deps.now ?? (() => new Date());
  const leaseMs = deps.leaseMs ?? DEFAULT_LEASE_MS;
  const at = now();
  const claimed = await deps.store.claimDue(at, leaseMs, deps.limit ?? 50, deps.instanceId);

  const result: CycleResult = { claimed: claimed.length, checked: 0, overtaken: 0, alerts: [], states: [] };

  for (const row of claimed) {
    let outcome: ProbeOutcome;
    try {
      outcome = await deps.probe(row.tenantId);
    } catch {
      // A probe that throws is a FAILED probe, never a skipped one. A monitor
      // that goes quiet when it breaks is worse than no monitor.
      outcome = { reachable: false, configured: true, settingsComplete: true, reason: "probe_threw" };
    }
    const state = classifyProbe(outcome);
    const reason = outcome.reason ?? state;
    const observedAt = now().toISOString();

    // The alert decision reuses the Phase 18BY reducer unchanged, so the
    // policy lives in exactly one place: transitions only, degraded after
    // three, one recovery notice, never a repeat for an unchanged state.
    const previousForReducer = {
      tenantId: row.tenantId,
      state: row.state,
      reason: row.reason,
      degradedStreak: row.state === "degraded" ? row.consecutiveFailures : 0,
      lastCheckedAt: row.lastCheckedAt ?? "",
      lastHealthyAt: row.lastSuccessAt,
      lastFailureAt: row.lastFailureAt,
      lastFailureReason: row.lastFailureReason,
      transitions: row.transitions,
    };
    const { record, alert } = applyObservation(previousForReducer, { state, reason, at: observedAt });

    const next: HealthRow = {
      ...row,
      state: record.state,
      reason: record.reason,
      consecutiveFailures: isFailure(record.state) ? row.consecutiveFailures + 1 : 0,
      lastCheckedAt: observedAt,
      lastSuccessAt: record.lastHealthyAt,
      lastFailureAt: record.lastFailureAt,
      lastFailureReason: record.lastFailureReason,
      transitions: record.transitions.slice(-MAX_TRANSITIONS),
      claimedBy: deps.instanceId,
      claimedAt: at.toISOString(),
    };

    const pending = alertToDeliver(row, next, alert, at, deps.retryAfterMs);
    if (pending) {
      const delivery = await deliverAlert(row.tenantId, pending, deps.channel, {
        maxAttempts: deps.maxAttempts ?? 3,
        now,
      });
      // What was ATTEMPTED, and whether it actually landed. Both are needed:
      // the state alone cannot distinguish "told them" from "tried to".
      next.lastAlertState = pending.state;
      next.lastAlertAt = delivery.at;
      next.lastDeliveryStatus = delivery.status;
      next.lastDeliveryError = delivery.error;
      result.alerts.push({ tenantId: row.tenantId, alert: pending, delivery });
    }

    // The fence. save() returns false when the row moved on to another
    // worker while this probe was in flight. The newer result is the
    // right one, so this one is dropped - but it is never counted as a
    // check, or the cycle would report a state it did not store.
    const written = await deps.store.save(next);
    if (!written) {
      result.overtaken += 1;
      continue;
    }
    result.checked += 1;
    result.states.push({ tenantId: row.tenantId, state: next.state });
  }

  return result;
}

/**
 * Constant-time comparison for the scheduler's shared secret.
 *
 * A plain === leaks the length and the position of the first wrong byte to
 * anything that can time the response, which is exactly what an unauthenticated
 * endpoint must not do.
 */
export function schedulerSecretMatches(provided: unknown, expected: string | undefined): boolean {
  if (typeof expected !== "string" || expected.length < 16) return false;
  if (typeof provided !== "string" || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}
