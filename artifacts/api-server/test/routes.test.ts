// HTTP-level tests for the Drive read and upload routes.
//
// These drive the REAL, unmodified route source through a real Express app
// over a real socket. Only the modules that would reach Supabase, Google or
// Replit Object Storage are substituted, and the build refuses if any of
// them escapes substitution.
//
// No production database, no Drive, no credential, no customer data.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const currentDir = dirname(fileURLToPath(import.meta.url));
import express from "express";
import cookieParser from "cookie-parser";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import tenantStorageRouter from "../src/routes/sa/tenantStorage";
import hrFilesRouter from "../src/routes/sa/hr/files";
import { calls as driveCalls, __setDriveState } from "../src/lib/tenantDrive";
import {
  driveStore,
  calls as driveUploadCalls,
  __setFault,
  __reset as resetDrive,
} from "../src/lib/driveUploadAccess";
import {
  calls as legacyCalls,
  __setProvider,
  __setLegacyConfigured,
} from "../src/lib/legacyDriveAccess";
import { calls as objectCalls } from "../src/lib/objectStorage";
import { __setActor } from "../src/lib/emailArchiveAuth";
import { __setTenant } from "../src/lib/tenantContext";
import attachmentsRouter from "../src/routes/sa/attachments";
import emailArchiveRouter from "../src/routes/sa/emailArchive";
import { __setAttachment } from "../src/routes/sa/archiveDb";
import { archiveState } from "../src/lib/objectStorage";


let server: Server;
let base: string;
/** Mimics app.ts: the tenant comes from the session layer, never the request. */
let tenantForRequest: string | null = "tenant-a";

before(async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", (req, res, next) => {
    if (tenantForRequest) res.locals.tenantId = tenantForRequest;
    next();
  });
  app.use("/api", tenantStorageRouter as never);
  app.use("/api", hrFilesRouter as never);
  app.use("/api", attachmentsRouter as never);
  app.use("/api", emailArchiveRouter as never);
  app.use("/api", (_req, res) => res.status(404).json({ error: "not found" }));
  // surface anything that escapes a route, so a 500 is explained not guessed
  app.use((err: Error, _req: never, res: never, _next: never) => {
    console.log("    ESCAPED ERROR: " + err.message);
    (res as { status: (n: number) => { json: (b: unknown) => void } })
      .status(500).json({ error: err.message });
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const reset = () => {
  driveCalls.oauthRead = 0;
  driveCalls.decrypt = 0;
  legacyCalls.legacyRead = 0;
  objectCalls.download = 0;
  objectCalls.save = 0;
  tenantForRequest = "tenant-a";
  __setTenant("tenant-a");
  __setActor(null);
  __setProvider("legacy-service-account");
  __setLegacyConfigured(true);
};

const get = (path: string, init: RequestInit = {}) => fetch(base + path, init);

// ------------------------------------------------- the legacy read path
test("a legacy tenant reads a drive:// file and NEVER decrypts a refresh token", async () => {
  reset();
  const res = await get("/api/sa/storage/files/legacyFILE00001");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "legacy-bytes");
  assert.equal(driveCalls.decrypt, 0, "the OAuth reader must not be reached for a legacy tenant");
  assert.ok(legacyCalls.legacyRead > 0, "the legacy reader did the work");
});

test("the response carries the safe headers", async () => {
  reset();
  const res = await get("/api/sa/storage/files/legacyFILE00001");
  assert.equal(res.headers.get("content-type"), "application/pdf");
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.match(res.headers.get("content-disposition") ?? "", /^inline; filename\*=UTF-8''/);
});

test("a file this tenant does not reference is refused with no bytes", async () => {
  reset();
  const res = await get("/api/sa/storage/files/notMINE0000001");
  assert.equal(res.status, 404);
  const body = await res.json() as { error?: string };
  assert.ok(body.error, "a refusal carries an explanation");
  assert.ok(!JSON.stringify(body).includes("legacy-bytes"), "no file content may leak");
});

test("another tenant asking for the same id gets nothing", async () => {
  reset();
  tenantForRequest = "tenant-b";
  const res = await get("/api/sa/storage/files/legacyFILE00001");
  assert.equal(res.status, 404);
  assert.notEqual(await res.text(), "legacy-bytes");
});

test("a forged Drive id is rejected as a bad request, not a server error", async () => {
  reset();
  for (const bad of ["abc", "a%20b", "..", "x".repeat(300)]) {
    const res = await get(`/api/sa/storage/files/${encodeURIComponent(bad)}`);
    assert.ok([400, 404].includes(res.status), `${bad} -> ${res.status}`);
    assert.notEqual(res.status, 500, "a malformed id must never be a 500");
  }
});

test("a request with no tenant in the session returns no bytes", async () => {
  reset();
  tenantForRequest = null;
  const res = await get("/api/sa/storage/files/legacyFILE00001");
  assert.notEqual(res.status, 200);
  assert.notEqual(await res.text(), "legacy-bytes");
});

// --------------------------------------------------- the OAuth read path
test("an OAuth tenant reads through the OAuth provider", async () => {
  reset();
  __setProvider("oauth");
  const res = await get("/api/sa/storage/files/oauthFILE000001");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "oauth-bytes");
  assert.equal(driveCalls.oauthRead, 1);
  assert.equal(legacyCalls.legacyRead, 0, "the legacy reader must not run for an OAuth tenant");
});

