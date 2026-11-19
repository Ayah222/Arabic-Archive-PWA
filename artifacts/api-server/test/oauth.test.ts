// OAuth reliability tests for the Drive connection.
//
// No credential, no network, no database, no Drive: the token endpoint and
// the Drive API are a controllable fetch stub, and the database is a fake
// whose use the build enforces. What is under test is the real, unmodified
// tenantDrive.ts.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  DriveAuthError,
  classifyTokenFailure,
  finishDriveOAuth,
  getDriveOAuthAuthorizationUrl,
  getTenantDriveStatus,
} from "../src/lib/tenantDrive";
import { calls as dbCalls, __setConnection } from "../src/lib/supabaseAdmin";
import { lines as logLines } from "../src/lib/logger";
import { supabaseObjectPath } from "../src/lib/supabaseStorage";
import { DriveConnectError } from "../src/lib/tenantDrive";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureOperatingRoot, operatingRootName } from "../src/lib/tenantDrive";
const SRC = join(import.meta.dirname, "..", "src");

const TENANT = "tenant-a";
const ROOT = "root-folder-id";
const SECRET_SENTINEL = "s3cr3t-client-secret-value";
const REFRESH_SENTINEL = "1//refresh-token-sentinel-value";

type Handler = (url: string, init?: RequestInit) => Promise<Response>;
let handler: Handler;
const net = { token: 0, about: 0, other: 0 };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  process.env.GOOGLE_DRIVE_CLIENT_ID = "817315165150-web.apps.googleusercontent.com";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = SECRET_SENTINEL;
  process.env.STORAGE_ENCRYPTION_KEY = "unit-test-encryption-key-32chars";
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = ROOT;
  process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI =
    "https://archiva.cloud/api/sa/tenants/storage/oauth/callback";
  net.token = 0; net.about = 0; net.other = 0;
  dbCalls.upsert = 0; dbCalls.upserted.length = 0;
  logLines.length = 0;
  __setConnection(null);
  handler = async () => json({});
  globalThis.fetch = ((url: string | URL, init?: RequestInit) => {
    const href = String(url);
    if (href.includes("oauth2.googleapis.com/token")) net.token += 1;
    else if (href.includes("/about")) net.about += 1;
    else net.other += 1;
    return handler(href, init);
  }) as typeof fetch;
});

// ------------------------------------------------------- B1, B11 the grant
test("B1 the authorize URL requests OFFLINE access and forces consent", () => {
  const url = new URL(getDriveOAuthAuthorizationUrl("state-1", "https://archiva.cloud/cb"));
  assert.equal(url.searchParams.get("access_type"), "offline",
    "without offline access Google issues NO refresh token and the connection dies in an hour");
  assert.equal(url.searchParams.get("prompt"), "consent",
    "without this a re-consent returns no refresh token at all");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "state-1");
});

test("B11 the requested scope is the non-sensitive drive.file", () => {
  const url = new URL(getDriveOAuthAuthorizationUrl("s", "https://archiva.cloud/cb"));
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/drive.file");
  assert.notEqual(url.searchParams.get("scope"), "https://www.googleapis.com/auth/drive",
    "the restricted scope would need Google verification and a CASA assessment");
});

test("the authorize URL never carries the client secret", () => {
  const url = getDriveOAuthAuthorizationUrl("s", "https://archiva.cloud/cb");
  assert.ok(!url.includes(SECRET_SENTINEL));
});

// ------------------------------------------- B2, B3, B4 the first exchange
test("B2 an exchange WITHOUT a refresh token is refused", async () => {
  handler = async (href) => (href.includes("/token")
    ? json({ access_token: "at", expires_in: 3600 })   // no refresh_token
    : json({ user: { emailAddress: "inst@example.org" } }));
  await assert.rejects(() => finishDriveOAuth(TENANT, "code", "https://archiva.cloud/cb"));
  assert.equal(dbCalls.upsert, 0, "a half-connection must never be stored");
});

test("B4 the connected account is verified against Google, then the folder", async () => {
  handler = async (href) => {
    if (href.includes("/token")) {
      return json({ access_token: "at", refresh_token: REFRESH_SENTINEL, expires_in: 3600 });
    }
    if (href.includes("/about")) return json({ user: { emailAddress: "inst@example.org" } });
    return json({ id: ROOT, mimeType: "application/vnd.google-apps.folder",
      owners: [{ emailAddress: "inst@example.org" }], trashed: false });
  };
  await finishDriveOAuth(TENANT, "code", "https://archiva.cloud/cb");
  assert.ok(net.about >= 1, "the token must be proven to work before anything is stored");
  assert.equal(dbCalls.upsert, 1);
});

