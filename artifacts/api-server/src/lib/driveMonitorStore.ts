// Durable state for Drive connection monitoring.
//
// WHY A STORE AT ALL
// Phase 18BY held monitor state in memory. That was honest for what it was,
// but it has three faults in Autoscale: the history dies on every restart,
// each instance keeps its own copy, and "has the connection been healthy for
// eight days" cannot be answered from memory that resets. All three are the
// same fault - nothing durable and nothing shared.
//
// THE LEASE IS THE WHOLE DESIGN
// Multiple instances must not probe the same tenant in the same interval.
// Rather than elect a leader or run a singleton, each instance tries to CLAIM
// a tenant with a conditional update that only succeeds when the row is
// actually due. Postgres makes that single statement atomic, so exactly one
// instance wins and the others get nothing back and do nothing. No
// coordination service, no leader election, no timer that must survive a
// restart.
//
// NO BACKGROUND TIMER IS ASSUMED. An Autoscale instance can be stopped at any
// moment, so a setInterval is not a schedule - it is a hope. The runner is
// driven by an authenticated endpoint that an external scheduler calls.

import type { ConnectionState } from "./driveMonitor";

export interface HealthRow {
  tenantId: string;
  state: ConnectionState;
  reason: string;
  consecutiveFailures: number;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  /** When this tenant may next be claimed. The lease. */
  nextDueAt: string;
  /** Which instance holds the current claim, for diagnosis only. */
  claimedBy: string | null;
  claimedAt: string | null;
  lastAlertState: ConnectionState | null;
  lastAlertAt: string | null;
  lastDeliveryStatus: "delivered" | "failed" | "pending" | null;
  lastDeliveryError: string | null;
  transitions: Array<{ from: ConnectionState | null; to: ConnectionState; reason: string; at: string }>;
}

export interface MonitorStore {
  /**
   * Atomically claims up to `limit` tenants whose lease has expired, and
   * pushes their next due time forward so no other instance can take them.
   * Returns only the rows this caller won.
   */
  claimDue(now: Date, leaseMs: number, limit: number, instanceId: string): Promise<HealthRow[]>;
  get(tenantId: string): Promise<HealthRow | null>;
  save(row: HealthRow): Promise<void>;
  /** Registers a tenant for monitoring. Idempotent. */
  ensure(tenantId: string, now: Date): Promise<HealthRow>;
  list(): Promise<HealthRow[]>;
}

export const DEFAULT_LEASE_MS = 15 * 60 * 1000;
export const MAX_TRANSITIONS = 50;

export function emptyHealthRow(tenantId: string, now: Date): HealthRow {
  return {
    tenantId,
    state: "disconnected",
    reason: "never_checked",
    consecutiveFailures: 0,
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    // Due immediately, so a newly registered tenant is checked on the next run
    nextDueAt: now.toISOString(),
    claimedBy: null,
    claimedAt: null,
    lastAlertState: null,
    lastAlertAt: null,
    lastDeliveryStatus: null,
    lastDeliveryError: null,
    transitions: [],
  };
}

/**
 * In-memory store. Used by every test, and a correct implementation in its
 * own right for a single instance - it simply does not survive a restart.
 *
 * claimDue applies the same conditional rule the SQL does, so the tests
 * exercise the real claiming semantics rather than a simplification.
 */
export class InMemoryMonitorStore implements MonitorStore {
  private readonly rows = new Map<string, HealthRow>();

  async ensure(tenantId: string, now: Date): Promise<HealthRow> {
    const existing = this.rows.get(tenantId);
    if (existing) return existing;
    const row = emptyHealthRow(tenantId, now);
    this.rows.set(tenantId, row);
    return row;
  }

  async get(tenantId: string): Promise<HealthRow | null> {
    return this.rows.get(tenantId) ?? null;
  }

  async save(row: HealthRow): Promise<void> {
    this.rows.set(row.tenantId, { ...row, transitions: row.transitions.slice(-MAX_TRANSITIONS) });
  }

  async claimDue(now: Date, leaseMs: number, limit: number, instanceId: string): Promise<HealthRow[]> {
    const claimed: HealthRow[] = [];
    for (const row of this.rows.values()) {
      if (claimed.length >= limit) break;
      // The condition that makes this safe: only a row that is actually due
      // can be taken, and taking it moves the lease forward in the same step.
      if (new Date(row.nextDueAt).getTime() > now.getTime()) continue;
      const taken: HealthRow = {
        ...row,
        nextDueAt: new Date(now.getTime() + leaseMs).toISOString(),
        claimedBy: instanceId,
        claimedAt: now.toISOString(),
      };
      this.rows.set(row.tenantId, taken);
      claimed.push(taken);
    }
    return claimed;
  }

  async list(): Promise<HealthRow[]> {
    return [...this.rows.values()];
  }

  /** Test helper. Never used in production code. */
  seed(row: HealthRow): void {
    this.rows.set(row.tenantId, row);
  }
}