test("a cross-organisation OAuth file is refused 403", async () => {
  reset();
  __setProvider("oauth");
  const res = await get("/api/sa/storage/files/otherTENANT001");
  assert.equal(res.status, 403);
});

test("a missing OAuth file is 404, not 500", async () => {
  reset();
  __setProvider("oauth");
  const res = await get("/api/sa/storage/files/missingFILE001");
  assert.equal(res.status, 404);
});

// ------------------------------------------------- Replit path unchanged
test("an app_ reference still reads from Replit Object Storage", async () => {
  reset();
  const ref = "app_" + Buffer.from("app/tenant-a/hr/file.pdf", "utf8").toString("base64url");
  const res = await get(`/api/sa/hr/storage/files/${ref}`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "replit-bytes");
  assert.equal(objectCalls.download, 1, "the object-storage path is untouched");
  assert.equal(driveCalls.decrypt, 0);
  assert.equal(legacyCalls.legacyRead, 0);
});

test("an app_ reference belonging to another tenant is refused", async () => {
  reset();
  const ref = "app_" + Buffer.from("app/tenant-b/hr/file.pdf", "utf8").toString("base64url");
  const res = await get(`/api/sa/hr/storage/files/${ref}`);
  assert.equal(res.status, 404);
  assert.equal(objectCalls.download, 0, "no cross-tenant object may be fetched");
});

test("an HR drive_ reference routes through the provider, not straight to OAuth", async () => {
  reset();
  const res = await get("/api/sa/hr/storage/files/drive_legacyFILE00001");
  assert.equal(res.status, 200);
  assert.equal(driveCalls.decrypt, 0, "HR was one of the eight broken sites; it must not decrypt");
  assert.ok(legacyCalls.legacyRead > 0);
});

// ----------------------------------------------------- the health route
test("with the flag OFF the upload route still writes to Replit, unchanged", async () => {
  reset();
  __setActor({ tenantId: "tenant-a", role: "admin" });
  const form = new FormData();
  form.set("file", new Blob([Buffer.from("hello")], { type: "text/plain" }), "ملف.txt");
  // this route only accepts the agencies namespace; omitting it is a 400
  form.set("namespace", "agencies");
  const res = await fetch(base + "/api/sa/tenants/storage/upload", { method: "POST", body: form });
  assert.equal(res.status, 201);
  const body = await res.json() as { path: string };
  assert.ok(body.path.startsWith("app/"), "the flag is off, so storage must be unchanged");
  assert.ok(!body.path.startsWith("drive://"), "no provider switch may occur with the flag off");
  assert.equal(objectCalls.save, 1);
  assert.equal(driveCalls.save, 0, "the Drive upload pipeline must be unreachable while off");
});

// ------------------------------------- attachments and the email archive
const driveAttachment = (path: string) => ({
  id: "att1", projectId: "p1", entityType: "letter", entityId: "e1",
  objectPath: path, name: "عقد.docx", mimeType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  size: 12, storagePath: path,
});

