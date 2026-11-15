// Tests for Drive connection monitoring.
//
// Pure logic, so every branch that matters - a revoked token, a blip, a
// recovery, a flapping connection - is exercised directly instead of waited
// for. No network, no credential, no database, no timer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_INTERVAL_MS,
  DEGRADED_ALERT_THRESHOLD,
  MAX_TRANSITIONS,
  MonitorRegistry,
  STATE_MESSAGES,
  applyObservation,
  classifyProbe,
  createMonitorLoop,
  emptyRecord,
  type Alert,
  type ProbeOutcome,
} from "./driveMonitor";

const currentDir = dirname(fileURLToPath(import.meta.url));
const TENANT = "tenant-a";
const ok: ProbeOutcome = { reachable: true, configured: true, settingsComplete: true, reason: "ok" };
const blip: ProbeOutcome = { reachable: false, configured: true, settingsComplete: true, reason: "http_503" };
const revoked: ProbeOutcome = {
  reachable: true, configured: true, settingsComplete: true, terminal: true, reason: "invalid_grant",
};
const absent: ProbeOutcome = { reachable: false, configured: false, settingsComplete: true, reason: "no_connection" };
const unset: ProbeOutcome = { reachable: false, configured: false, settingsComplete: false, reason: "missing_settings:3" };

let clock = 0;
const at = () => new Date(1_700_000_000_000 + (clock += 900_000)).toISOString();

function feed(outcomes: ProbeOutcome[]) {
  const registry = new MonitorRegistry();
  const alerts: Alert[] = [];
  for (const outcome of outcomes) {
    const { alert } = registry.observe(TENANT, outcome, at());
    if (alert) alerts.push(alert);
  }
  return { registry, alerts, record: registry.get(TENANT) };
}

// ------------------------------------------------------- classification
test("a decrypted but REVOKED token is never healthy", () => {
  assert.equal(classifyProbe(revoked), "reauth_required");
  // this is the precise false success that hid the current outage: the
  // credential decrypts perfectly and Google has already thrown it away
  assert.notEqual(classifyProbe(revoked), "healthy");
});

test("settings are judged before anything else", () => {
  assert.equal(classifyProbe(unset), "misconfigured");
  // a missing redirect URI is not a Drive fault and must not read as one
  assert.equal(classifyProbe({ ...revoked, settingsComplete: false }), "misconfigured");
});

test("a terminal failure outranks reachability", () => {
  assert.equal(classifyProbe({ ...revoked, reachable: false }), "reauth_required",
    "a revoked token is not a blip however the request failed");
});

test("the wrong Google account is treated as reauth_required", () => {
  assert.equal(classifyProbe({ ...ok, wrongAccount: true }), "reauth_required",
    "a working connection to the WRONG account is worse than none");
});

test("every outcome maps to exactly one known state", () => {
  const states = new Set([classifyProbe(ok), classifyProbe(blip), classifyProbe(revoked),
    classifyProbe(absent), classifyProbe(unset)]);
  assert.deepEqual([...states].sort(),
    ["degraded", "disconnected", "healthy", "misconfigured", "reauth_required"]);
});

// --------------------------------------------------------- alert policy
test("reauth_required alerts IMMEDIATELY, on the first occurrence", () => {
  const { alerts } = feed([ok, revoked]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].severity, "critical");
  assert.equal(alerts[0].actionRequired, true);
  assert.equal(alerts[0].state, "reauth_required");
});

test("a single blip alerts NOBODY", () => {
  const { alerts } = feed([ok, blip, ok]);
  assert.deepEqual(alerts.filter((a) => a.severity === "warning"), [],
    "one transient failure must never page anyone");
});

test("degraded alerts only on the THIRD consecutive result", () => {
  const { alerts, record } = feed([ok, blip, blip, blip]);
  const warnings = alerts.filter((a) => a.severity === "warning");
  assert.equal(warnings.length, 1);
  assert.equal(record.degradedStreak, DEGRADED_ALERT_THRESHOLD);
});

test("a long outage alerts ONCE, not every interval", () => {
  const { alerts } = feed([ok, blip, blip, blip, blip, blip, blip, blip, blip]);
  assert.equal(alerts.filter((a) => a.severity === "warning").length, 1,
    "re-notifying every 15 minutes is how alerts get muted");
});

test("an unchanged state never re-alerts", () => {
  const { alerts } = feed([ok, revoked, revoked, revoked, revoked]);
  assert.equal(alerts.filter((a) => a.state === "reauth_required").length, 1);
});

test("recovery produces one info notice, so a raised alert is visibly closed", () => {
  const { alerts } = feed([ok, revoked, ok]);
  const info = alerts.filter((a) => a.severity === "info");
  assert.equal(info.length, 1);
  assert.equal(info[0].state, "healthy");
  assert.equal(info[0].actionRequired, false);
});

test("a healthy start does not announce itself", () => {
  const { alerts } = feed([ok, ok, ok]);
  assert.equal(alerts.length, 0, "nothing happened, so nothing is reported");
});

test("never having been connected is not an incident", () => {
  const { alerts } = feed([absent, absent]);
  assert.equal(alerts.length, 0,
    "a connection that has never existed must not page anyone at startup");
});

test("LOSING a connection is an incident", () => {
  const { alerts } = feed([ok, absent]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].severity, "critical");
  assert.equal(alerts[0].state, "disconnected");
});

test("misconfiguration alerts immediately and asks for action", () => {
  const { alerts } = feed([ok, unset]);
  assert.equal(alerts[0].severity, "critical");
  assert.equal(alerts[0].actionRequired, true);
});