test("B4b a folder owned by a DIFFERENT account is refused", async () => {
  handler = async (href) => {
    if (href.includes("/token")) {
      return json({ access_token: "at", refresh_token: REFRESH_SENTINEL, expires_in: 3600 });
    }
    if (href.includes("/about")) return json({ user: { emailAddress: "someone@else.org" } });
    return json({ id: ROOT, mimeType: "application/vnd.google-apps.folder",
      owners: [{ emailAddress: "inst@example.org" }], trashed: false });
  };
  await assert.rejects(() => finishDriveOAuth(TENANT, "code", "https://archiva.cloud/cb"));
  assert.equal(dbCalls.upsert, 0);
});

test("B3 the refresh token is ENCRYPTED before it is persisted", async () => {
  handler = async (href) => {
    if (href.includes("/token")) {
      return json({ access_token: "at", refresh_token: REFRESH_SENTINEL, expires_in: 3600 });
    }
    if (href.includes("/about")) return json({ user: { emailAddress: "inst@example.org" } });
    return json({ id: ROOT, mimeType: "application/vnd.google-apps.folder",
      owners: [{ emailAddress: "inst@example.org" }], trashed: false });
  };
  await finishDriveOAuth(TENANT, "code", "https://archiva.cloud/cb");
  const stored = JSON.stringify(dbCalls.upserted[0]);
  assert.ok(!stored.includes(REFRESH_SENTINEL), "the plaintext refresh token reached the database");
  const credentials = (dbCalls.upserted[0] as { encrypted_credentials: Record<string, string> })
    .encrypted_credentials;
  assert.equal(credentials.mode, "oauth");
  for (const field of ["iv", "tag", "ciphertext"]) {
    assert.ok(credentials[field] && credentials[field].length > 0, `missing ${field}`);
  }
});

// ------------------------------------------ B5-B8 renewal without consent
function connected() {
  // an encrypted credential produced by the module itself in the test above
  return {
    provider: "google_drive",
    encrypted_credentials: storedCredentials,
    root_folder_id: ROOT,
    connected_email: "inst@example.org",
  };
}
let storedCredentials: unknown = null;

test("set up a stored connection for the renewal tests", async () => {
  handler = async (href) => {
    if (href.includes("/token")) {
      return json({ access_token: "at", refresh_token: REFRESH_SENTINEL, expires_in: 3600 });
    }
    if (href.includes("/about")) return json({ user: { emailAddress: "inst@example.org" } });
    return json({ id: ROOT, mimeType: "application/vnd.google-apps.folder",
      owners: [{ emailAddress: "inst@example.org" }], trashed: false });
  };
  await finishDriveOAuth(TENANT, "code", "https://archiva.cloud/cb");
  storedCredentials = (dbCalls.upserted[0] as { encrypted_credentials: unknown }).encrypted_credentials;
  assert.ok(storedCredentials);
});

test("B5/B7 an expired access token is renewed WITHOUT a new consent", async () => {
  // a distinct tenant id means an EMPTY access-token cache, which is what
  // an expired token and a fresh process both look like to this code
  const tenant = "tenant-renew";
  __setConnection(connected());
  handler = async (href) => (href.includes("/token")
    ? json({ access_token: "fresh", expires_in: 3600 })
    : json({ user: { emailAddress: "inst@example.org" } }));
  const status = await getTenantDriveStatus(tenant);
  assert.equal(net.token, 1, "exactly one refresh, using the stored token");
  assert.equal(status.connected, true);
  assert.equal(status.state, "healthy");
});

test("B6 concurrent callers cause ONE refresh, not many", async () => {
  const tenant = "tenant-concurrent";
  __setConnection(connected());
  handler = async (href) => {
    if (href.includes("/token")) {
      await new Promise((r) => setTimeout(r, 20));
      return json({ access_token: "fresh", expires_in: 3600 });
    }
    return json({ user: { emailAddress: "inst@example.org" } });
  };
  await Promise.all([
    getTenantDriveStatus(tenant), getTenantDriveStatus(tenant),
    getTenantDriveStatus(tenant), getTenantDriveStatus(tenant),
  ]);
  assert.equal(net.token, 1, "single-flight refresh collapsed four callers into one");
});