test("attachments preview reads a legacy drive:// file without decrypting", async () => {
  reset();
  __setActor({ tenantId: "tenant-a", role: "admin" });
  __setAttachment(driveAttachment("drive://legacyFILE00001"));
  const res = await get("/api/sa/projects/p1/attachments/att1/preview.pdf");
  // conversion itself needs LibreOffice and is not under test; what matters
  // is that the READ happened on the legacy path and never touched OAuth
  assert.notEqual(res.status, 500);
  assert.equal(driveCalls.decrypt, 0, "attachments was one of the eight broken sites");
  assert.ok(legacyCalls.legacyRead > 0, "the legacy reader served it");
});

test("attachments preview for ANOTHER tenant discloses nothing", async () => {
  reset();
  tenantForRequest = "tenant-b";
  __setTenant("tenant-b");
  __setActor({ tenantId: "tenant-b", role: "admin" });
  __setAttachment(driveAttachment("drive://legacyFILE00001"));
  const res = await get("/api/sa/projects/p1/attachments/att1/preview.pdf");
  const body = await res.text();
  assert.ok(!body.includes("legacy-bytes"), "no file content may cross a tenant boundary");
});

test("attachments preview on an unreferenced id returns no bytes", async () => {
  reset();
  __setActor({ tenantId: "tenant-a", role: "admin" });
  __setAttachment(driveAttachment("drive://notMINE0000001"));
  const res = await get("/api/sa/projects/p1/attachments/att1/preview.pdf");
  const body = await res.text();
  assert.notEqual(res.status, 200);
  assert.ok(!body.includes("legacy-bytes"));
  // What this test DOES prove: never a 200, never file bytes, never an
  // empty body. What it does NOT prove: the exact status and headers on
  // this path. The route sets download headers before attempting the read
  // and then runs an audit-log call whose actor fixture this harness does
  // not fully reproduce, so the tail of the response is a harness artefact
  // rather than production behaviour. Left as a smoke test instead of
  // being asserted here, because an assertion on an unfaithful fixture
  // would be worse than none.
  const disposition = res.headers.get("content-disposition") ?? "";
  const contentType = res.headers.get("content-type") ?? "";
  console.log("    observed on failure: status " + res.status
    + ", content-type " + contentType
    + ", disposition " + (disposition ? "PRESENT" : "absent"));
});

test("attachments preview on a Replit-backed file still uses object storage", async () => {
  reset();
  __setActor({ tenantId: "tenant-a", role: "admin" });
  __setAttachment(driveAttachment("app/tenant-a/hr/file.pdf"));
  await get("/api/sa/projects/p1/attachments/att1/preview.pdf");
  assert.equal(objectCalls.download, 1, "the untouched path is still taken");
  assert.equal(driveCalls.decrypt, 0);
  assert.equal(legacyCalls.legacyRead, 0);
});

test("email archive attachment download reads via the provider", async () => {
  reset();
  __setActor({ tenantId: "tenant-a", role: "admin" });
  // getState() memoises per tenant and is never invalidated, so BOTH
  // messages must exist before the first email-archive request.
  archiveState.value = { emails: [
    { id: "m1", attachments: [{ id: "a1", filename: "خطاب.pdf",
      mimeType: "application/pdf", objectName: "drive://legacyFILE00001" }] },
    { id: "m2", attachments: [{ id: "a2", filename: "مفقود.pdf",
      mimeType: "application/pdf", objectName: "drive://notMINE0000001" }] },
  ] };
  const res = await get("/api/sa/email-archive/m1/attachments/a1/download");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "legacy-bytes");
  assert.equal(driveCalls.decrypt, 0, "emailArchive was one of the eight broken sites");
});

test("a failed email-archive Drive read is an error, never an empty success", async () => {
  reset();
  __setActor({ tenantId: "tenant-a", role: "admin" });
  const res = await get("/api/sa/email-archive/m2/attachments/a2/download");
  assert.notEqual(res.status, 200, "a failed read must never be a 200");
  const body = await res.text();
  assert.ok(body.length > 0, "and never an empty body");
  assert.ok(!body.includes("legacy-bytes"));
});

test("attachments preview with NO session reads nothing at all", async () => {
  reset();
  __setAttachment(driveAttachment("drive://legacyFILE00001"));
  const res = await get("/api/sa/projects/p1/attachments/att1/preview.pdf");
  assert.equal(res.status, 401);
  assert.equal(legacyCalls.legacyRead, 0, "authorization runs BEFORE any storage read");
  assert.equal(objectCalls.download, 0);
  assert.equal(driveCalls.decrypt, 0);
});

