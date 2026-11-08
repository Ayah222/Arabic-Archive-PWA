// Tests for the historical (service-account) Google Drive read path.
//
// No credential, no network, no database. Every dependency is a fake that
// records what it was asked, so the tests can assert the thing that actually
// matters: that a Drive id nobody references never reaches Google, and that
// nothing on this path writes.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLegacyServiceAccountCredentials,
  LEGACY_CREDENTIAL_MODE,
  LegacyDriveError,
  readLegacyDriveContent,
  readLegacyDriveMetadata,
  type LegacyDriveDeps,
  type LegacyReference,
} from "./legacyDriveReader";

const FILE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz01234";
const OTHER_ID = "9ZyXwVuTsRqPoNmLkJiHgFeDcBa98765";

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

/** Records every call; by default the tenant references FILE_ID and nothing else. */
function fakeDeps(options: {
  reference?: LegacyReference | null;
  token?: string | (() => Promise<string>);
  responses?: Response[];
  fetchThrows?: boolean;
  authorizeProject?: (projectId: string) => Promise<boolean>;
} = {}) {
  const urls: string[] = [];
  const lookedUp: string[] = [];
  const queue = [...(options.responses ?? [])];
  const deps: LegacyDriveDeps = {
    async lookupReference(fileId) {
      lookedUp.push(fileId);
      if (options.reference !== undefined) return options.reference;
      return fileId === FILE_ID ? { projectId: "project-1", recordedSize: 1024 } : null;
    },
    async getAccessToken() {
      if (typeof options.token === "function") return options.token();
      return options.token ?? "ya29.fake-short-lived";
    },
    fetchImpl: (async (url: string | URL | Request) => {
      urls.push(String(url));
      if (options.fetchThrows) throw new Error("socket hang up");
      return queue.shift() ?? jsonResponse({ id: FILE_ID, name: "letter.pdf", mimeType: "application/pdf", size: "1024" });
    }) as unknown as typeof fetch,
    authorizeProject: options.authorizeProject,
  };
  return { deps, urls, lookedUp };
}

async function failureCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (!(error instanceof LegacyDriveError)) {
      assert.fail(`expected LegacyDriveError, got ${String(error)}`);
    }
    return error.code;
  }
  return assert.fail("expected a refusal");
}

/* ═══════════ the legacy marker is recognised, narrowly ═══════════ */

test("the historical marker is recognised", () => {
  assert.equal(isLegacyServiceAccountCredentials({ mode: LEGACY_CREDENTIAL_MODE }), true);
});

test("an OAuth record is NOT treated as legacy, whatever its mode claims", () => {
  // A half-migrated row must never take the service-account path.
  for (const value of [
    { mode: "oauth", iv: "a", tag: "b", ciphertext: "c" },
    { mode: LEGACY_CREDENTIAL_MODE, ciphertext: "c" },
    { mode: LEGACY_CREDENTIAL_MODE, iv: "a" },
    { mode: LEGACY_CREDENTIAL_MODE, tag: "b" },
    {}, null, undefined, "service_account", 5,
  ]) {
    assert.equal(isLegacyServiceAccountCredentials(value), false, JSON.stringify(value) ?? "nullish");
  }
});

/* ═══════════ the gate: nothing unreferenced reaches Google ═══════════ */

test("a Drive id this tenant does not reference is refused, and Google is never called", async () => {
  // This is the property that stops the endpoint from being a Drive proxy.
  const { deps, urls } = fakeDeps();
  assert.equal(await failureCode(() => readLegacyDriveMetadata(OTHER_ID, deps)), "not-referenced");
  assert.deepEqual(urls, [], "not one request left the process");
});

test("a wrong-tenant request is refused: the lookup is the tenant boundary", async () => {
  // lookupReference is tenant-scoped by the caller, so another tenant sees null
  // for a file it does not own -- even a real, existing Drive id.
  const { deps, urls } = fakeDeps({ reference: null });
  assert.equal(await failureCode(() => readLegacyDriveMetadata(FILE_ID, deps)), "not-referenced");
  assert.deepEqual(urls, []);
});

