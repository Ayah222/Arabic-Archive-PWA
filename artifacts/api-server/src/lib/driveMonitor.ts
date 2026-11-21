// Google Drive connection monitoring.
//
// WHY THIS EXISTS
// The production Drive connection has been unusable for weeks and nothing
// said so. Every symptom surfaced as a per-request error to whichever
// employee happened to open a file, so it read as "that document is broken"
// rather than "the archive is disconnected". A connection that can fail
// silently will, and the only defence is something that looks at it on a
// schedule and tells a person when the answer changes.
//
// WHAT THIS MODULE IS
// Pure decision logic: given the outcome of a probe and what was observed
// last time, it decides the state, whether that is a transition, and whether
// anyone should be told. It performs no I/O, holds no credential, and starts
// no timer - so it can be tested exhaustively, including every failure
// branch, without a network or a Google account.
//
// WHAT IT DELIBERATELY IS NOT
// It does not schedule itself. Creating a production cron job is a separate,
// explicitly withheld authorization, so the loop that would call tick() is
// provided but never started.

/** Every state an institution administrator can act on. */
export type ConnectionState =
  | "healthy"
  | "degraded"
  | "reauth_required"
  | "disconnected"
  | "misconfigured";

export type AlertSeverity = "critical" | "warning" | "info";

export interface ProbeOutcome {
  /** True only when Google actually answered a request. */
  reachable: boolean;
  /** A credential exists and decrypts. Says nothing about Google accepting it. */
  configured: boolean;
  /** Every required setting is present. */
  settingsComplete: boolean;
  /** True when the failure is terminal: only a new consent fixes it. */
  terminal?: boolean;
  /** A short machine reason: invalid_grant, http_503, no_connection. */
  reason?: string;
  /** True when Google answered as an account other than the institution. */
  wrongAccount?: boolean;
}

export interface Observation {
  state: ConnectionState;
  reason: string;
  at: string;
}

export interface MonitorRecord {
  tenantId: string;
  state: ConnectionState;
  reason: string;
  /** Consecutive degraded observations, reset by any other state. */
  degradedStreak: number;
  lastCheckedAt: string;
  lastHealthyAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  /** Bounded transition history. Never contains a secret. */
  transitions: Array<{ from: ConnectionState | null; to: ConnectionState; reason: string; at: string }>;
}

export interface Alert {
  severity: AlertSeverity;
  state: ConnectionState;
  reason: string;
  message: string;
  actionRequired: boolean;
  at: string;
}

/** Default cadence. Configurable, because 15 minutes is a judgement, not a law. */
export const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
/** How many consecutive degraded results before anyone is told. */
export const DEGRADED_ALERT_THRESHOLD = 3;
/** Transitions kept per tenant. Enough to see a pattern, bounded for memory. */
export const MAX_TRANSITIONS = 50;

export const STATE_MESSAGES: Record<ConnectionState, string> = {
  healthy: "ربط Google Drive يعمل بشكل صحيح.",
  degraded: "خدمة Google Drive غير مستقرة حالياً. تتم إعادة المحاولة تلقائياً.",
  reauth_required: "انتهت صلاحية ربط Google Drive أو تم إلغاؤه. يلزم إعادة الربط من حساب المؤسسة.",
  disconnected: "لم يتم ربط Google Drive بحساب المؤسسة بعد.",
  misconfigured: "إعداد Google Drive غير مكتمل. تحقق من متغيرات البيئة المطلوبة.",
};

export const RECOVERY_ACTIONS: Record<ConnectionState, string> = {
  healthy: "لا يلزم أي إجراء.",
  degraded: "لا يلزم إجراء الآن. إذا استمرت الحالة، تحقق من حالة خدمات Google.",
  reauth_required:
    "ألغِ وصول ArchHive من صفحة أمان حساب Google، ثم أعد الربط من إعدادات التخزين.",
  disconnected: "أكمل ربط Google Drive من إعدادات التخزين بحساب مدير المؤسسة.",
  misconfigured: "أكمل إعداد متغيرات OAuth في بيئة الإنتاج ثم أعد المحاولة.",
};