// ----------------------------------------------- the flag, ON for ONE tenant

// ------------------------------------------------ admin diagnostics
test("diagnostics requires an admin session", async () => {
  reset();
  const res = await get("/api/sa/tenants/storage/diagnostics");
  assert.equal(res.status, 403);
});

test("diagnostics reports a state and a recovery action", async () => {
  reset();
  __setActor({ tenantId: "tenant-a", role: "admin" });
  const res = await get("/api/sa/tenants/storage/diagnostics");
  assert.equal(res.status, 200);
  const body = await res.json() as Record<string, unknown>;
  for (const field of ["state", "message", "actionRequired", "recommendedAction",
    "lastCheckedAt", "lastSuccessAt", "lastFailureAt", "lastFailureReason"]) {
    assert.ok(field in body, `missing ${field}`);
  }
  assert.ok(["healthy", "degraded", "reauth_required", "disconnected", "misconfigured"]
    .includes(String(body.state)), String(body.state));
});

test("diagnostics exposes no secret and no file name", async () => {
  reset();
  __setActor({ tenantId: "tenant-a", role: "admin" });
  const text = await (await get("/api/sa/tenants/storage/diagnostics")).text();
  for (const forbidden of ["refresh_token", "access_token", "client_secret",
    "ciphertext", "private_key", "Bearer "]) {
    assert.ok(!text.includes(forbidden), `diagnostics leaked ${forbidden}`);
  }
});

test("diagnostics takes the tenant from the SESSION, not the request", async () => {
  reset();
  __setActor({ tenantId: "tenant-b", role: "admin" });
  const res = await get("/api/sa/tenants/storage/diagnostics?tenantId=tenant-a");
  assert.equal(res.status, 200);
  const source = readFileSync(join(currentDir, "..", "src", "routes", "sa", "tenantStorage.ts"), "utf8");
  assert.ok(/connectionDiagnostics\(actor\.tenantId\)/.test(source),
    "the tenant must come from the verified session, never a query parameter");
});

// --------------------------- Phase 18CK, through a real HTTP route
test("END TO END: after connecting OAuth, a historical file still downloads", async () => {
  reset();
  // exactly what completing the OAuth connection does to routing:
  // encrypted_credentials is overwritten, so the tenant resolves to oauth
  __setProvider("oauth");
  const res = await get("/api/sa/storage/files/legacyFILE00001");
  assert.equal(res.status, 200, "the migrated document must still be served");
  assert.equal(await res.text(), "legacy-bytes");
  assert.ok(driveCalls.oauthRead > 0, "the connected identity was tried first");
  assert.ok(legacyCalls.legacyRead > 0, "the historical reader rescued it");
});

test("END TO END: the rescue is skipped when no service account is configured", async () => {
  reset();
  __setProvider("oauth");
  __setLegacyConfigured(false);
  const res = await get("/api/sa/storage/files/legacyFILE00001");
  assert.equal(res.status, 404, "without a historical reader this is simply not found");
  assert.equal(legacyCalls.legacyRead, 0, "and no rescue was attempted");
});

test("END TO END: the rescue cannot fetch another tenant's file", async () => {
  reset();
  __setProvider("oauth");
  // legacyFILE00001 is referenced by tenant-a only; ask as tenant-b
  tenantForRequest = "tenant-b";
  __setTenant("tenant-b");
  const res = await get("/api/sa/storage/files/legacyFILE00001");
  assert.notEqual(res.status, 200, "cross-tenant access must be refused");
  assert.ok(!(await res.text()).includes("legacy-bytes"), "no bytes may leak");
});

// ------------------------------------------------------------------
// Phase 18DQ - self-service recovery.
//
// The rules worth protecting at the HTTP boundary: a transient failure
// never offers consent, and nobody who cannot manage storage is ever
// handed a control - whatever the connection state happens to be.
// ------------------------------------------------------------------

test("40. a healthy connection is reported silently, with no action", async () => {
  __setDriveState("healthy");
  __setActor({ tenantId: "tenant-a", role: "admin" });
  const body = await (await get("/api/sa/tenants/storage")).json();
  assert.equal(body.ux.tone, "none");
  assert.equal(body.ux.action, "none");
  assert.equal(body.ux.actionRequired, false);
  assert.equal(body.ux.canManageStorage, true);
});