test("a flapping connection alerts on each real transition, not on each poll", () => {
  const { alerts } = feed([ok, revoked, ok, revoked, ok]);
  assert.equal(alerts.filter((a) => a.state === "reauth_required").length, 2);
  assert.equal(alerts.filter((a) => a.severity === "info").length, 2);
});

// -------------------------------------------------------------- records
test("the record tracks last success and last failure separately", () => {
  const { record } = feed([ok, blip]);
  assert.ok(record.lastHealthyAt, "a success time survives a later failure");
  assert.ok(record.lastFailureAt);
  assert.equal(record.lastFailureReason, "http_503");
  assert.notEqual(record.lastHealthyAt, record.lastFailureAt);
});

test("a success does not erase the previous failure", () => {
  const { record } = feed([ok, revoked, ok]);
  assert.equal(record.state, "healthy");
  assert.ok(record.lastFailureAt, "the incident is still visible after recovery");
  assert.equal(record.lastFailureReason, "invalid_grant");
});

test("only transitions are recorded, not every poll", () => {
  const { record } = feed([ok, ok, ok, blip, blip, ok]);
  assert.equal(record.transitions.length, 3, "healthy -> degraded -> healthy, plus the first");
});

test("transition history is bounded", () => {
  const flapping: ProbeOutcome[] = [];
  for (let i = 0; i < MAX_TRANSITIONS + 30; i += 1) flapping.push(i % 2 === 0 ? ok : revoked);
  const { record } = feed(flapping);
  assert.ok(record.transitions.length <= MAX_TRANSITIONS, "memory must stay bounded");
});

test("the degraded streak resets on any other state", () => {
  const { record } = feed([blip, blip, ok]);
  assert.equal(record.degradedStreak, 0);
});

test("an unobserved tenant has a safe empty record", () => {
  const record = emptyRecord("nobody");
  assert.equal(record.state, "disconnected");
  assert.equal(record.transitions.length, 0);
  assert.equal(record.lastHealthyAt, null);
});

test("tenants are tracked independently", () => {
  const registry = new MonitorRegistry();
  registry.observe("tenant-a", ok, at());
  registry.observe("tenant-b", revoked, at());
  assert.equal(registry.get("tenant-a").state, "healthy");
  assert.equal(registry.get("tenant-b").state, "reauth_required");
});

// ----------------------------------------------------------- the loop
test("the default interval is 15 minutes and is configurable", () => {
  assert.equal(DEFAULT_INTERVAL_MS, 15 * 60 * 1000);
  const loop = createMonitorLoop({
    intervalMs: 60_000, tenants: async () => [], probe: async () => ok, onAlert: () => {},
  });
  assert.equal(loop.intervalMs, 60_000);
});

test("the loop does NOT start itself", () => {
  const loop = createMonitorLoop({ tenants: async () => [], probe: async () => ok, onAlert: () => {} });
  assert.equal(loop.running, false,
    "creating a production scheduled job is a separate authorization");
});

test("a probe that THROWS counts as a failure, never as a skip", async () => {
  const registry = new MonitorRegistry();
  const alerts: Array<[string, Alert]> = [];
  const loop = createMonitorLoop({
    registry,
    tenants: async () => [TENANT],
    probe: async () => { throw new Error("network down"); },
    onAlert: (t, a) => alerts.push([t, a]),
    now: () => new Date(),
  });
  await loop.tick();
  await loop.tick();
  await loop.tick();
  assert.equal(registry.get(TENANT).state, "degraded",
    "a monitor that goes quiet when it breaks is worse than none");
  assert.equal(alerts.filter(([, a]) => a.severity === "warning").length, 1);
});

test("the loop probes every tenant it is given", async () => {
  const seen: string[] = [];
  const loop = createMonitorLoop({
    registry: new MonitorRegistry(),
    tenants: async () => ["t1", "t2", "t3"],
    probe: async (t) => { seen.push(t); return ok; },
    onAlert: () => {},
  });
  await loop.tick();
  assert.deepEqual(seen, ["t1", "t2", "t3"]);
});

// ------------------------------------------------------------ disclosure
test("no alert or record can carry a secret", () => {
  const { alerts, record } = feed([ok, revoked]);
  const haystack = JSON.stringify(alerts) + JSON.stringify(record);
  for (const forbidden of ["refresh_token", "access_token", "client_secret",
    "ciphertext", "private_key", "Bearer "]) {
    assert.ok(!haystack.includes(forbidden), `a secret leaked: ${forbidden}`);
  }
});

test("the module reads no secret and performs no I/O", () => {
  const source = readFileSync(join(currentDir, "driveMonitor.ts"), "utf8");
  const code = source.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  for (const forbidden of ["process.env", "fetch(", "supabaseAdmin", "decryptRefreshToken",
    "writeFileSync", 'method: "POST"']) {
    assert.ok(!code.includes(forbidden), `driveMonitor.ts must not reference ${forbidden}`);
  }
});

test("every state has a message and a recovery action", async () => {
  const { RECOVERY_ACTIONS } = await import("./driveMonitor");
  for (const state of ["healthy", "degraded", "reauth_required", "disconnected", "misconfigured"] as const) {
    assert.ok(STATE_MESSAGES[state]?.length > 0, state);
    assert.ok(RECOVERY_ACTIONS[state]?.length > 0, state);
  }
});

test("applyObservation is pure: the previous record is never mutated", () => {
  const before = emptyRecord(TENANT);
  const snapshot = JSON.stringify(before);
  applyObservation(before, { state: "healthy", reason: "ok", at: at() });
  assert.equal(JSON.stringify(before), snapshot);
});
