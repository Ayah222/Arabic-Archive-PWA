// Tests for the durable monitoring cycle, the lease, and alert delivery.
//
// No database, no network, no Google, no timer. The store is the in-memory
// implementation, which applies the same claiming rule the SQL does, so the
// concurrency tests exercise real semantics rather than a simplification.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  InMemoryMonitorStore,
  emptyHealthRow,
  type HealthRow,
} from "./driveMonitorStore";
import {
  runMonitorCycle,
  schedulerSecretMatches,
  ALERT_RETRY_AFTER_MS,
  alertToDeliver,
} from "./monitorRunner";
import {
  buildAlertMessage,
  deliverAlert,
  recordingAlertChannel,
  type AlertChannel,
  type AlertMessage,
} from "./driveAlerts";
import type { ProbeOutcome } from "./driveMonitor";
import { alertForState } from "./driveMonitor";

const currentDir = dirname(fileURLToPath(import.meta.url));
const T1 = "tenant-1";
const T2 = "tenant-2";

const ok: ProbeOutcome = { reachable: true, configured: true, settingsComplete: true, reason: "ok" };
const blip: ProbeOutcome = { reachable: false, configured: true, settingsComplete: true, reason: "http_503" };
const revoked: ProbeOutcome = {
  reachable: true, configured: true, settingsComplete: true, terminal: true, reason: "invalid_grant",
};
const unset: ProbeOutcome = { reachable: false, configured: false, settingsComplete: false, reason: "missing_settings:3" };
const wrongAccount: ProbeOutcome = { ...ok, wrongAccount: true, reason: "unexpected_account" };

function harness(outcomes: Record<string, ProbeOutcome | (() => Promise<ProbeOutcome>)>) {
  const store = new InMemoryMonitorStore();
  const sink: Array<{ tenantId: string; message: AlertMessage }> = [];
  const probes: string[] = [];
  let clock = Date.parse("2026-11-16T00:00:00.000Z");
  const now = () => new Date(clock);
  const advance = (ms: number) => { clock += ms; };
  const deps = (instanceId = "inst-a") => ({
    store,
    instanceId,
    now,
    channel: recordingAlertChannel(sink),
    probe: async (tenantId: string) => {
      probes.push(tenantId);
      const outcome = outcomes[tenantId];
      return typeof outcome === "function" ? outcome() : outcome;
    },
  });
  return { store, sink, probes, now, advance, deps };
}

// --------------------------------------------------- the lease / concurrency
test("exactly ONE instance checks a tenant per interval", async () => {
  const h = harness({ [T1]: ok });
  await h.store.ensure(T1, h.now());
  const [a, b, c] = await Promise.all([
    runMonitorCycle(h.deps("inst-a")),
    runMonitorCycle(h.deps("inst-b")),
    runMonitorCycle(h.deps("inst-c")),
  ]);
  const totalChecked = a.checked + b.checked + c.checked;
  assert.equal(totalChecked, 1, "three instances, one probe");
  assert.equal(h.probes.length, 1);
});

test("a second cycle inside the interval claims nothing", async () => {
  const h = harness({ [T1]: ok });
  await h.store.ensure(T1, h.now());
  await runMonitorCycle(h.deps());
  const second = await runMonitorCycle(h.deps());
  assert.equal(second.claimed, 0, "the lease has not expired yet");
  assert.equal(h.probes.length, 1);
});

test("the tenant becomes due again after the lease expires", async () => {
  const h = harness({ [T1]: ok });
  await h.store.ensure(T1, h.now());
  await runMonitorCycle(h.deps());
  h.advance(15 * 60 * 1000 + 1);
  const second = await runMonitorCycle(h.deps());
  assert.equal(second.checked, 1);
  assert.equal(h.probes.length, 2);
});

test("a scheduler restart loses nothing - the lease lives in the store", async () => {
  const h = harness({ [T1]: ok });
  await h.store.ensure(T1, h.now());
  await runMonitorCycle(h.deps("inst-before-restart"));
  // a brand new instance id models a replacement process
  h.advance(15 * 60 * 1000 + 1);
  const after = await runMonitorCycle(h.deps("inst-after-restart"));
  assert.equal(after.checked, 1);
  const row = await h.store.get(T1);
  assert.equal(row?.claimedBy, "inst-after-restart");
  assert.ok(row?.lastSuccessAt, "history from before the restart survived");
});