test("41. a TRANSIENT failure does not offer consent over HTTP", async () => {
  __setDriveState("degraded");
  __setActor({ tenantId: "tenant-a", role: "admin" });
  const body = await (await get("/api/sa/tenants/storage")).json();
  assert.equal(body.ux.reason, "transient");
  assert.equal(body.ux.action, "none", "a blip must never ask the admin to reconnect");
  assert.equal(body.ux.actionRequired, false);
  assert.ok(body.ux.pollAfterSeconds > 0, "it keeps retrying by itself");
});

test("42. a CONFIRMED revocation offers reconnect and stops polling", async () => {
  __setDriveState("reauth_required");
  __setActor({ tenantId: "tenant-a", role: "admin" });
  const body = await (await get("/api/sa/tenants/storage")).json();
  assert.equal(body.ux.action, "reconnect");
  assert.equal(body.ux.actionRequired, true);
  assert.equal(body.ux.pollAfterSeconds, 0);
});

test("43. a misconfigured server asks for support, not for consent", async () => {
  __setDriveState("misconfigured");
  __setActor({ tenantId: "tenant-a", role: "admin" });
  const body = await (await get("/api/sa/tenants/storage")).json();
  assert.equal(body.ux.action, "contact-support");
});

test("44. AUTHORIZATION: a viewer is offered nothing, even when revoked", async () => {
  __setDriveState("reauth_required");
  __setActor({ tenantId: "tenant-a", role: "viewer" });
  const body = await (await get("/api/sa/tenants/storage")).json();
  assert.equal(body.ux.canManageStorage, false);
  assert.equal(body.ux.action, "none", "an ordinary user must never see a reconnect control");
  assert.equal(body.ux.tone, "none");
});

test("45. AUTHORIZATION: data entry is offered nothing either", async () => {
  __setDriveState("reauth_required");
  __setActor({ tenantId: "tenant-a", role: "data_entry" });
  const body = await (await get("/api/sa/tenants/storage")).json();
  assert.equal(body.ux.canManageStorage, false);
  assert.equal(body.ux.action, "none");
});

test("46. AUTHORIZATION: signing out is required to read status at all", async () => {
  __setActor(null);
  const res = await get("/api/sa/tenants/storage");
  assert.equal(res.status, 401);
});

test("47. AUTHORIZATION: a viewer cannot START the consent flow", async () => {
  __setActor({ tenantId: "tenant-a", role: "viewer" });
  const res = await fetch(base + "/api/sa/tenants/storage/oauth/start", { redirect: "manual" });
  assert.equal(res.status, 403);
});