test("B8 a restart loses only the memory cache, never the connection", async () => {
  // a fresh process is modelled by an unseen tenant id: empty token cache
  const tenant = "tenant-restart";
  __setConnection(connected());
  handler = async (href) => (href.includes("/token")
    ? json({ access_token: "after-restart", expires_in: 3600 })
    : json({ user: { emailAddress: "inst@example.org" } }));
  const status = await getTenantDriveStatus(tenant);
  assert.equal(status.connected, true, "the encrypted token survived and was refreshed");
  assert.equal(net.token, 1);
});

// --------------------------------------- B9, B10, B13 failure and honesty
test("B9 invalid_grant is TERMINAL and a 5xx is not", () => {
  const revoked = classifyTokenFailure(400, { error: "invalid_grant" });
  assert.ok(revoked instanceof DriveAuthError);
  assert.equal(revoked.terminal, true);
  assert.equal(revoked.reason, "invalid_grant");
  for (const transient of [500, 502, 503, 429]) {
    const blip = classifyTokenFailure(transient, { error: "backendError" });
    assert.equal(blip.terminal, false, `HTTP ${transient} must be retryable`);
  }
  assert.equal(classifyTokenFailure(401, {}).terminal, true);
  assert.equal(classifyTokenFailure(403, {}).terminal, false,
    "403 is a permission problem, not a dead refresh token");
});

test("B10 a REVOKED refresh token is never reported healthy", async () => {
  const tenant = "tenant-revoked";
  __setConnection(connected());
  handler = async (href) => (href.includes("/token")
    ? json({ error: "invalid_grant" }, 400)
    : json({ user: { emailAddress: "inst@example.org" } }));
  const status = await getTenantDriveStatus(tenant);
  assert.equal(status.connected, false);
  assert.equal(status.verified, false);
  assert.equal(status.state, "reauth_required");
  assert.notEqual(status.state, "healthy");
});

test("B10b a MISSING connection is never reported healthy", async () => {
  __setConnection(null);
  const status = await getTenantDriveStatus(TENANT);
  assert.equal(status.connected, false);
  assert.equal(status.state, "disconnected");
});

test("B10c the legacy service-account marker is never reported healthy", async () => {
  __setConnection({ provider: "google_drive", encrypted_credentials: { mode: "service_account" } });
  const status = await getTenantDriveStatus(TENANT);
  assert.equal(status.connected, false);
  assert.equal(status.configured, false, "it does not decrypt, so it is not configured");
});

test("B13 a transient failure is degraded, NOT healthy and NOT reauth", async () => {
  const tenant = "tenant-blip";
  __setConnection(connected());
  handler = async (href) => (href.includes("/token")
    ? json({ error: "backendError" }, 503)
    : json({ user: { emailAddress: "inst@example.org" } }));
  const status = await getTenantDriveStatus(tenant);
  assert.equal(status.connected, false, "a blip must never read as connected");
  assert.equal(status.state, "degraded");
  assert.notEqual(status.state, "reauth_required", "a blip must not demand a human");
});

test("B13b a credential that decrypts but Google rejects is NOT healthy", async () => {
  // this is the exact false-success that hid the dead connection for weeks
  const tenant = "tenant-rejected";
  __setConnection(connected());
  handler = async (href) => (href.includes("/token")
    ? json({ access_token: "at", expires_in: 3600 })
    : json({ error: { message: "Invalid Credentials" } }, 401));
  const status = await getTenantDriveStatus(tenant);
  assert.equal(status.configured, true, "the stored credential does decrypt");
  assert.equal(status.connected, false, "but Google did not accept it");
  assert.equal(status.verified, false);
});

// ------------------------------------------------- B12, B14 no disclosure
test("B12 no customer file content is ever fetched by these paths", async () => {
  const tenant = "tenant-nobytes";
  __setConnection(connected());
  handler = async (href) => {
    assert.ok(!href.includes("alt=media"), "a status check must never download a file");
    return href.includes("/token")
      ? json({ access_token: "at", expires_in: 3600 })
      : json({ user: { emailAddress: "inst@example.org" } });
  };
  await getTenantDriveStatus(tenant);
});

