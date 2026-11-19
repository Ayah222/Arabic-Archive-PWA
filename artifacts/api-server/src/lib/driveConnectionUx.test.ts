// Tests for the Drive connection interface decision.
//
// Pure logic, so the whole matrix - every state, authorized and not - is
// exercised directly. No network, no credential, no database, no DOM.
//
// The two rules worth protecting are stated as tests rather than as
// comments: a transient failure must never ask for consent, and nobody
// outside the storage administrators may ever be offered a control.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  driveConnectionUx,
  transientPollSeconds,
  type DriveConnectionState,
} from "./driveConnectionUx";

const STATES: DriveConnectionState[] = [
  "healthy", "degraded", "reauth_required", "misconfigured", "disconnected",
];
/** Anyone hasAdminAccess() rejects: data entry, viewers, signed-out. */
const CANNOT_MANAGE = false;

test("1. healthy is silent - no tone, no action, no interruption", () => {
  const ux = driveConnectionUx({ state: "healthy", canManage: true });
  assert.equal(ux.tone, "none");
  assert.equal(ux.action, "none");
  assert.equal(ux.actionRequired, false);
  assert.equal(ux.reason, "ok");
  assert.ok(ux.pollAfterSeconds >= 60, "a healthy connection is not polled aggressively");
});

test("2. a TRANSIENT failure never asks for consent", () => {
  const ux = driveConnectionUx({ state: "degraded", canManage: true });
  assert.equal(ux.action, "none", "degraded must NOT offer reconnect");
  assert.equal(ux.actionRequired, false);
  assert.equal(ux.reason, "transient");
  assert.equal(ux.tone, "warning", "it is surfaced, but it is not an alarm");
});

test("3. only a CONFIRMED revocation offers reconnect", () => {
  const ux = driveConnectionUx({ state: "reauth_required", canManage: true });
  assert.equal(ux.action, "reconnect");
  assert.equal(ux.actionRequired, true);
  assert.equal(ux.tone, "critical");
  assert.equal(ux.pollAfterSeconds, 0, "stop polling once a human has to act");
});

test("4. reconnect is offered for EXACTLY one state", () => {
  const offering = STATES.filter(
    (state) => driveConnectionUx({ state, canManage: true }).action === "reconnect",
  );
  assert.deepEqual(offering, ["reauth_required"]);
});

test("5. a misconfigured SERVER does not send the admin through consent", () => {
  const ux = driveConnectionUx({ state: "misconfigured", canManage: true });
  assert.equal(ux.action, "contact-support");
  assert.notEqual(ux.action, "reconnect", "consent cannot fix a missing server setting");
  assert.equal(ux.actionRequired, true);
});

test("6. never connected offers connect, and is not an error", () => {
  const ux = driveConnectionUx({ state: "disconnected", canManage: true });
  assert.equal(ux.action, "connect");
  assert.equal(ux.actionRequired, false);
  assert.equal(ux.tone, "info");
});

test("7. a viewer who cannot manage storage is offered nothing, in any state", () => {
  for (const state of STATES) {
    const ux = driveConnectionUx({ state, canManage: CANNOT_MANAGE });
    assert.equal(ux.action, "none", `no action for ${state}`);
    assert.equal(ux.canManageStorage, false);
    assert.equal(ux.tone, "none", `must not be nagged about ${state}`);
    assert.equal(ux.actionRequired, false);
    assert.equal(ux.reason, "hidden");
  }
});

test("8. authorization is injected, never re-derived here", () => {
  // The institution's own admin recovers without any platform involvement -
  // the whole point of self-service recovery. Whoever hasAdminAccess()
  // approves gets the offer; this module does not second-guess it, and
  // carries no copy of the rule that could drift from the real one.
  const allowed = driveConnectionUx({ state: "reauth_required", canManage: true });
  const denied = driveConnectionUx({ state: "reauth_required", canManage: false });
  assert.equal(allowed.action, "reconnect");
  assert.equal(denied.action, "none");
});

test("9. backoff doubles and is capped", () => {
  assert.equal(transientPollSeconds(1), 30);
  assert.equal(transientPollSeconds(2), 60);
  assert.equal(transientPollSeconds(3), 120);
  assert.equal(transientPollSeconds(10), 900, "capped, not unbounded");
  assert.equal(transientPollSeconds(1000), 900, "still capped");
  assert.equal(transientPollSeconds(0), 30, "a nonsense count degrades to the base");
  assert.equal(transientPollSeconds(-5), 30);
  assert.equal(transientPollSeconds(Number.NaN), 30);
});

test("10. repeated transient failures back off rather than hammer Google", () => {
  const first = driveConnectionUx({ state: "degraded", canManage: true, consecutiveFailures: 1 });
  const later = driveConnectionUx({ state: "degraded", canManage: true, consecutiveFailures: 6 });
  assert.ok(later.pollAfterSeconds > first.pollAfterSeconds);
  assert.ok(later.pollAfterSeconds <= 900);
});

test("11. an unknown state degrades safely rather than throwing", () => {
  const ux = driveConnectionUx({
    state: "something-new" as DriveConnectionState, canManage: true,
  });
  assert.equal(ux.actionRequired, false, "an unknown state must not raise a false alarm");
  assert.ok(["connect", "none"].includes(ux.action));
});