test("several tenants are each claimed once", async () => {
  const h = harness({ [T1]: ok, [T2]: blip });
  await h.store.ensure(T1, h.now());
  await h.store.ensure(T2, h.now());
  const [a, b] = await Promise.all([
    runMonitorCycle(h.deps("inst-a")),
    runMonitorCycle(h.deps("inst-b")),
  ]);
  assert.equal(a.checked + b.checked, 2);
  assert.deepEqual([...h.probes].sort(), [T1, T2]);
});

// ------------------------------------------------------------- durability
test("state, counters and timestamps persist in the store", async () => {
  const h = harness({ [T1]: blip });
  await h.store.ensure(T1, h.now());
  for (let i = 0; i < 3; i += 1) {
    await runMonitorCycle(h.deps());
    h.advance(15 * 60 * 1000 + 1);
  }
  const row = await h.store.get(T1) as HealthRow;
  assert.equal(row.state, "degraded");
  assert.equal(row.consecutiveFailures, 3);
  assert.ok(row.lastFailureAt);
  assert.equal(row.lastFailureReason, "http_503");
  assert.ok(row.transitions.length >= 1, "the transition was recorded");
});

test("the failure counter resets on recovery and the incident stays visible", async () => {
  let outcome: ProbeOutcome = blip;
  const h = harness({ [T1]: () => Promise.resolve(outcome) });
  await h.store.ensure(T1, h.now());
  await runMonitorCycle(h.deps());
  h.advance(15 * 60 * 1000 + 1);
  await runMonitorCycle(h.deps());
  h.advance(15 * 60 * 1000 + 1);
  outcome = ok;
  await runMonitorCycle(h.deps());
  const row = await h.store.get(T1) as HealthRow;
  assert.equal(row.state, "healthy");
  assert.equal(row.consecutiveFailures, 0);
  assert.ok(row.lastFailureAt, "the earlier incident is still visible after recovery");
  assert.ok(row.lastSuccessAt);
});

test("transition history is bounded", async () => {
  let flip = true;
  const h = harness({ [T1]: () => Promise.resolve(flip ? ok : revoked) });
  await h.store.ensure(T1, h.now());
  for (let i = 0; i < 60; i += 1) {
    await runMonitorCycle(h.deps());
    h.advance(15 * 60 * 1000 + 1);
    flip = !flip;
  }
  const row = await h.store.get(T1) as HealthRow;
  assert.ok(row.transitions.length <= 50, `bounded, got ${row.transitions.length}`);
});

// ------------------------------------------------------ recovery scenarios
test("a revoked refresh token alerts immediately", async () => {
  let outcome: ProbeOutcome = ok;
  const h = harness({ [T1]: () => Promise.resolve(outcome) });
  await h.store.ensure(T1, h.now());
  await runMonitorCycle(h.deps());
  h.advance(15 * 60 * 1000 + 1);
  outcome = revoked;
  const cycle = await runMonitorCycle(h.deps());
  assert.equal(cycle.alerts.length, 1);
  assert.equal(cycle.alerts[0].alert.state, "reauth_required");
  assert.equal(cycle.alerts[0].alert.severity, "critical");
  assert.equal(cycle.alerts[0].delivery.status, "delivered");
});

test("a single outage tick alerts nobody; three do", async () => {
  let outcome: ProbeOutcome = ok;
  const h = harness({ [T1]: () => Promise.resolve(outcome) });
  await h.store.ensure(T1, h.now());
  await runMonitorCycle(h.deps());
  outcome = blip;
  let warnings = 0;
  for (let i = 0; i < 3; i += 1) {
    h.advance(15 * 60 * 1000 + 1);
    const cycle = await runMonitorCycle(h.deps());
    warnings += cycle.alerts.filter((a) => a.alert.severity === "warning").length;
    if (i === 0) assert.equal(warnings, 0, "one blip must never page anyone");
  }
  assert.equal(warnings, 1, "exactly one warning, on the third consecutive failure");
});

test("an unchanged state never alerts twice", async () => {
  const h = harness({ [T1]: revoked });
  await h.store.ensure(T1, h.now());
  let alerts = 0;
  for (let i = 0; i < 5; i += 1) {
    const cycle = await runMonitorCycle(h.deps());
    alerts += cycle.alerts.length;
    h.advance(15 * 60 * 1000 + 1);
  }
  assert.equal(alerts, 1, "a persistent fault is announced once, not every interval");
});