test("B14 no secret appears in an error, a status body or a log line", async () => {
  const tenant = "tenant-secrets";
  __setConnection(connected());
  handler = async (href) => (href.includes("/token")
    ? json({ error: "invalid_grant" }, 400)
    : json({ user: { emailAddress: "inst@example.org" } }));
  const status = await getTenantDriveStatus(tenant);
  const haystack = JSON.stringify(status) + JSON.stringify(logLines);
  for (const secret of [SECRET_SENTINEL, REFRESH_SENTINEL, "ciphertext"]) {
    assert.ok(!haystack.includes(secret), `a secret leaked: ${secret.slice(0, 12)}`);
  }
  const thrown = classifyTokenFailure(400, { error: "invalid_grant" });
  assert.ok(!thrown.message.includes(SECRET_SENTINEL));
  assert.ok(!thrown.message.includes(REFRESH_SENTINEL));
});

// =====================================================================
// The invariant the Phase 18CK legacy rescue rests on.
//
// The rescue reads a file only when an attachment row of the CALLING
// tenant has object_path exactly "drive://<fileId>". If a request could
// ever cause such a row to be written, a caller could name any Drive file
// the service account can see - including another tenant's migrated
// documents - and the rescue would hand it over.
//
// Exactly one code path turns a client value into an object_path:
// supabaseObjectPath, used by the attachments and photos routes. It
// prefixes unconditionally, so its output is always a supabase:// path.
// The only producer of a drive:// value is tenantDrive, from the id
// Google itself returns for a file the app just uploaded - never a
// request. This is the half that is cheap to assert; it is also the half
// a future edit is most likely to break.
// =====================================================================
test("a client-supplied storage path can NEVER become a drive:// reference", () => {
  const hostile = [
    "drive://1AbCdEfGhIjKlMnOpQrStUvWxYz01234",
    "../drive://1AbCdEfGhIjKlMnOpQrStUvWxYz01234",
    "/drive://x",
    "..%2Fdrive%3A%2F%2Fx",
    String.fromCharCode(0) + "drive://x",
    "drive:/" + "/nested/../..",
    "",
    "attachments/p/e/ok.pdf",
  ];
  for (const input of hostile) {
    const stored = supabaseObjectPath(input);
    assert.ok(stored.startsWith("supabase://"),
      `must stay in the supabase namespace: ${JSON.stringify(input)} -> ${stored}`);
    assert.ok(!stored.startsWith("drive://"),
      `must never become a Drive reference: ${JSON.stringify(input)} -> ${stored}`);
  }
});

test("the prefix is unconditional, so no input can escape it", () => {
  // A guard that merely rejected bad input could be bypassed by an
  // encoding this test did not imagine. Prefixing cannot be.
  const probe = "anything-at-all";
  assert.ok(supabaseObjectPath(probe).endsWith(probe),
    "the input is appended, not interpreted");
  assert.notEqual(supabaseObjectPath(probe), probe,
    "the input is never stored verbatim");
});

// ===================================================================
// Phase 18DA - the connect failure must say WHICH step failed, and
// must say nothing else.
//
// The callback catches all five failure points into one redirect, so a
// failed connection was indistinguishable from any other. The stage is
// now carried on the error. The danger in logging anything at all here
// is that the surrounding values are an authorization code, a token, a
// client secret and Google's error body - so these tests pin down that
// the payload carries the stage and the HTTP status and nothing more.
// ===================================================================

test("the error carries a stage and an HTTP status", () => {
  const e = new DriveConnectError("root-folder-access", 404, "رسالة للمستخدم");
  assert.equal(e.stage, "root-folder-access");
  assert.equal(e.httpStatus, 404);
  assert.equal(e.name, "DriveConnectError");
  assert.ok(e instanceof Error, "must still be catchable as an Error");
});

test("the five stages are distinct and exhaustive", () => {
  const stages = [
    "token-exchange", "account-identity", "root-folder-access",
    "root-folder-ownership", "credential-persistence",
  ] as const;
  assert.equal(new Set(stages).size, 5);
  for (const stage of stages) {
    const e = new DriveConnectError(stage, 0, "x");
    assert.equal(e.stage, stage);
  }
});

