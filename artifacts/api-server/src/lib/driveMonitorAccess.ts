// Wiring for Drive connection monitoring.
//
// Same separation as the rest of this work: the decision logic in
// driveMonitor.ts stays free of the database, the environment and Google, so
// it can be tested exhaustively; this file is the only place that reaches
// the real world.

import { getTenantDriveStatus } from "./tenantDrive";
import {
  RECOVERY_ACTIONS,
  STATE_MESSAGES,
  monitorRegistry,
  type ConnectionState,
  type ProbeOutcome,
} from "./driveMonitor";

/** Names only. A value is never read, logged or returned. */
const REQUIRED_SETTINGS = [
  "GOOGLE_DRIVE_CLIENT_ID",
  "GOOGLE_DRIVE_CLIENT_SECRET",
  "GOOGLE_DRIVE_OAUTH_REDIRECT_URI",
  "GOOGLE_DRIVE_ROOT_FOLDER_ID",
  "STORAGE_ENCRYPTION_KEY",
] as const;

/** Which required settings are absent. Names only - never values. */
export function missingSettings(env: NodeJS.ProcessEnv = process.env): string[] {
  return REQUIRED_SETTINGS.filter((name) => {
    const value = env[name];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

/**
 * One real, non-destructive probe of a tenant's connection.
 *
 * getTenantDriveStatus already refreshes the access token and makes a single
 * /about call, so it proves Google ACCEPTED the credential rather than that
 * it merely decrypted. It reads no file, lists no folder and writes nothing.
 */
export async function probeTenantConnection(tenantId: string): Promise<ProbeOutcome> {
  const missing = missingSettings();
  if (missing.length > 0) {
    return {
      reachable: false,
      configured: false,
      settingsComplete: false,
      reason: `missing_settings:${missing.length}`,
    };
  }
  try {
    const status = await getTenantDriveStatus(tenantId) as {
      configured?: boolean; verified?: boolean; state?: ConnectionState;
    };
    if (!status.configured) {
      return { reachable: false, configured: false, settingsComplete: true, reason: "no_connection" };
    }
    if (status.state === "reauth_required") {
      return {
        reachable: true, configured: true, settingsComplete: true,
        terminal: true, reason: "invalid_grant",
      };
    }
    if (!status.verified) {
      return { reachable: false, configured: true, settingsComplete: true, reason: "api_unreachable" };
    }
    return { reachable: true, configured: true, settingsComplete: true, reason: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const terminal = /invalid_grant|unauthorized_client|invalid_client/i.test(message);
    return {
      reachable: false,
      configured: true,
      settingsComplete: true,
      terminal,
      reason: terminal ? "invalid_grant" : "probe_failed",
    };
  }
}

export interface Diagnostics {
  state: ConnectionState;
  message: string;
  actionRequired: boolean;
  recommendedAction: string;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  degradedStreak: number;
  missingSettings: string[];
  recentTransitions: Array<{ from: ConnectionState | null; to: ConnectionState; reason: string; at: string }>;
}

/**
 * Everything an institution administrator needs, and nothing more.
 *
 * WHAT IS DELIBERATELY ABSENT: the refresh token, the access token, the
 * client secret, the encrypted credential, any file name and any file id.
 * A diagnostics page is exactly the sort of screen that gets pasted into a
 * support thread, so it must be safe to paste.
 */
export async function connectionDiagnostics(
  tenantId: string,
  now: () => Date = () => new Date(),
): Promise<Diagnostics> {
  const outcome = await probeTenantConnection(tenantId);
  const { record } = monitorRegistry.observe(tenantId, outcome, now().toISOString());
  return {
    state: record.state,
    message: STATE_MESSAGES[record.state],
    actionRequired: record.state === "reauth_required"
      || record.state === "misconfigured"
      || record.state === "disconnected",
    recommendedAction: RECOVERY_ACTIONS[record.state],
    lastCheckedAt: record.lastCheckedAt || null,
    lastSuccessAt: record.lastHealthyAt,
    lastFailureAt: record.lastFailureAt,
    lastFailureReason: record.lastFailureReason,
    degradedStreak: record.degradedStreak,
    missingSettings: missingSettings(),
    recentTransitions: record.transitions.slice(-10),
  };
}