test("recovery sends exactly one notice", async () => {
  let outcome: ProbeOutcome = revoked;
  const h = harness({ [T1]: () => Promise.resolve(outcome) });
  await h.store.ensure(T1, h.now());
  await runMonitorCycle(h.deps());
  h.advance(15 * 60 * 1000 + 1);
  outcome = ok;
  const cycle = await runMonitorCycle(h.deps());
  const info = cycle.alerts.filter((a) => a.alert.severity === "info");
  assert.equal(info.length, 1);
  assert.equal(info[0].alert.state, "healthy");
});

test("a wrong-account connection is reported as reauth_required", async () => {
  const h = harness({ [T1]: wrongAccount });
  await h.store.ensure(T1, h.now());
  const cycle = await runMonitorCycle(h.deps());
  assert.equal(cycle.states[0].state, "reauth_required");
});

test("missing configuration is reported as misconfigured, immediately", async () => {
  let outcome: ProbeOutcome = ok;
  const h = harness({ [T1]: () => Promise.resolve(outcome) });
  await h.store.ensure(T1, h.now());
  await runMonitorCycle(h.deps());
  h.advance(15 * 60 * 1000 + 1);
  outcome = unset;
  const cycle = await runMonitorCycle(h.deps());
  assert.equal(cycle.alerts[0].alert.state, "misconfigured");
  assert.equal(cycle.alerts[0].alert.actionRequired, true);
});

test("a probe that THROWS is a failure, never a skip", async () => {
  const h = harness({ [T1]: () => Promise.reject(new Error("network down")) });
  await h.store.ensure(T1, h.now());
  const cycle = await runMonitorCycle(h.deps());
  assert.equal(cycle.checked, 1, "the tenant was still checked");
  assert.equal(cycle.states[0].state, "degraded");
  const row = await h.store.get(T1) as HealthRow;
  assert.equal(row.reason, "probe_threw");
});

// ------------------------------------------------------- alert delivery
test("a delivery failure is retried, then recorded as failed", async () => {
  let attempts = 0;
  const flaky: AlertChannel = {
    name: "flaky",
    async send() { attempts += 1; throw new Error("channel unavailable"); },
  };
  const result = await deliverAlert("t", {
    severity: "critical", state: "reauth_required", reason: "invalid_grant",
    message: "x", actionRequired: true, at: "2026-11-16T00:00:00.000Z",
  }, flaky, { maxAttempts: 3 });
  assert.equal(attempts, 3);
  assert.equal(result.status, "failed");
  assert.equal(result.attempts, 3);
  assert.ok(result.error);
});

test("a delivery that succeeds on retry is recorded as delivered", async () => {
  let attempts = 0;
  const flaky: AlertChannel = {
    name: "flaky",
    async send() { attempts += 1; if (attempts < 2) throw new Error("temporary"); },
  };
  const result = await deliverAlert("t", {
    severity: "warning", state: "degraded", reason: "http_503",
    message: "x", actionRequired: false, at: "2026-11-16T00:00:00.000Z",
  }, flaky, { maxAttempts: 3 });
  assert.equal(result.status, "delivered");
  assert.equal(result.attempts, 2);
  assert.equal(result.error, null);
});

test("a failed delivery is persisted, so it is visible in diagnostics", async () => {
  const store = new InMemoryMonitorStore();
  await store.ensure(T1, new Date());
  const dead: AlertChannel = { name: "dead", async send() { throw new Error("no channel"); } };
  await runMonitorCycle({
    store, instanceId: "i", channel: dead, maxAttempts: 2,
    probe: async () => revoked,
  });
  const row = await store.get(T1) as HealthRow;
  assert.equal(row.lastDeliveryStatus, "failed");
  assert.ok(row.lastDeliveryError);
  assert.equal(row.lastAlertState, "reauth_required",
    "the alert still counts as raised, so it is not re-sent every interval");
});