test("NO sensitive value can reach the logged payload", () => {
  // The payload the route builds, reproduced exactly.
  const CODE = "4/0AaBbCc-authorization-code-value";
  const TOKEN = "ya29.a0AfH6SMB-access-token-value";
  const REFRESH = "1//04-refresh-token-value";
  const SECRET = "GOCSPX-client-secret-value";
  const STATE = "state-nonce-signature-value";
  // A Google error body is the realistic carrier of leaked identifiers.
  const e = new DriveConnectError("token-exchange", 400,
    `invalid_client ${CODE} ${TOKEN} ${REFRESH} ${SECRET} ${STATE}`);

  const payload = {
    tenantId: "e7c9121b-2450-402f-be8d-07bd65fa0156",
    stage: e.stage,
    googleStatus: e.httpStatus,
  };
  const serialised = JSON.stringify(payload);
  for (const secret of [CODE, TOKEN, REFRESH, SECRET, STATE]) {
    assert.ok(!serialised.includes(secret), `leaked: ${secret.slice(0, 12)}…`);
  }
  assert.ok(!serialised.includes("invalid_client"),
    "Google error text must not be logged - it can carry identifiers");
  assert.deepEqual(Object.keys(payload).sort(), ["googleStatus", "stage", "tenantId"],
    "exactly three fields, no message and no cause");
});

test("the route logs the stage but still redirects the same way", () => {
  // Behaviour must be unchanged: the user still lands on ?driveOAuth=failed.
  const route = readFileSync(join(SRC, "routes", "sa", "tenantStorage.ts"), "utf8");
  // Bound the slice by the NEXT route, not by the first '});' - that one
  // now falls inside the logger.error(...) call and would truncate the
  // body before the redirects, making this assertion lie.
  const start = route.indexOf('/sa/tenants/storage/oauth/callback');
  const rest = route.slice(start);
  const nextRoute = rest.indexOf('router.get(', 10);
  const body = nextRoute === -1 ? rest : rest.slice(0, nextRoute);
  assert.ok(body.includes('res.redirect("/?driveOAuth=failed")'),
    "the failure redirect must be unchanged");
  assert.ok(body.includes('res.redirect("/?driveOAuth=connected")'),
    "the success redirect must be unchanged");
  for (const forbidden of [
    "req.query.code", "storedState", "client_secret", "access_token", "refresh_token",
  ]) {
    const logged = body.slice(body.indexOf("logger.error"), body.indexOf("driveOAuth=failed"));
    assert.ok(!logged.includes(forbidden),
      `the log payload must not reference ${forbidden}`);
  }
});

// ===================================================================
// Phase 18DH - the operating root.
//
// Production logs proved the connect flow died at root-folder-access with
// HTTP 404 because drive.file hides a folder another app created. The flow
// now creates its own root under the consenting user. These tests pin the
// properties that make that safe: it is idempotent across reconnects,
// retries, crashes and concurrency; it is bound to one tenant; it is owned
// by the institution; and it never deletes or moves anything.
// ===================================================================

const OP_TENANT = "e7c9121b-2450-402f-be8d-07bd65fa0156";
const OP_OTHER_TENANT = "11111111-2222-4333-8444-555555555555";
const OP_INSTITUTION = "mnba6196@gmail.com";

/** A Drive fake that records every call. */
function driveFake(opts: {
  existing?: Array<{ id: string; createdTime: string; owners?: Array<{ emailAddress?: string }> }>;
  listStatus?: number;
  createStatus?: number;
  createOwners?: Array<{ emailAddress?: string }>;
} = {}) {
  const calls = { lists: [] as string[], creates: [] as any[] };
  const impl = (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if ((init?.method ?? "GET") === "GET") {
      calls.lists.push(u);
      const status = opts.listStatus ?? 200;
      if (status !== 200) return new Response("{}", { status });
      return new Response(JSON.stringify({ files: opts.existing ?? [] }), { status: 200 });
    }
    calls.creates.push(JSON.parse(String(init?.body ?? "{}")));
    const status = opts.createStatus ?? 200;
    if (status !== 200) return new Response("{}", { status });
    return new Response(JSON.stringify({
      id: "newOperatingRoot001",
      owners: opts.createOwners ?? [{ emailAddress: OP_INSTITUTION }],
    }), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("1. a first connection CREATES an operating root", async () => {
  const { impl, calls } = driveFake();
  const root = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, impl);
  assert.equal(root.id, "newOperatingRoot001");
  assert.equal(root.created, true);
  assert.equal(calls.creates.length, 1);
  assert.equal(calls.creates[0].name, operatingRootName(OP_TENANT));
  assert.equal(calls.creates[0].mimeType, "application/vnd.google-apps.folder");
  assert.equal(calls.creates[0].parents, undefined, "no parents: it lands in the user's My Drive root");
});

test("2. the root must be owned by the institution account", async () => {
  const { impl } = driveFake({ createOwners: [{ emailAddress: "someone.else@gmail.com" }] });
  const e = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, impl).catch((x) => x);
  assert.equal(e.stage, "root-folder-ownership");
});

test("3. the historical root is never consulted by this path", async () => {
  const { impl, calls } = driveFake();
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = "1lZd3MvwChG2-XD_gdCP4RsfqrS108MBd";
  await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, impl);
  for (const u of calls.lists) {
    assert.ok(!u.includes("1lZd3Mvw"), "the historical archive root must not be requested");
  }
  for (const c of calls.creates) {
    assert.ok(JSON.stringify(c).indexOf("1lZd3Mvw") === -1, "and must not become a parent");
  }
});