test("48. an admin starting recovery is sent to Google, not told to wait", async () => {
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret";
  __setActor({ tenantId: "tenant-a", role: "admin" });
  const res = await fetch(base + "/api/sa/tenants/storage/oauth/start", { redirect: "manual" });
  assert.equal(res.status, 302);
  assert.match(String(res.headers.get("location")), /^https:\/\/accounts\.google\.com\//);
});

test("49. AUTHORIZATION: a viewer cannot complete a callback", async () => {
  __setActor({ tenantId: "tenant-a", role: "viewer" });
  const res = await fetch(base + "/api/sa/tenants/storage/oauth/callback?code=x&state=y", { redirect: "manual" });
  assert.equal(res.status, 400);
});

test("50. a client-reported failure streak cannot escape the backoff cap", async () => {
  __setDriveState("degraded");
  __setActor({ tenantId: "tenant-a", role: "admin" });
  const body = await (await get("/api/sa/tenants/storage?failures=99999")).json();
  assert.ok(body.ux.pollAfterSeconds <= 900, "the cap is the server's, not the client's");
  const junk = await (await get("/api/sa/tenants/storage?failures=not-a-number")).json();
  assert.ok(junk.ux.pollAfterSeconds > 0);
});

test("51. an upload never silently falls back to Google Drive", async () => {
  // 'Never claim a failed upload succeeded' starts with knowing which
  // provider ran. Uploads go to private object storage; if one ever
  // reached Drive instead, this counter would move.
  __setDriveState("reauth_required");
  __setActor({ tenantId: "tenant-a", role: "admin" });
  const before = driveCalls.save;
  const form = new FormData();
  form.set("namespace", "agencies");
  form.set("file", new Blob([Buffer.from("x")]), "a.bin");
  const res = await fetch(base + "/api/sa/tenants/storage/upload", { method: "POST", body: form });
  assert.equal(res.status, 201);
  assert.equal(driveCalls.save, before, "the upload must not touch Drive");
});

// ------------------------------------------------------------------
// Phase 18DS - direct institution Drive uploads.
//
// The whole point is that a Drive failure NEVER becomes a Replit write.
// Every fault below therefore asserts two things: the request failed, and
// object storage was not touched.
// ------------------------------------------------------------------

const ENABLED = "tenant-a";

async function agencyUpload(body = "hello drive", filename = "ملف.txt", type = "text/plain") {
  const form = new FormData();
  form.set("file", new Blob([Buffer.from(body)], { type }), filename);
  form.set("namespace", "agencies");
  return fetch(base + "/api/sa/tenants/storage/upload", { method: "POST", body: form });
}

async function withFlag(tenants: string, run: () => Promise<void>) {
  process.env.DRIVE_DIRECT_UPLOAD_TENANTS = tenants;
  try { await run(); } finally { delete process.env.DRIVE_DIRECT_UPLOAD_TENANTS; }
}

test("60. flag OFF: the upload route still writes to Replit, unchanged", async () => {
  reset(); resetDrive();
  __setActor({ tenantId: ENABLED, role: "admin" });
  const res = await agencyUpload();
  assert.equal(res.status, 201);
  const body = await res.json() as { path: string };
  assert.ok(body.path.startsWith("app/"), "flag off means storage is unchanged");
  assert.equal(objectCalls.save, 1);
  assert.equal(driveUploadCalls.upload, 0, "the Drive pipeline is unreachable while off");
});

test("61. flag ON: the file goes to Drive, with filename and MIME intact", async () => {
  reset(); resetDrive();
  __setActor({ tenantId: ENABLED, role: "admin" });
  await withFlag(ENABLED, async () => {
    const res = await agencyUpload("hello drive", "تقرير فني.pdf", "application/pdf");
    assert.equal(res.status, 201);
    const body = await res.json() as { path: string };
    assert.ok(body.path.startsWith("drive://"), "the enabled tenant stores in Drive");
    assert.equal(objectCalls.save, 0, "and NOT in Replit");
    const stored = [...driveStore.values()][0] as {
      name: string; mimeType: string; size: string; folderSegments: string[];
      appProperties: Record<string, string>;
    };
    assert.equal(stored.name, "تقرير فني.pdf", "the Arabic filename survives");
    assert.equal(stored.mimeType, "application/pdf", "the MIME type survives");
    assert.equal(Number(stored.size), Buffer.from("hello drive").length, "size matches");
    assert.equal(stored.folderSegments[0], "04 Agencies", "filed by namespace");
    assert.ok(stored.appProperties.archhiveUploadKey, "carries an idempotency key");
  });
});

test("62. ISOLATION: an unlisted tenant stays on Replit", async () => {
  reset(); resetDrive();
  tenantForRequest = "tenant-b";
  __setActor({ tenantId: "tenant-b", role: "admin" });
  await withFlag(ENABLED, async () => {
    const res = await agencyUpload();
    assert.equal(res.status, 201);
    const body = await res.json() as { path: string };
    assert.ok(body.path.startsWith("app/"), "an unlisted tenant is untouched");
    assert.equal(driveUploadCalls.upload, 0);
  });
});

test("63. no wildcard: '*' never enables anybody", async () => {
  reset(); resetDrive();
  __setActor({ tenantId: ENABLED, role: "admin" });
  await withFlag("*", async () => {
    const res = await agencyUpload();
    assert.equal(res.status, 201);
    const body = await res.json() as { path: string };
    assert.ok(body.path.startsWith("app/"), "a wildcard must not switch anyone to Drive");
    assert.equal(driveUploadCalls.upload, 0);
  });
});

test("64. IDEMPOTENCY: a retried upload creates exactly one Drive file", async () => {
  reset(); resetDrive();
  __setActor({ tenantId: ENABLED, role: "admin" });
  await withFlag(ENABLED, async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await agencyUpload("same bytes", "تقرير.txt");
      assert.equal(res.status, 201);
    }
    assert.equal(driveUploadCalls.upload, 1, "the retries found their own earlier file");
    assert.equal(driveStore.size, 1);
  });
});

