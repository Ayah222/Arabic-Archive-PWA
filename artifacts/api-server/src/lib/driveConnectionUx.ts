/**
 * What the interface should show about the Google Drive connection.
 *
 * WHY THIS IS A SEPARATE, PURE MODULE
 * The decision used to live in the sidebar component, and it keyed off
 * `configured` - which only means "a credential is present and decrypts".
 * That is a LOCAL check: a token Google revoked yesterday still decrypts
 * perfectly, so a revoked connection rendered as a green check for ever and
 * the administrator was never offered a way back. The state that matters is
 * the one Google answers, and the rule for turning it into an interface has
 * to be testable on its own.
 *
 * It returns a SEMANTIC decision, never wording. The Arabic and English
 * copy stays in the view where the rest of the translations live; this
 * module decides tone, which single action is offered, who may see it, and
 * when to look again.
 *
 * THE TWO MISTAKES THIS EXISTS TO PREVENT
 *   1. Asking for consent because of a transient failure. A network blip or
 *      a Google 5xx is `degraded`. Consent is offered ONLY for a confirmed
 *      revocation or expiry, which Google reports as invalid_grant.
 *   2. Showing storage controls, or a support message, to someone who
 *      cannot act on them. Only a storage administrator ever sees an
 *      action.
 */

/** The connection states the monitor and the live probe can report. */
export type DriveConnectionState =
  | "healthy"
  | "degraded"
  | "reauth_required"
  | "misconfigured"
  | "disconnected";

export type DriveUxTone = "none" | "info" | "warning" | "critical";

/**
 * The single action offered, if any.
 *   connect        - never connected; start the normal consent flow
 *   reconnect      - confirmed revocation/expiry; same flow, re-entered
 *   contact-support - the SERVER is misconfigured; consent cannot fix it
 *   none           - nothing for this viewer to do
 */
export type DriveUxAction = "none" | "connect" | "reconnect" | "contact-support";

export interface DriveConnectionUx {
  tone: DriveUxTone;
  action: DriveUxAction;
  /** Whether this viewer is allowed to start a connect/reconnect at all. */
  canManageStorage: boolean;
  /** True ONLY for a confirmed revocation, expiry or misconfiguration. */
  actionRequired: boolean;
  /** Machine key for the copy. Never user-facing text. */
  reason: "ok" | "transient" | "revoked" | "server_setup" | "never_connected" | "hidden";
  /** Seconds before the client should ask again. 0 means stop polling. */
  pollAfterSeconds: number;
}

/**
 * Quiet when healthy. A routine status message every few minutes is noise,
 * and noise is what makes a real warning get ignored.
 */
const HEALTHY_POLL_SECONDS = 300;

/** Transient failures retry quickly at first, then back off. */
const TRANSIENT_BASE_SECONDS = 30;
const TRANSIENT_MAX_SECONDS = 900;

/**
 * Backoff for a connection that is failing but not confirmed dead.
 *
 * Doubling from 30s, capped at 15 minutes. The cap matters more than the
 * curve: an instance that polls a broken connection forever at 30s turns one
 * outage into a sustained call rate against Google, which is how a transient
 * problem becomes a rate-limited one.
 */
export function transientPollSeconds(consecutiveFailures: number): number {
  const failures = Number.isFinite(consecutiveFailures) && consecutiveFailures > 0
    ? Math.floor(consecutiveFailures)
    : 1;
  const backoff = TRANSIENT_BASE_SECONDS * Math.pow(2, Math.min(failures, 10) - 1);
  return Math.min(backoff, TRANSIENT_MAX_SECONDS);
}

export function driveConnectionUx(input: {
  state: DriveConnectionState;
  /**
   * Whether this viewer may manage the storage connection.
   *
   * Passed IN rather than derived here. Authorization has one home -
   * hasAdminAccess in emailArchiveAuth - and a second copy of the rule in a
   * presentation module is how the two quietly drift apart.
   */
  canManage: boolean;
  consecutiveFailures?: number;
}): DriveConnectionUx {
  const manages = input.canManage;

  // Everyone else sees nothing here. An employee who cannot act on a storage
  // fault gains nothing from a panel about it, and must never be shown a
  // control that asks for a Google account. The warning an employee needs
  // belongs at the document operation that actually failed, not in a sidebar.
  if (!manages) {
    return {
      tone: "none",
      action: "none",
      canManageStorage: false,
      actionRequired: false,
      reason: "hidden",
      pollAfterSeconds: 0,
    };
  }

  switch (input.state) {
    case "healthy":
      return {
        tone: "none",
        action: "none",
        canManageStorage: true,
        actionRequired: false,
        reason: "ok",
        pollAfterSeconds: HEALTHY_POLL_SECONDS,
      };

    case "degraded":
      // NOT a reason to ask for consent. Google was unreachable or answered
      // with something that is not a credential verdict; the stored refresh
      // token may well be perfectly good. Retry, quietly, with backoff.
      return {
        tone: "warning",
        action: "none",
        canManageStorage: true,
        actionRequired: false,
        reason: "transient",
        pollAfterSeconds: transientPollSeconds(input.consecutiveFailures ?? 1),
      };

    case "reauth_required":
      // The only state that earns a consent prompt: Google itself rejected
      // the refresh token. Stop polling - no amount of retrying fixes a
      // revoked grant, and the page is now waiting on a person.
      return {
        tone: "critical",
        action: "reconnect",
        canManageStorage: true,
        actionRequired: true,
        reason: "revoked",
        pollAfterSeconds: 0,
      };

    case "misconfigured":
      // A server setting is missing. Consent cannot fix it, so offering
      // "reconnect" here would send the administrator through a flow that
      // is guaranteed to fail and teach them the button does not work.
      return {
        tone: "critical",
        action: "contact-support",
        canManageStorage: true,
        actionRequired: true,
        reason: "server_setup",
        pollAfterSeconds: HEALTHY_POLL_SECONDS,
      };

    case "disconnected":
    default:
      return {
        tone: "info",
        action: "connect",
        canManageStorage: true,
        actionRequired: false,
        reason: "never_connected",
        pollAfterSeconds: HEALTHY_POLL_SECONDS,
      };
  }
}