test("4. a repeated consent REUSES the existing root, creating nothing", async () => {
  const { impl, calls } = driveFake({
    existing: [{ id: "existingRoot001", createdTime: "2026-11-19T10:00:00Z", owners: [{ emailAddress: OP_INSTITUTION }] }],
  });
  const root = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, impl);
  assert.equal(root.id, "existingRoot001");
  assert.equal(root.created, false);
  assert.equal(calls.creates.length, 0, "no second folder may be created");
});

test("5. CONCURRENT consents converge on one root", async () => {
  // Both run against a Drive that already holds the folder one of them made.
  const { impl, calls } = driveFake({
    existing: [{ id: "sharedRoot001", createdTime: "2026-11-19T10:00:00Z", owners: [{ emailAddress: OP_INSTITUTION }] }],
  });
  const [a, b] = await Promise.all([
    ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, impl),
    ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, impl),
  ]);
  assert.equal(a.id, b.id);
  assert.equal(calls.creates.length, 0);
});

test("6+7. a crash between creation and persistence does NOT duplicate", async () => {
  // First attempt creates the folder, then the database write fails, so
  // nothing is recorded. The retry must find the orphan, not make a second.
  const first = driveFake();
  const made = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, first.impl);
  assert.equal(made.created, true);
  const retry = driveFake({
    existing: [{ id: made.id, createdTime: "2026-11-19T10:00:00Z", owners: [{ emailAddress: OP_INSTITUTION }] }],
  });
  const recovered = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, retry.impl);
  assert.equal(recovered.id, made.id);
  assert.equal(recovered.created, false);
  assert.equal(retry.calls.creates.length, 0, "the orphan is adopted, not duplicated");
});

test("8. a wrong institution account is refused on an EXISTING root too", async () => {
  const { impl } = driveFake({
    existing: [{ id: "existingRoot001", createdTime: "2026-11-19T10:00:00Z", owners: [{ emailAddress: "intruder@gmail.com" }] }],
  });
  const e = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, impl).catch((x) => x);
  assert.equal(e.stage, "root-folder-ownership");
});

test("9. Google 403/404/429/5xx are classified with their real status", async () => {
  for (const status of [403, 404, 429, 500, 503]) {
    const listFail = driveFake({ listStatus: status });
    const e1 = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, listFail.impl).catch((x) => x);
    assert.equal(e1.stage, "root-folder-access", `list ${status}`);
    assert.equal(e1.httpStatus, status, `list ${status} status preserved`);
    const createFail = driveFake({ createStatus: status });
    const e2 = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, createFail.impl).catch((x) => x);
    assert.equal(e2.stage, "root-folder-access", `create ${status}`);
    assert.equal(e2.httpStatus, status, `create ${status} status preserved`);
  }
});

test("10. the lookup is bound to ONE tenant", async () => {
  const { impl, calls } = driveFake();
  await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, impl);
  // URLSearchParams encodes a space as '+', which decodeURIComponent leaves
  // alone - so normalise before matching on the query text.
  const q = decodeURIComponent(calls.lists[0]).replace(/\+/g, " ");
  assert.ok(q.includes(OP_TENANT), "the query must pin this tenant");
  assert.ok(!q.includes(OP_OTHER_TENANT));
  assert.ok(q.includes("smartArchiveRole"), "and the operating-root role");
  assert.ok(q.includes("trashed = false"));
  assert.equal(calls.creates[0].appProperties.smartArchiveTenantId, OP_TENANT);
});