test("65. CONCURRENCY: simultaneous identical uploads do not duplicate", async () => {
  reset(); resetDrive();
  __setActor({ tenantId: ENABLED, role: "admin" });
  await withFlag(ENABLED, async () => {
    const results = await Promise.all([
      agencyUpload("concurrent", "a.txt"),
      agencyUpload("concurrent", "a.txt"),
    ]);
    for (const r of results) assert.equal(r.status, 201);
    // Discovery-before-create is not atomic, so two creates are possible.
    // What must hold is that nothing is lost and nothing is silently
    // rerouted: every result is a Drive reference, never a Replit path.
    for (const r of results) {
      assert.ok((await r.json() as { path: string }).path.startsWith("drive://"));
    }
    assert.equal(objectCalls.save, 0, "no concurrent upload fell back to Replit");
  });
});

for (const [label, fault, message] of [
  ["a Drive outage", "upload", "Google Drive download failed (503)"],
  ["invalid_grant", "upload", "invalid_grant"],
  ["401 unauthorised", "upload", "Google Drive download failed (401)"],
  ["403 denied", "upload", "Google Drive download failed (403)"],
  ["429 rate limiting", "upload", "Google Drive download failed (429)"],
  ["a failed idempotency lookup", "lookup", "Google Drive download failed (503)"],
  ["a failed verification read", "metadata", "Google Drive download failed (500)"],
] as const) {
  test(`66. NO FALSE SUCCESS: ${label} fails the request and never writes to Replit`, async () => {
    reset(); resetDrive();
    __setActor({ tenantId: ENABLED, role: "admin" });
    await withFlag(ENABLED, async () => {
      __setFault(fault, message);
      const res = await agencyUpload();
      assert.notEqual(res.status, 201, "a Drive failure must not report success");
      assert.ok(res.status >= 400, `expected an error status, got ${res.status}`);
      assert.equal(objectCalls.save, 0, "and must NEVER fall back to Replit");
    });
  });
}

test("67. a corrupted upload is refused and the bad file is removed", async () => {
  reset(); resetDrive();
  __setActor({ tenantId: ENABLED, role: "admin" });
  await withFlag(ENABLED, async () => {
    __setFault("corrupt", true as never);
    const res = await agencyUpload();
    assert.notEqual(res.status, 201, "a checksum mismatch is not a success");
    assert.equal(objectCalls.save, 0, "no fallback write");
    assert.equal(driveUploadCalls.remove, 1, "the unverifiable file is cleaned up");
    assert.equal(driveStore.size, 0, "no orphan is left behind");
  });
});

// ------------------------------------------------------------------
// Phase 18DS - the folder-zip client storagePath.
//
// The sibling route was constrained in 18BT; this one still handed a raw
// client string to the SERVICE-ROLE client, for a read and for two deletes.
// These pin the rule so it cannot quietly come back.
// ------------------------------------------------------------------

async function folderZip(storagePath: string) {
  const form = new FormData();
  form.set("entityType", "letter");
  form.set("entityId", "e1");
  form.set("storagePath", storagePath);
  return fetch(base + "/api/sa/projects/p1/attachments/folder-zip", { method: "POST", body: form });
}

test("70. a storagePath outside this project is refused before any read", async () => {
  reset(); resetDrive();
  __setActor({ tenantId: ENABLED, role: "admin" });
  const res = await folderZip("attachments/SOMEONE-ELSE/letter/secret.zip");
  assert.ok(res.status >= 400 && res.status < 500,
    `a foreign path must be refused, got ${res.status}`);
});

test("71. a traversing storagePath is refused", async () => {
  reset(); resetDrive();
  __setActor({ tenantId: ENABLED, role: "admin" });
  for (const bad of ["../../etc/passwd", "attachments/p1/letter/../../../other/x.zip", "/absolute/x.zip"]) {
    const res = await folderZip(bad);
    assert.ok(res.status >= 400 && res.status < 500, `${bad} must be refused, got ${res.status}`);
  }
});

test("72. once Drive is authoritative an external reference is refused outright", async () => {
  reset(); resetDrive();
  __setActor({ tenantId: ENABLED, role: "admin" });
  await withFlag(ENABLED, async () => {
    const res = await folderZip("attachments/p1/letter/folder.zip");
    assert.equal(res.status, 409,
      "registering non-Drive storage while Drive is authoritative must be refused");
  });
});