test("a result from an OVERTAKEN worker is discarded, not forced", async () => {
  // The runner-level half of the fence: the store refuses the write and the
  // cycle treats that as normal, because the newer worker's result is right.
  const store = new InMemoryMonitorStore();
  await store.ensure(T1, new Date());
  const sink: Array<{ tenantId: string; message: AlertMessage }> = [];
  const cycle = await runMonitorCycle({
    store, instanceId: "slow", channel: recordingAlertChannel(sink),
    probe: async () => {
      // a newer worker claims the row while this probe is in flight
      await store.claimDue(new Date(Date.now() + 3_600_000), 900_000, 10, "fast");
      return ok;
    },
  });
  assert.equal(cycle.claimed, 1);
  assert.equal(cycle.checked, 0, "the stale result was not counted as a check");
  assert.equal(cycle.overtaken, 1);
  const row = await store.get(T1);
  assert.equal(row?.claimedBy, "fast", "the newer claim stands");
});
test("an alert carries no token, secret or file name", () => {
  const message = buildAlertMessage({
    severity: "critical", state: "reauth_required",
    reason: "invalid_grant", message: "connection revoked",
    actionRequired: true, at: "2026-11-16T00:00:00.000Z",
  });
  const text = JSON.stringify(message);
  for (const forbidden of ["refresh_token", "access_token", "client_secret",
    "ciphertext", "private_key", "Bearer ", ".pdf", "drive://"]) {
    assert.ok(!text.includes(forbidden), `alert leaked ${forbidden}`);
  }
});

test("an unexpected reason string cannot be smuggled into an alert body", () => {
  const message = buildAlertMessage({
    severity: "critical", state: "reauth_required",
    reason: "token=ya29.SECRET or <script>alert(1)</script>",
    message: "x", actionRequired: true, at: "2026-11-16T00:00:00.000Z",
  });
  assert.ok(message.body.includes("(unknown)"), "a non-token reason is replaced");
  assert.ok(!message.body.includes("ya29"));
  assert.ok(!message.body.includes("<script>"));
});

// ------------------------------------------------------- scheduler secret
test("the scheduler secret is compared safely and refuses weak configuration", () => {
  const secret = "a".repeat(32);
  assert.equal(schedulerSecretMatches(secret, secret), true);
  assert.equal(schedulerSecretMatches("b".repeat(32), secret), false);
  assert.equal(schedulerSecretMatches(secret, undefined), false, "unset means closed");
  assert.equal(schedulerSecretMatches("short", "short"), false, "a short secret is refused");
  assert.equal(schedulerSecretMatches(null, secret), false);
  assert.equal(schedulerSecretMatches(secret + "x", secret), false);
});

// --------------------------------------------------------- module shape
test("the runner and the store reach nothing real", () => {
  for (const file of ["monitorRunner.ts", "driveMonitorStore.ts", "driveAlerts.ts"]) {
    const source = readFileSync(join(currentDir, file), "utf8");
    const code = source.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    for (const forbidden of ["supabaseAdmin", "fetch(", "process.env", "setInterval"]) {
      assert.ok(!code.includes(forbidden), `${file} must not reference ${forbidden}`);
    }
  }
});

test("no background timer exists anywhere in the monitoring path", () => {
  // CODE only. The file explains in prose why a timer is the wrong tool,
  // and a test that fails on its own rationale proves nothing.
  const runner = readFileSync(join(currentDir, "monitorRunner.ts"), "utf8");
  const code = runner.split(String.fromCharCode(10))
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join(String.fromCharCode(10));
  assert.ok(!/setInterval|setTimeout/.test(code),
    "an Autoscale instance can stop between ticks; a timer is a hope, not a schedule");
});

test("an empty row starts due, so a new tenant is checked on the next run", () => {
  const now = new Date("2026-11-16T00:00:00.000Z");
  const row = emptyHealthRow(T1, now);
  assert.equal(row.nextDueAt, now.toISOString());
  assert.equal(row.consecutiveFailures, 0);
  assert.equal(row.lastDeliveryStatus, null);
});

// ------------------------------------------------------------------
// Phase 18EG - an alert is OUTSTANDING until it has actually landed.
//
// The defect: lastAlertState was recorded even when delivery FAILED, so
// the identical state was suppressed for ever - one failed notification
// silenced a revoked connection permanently.
//
// These tests also pin down WHY the obvious fix is not enough: with no
// transition there is no fresh alert to retry, so the retry has to be
// driven from the stored row.
// ------------------------------------------------------------------

