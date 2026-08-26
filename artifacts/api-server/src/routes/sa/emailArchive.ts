import { createHash, randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { objectStorageClient, privateObjectLocation } from "../../lib/objectStorage";
import { verifyEmailArchiveSession, type EmailArchiveActor } from "../../lib/emailArchiveAuth";
import { addAuditLog } from "./store";

const router: IRouter = Router();
const gmail = new ReplitConnectors();
const MAX_THREADS_PER_SYNC = 100;

type EmailDirection = "incoming" | "outgoing";

export interface ArchivedEmailAttachment {
  id: string;
  gmailAttachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  objectName: string;
}

export interface ArchivedEmail {
  id: string;
  gmailMessageId: string;
  gmailThreadId: string;
  fingerprint: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  replyTo: string;
  direction: EmailDirection;
  sentAt: string;
  receivedAt: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string | null;
  labels: string[];
  attachments: ArchivedEmailAttachment[];
  sizeBytes: number;
  archivedAt: string;
}

interface ArchiveState {
  emails: ArchivedEmail[];
  sync: {
    gmailAddress: string | null;
    lastSyncAt: string | null;
    lastSuccessAt: string | null;
    lastHistoryId: string | null;
    nextPageToken: string | null;
    historyPageToken: string | null;
    lastError: string | null;
    syncing: boolean;
  };
}

const emptyState = (): ArchiveState => ({
  emails: [],
  sync: {
    gmailAddress: null,
    lastSyncAt: null,
    lastSuccessAt: null,
    lastHistoryId: null,
    nextPageToken: null,
    historyPageToken: null,
    lastError: null,
    syncing: false,
  },
});

let statePromise: Promise<ArchiveState> | null = null;
let syncPromise: Promise<EmailSyncResult> | null = null;

async function getState() {
  if (!statePromise) {
    statePromise = (async () => {
      try {
        const { bucketName, objectName } = privateObjectLocation("email-archive", "index.json");
        const file = objectStorageClient.bucket(bucketName).file(objectName);
        const [exists] = await file.exists();
        if (!exists) return emptyState();
        const [contents] = await file.download();
        const raw = contents.toString("utf8");
        const parsed = JSON.parse(raw) as Partial<ArchiveState>;
        return {
          ...emptyState(),
          ...parsed,
          emails: Array.isArray(parsed.emails) ? parsed.emails : [],
          sync: { ...emptyState().sync, ...(parsed.sync ?? {}), syncing: false },
        };
      } catch (error: unknown) {
        throw new Error(`Unable to read protected email archive index: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    })();
  }
  return statePromise;
}

async function persistState() {
  const state = await getState();
  const { bucketName, objectName } = privateObjectLocation("email-archive", "index.json");
  await objectStorageClient.bucket(bucketName).file(objectName).save(Buffer.from(JSON.stringify(state)), {
    resumable: false,
    metadata: { contentType: "application/json", metadata: { archive: "gmail-index" } },
  });
}

function base64UrlToBuffer(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function base64UrlToText(data?: string) {
  return data ? base64UrlToBuffer(data).toString("utf8") : "";
}

function header(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function getAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

interface GmailPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: Array<{ name?: string; value?: string }> };
}

function inspectParts(part: GmailPart | undefined) {
  const attachments: Array<{ gmailAttachmentId: string; filename: string; mimeType: string; size: number }> = [];
  let bodyText = "";
  let bodyHtml: string | null = null;

  const visit = (node: GmailPart) => {
    const mimeType = node.mimeType?.toLowerCase() ?? "";
    if (node.filename && node.body?.attachmentId) {
      attachments.push({
        gmailAttachmentId: node.body.attachmentId,
        filename: node.filename,
        mimeType: node.mimeType ?? "application/octet-stream",
        size: node.body.size ?? 0,
      });
    } else if (mimeType === "text/plain" && node.body?.data) {
      bodyText += `${bodyText ? "\n\n" : ""}${base64UrlToText(node.body.data)}`;
    } else if (mimeType === "text/html" && node.body?.data) {
      bodyHtml = `${bodyHtml ?? ""}${base64UrlToText(node.body.data)}`;
    }
    node.parts?.forEach(visit);
  };

  if (part) visit(part);
  return { attachments, bodyText: bodyText.trim(), bodyHtml };
}

async function gmailJson<T>(requestPath: string): Promise<T> {
  const response = await gmail.proxy("google-mail", requestPath);
  if (!response.ok) {
    throw new Error(`Gmail request failed (${response.status}): ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function saveAttachment(
  messageId: string,
  attachment: { gmailAttachmentId: string; filename: string; mimeType: string; size: number },
) {
  const payload = await gmailJson<{ data?: string }>(
    `/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.gmailAttachmentId)}`,
  );
  const bytes = payload.data ? base64UrlToBuffer(payload.data) : Buffer.alloc(0);
  const safeName = attachment.filename.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 160) || "attachment";
  const { bucketName, objectName } = privateObjectLocation(
    "email-archive",
    messageId,
    `${createHash("sha256").update(attachment.gmailAttachmentId).digest("hex").slice(0, 24)}-${safeName}`,
  );
  await objectStorageClient.bucket(bucketName).file(objectName).save(bytes, {
    resumable: false,
    metadata: {
      contentType: attachment.mimeType,
      metadata: { archive: "gmail", gmailMessageId: messageId },
    },
  });

  return {
    id: randomUUID(),
    gmailAttachmentId: attachment.gmailAttachmentId,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: bytes.length || attachment.size,
    objectName,
  } satisfies ArchivedEmailAttachment;
}

function currentActor(req: Request): EmailArchiveActor | null {
  return verifyEmailArchiveSession(req.cookies?.sa_email_archive_session);
}

export interface EmailSyncResult {
  added: number;
  skipped: number;
  attachments: number;
  hasMore: boolean;
  syncedAt: string;
}

export async function syncEmailArchive(): Promise<EmailSyncResult> {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const state = await getState();
    state.sync.syncing = true;
    state.sync.lastError = null;
    await persistState();

    try {
      const profile = await gmailJson<{ emailAddress: string; historyId?: string }>("/gmail/v1/users/me/profile");
      let added = 0;
      let skipped = 0;
      let attachmentCount = 0;
      const existingIds = new Set(state.emails.map((email) => email.gmailMessageId));
      const existingFingerprints = new Set(state.emails.map((email) => email.fingerprint));
      const messages: GmailMessage[] = [];
      let historyHasMore = false;
      let usedHistory = false;

      // After initial capture, Gmail History provides the most recent changes
      // before the older inbox backfill is resumed. That keeps new messages
      // from waiting behind a large mailbox's pagination cursor.
      if (state.sync.lastHistoryId) {
        try {
          const params = new URLSearchParams({
            startHistoryId: state.sync.lastHistoryId,
            historyTypes: "messageAdded",
            maxResults: String(MAX_THREADS_PER_SYNC),
          });
          if (state.sync.historyPageToken) params.set("pageToken", state.sync.historyPageToken);
          const history = await gmailJson<{
            history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>;
            nextPageToken?: string;
          }>(`/gmail/v1/users/me/history?${params.toString()}`);

          usedHistory = true;
          const messageIds = new Set(
            (history.history ?? [])
              .flatMap((entry) => entry.messagesAdded ?? [])
              .map((entry) => entry.message?.id)
              .filter((id): id is string => Boolean(id)),
          );
          for (const messageId of messageIds) {
            messages.push(await gmailJson<GmailMessage>(`/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`));
          }
          state.sync.historyPageToken = history.nextPageToken ?? null;
          historyHasMore = Boolean(history.nextPageToken);
          if (!historyHasMore) state.sync.lastHistoryId = profile.historyId ?? state.sync.lastHistoryId;
        } catch (error) {
          // Gmail history can expire for long-idle accounts. A regular thread
          // backfill below safely recovers while duplicate IDs keep it idempotent.
          if (!(error instanceof Error) || !error.message.includes("(404)")) throw error;
          state.sync.lastHistoryId = null;
          state.sync.historyPageToken = null;
        }
      }

      let backfillHasMore = Boolean(state.sync.nextPageToken);
      if (!usedHistory || messages.length === 0) {
        const params = new URLSearchParams({ maxResults: String(MAX_THREADS_PER_SYNC) });
        if (state.sync.nextPageToken) params.set("pageToken", state.sync.nextPageToken);
        const threadPage = await gmailJson<{ threads?: Array<{ id: string }>; nextPageToken?: string }>(
          `/gmail/v1/users/me/threads?${params.toString()}`,
        );
        for (const thread of threadPage.threads ?? []) {
          const fullThread = await gmailJson<{ messages?: GmailMessage[] }>(
            `/gmail/v1/users/me/threads/${encodeURIComponent(thread.id)}?format=full`,
          );
          messages.push(...(fullThread.messages ?? []));
        }
        state.sync.nextPageToken = threadPage.nextPageToken ?? null;
        backfillHasMore = Boolean(threadPage.nextPageToken);
        // Use the profile history present before this page was read as the
        // incremental baseline, so later mail is picked up by History.
        state.sync.lastHistoryId = profile.historyId ?? state.sync.lastHistoryId;
      }

      for (const message of messages) {
        const payload = message.payload;
        const headers = payload?.headers;
        const from = header(headers, "From");
        const to = header(headers, "To");
        const subject = header(headers, "Subject") || "(بدون عنوان)";
        const sentAt = header(headers, "Date") || (message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString());
        const inspected = inspectParts(payload);
        const fingerprint = createHash("sha256")
          .update([message.id, message.threadId, from, to, subject, message.snippet ?? "", inspected.bodyText].join("\n"))
          .digest("hex");

        if (existingIds.has(message.id) || existingFingerprints.has(fingerprint)) {
          skipped += 1;
          continue;
        }

        const attachments: ArchivedEmailAttachment[] = [];
        for (const attachment of inspected.attachments) {
          attachments.push(await saveAttachment(message.id, attachment));
          attachmentCount += 1;
        }

        const direction: EmailDirection =
          getAddress(from) === profile.emailAddress.toLowerCase() ? "outgoing" : "incoming";
        const sizeBytes =
          Buffer.byteLength(inspected.bodyText) +
          Buffer.byteLength(inspected.bodyHtml ?? "") +
          attachments.reduce((total, item) => total + item.size, 0);

        state.emails.unshift({
          id: randomUUID(),
          gmailMessageId: message.id,
          gmailThreadId: message.threadId,
          fingerprint,
          subject,
          from,
          to,
          cc: header(headers, "Cc"),
          bcc: header(headers, "Bcc"),
          replyTo: header(headers, "Reply-To"),
          direction,
          sentAt,
          receivedAt: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : sentAt,
          snippet: message.snippet ?? inspected.bodyText.slice(0, 240),
          bodyText: inspected.bodyText,
          bodyHtml: inspected.bodyHtml,
          labels: message.labelIds ?? [],
          attachments,
          sizeBytes,
          archivedAt: new Date().toISOString(),
        });
        existingIds.add(message.id);
        existingFingerprints.add(fingerprint);
        added += 1;
      }

      state.sync.gmailAddress = profile.emailAddress;
      state.sync.lastSyncAt = new Date().toISOString();
      state.sync.lastSuccessAt = state.sync.lastSyncAt;
      state.sync.lastError = null;
      state.sync.syncing = false;
      await persistState();
      return { added, skipped, attachments: attachmentCount, hasMore: historyHasMore || backfillHasMore, syncedAt: state.sync.lastSyncAt };
    } catch (error) {
      const state = await getState();
      state.sync.syncing = false;
      state.sync.lastError = error instanceof Error ? error.message.slice(0, 500) : "Unknown Gmail sync error";
      await persistState();
      throw error;
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

router.use("/sa/email-archive", (req: Request, res: Response, next) => {
  const actor = currentActor(req);
  if (!actor) {
    res.status(403).json({ error: "يلزم تسجيل الدخول لعرض أرشيف البريد" });
    return;
  }
  res.locals.emailArchiveActor = actor;
  next();
});

router.get("/sa/email-archive", async (req: Request, res: Response) => {
  const state = await getState();
  const query = String(req.query.q ?? "").trim().toLowerCase();
  const direction = String(req.query.direction ?? "");
  const from = String(req.query.from ?? "").trim().toLowerCase();
  const to = String(req.query.to ?? "").trim().toLowerCase();
  const start = String(req.query.start ?? "");
  const end = String(req.query.end ?? "");

  const emails = state.emails.filter((email) => {
    const searchable = [email.subject, email.from, email.to, email.cc, email.bcc, email.snippet, email.bodyText].join("\n").toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if ((direction === "incoming" || direction === "outgoing") && email.direction !== direction) return false;
    if (from && !email.from.toLowerCase().includes(from)) return false;
    if (to && !email.to.toLowerCase().includes(to)) return false;
    if (start && email.sentAt < `${start}T00:00:00`) return false;
    if (end && email.sentAt > `${end}T23:59:59`) return false;
    return true;
  });

  res.json(emails.map(({ bodyText, bodyHtml, ...email }) => ({ ...email, preview: bodyText || email.snippet })));
});

router.get("/sa/email-archive/dashboard", async (_req: Request, res: Response) => {
  const state = await getState();
  const bytes = state.emails.reduce((total, email) => total + email.sizeBytes, 0);
  res.json({
    ...state.sync,
    messageCount: state.emails.length,
    incomingCount: state.emails.filter((email) => email.direction === "incoming").length,
    outgoingCount: state.emails.filter((email) => email.direction === "outgoing").length,
    attachmentCount: state.emails.reduce((total, email) => total + email.attachments.length, 0),
    storageBytes: bytes,
  });
});

router.get("/sa/email-archive/:id", async (req: Request, res: Response) => {
  const state = await getState();
  const email = state.emails.find((item) => item.id === req.params.id);
  if (!email) {
    res.status(404).json({ error: "الرسالة غير موجودة في الأرشيف" });
    return;
  }
  res.json(email);
});

router.get("/sa/email-archive/:id/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  const state = await getState();
  const email = state.emails.find((item) => item.id === req.params.id);
  const attachment = email?.attachments.find((item) => item.id === req.params.attachmentId);
  if (!email || !attachment) {
    res.status(404).json({ error: "المرفق غير موجود" });
    return;
  }

  const { bucketName } = privateObjectLocation();
  const file = objectStorageClient.bucket(bucketName).file(attachment.objectName);
  res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`);
  res.setHeader("Cache-Control", "private, no-store");
  file.createReadStream().on("error", () => {
    if (!res.headersSent) res.status(404).json({ error: "تعذر العثور على ملف المرفق" });
    else res.end();
  }).pipe(res);

  const actor = res.locals.emailArchiveActor as EmailArchiveActor;
  addAuditLog(actor.id, actor.name, "update", "مرفق بريد", attachment.id, `تنزيل مرفق من بريد مؤرشف: ${attachment.filename}`);
});

router.post("/sa/email-archive/sync", async (req: Request, res: Response) => {
  const actor = res.locals.emailArchiveActor as EmailArchiveActor;
  if (actor.role !== "admin") {
    res.status(403).json({ error: "مزامنة البريد متاحة للمدير فقط" });
    return;
  }

  try {
    const result = await syncEmailArchive();
    addAuditLog(actor.id, actor.name, "update", "أرشيف البريد", "gmail", `مزامنة Gmail: ${result.added} رسالة جديدة، ${result.attachments} مرفق`);
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "تعذر مزامنة Gmail" });
  }
});

export default router;