import { createHmac, timingSafeEqual } from "node:crypto";

export type EmailArchiveActor = {
  id: string;
  name: string;
  role: "admin" | "data_entry" | "viewer";
};

type ArchiveSessionPayload = EmailArchiveActor & { exp: number };

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for email archive sessions");
  return secret;
}

function signature(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function createEmailArchiveSession(actor: EmailArchiveActor) {
  const payload = Buffer.from(JSON.stringify({ ...actor, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyEmailArchiveSession(token: unknown): EmailArchiveActor | null {
  if (typeof token !== "string") return null;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return null;

  const expectedSignature = signature(payload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ArchiveSessionPayload;
    if (!parsed.id || !parsed.name || !["admin", "data_entry", "viewer"].includes(parsed.role) || parsed.exp < Date.now()) return null;
    return { id: parsed.id, name: parsed.name, role: parsed.role };
  } catch {
    return null;
  }
}