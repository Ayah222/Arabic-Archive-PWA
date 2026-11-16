// Alert delivery for Drive connection monitoring.
//
// THE CHANNEL IS THE ONE THAT ALREADY EXISTS. ArchHive has an in-app
// notification table with an "admin" audience, already surfaced in the UI
// and already carrying operational messages. Using it invents no recipient,
// needs no new credential, and reaches exactly the people who can act. A new
// webhook or mail integration would need an address, a secret and an owner
// decision - none of which I am entitled to invent.
//
// WHAT AN ALERT MAY CONTAIN
// A state, a classified reason, a time, and an instruction. Never a token,
// never a secret, never a customer file name. Alerts end up in screenshots
// and support threads, so the safe content is decided here rather than left
// to whoever writes the next message.

import { randomUUID } from "node:crypto";
import type { Alert, ConnectionState } from "./driveMonitor";

export type DeliveryStatus = "delivered" | "failed" | "pending";

export interface DeliveryResult {
  status: DeliveryStatus;
  attempts: number;
  error: string | null;
  at: string;
}

export interface AlertMessage {
  title: string;
  body: string;
  severity: Alert["severity"];
  state: ConnectionState;
  actionRequired: boolean;
}

/** The thing that actually delivers. Swapped for a fake in every test. */
export interface AlertChannel {
  readonly name: string;
  send(tenantId: string, message: AlertMessage): Promise<void>;
}

const TITLES: Record<ConnectionState, string> = {
  healthy: "تمت استعادة ربط Google Drive",
  degraded: "خدمة Google Drive غير مستقرة",
  reauth_required: "يلزم إعادة ربط Google Drive",
  disconnected: "انقطع ربط Google Drive",
  misconfigured: "إعداد Google Drive غير مكتمل",
};

const ACTIONS: Record<ConnectionState, string> = {
  healthy: "لا يلزم أي إجراء.",
  degraded: "لا يلزم إجراء فوري. إذا استمرت الحالة أكثر من ساعة، تحقق من حالة خدمات Google.",
  reauth_required:
    "ألغِ وصول ArchHive من صفحة أمان حساب Google، ثم أعد الربط من إعدادات التخزين.",
  disconnected: "أعد ربط Google Drive من إعدادات التخزين بحساب مدير المؤسسة.",
  misconfigured: "أكمل إعداد متغيرات OAuth في بيئة الإنتاج ثم أعد المحاولة.",
};

/** Reasons are machine tokens by construction, so they are safe to show. */
const SAFE_REASON = /^[a-z0-9_:.-]{1,64}$/i;

export function buildAlertMessage(alert: Alert): AlertMessage {
  const reason = SAFE_REASON.test(alert.reason) ? alert.reason : "unknown";
  return {
    title: TITLES[alert.state],
    // The reason is a short machine token (invalid_grant, http_503). It is
    // included because it is the difference between "try again later" and
    // "a human must reconnect", and it can carry nothing sensitive.
    body: `${alert.message} (${reason})\n${ACTIONS[alert.state]}`,
    severity: alert.severity,
    state: alert.state,
    actionRequired: alert.actionRequired,
  };
}

/**
 * Delivers with bounded retries.
 *
 * A transient delivery failure must not lose the alert, and must not retry
 * forever either - an alert nobody can deliver is itself worth recording, so
 * the result is returned rather than thrown and the caller persists it.
 */
export async function deliverAlert(
  tenantId: string,
  alert: Alert,
  channel: AlertChannel,
  options: { maxAttempts?: number; now?: () => Date; onRetry?: (attempt: number) => Promise<void> } = {},
): Promise<DeliveryResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const now = options.now ?? (() => new Date());
  const message = buildAlertMessage(alert);
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await channel.send(tenantId, message);
      return { status: "delivered", attempts: attempt, error: null, at: now().toISOString() };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error ?? "unknown");
      if (attempt < maxAttempts && options.onRetry) await options.onRetry(attempt);
    }
  }
  return {
    status: "failed",
    attempts: maxAttempts,
    // Truncated: a delivery error is diagnostic, not a place for a payload.
    error: lastError.slice(0, 200),
    at: now().toISOString(),
  };
}

/**
 * The in-app notification channel.
 *
 * createNotification is injected rather than imported so this module stays
 * testable without the database, and so the dependency is visible.
 */
export function inAppAlertChannel(deps: {
  createNotification: (notification: {
    id: string; title: string; message: string;
    type: "reminder" | "info" | "warning" | "success";
    audience: "all" | "admin" | "employee";
    scheduledAt: string | null; read: boolean; projectId: string | null; createdAt: string;
  }) => Promise<unknown>;
  now?: () => Date;
}): AlertChannel {
  const now = deps.now ?? (() => new Date());
  return {
    name: "in-app",
    async send(_tenantId, message) {
      await deps.createNotification({
        id: randomUUID(),
        title: message.title,
        message: message.body,
        type: message.severity === "critical" ? "warning"
          : message.severity === "warning" ? "warning" : "success",
        // Only administrators can act on a connection fault, and the body
        // would mean nothing to anyone else.
        audience: "admin",
        scheduledAt: null,
        read: false,
        projectId: null,
        createdAt: now().toISOString(),
      });
    },
  };
}

/**
 * A channel that records instead of sending. This is the DEFAULT until an
 * owner confirms a channel, so nothing is ever delivered to a recipient
 * nobody chose.
 */
export function recordingAlertChannel(sink: Array<{ tenantId: string; message: AlertMessage }>): AlertChannel {
  return {
    name: "recording",
    async send(tenantId, message) {
      sink.push({ tenantId, message });
    },
  };
}