test("a malformed Drive id is refused before any lookup or request", async () => {
  for (const bad of ["", "abc", "../../etc/passwd", "id with spaces", "a".repeat(257), "x/y"]) {
    const { deps, urls, lookedUp } = fakeDeps();
    assert.equal(await failureCode(() => readLegacyDriveMetadata(bad, deps)), "invalid-id", bad);
    assert.deepEqual(lookedUp, [], "no database lookup for a malformed id");
    assert.deepEqual(urls, []);
  }
});

test("project permission is enforced on top of tenant ownership", async () => {
  const { deps, urls } = fakeDeps({ authorizeProject: async () => false });
  assert.equal(await failureCode(() => readLegacyDriveMetadata(FILE_ID, deps)), "forbidden");
  assert.deepEqual(urls, [], "a forbidden project costs no Drive request");
});

test("an allowed project proceeds", async () => {
  const seen: string[] = [];
  const { deps } = fakeDeps({ authorizeProject: async (p) => { seen.push(p); return true; } });
  await readLegacyDriveMetadata(FILE_ID, deps);
  assert.deepEqual(seen, ["project-1"], "the project from the attachment row is the one checked");
});

/* ═══════════ a valid historical reference ═══════════ */

test("a valid historical reference returns metadata and compares the recorded size", async () => {
  const { deps, urls } = fakeDeps({
    responses: [jsonResponse({ id: FILE_ID, name: "letter.pdf", mimeType: "application/pdf", size: "1024", capabilities: { canDownload: true } })],
  });
  const meta = await readLegacyDriveMetadata(FILE_ID, deps);
  assert.equal(meta.size, 1024);
  assert.equal(meta.recordedSize, 1024);
  assert.equal(meta.sizeMatchesRecord, true);
  assert.equal(meta.filename, "letter.pdf");
  assert.equal(meta.canDownload, true);
  assert.equal(meta.trashed, false);
  assert.equal(urls.length, 1, "exactly one Drive request");
  assert.ok(!urls[0]!.includes("alt=media"), "metadata must not request content");
  assert.ok(urls[0]!.includes("supportsAllDrives=true"));
});

test("a size that disagrees with the record is reported, not hidden", async () => {
  const { deps } = fakeDeps({ responses: [jsonResponse({ size: "2048", name: "x.pdf" })] });
  const meta = await readLegacyDriveMetadata(FILE_ID, deps);
  assert.equal(meta.sizeMatchesRecord, false);
  assert.equal(meta.size, 2048);
});

test("a missing size is unknown, never silently zero", async () => {
  const { deps } = fakeDeps({ responses: [jsonResponse({ name: "x.pdf" })] });
  const meta = await readLegacyDriveMetadata(FILE_ID, deps);
  assert.equal(meta.size, null);
  assert.equal(meta.sizeMatchesRecord, null);
});

/* ═══════════ Google-side failures are classified, not swallowed ═══════════ */

test("Google statuses map onto distinct refusals", async () => {
  for (const [status, expected] of [[404, "not-found"], [403, "denied"], [401, "auth-failed"], [429, "transient"], [500, "transient"]] as const) {
    const { deps } = fakeDeps({ responses: [jsonResponse({ error: "x" }, { status })] });
    assert.equal(await failureCode(() => readLegacyDriveMetadata(FILE_ID, deps)), expected, String(status));
  }
});