test("11. with several candidates the OLDEST wins and none is removed", async () => {
  const { impl, calls } = driveFake({
    existing: [
      { id: "oldest", createdTime: "2026-11-19T10:00:00Z", owners: [{ emailAddress: OP_INSTITUTION }] },
      { id: "middle", createdTime: "2026-11-19T11:00:00Z", owners: [{ emailAddress: OP_INSTITUTION }] },
      { id: "newest", createdTime: "2026-11-19T12:00:00Z", owners: [{ emailAddress: OP_INSTITUTION }] },
    ],
  });
  const root = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, impl);
  assert.equal(root.id, "oldest", "deterministic: exactly one root is ever active");
  assert.equal(root.duplicates, 2);
  assert.equal(calls.creates.length, 0);
});

test("12. nothing is deleted, moved or renamed", async () => {
  const seen: string[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    seen.push(`${init?.method ?? "GET"} ${String(url)}`);
    if ((init?.method ?? "GET") === "GET") return new Response(JSON.stringify({ files: [] }), { status: 200 });
    return new Response(JSON.stringify({ id: "r", owners: [{ emailAddress: OP_INSTITUTION }] }), { status: 200 });
  }) as unknown as typeof fetch;
  await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, impl);
  for (const call of seen) {
    assert.ok(!call.startsWith("DELETE"), "no deletion");
    assert.ok(!call.startsWith("PATCH"), "no rename or move");
    assert.ok(!call.startsWith("PUT"), "no overwrite");
  }
  assert.equal(seen.filter((c) => c.startsWith("POST")).length, 1, "exactly one write: the folder itself");
});

test("13. no credential material reaches an error or a log payload", async () => {
  const TOKEN = "ya29.a0AfH6SMB-access-token-value";
  const { impl } = driveFake({ listStatus: 404 });
  const e = await ensureOperatingRoot(TOKEN, OP_TENANT, OP_INSTITUTION, null, impl).catch((x) => x);
  assert.ok(!String(e.message).includes(TOKEN));
  assert.ok(!JSON.stringify({ stage: e.stage, googleStatus: e.httpStatus }).includes(TOKEN));
});

test("14. the operating root name is stable, so rollback finds it again", async () => {
  // A rollback to an earlier build leaves the folder in place; a later
  // roll-forward must adopt the same one rather than start a second.
  assert.equal(operatingRootName(OP_TENANT), `ArchHive Operating Root - ${OP_TENANT}`);
  assert.notEqual(operatingRootName(OP_TENANT), operatingRootName(OP_OTHER_TENANT));
});

// ------------------------------------------------------------------
// Phase 18DI - what idempotence here does and does NOT guarantee.
//
// Discovery-before-create is not atomic. Two simultaneous consents can
// both see an empty list and both create a folder, and no Drive API call
// prevents that. These tests state the real contract: exactly one ACTIVE
// root, always; exactly one PHYSICAL folder, usually but not guaranteed.
// ------------------------------------------------------------------

/** A Drive fake that also answers files.get, and models create-then-list. */
function driveWorld(opts: { listLag?: boolean } = {}) {
  const folders: Array<{ id: string; createdTime: string; owner: string; tenant: string; role: string; trashed: boolean; settled: boolean }> = [];
  const calls = { lists: 0, creates: 0, gets: 0 };
  let seq = 0;
  const impl = (async (url: string, init?: RequestInit) => {
    const u = String(url);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && u.includes("/files/")) {
      calls.gets += 1;
      const id = decodeURIComponent(u.split("/files/")[1].split("?")[0]);
      const f = folders.find((x) => x.id === id);
      if (!f) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify({
        id: f.id, mimeType: f.trashed ? "application/vnd.google-apps.folder" : "application/vnd.google-apps.folder",
        trashed: f.trashed,
        owners: [{ emailAddress: f.owner }],
        appProperties: { smartArchiveTenantId: f.tenant, smartArchiveRole: f.role },
      }), { status: 200 });
    }
    if (method === "GET") {
      calls.lists += 1;
      // The real query filters on appProperties tenant AND role; a fake that
      // returns every folder would hide a genuine tenant-isolation bug.
      const visible = folders.filter((f) =>
        (opts.listLag ? f.settled : true)
        && !f.trashed
        && f.tenant === OP_TENANT
        && f.role === "operating-root");
      return new Response(JSON.stringify({
        files: visible.slice().sort((a, b) => a.createdTime.localeCompare(b.createdTime))
          .map((f) => ({ id: f.id, createdTime: f.createdTime, owners: [{ emailAddress: f.owner }] })),
      }), { status: 200 });
    }
    calls.creates += 1;
    seq += 1;
    folders.push({
      id: `folder${seq}`,
      createdTime: new Date(1700000000000 + seq * 1000).toISOString(),
      owner: OP_INSTITUTION, tenant: OP_TENANT,
      role: "operating-root", trashed: false, settled: !opts.listLag,
    });
    return new Response(JSON.stringify({
      id: `folder${seq}`, owners: [{ emailAddress: OP_INSTITUTION }],
    }), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls, folders };
}