/**
 * Turns one probe outcome into a state.
 *
 * ORDER MATTERS. Settings are checked before anything else, because a
 * missing redirect URI is not a Drive problem and must not be reported as
 * one. A terminal auth failure outranks reachability, because a revoked
 * token is not a temporary blip no matter how the request failed.
 */
export function classifyProbe(outcome: ProbeOutcome): Observation["state"] {
  if (!outcome.settingsComplete) return "misconfigured";
  if (!outcome.configured) return "disconnected";
  if (outcome.wrongAccount) return "reauth_required";
  if (outcome.terminal) return "reauth_required";
  if (!outcome.reachable) return "degraded";
  return "healthy";
}

/** A fresh record for a tenant that has never been observed. */
export function emptyRecord(tenantId: string): MonitorRecord {
  return {
    tenantId,
    state: "disconnected",
    reason: "never_checked",
    degradedStreak: 0,
    lastCheckedAt: "",
    lastHealthyAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    transitions: [],
  };
}

/**
 * Folds one observation into the record and decides whether to alert.
 *
 * THE ALERT POLICY, and the reasoning behind each line:
 *   reauth_required  alert IMMEDIATELY and every time it is newly entered.
 *                    It is terminal; waiting only lengthens the outage.
 *   misconfigured    immediately - a human must change a setting
 *   disconnected     immediately, but only as a transition away from a
 *                    working state. A connection that has never existed is
 *                    not an incident.
 *   degraded         only after three consecutive results, about 45 minutes
 *                    at the default cadence. A single blip must never page
 *                    anyone, or the alerts get muted and the real one is
 *                    missed with them.
 *   healthy          one info notice on RECOVERY, so a raised alert is
 *                    visibly resolved rather than left hanging.
 *
 * ALERTS FIRE ON TRANSITIONS, NEVER ON STATES. Alerting on a state would
 * re-notify every fifteen minutes for as long as the fault lasts, which
 * trains everyone to ignore it.
 */
export function applyObservation(
  previous: MonitorRecord,
  observation: Observation,
): { record: MonitorRecord; alert: Alert | null } {
  const changed = previous.state !== observation.state;
  const hadEverBeenObserved = previous.lastCheckedAt !== "";
  const degradedStreak = observation.state === "degraded"
    ? (previous.state === "degraded" ? previous.degradedStreak + 1 : 1)
    : 0;

  const record: MonitorRecord = {
    ...previous,
    state: observation.state,
    reason: observation.reason,
    degradedStreak,
    lastCheckedAt: observation.at,
    lastHealthyAt: observation.state === "healthy" ? observation.at : previous.lastHealthyAt,
    lastFailureAt: observation.state === "healthy" ? previous.lastFailureAt : observation.at,
    lastFailureReason: observation.state === "healthy"
      ? previous.lastFailureReason
      : observation.reason,
    transitions: changed
      ? [
        ...previous.transitions,
        { from: hadEverBeenObserved ? previous.state : null, to: observation.state, reason: observation.reason, at: observation.at },
      ].slice(-MAX_TRANSITIONS)
      : previous.transitions,
  };

  return { record, alert: decideAlert(previous, record, changed, hadEverBeenObserved) };
}

/**
 * Severity and urgency for a state. ONE table, used by both the transition
 * path and the retry path below.
 *
 * Phase 18EG. The retry path has to rebuild an alert for a state that was
 * decided on an earlier cycle. Rebuilding it with a second copy of this
 * mapping is how two copies of a policy drift apart - so there is one.
 */
const ALERT_SHAPE: Record<ConnectionState, { severity: AlertSeverity; actionRequired: boolean }> = {
  healthy: { severity: "info", actionRequired: false },
  degraded: { severity: "warning", actionRequired: false },
  reauth_required: { severity: "critical", actionRequired: true },
  misconfigured: { severity: "critical", actionRequired: true },
  disconnected: { severity: "critical", actionRequired: true },
};