test("a missing service-account configuration fails closed as auth-failed", async () => {
  for (const token of [async () => { throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON missing: key=abc123"); }, async () => ""]) {
    const { deps, urls } = fakeDeps({ token });
    assert.equal(await failureCode(() => readLegacyDriveMetadata(FILE_ID, deps)), "auth-failed");
    assert.deepEqual(urls, [], "no request without a token");
  }
});

test("a token error never leaks its message, which can carry key material", async () => {
  const secretish = "-----BEGIN PRIVATE KEY----- AAAA";
  const { deps } = fakeDeps({ token: async () => { throw new Error(secretish); } });
  try {
    await readLegacyDriveMetadata(FILE_ID, deps);
    assert.fail("expected a refusal");
  } catch (error) {
    const text = `${(error as Error).name} ${(error as Error).message} ${(error as Error).stack ?? ""}`;
    assert.equal(text.includes(secretish), false, "the underlying message must not propagate");
    assert.equal(text.includes("PRIVATE KEY"), false);
  }
});

test("a network failure is transient, and is not retried", async () => {
  const { deps, urls } = fakeDeps({ fetchThrows: true });
  assert.equal(await failureCode(() => readLegacyDriveMetadata(FILE_ID, deps)), "transient");
  assert.equal(urls.length, 1, "one attempt only");
});

test("a refusal message never contains the Drive id or the filename", async () => {
  const { deps } = fakeDeps({ responses: [jsonResponse({}, { status: 404 })] });
  try {
    await readLegacyDriveMetadata(FILE_ID, deps);
  } catch (error) {
    assert.equal((error as Error).message.includes(FILE_ID), false);
    assert.equal((error as Error).message.includes("letter.pdf"), false);
  }
});

/* ═══════════ content reads are bounded ═══════════ */

test("content comes back when everything agrees", async () => {
  const body = Buffer.from("hello world!");
  const { deps, urls } = fakeDeps({
    responses: [
      jsonResponse({ name: "letter.pdf", mimeType: "application/pdf", size: String(body.length) }),
      new Response(body, { headers: { "content-length": String(body.length) } }),
    ],
    reference: { projectId: "project-1", recordedSize: body.length },
  });
  const file = await readLegacyDriveContent(FILE_ID, deps, 1_000_000);
  assert.equal(file.bytes.toString(), "hello world!");
  assert.equal(file.filename, "letter.pdf");
  assert.equal(file.contentType, "application/pdf");
  assert.ok(urls[1]!.includes("alt=media"), "content is the second request");
});

test("the size limit is enforced from the metadata, before any content is fetched", async () => {
  const { deps, urls } = fakeDeps({ responses: [jsonResponse({ name: "big.pdf", size: "999999" })] });
  assert.equal(await failureCode(() => readLegacyDriveContent(FILE_ID, deps, 1000)), "too-large");
  assert.equal(urls.length, 1, "the content request was never made");
});

test("a lying content-length is caught, and so are the bytes that actually arrive", async () => {
  const header = fakeDeps({
    responses: [
      jsonResponse({ name: "x.pdf" }),
      new Response(Buffer.from("tiny"), { headers: { "content-length": "999999" } }),
    ],
    reference: { projectId: "project-1", recordedSize: null },
  });
  assert.equal(await failureCode(() => readLegacyDriveContent(FILE_ID, header.deps, 1000)), "too-large");

  const actual = fakeDeps({
    responses: [
      jsonResponse({ name: "x.pdf" }),
      new Response(Buffer.from("x".repeat(2000)), { headers: { "content-length": "4" } }),
    ],
    reference: { projectId: "project-1", recordedSize: null },
  });
  assert.equal(await failureCode(() => readLegacyDriveContent(FILE_ID, actual.deps, 1000)), "too-large");
});

test("a truncated download is refused rather than returned as the file", async () => {
  const { deps } = fakeDeps({
    responses: [
      jsonResponse({ name: "x.pdf", size: "100" }),
      new Response(Buffer.from("short")),
    ],
    reference: { projectId: "project-1", recordedSize: 100 },
  });
  assert.equal(await failureCode(() => readLegacyDriveContent(FILE_ID, deps, 1_000_000)), "incomplete");
});

test("an unreferenced id is refused on the content path too", async () => {
  const { deps, urls } = fakeDeps();
  assert.equal(await failureCode(() => readLegacyDriveContent(OTHER_ID, deps, 1_000_000)), "not-referenced");
  assert.deepEqual(urls, []);
});

/* ═══════════ this path cannot write, and cannot reach the other readers ═══════════ */

test("the module writes nothing and touches neither OAuth nor Replit storage", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  let source = "";
  let dir = __dirname;
  for (let up = 0; up < 8 && !source; up += 1) {
    for (const segments of [["legacyDriveReader.ts"], ["src", "lib", "legacyDriveReader.ts"],
      ["artifacts", "api-server", "src", "lib", "legacyDriveReader.ts"]]) {
      try { source = readFileSync(join(dir, ...segments), "utf8"); break; } catch { /* keep looking */ }
    }
    dir = dirname(dir);
  }
  assert.ok(source, "the source must be readable");

  // Assert against CODE, not prose: the comments deliberately name the secret
  // and the upsert bug this path exists to avoid, and naming them is not doing
  // them. Stripping comments first also makes these checks stricter.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

  // No write of any kind, and no folder creation: a read path that mutates is
  // how the existing OAuth reader ended up upserting on every download.
  for (const forbidden of ["upsert(", "insert(", "update(", "delete(", "ensureFolder", "generateIds"]) {
    assert.equal(code.includes(forbidden), false, `must not contain ${forbidden}`);
  }
  // It cannot open a database connection, and it never reads the secret itself:
  // the token arrives through the injected getAccessToken.
  for (const forbidden of ["supabaseAdmin", "@supabase", "SERVICE_ACCOUNT_JSON", "private_key", "process.env"]) {
    assert.equal(code.includes(forbidden), false, `must not reference ${forbidden}`);
  }
  // It must not import the OAuth reader or the Replit storage module, so it
  // cannot change their behaviour or be reached as a fallback from them.
  const imports = (source.match(/^import[\s\S]*?from\s+"[^"]+";/gm) ?? []).join("\n");
  for (const forbidden of ["tenantDrive", "objectStorage"]) {
    assert.equal(imports.includes(forbidden), false, `must not import ${forbidden}`);
  }
  // alt=media appears only on the content path, never on the metadata path.
  assert.equal((code.match(/alt=media/g) ?? []).length, 1);
});

/* ═══════════ the project gate is WIRED, not merely available ═══════════ */

/** Reads a sibling source file without importing it (it pulls in the database). */
async function siblingSource(name: string): Promise<string> {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  let dir = __dirname;
  for (let up = 0; up < 8; up += 1) {
    for (const segments of [[name], ["src", "lib", name], ["artifacts", "api-server", "src", "lib", name]]) {
      try { return readFileSync(join(dir, ...segments), "utf8"); } catch { /* keep looking */ }
    }
    dir = dirname(dir);
  }
  return "";
}

test("legacyDriveDepsFor supplies authorizeProject by default", async () => {
  // An optional gate that nobody passes is not a gate. Omission must fall back
  // to the project-to-tenant check, never to undefined.
  const source = await siblingSource("legacyDriveAccess.ts");
  assert.ok(source, "legacyDriveAccess.ts must be readable");
  assert.match(
    source,
    /authorizeProject:\s*authorizeProject\s*\?\?\s*\(\(projectId\)\s*=>\s*projectBelongsToTenant\(tenantId,\s*projectId\)\)/,
    "the default must be the project-to-tenant check",
  );
  assert.match(source, /export async function projectBelongsToTenant/);
});

test("the project check is scoped to the tenant and fails closed", async () => {
  const source = await siblingSource("legacyDriveAccess.ts");
  const fn = source.slice(source.indexOf("export async function projectBelongsToTenant"));
  const body = fn.slice(0, fn.indexOf("\n}") + 2);
  assert.ok(body.includes("runWithTenant(tenantId"), "must run inside the tenant scope");
  assert.ok(body.includes('from("projects")'), "must check the projects table");
  assert.ok(/if \(error \|\| !data\) return false;/.test(body), "missing or unreadable denies");
  // Exactly one way to succeed, and every other exit denies.
  assert.equal((body.match(/return true/g) ?? []).length, 1, "one success path only");
  assert.ok((body.match(/return false/g) ?? []).length >= 2, "every other exit denies");
});

test("the access layer never writes, and never uses getConnection", async () => {
  const source = await siblingSource("legacyDriveAccess.ts");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  for (const forbidden of ["upsert(", "insert(", "update(", "delete(", "ensureFolder", "getConnection"]) {
    assert.equal(code.includes(forbidden), false, `must not contain ${forbidden}`);
  }
  // The connection record is read, never rewritten.
  assert.ok(code.includes('from("tenant_storage_connections")'));
  assert.ok(code.includes(".select("), "the connection is read with select");
});