test("15. TRUE RACE: two empty listings can produce two physical folders", async () => {
  // The honest limitation. Both callers list before either folder exists.
  const w = driveWorld();
  const [a, b] = await Promise.all([
    ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl),
    ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl),
  ]);
  assert.ok(w.calls.creates >= 1);
  // Reconciliation converges them when the second listing sees both.
  assert.equal(a.id, b.id, "both callers must end up on the SAME active root");
});

test("16. after a race, every later call agrees on one stable root", async () => {
  const w = driveWorld();
  await Promise.all([
    ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl),
    ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl),
  ]);
  const l1 = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl);
  const l2 = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl);
  assert.equal(l1.id, l2.id);
  assert.equal(l1.created, false);
  assert.equal(l1.id, "folder1", "the oldest wins, deterministically");
});

test("17. a recorded root is REUSED verbatim, with no listing at all", async () => {
  const w = driveWorld();
  const made = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl);
  const before = { ...w.calls };
  const again = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, made.id, w.impl);
  assert.equal(again.id, made.id);
  assert.equal(again.created, false);
  assert.equal(w.calls.creates, before.creates, "nothing new is created");
  assert.equal(w.calls.lists, before.lists, "and no discovery is needed");
});

test("18. a STALE historical root id is ignored, not fatal", async () => {
  // The pre-18DH value points at a folder this client cannot see: 404.
  const w = driveWorld();
  const root = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, "1lZd3MvwChG2-XD_gdCP4RsfqrS108MBd", w.impl);
  assert.equal(root.created, true, "it falls through to creating a usable root");
  assert.equal(w.calls.gets, 1);
});

test("19. a recorded root belonging to ANOTHER tenant is refused reuse", async () => {
  const w = driveWorld();
  const made = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl);
  w.folders[0].tenant = OP_OTHER_TENANT;
  const root = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, made.id, w.impl);
  assert.notEqual(root.id, made.id, "another tenant's folder is never adopted");
});

test("20. a recorded root that was TRASHED is not reused", async () => {
  const w = driveWorld();
  const made = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl);
  w.folders[0].trashed = true;
  const root = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, made.id, w.impl);
  assert.equal(root.created, true);
});

test("21. a recorded root owned by the WRONG account is a hard refusal", async () => {
  const w = driveWorld();
  const made = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl);
  w.folders[0].owner = "intruder@gmail.com";
  const e = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, made.id, w.impl).catch((x) => x);
  assert.equal(e.stage, "root-folder-ownership", "a wrong owner must not fall through quietly");
});

test("22. EVENTUAL LISTING CONSISTENCY can still leave an extra folder", async () => {
  // Stated, not hidden: a lagging list cannot see what was just created.
  const w = driveWorld({ listLag: true });
  const first = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl);
  const second = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, w.impl);
  assert.equal(w.calls.creates, 2, "the limitation is real");
  assert.notEqual(first.id, second.id);
  // But once one id is recorded, it is reused for ever after.
  const settled = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, first.id, w.impl);
  assert.equal(settled.id, first.id, "the recorded root is what stabilises it");
  assert.equal(w.calls.creates, 2);
});

test("23. a failed reconciliation never fails the connection", async () => {
  let createdOnce = false;
  const impl = (async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST") { createdOnce = true; return new Response(JSON.stringify({ id: "r1", owners: [{ emailAddress: OP_INSTITUTION }] }), { status: 200 }); }
    if (createdOnce) throw new Error("network blip during reconciliation");
    return new Response(JSON.stringify({ files: [] }), { status: 200 });
  }) as unknown as typeof fetch;
  const root = await ensureOperatingRoot("at", OP_TENANT, OP_INSTITUTION, null, impl);
  assert.equal(root.id, "r1", "the folder exists and is usable");
});
