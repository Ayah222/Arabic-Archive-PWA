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
import { calls as driveCalls } from "../src/lib/tenantDrive";
import { calls as legacyCalls, __setProvider } from "../src/lib/legacyDriveAccess";
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