/** The alert that represents a state, independent of WHEN it was decided. */
export function alertForState(state: ConnectionState, reason: string, at: string): Alert {
  return { state, reason, message: STATE_MESSAGES[state], at, ...ALERT_SHAPE[state] };
}

function decideAlert(
  previous: MonitorRecord,
  record: MonitorRecord,
  changed: boolean,
  hadEverBeenObserved: boolean,
): Alert | null {
  if (record.state === "reauth_required" || record.state === "misconfigured") {
    return changed ? alertForState(record.state, record.reason, record.lastCheckedAt) : null;
  }

  if (record.state === "disconnected") {
    // Never having been connected is a starting condition, not an incident.
    const wasWorking = hadEverBeenObserved && previous.state !== "disconnected";
    return wasWorking ? alertForState(record.state, record.reason, record.lastCheckedAt) : null;
  }

  if (record.state === "degraded") {
    // Exactly at the threshold, so a long outage alerts once, not forever.
    return record.degradedStreak === DEGRADED_ALERT_THRESHOLD
      ? alertForState(record.state, record.reason, record.lastCheckedAt)
      : null;
  }

  // healthy: notify only when it is a RECOVERY from something that alerted
  const recovered = changed && hadEverBeenObserved && previous.state !== "healthy";
  return recovered ? alertForState(record.state, record.reason, record.lastCheckedAt) : null;
}

/**
 * In-memory monitor state, keyed by tenant.
 *
 * Deliberately NOT a database table: a schema migration is an owner-only
 * action, and the monitor must be able to run before one is possible. The
 * cost is that history resets on restart, which is acceptable because the
 * CURRENT state is re-derived by the next probe within one interval.
 */
export class MonitorRegistry {
  private readonly records = new Map<string, MonitorRecord>();

  get(tenantId: string): MonitorRecord {
    return this.records.get(tenantId) ?? emptyRecord(tenantId);
  }

  observe(tenantId: string, outcome: ProbeOutcome, at: string): { record: MonitorRecord; alert: Alert | null } {
    const state = classifyProbe(outcome);
    const result = applyObservation(this.get(tenantId), {
      state,
      reason: outcome.reason ?? state,
      at,
    });
    this.records.set(tenantId, result.record);
    return result;
  }

  /** Everything known, for diagnostics. Never contains a secret. */
  snapshot(): MonitorRecord[] {
    return [...this.records.values()];
  }

  reset(tenantId?: string): void {
    if (tenantId) this.records.delete(tenantId);
    else this.records.clear();
  }
}

/** The single process-wide registry. */
export const monitorRegistry = new MonitorRegistry();

/**
 * The loop a scheduler would drive. EXPORTED BUT NEVER STARTED - creating a
 * production scheduled job is a separate authorization that has not been
 * given, so nothing in this build calls it.
 */
export function createMonitorLoop(options: {
  intervalMs?: number;
  tenants: () => Promise<string[]>;
  probe: (tenantId: string) => Promise<ProbeOutcome>;
  onAlert: (tenantId: string, alert: Alert) => void;
  now?: () => Date;
  registry?: MonitorRegistry;
}) {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const registry = options.registry ?? monitorRegistry;
  const now = options.now ?? (() => new Date());
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = async () => {
    for (const tenantId of await options.tenants()) {
      let outcome: ProbeOutcome;
      try {
        outcome = await options.probe(tenantId);
      } catch {
        // A probe that throws is a failed probe, never a skipped one: a
        // monitor that goes quiet when it breaks is worse than none.
        outcome = { reachable: false, configured: true, settingsComplete: true, reason: "probe_threw" };
      }
      const { alert } = registry.observe(tenantId, outcome, now().toISOString());
      if (alert) options.onAlert(tenantId, alert);
    }
  };

  return {
    tick,
    intervalMs,
    start() {
      if (timer) return;
      timer = setInterval(() => { void tick(); }, intervalMs);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    get running() {
      return timer !== null;
    },
  };
}