const ROW = (over = {}) => ({
  lastAlertState: null, lastAlertAt: null, lastDeliveryStatus: null, ...over,
}) as never;
const NEXT = (over = {}) => ({
  state: "reauth_required", reason: "invalid_grant", lastCheckedAt: "2026-11-22T10:00:00.000Z", ...over,
}) as never;
const FRESH = (state = "reauth_required") => alertForState(state as never, "invalid_grant", "2026-11-22T10:00:00.000Z");
const T0 = new Date("2026-11-22T10:00:00.000Z");
const LATER = new Date("2026-11-22T10:20:00.000Z");

test("EG1. a first transition alert is delivered", () => {
  const out = alertToDeliver(ROW(), NEXT(), FRESH(), T0);
  assert.equal(out?.state, "reauth_required");
  assert.equal(out?.severity, "critical");
});

test("EG2. a DELIVERED alert is never repeated for an unchanged state", () => {
  const row = ROW({ lastAlertState: "reauth_required", lastDeliveryStatus: "delivered", lastAlertAt: T0.toISOString() });
  assert.equal(alertToDeliver(row, NEXT(), FRESH(), LATER), null, "no repeat on a fresh duplicate");
  assert.equal(alertToDeliver(row, NEXT(), null, LATER), null, "and none without a transition");
});

test("EG3. THE DEFECT: a FAILED delivery stays eligible for retry", () => {
  const row = ROW({ lastAlertState: "reauth_required", lastDeliveryStatus: "failed", lastAlertAt: T0.toISOString() });
  // No transition this cycle - which is exactly when the old code lost it.
  const out = alertToDeliver(row, NEXT(), null, LATER);
  assert.notEqual(out, null, "an undelivered alert must come back");
  assert.equal(out?.state, "reauth_required");
  assert.equal(out?.actionRequired, true, "rebuilt with the same urgency");
});

test("EG4. retry is rate bounded, not a storm", () => {
  const row = ROW({ lastAlertState: "reauth_required", lastDeliveryStatus: "failed", lastAlertAt: T0.toISOString() });
  const tooSoon = new Date(T0.getTime() + ALERT_RETRY_AFTER_MS - 1000);
  assert.equal(alertToDeliver(row, NEXT(), null, tooSoon), null, "inside the window: silent");
  const due = new Date(T0.getTime() + ALERT_RETRY_AFTER_MS + 1000);
  assert.notEqual(alertToDeliver(row, NEXT(), null, due), null, "after the window: retried");
});

test("EG5. a retry is abandoned once the state moves on", () => {
  const row = ROW({ lastAlertState: "degraded", lastDeliveryStatus: "failed", lastAlertAt: T0.toISOString() });
  // the connection is no longer degraded, so the stale alert is not resent
  assert.equal(alertToDeliver(row, NEXT({ state: "healthy" }), null, LATER), null);
});

test("EG6. a newer, more serious transition wins over a stale retry", () => {
  const row = ROW({ lastAlertState: "degraded", lastDeliveryStatus: "failed", lastAlertAt: T0.toISOString() });
  const out = alertToDeliver(row, NEXT(), FRESH("reauth_required"), LATER);
  assert.equal(out?.state, "reauth_required");
});

test("EG7. a recovery notice is still delivered after a failed critical", () => {
  const row = ROW({ lastAlertState: "reauth_required", lastDeliveryStatus: "failed", lastAlertAt: T0.toISOString() });
  const out = alertToDeliver(row, NEXT({ state: "healthy", reason: "ok" }), FRESH("healthy"), LATER);
  assert.equal(out?.state, "healthy");
  assert.equal(out?.severity, "info");
  assert.equal(out?.actionRequired, false);
});

test("EG8. nothing is sent when there is nothing outstanding", () => {
  assert.equal(alertToDeliver(ROW(), NEXT(), null, T0), null);
  assert.equal(alertToDeliver(ROW({ lastDeliveryStatus: "pending" }), NEXT(), null, LATER), null);
});

test("EG9. delivery success is never assumed without evidence", () => {
  // The rebuilt alert carries the CURRENT state and reason, never a stale
  // claim that something was delivered.
  const row = ROW({ lastAlertState: "degraded", lastDeliveryStatus: "failed", lastAlertAt: T0.toISOString() });
  const out = alertToDeliver(row, NEXT({ state: "degraded", reason: "http_503" }), null, LATER);
  assert.equal(out?.reason, "http_503");
  assert.equal(out?.severity, "warning");
  assert.equal(out?.actionRequired, false, "a transient fault never demands a human");
});
