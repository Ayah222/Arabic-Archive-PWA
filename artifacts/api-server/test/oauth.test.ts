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
