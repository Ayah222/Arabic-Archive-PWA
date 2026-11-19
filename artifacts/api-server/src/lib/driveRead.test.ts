// Tests for the provider-aware Drive read path.
//
// No credential, no network, no database, no Drive. Both readers are fakes
// that record how they were called, so the tests can assert the thing that
// actually matters: a tenant on the historical service-account marker never
// reaches the OAuth reader, and therefore never reaches decryptRefreshToken.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LegacyDriveError } from "./legacyDriveReader";
import {
  classifyOAuthError,
  driveReadStatus,
  readTenantDriveFile,
  type DriveProvider,
  type DriveReadDeps,
  type TenantDriveFile,
} from "./driveRead";

const currentDir = dirname(fileURLToPath(import.meta.url));
const FILE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz01234";
const MAX = 10 * 1024 * 1024;

const file = (name = "doc.pdf"): TenantDriveFile => ({
  bytes: Buffer.from("synthetic"),
  filename: name,
  contentType: "application/pdf",
});

/** A deps bundle whose every call is recorded. */
function spyDeps(
  provider: DriveProvider | null,
  overrides: Partial<{
    legacy: (fileId: string, maxBytes: number) => Promise<TenantDriveFile>;
    oauth: (fileId: string, maxBytes: number) => Promise<TenantDriveFile>;
    // Phase 18CK. Defaults to FALSE, so every test written before this
    // phase keeps precisely the behaviour it had and the rescue path is
    // reached only where a test asks for it.
    legacyAvailable: boolean;
  }> = {},
) {
  const calls = {
    resolve: 0, legacy: 0, oauth: 0, available: 0,
    legacyArgs: [] as unknown[], oauthArgs: [] as unknown[],
  };
  const deps: DriveReadDeps = {
    legacyReaderAvailable: async () => {
      calls.available += 1;
      return overrides.legacyAvailable ?? false;
    },
    resolveProvider: async () => {
      calls.resolve += 1;
      return provider;
    },
    readLegacy: async (fileId, maxBytes) => {
      calls.legacy += 1;
      calls.legacyArgs.push([fileId, maxBytes]);
      return overrides.legacy ? overrides.legacy(fileId, maxBytes) : file();
    },
    readOAuth: async (fileId, maxBytes) => {
      calls.oauth += 1;
      calls.oauthArgs.push([fileId, maxBytes]);
      return overrides.oauth ? overrides.oauth(fileId, maxBytes) : file();
    },
  };
  return { deps, calls };
}

async function refusal(fn: () => Promise<unknown>): Promise<LegacyDriveError> {
  try {
    await fn();
  } catch (error) {
    assert.ok(error instanceof LegacyDriveError, "refusals must be typed LegacyDriveError");
    return error;
  }
  throw new assert.AssertionError({ message: "expected a refusal, got a result" });
}

// ---------------------------------------------------------------- routing
test("a legacy connection is served by the legacy reader", async () => {
  const { deps, calls } = spyDeps("legacy-service-account");
  const out = await readTenantDriveFile(FILE_ID, deps, MAX);
  assert.equal(out.filename, "doc.pdf");
  assert.equal(calls.legacy, 1);
  assert.equal(calls.oauth, 0);
});

test("THE REGRESSION: a legacy connection NEVER reaches the OAuth reader", async () => {
  // readOAuth is the only route to decryptRefreshToken. If it is never
  // called, the decrypt that produced the 400 cannot happen.
  const { deps, calls } = spyDeps("legacy-service-account", {
    oauth: async () => {
      throw new Error("decryptRefreshToken must never run for a legacy tenant");
    },
  });
  await readTenantDriveFile(FILE_ID, deps, MAX);
  assert.equal(calls.oauth, 0, "the OAuth reader was invoked for a legacy tenant");
});

test("an OAuth connection is served by the OAuth reader", async () => {
  const { deps, calls } = spyDeps("oauth");
  await readTenantDriveFile(FILE_ID, deps, MAX);
  assert.equal(calls.oauth, 1);
  assert.equal(calls.legacy, 0);
});

test("the provider is resolved exactly once, before either reader", async () => {
  const { deps, calls } = spyDeps("oauth");
  await readTenantDriveFile(FILE_ID, deps, MAX);
  assert.equal(calls.resolve, 1);
});

test("the file id and byte cap are passed through unchanged", async () => {
  const { deps, calls } = spyDeps("legacy-service-account");
  await readTenantDriveFile(FILE_ID, deps, 4242);
  assert.deepEqual(calls.legacyArgs[0], [FILE_ID, 4242]);
});

// ------------------------------------------------- credentials / provider
test("no connection at all is refused, not guessed", async () => {
  const { deps, calls } = spyDeps(null);
  const error = await refusal(() => readTenantDriveFile(FILE_ID, deps, MAX));
  assert.equal(error.code, "not-configured");
  assert.equal(calls.legacy, 0);
  assert.equal(calls.oauth, 0);
});

test("an unrecognised provider value reaches neither reader", async () => {
  const { deps, calls } = spyDeps("something-else" as unknown as DriveProvider);
  const error = await refusal(() => readTenantDriveFile(FILE_ID, deps, MAX));
  assert.equal(error.code, "not-configured");
  assert.equal(calls.legacy + calls.oauth, 0);
});

test("a provider lookup that throws is not swallowed into a success", async () => {
  const deps: DriveReadDeps = {
    resolveProvider: async () => {
      throw new Error("database unreachable");
    },
    legacyReaderAvailable: async () => false,
    readLegacy: async () => file(),
    readOAuth: async () => file(),
  };
  await assert.rejects(() => readTenantDriveFile(FILE_ID, deps, MAX));
});

// ------------------------------------------------------------- bad input
test("a forged file id is refused before the connection is consulted", async () => {
  const { deps, calls } = spyDeps("oauth");
  for (const bad of ["", "abc", "../../etc/passwd", "a b c", "a/b", "a.b", "x".repeat(257)]) {
    const error = await refusal(() => readTenantDriveFile(bad, deps, MAX));
    assert.equal(error.code, "invalid-id", `expected invalid-id for ${JSON.stringify(bad)}`);
  }
  assert.equal(calls.resolve, 0, "a malformed id must not even resolve the provider");
  assert.equal(calls.legacy + calls.oauth, 0);
});

test("a drive_ prefixed reference is pattern-valid, so routes must strip it", () => {
  // Underscore is a legal Drive id character, so "drive_<id>" passes the
  // shape check and would reach Google as an id that does not exist.
  // hr/files.ts always stripped the prefix; hr/candidates.ts did not, and
  // its catch turned the resulting failure into a silent empty result.
  for (const rel of ["../routes/sa/hr/files.ts", "../routes/sa/hr/candidates.ts"]) {
    const source = readFileSync(join(currentDir, rel), "utf8");
    assert.ok(
      /drive_/.test(source) && /replace\(\/\^drive_\/|slice\("drive_"\.length\)/.test(source),
      `${rel} must strip the drive_ prefix before reading`,
    );
  }
});
test("a non-string file id is refused", async () => {
  const { deps } = spyDeps("oauth");
  for (const bad of [null, undefined, 42, {}, []]) {
    const error = await refusal(() => readTenantDriveFile(bad as unknown as string, deps, MAX));
    assert.equal(error.code, "invalid-id");
  }
});

test("a missing or absurd byte cap is refused", async () => {
  const { deps, calls } = spyDeps("oauth");
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await refusal(() => readTenantDriveFile(FILE_ID, deps, bad));
  }
  assert.equal(calls.legacy + calls.oauth, 0);
});

// ------------------------------------------ authorisation is NOT weakened
test("a legacy refusal passes through with its own code and no bytes", async () => {
  // not-referenced is the legacy reader's tenant-ownership gate: the id is
  // not referenced by any attachment row belonging to this tenant.
  for (const code of ["not-referenced", "forbidden", "not-found", "denied"] as const) {
    const { deps } = spyDeps("legacy-service-account", {
      legacy: async () => {
        throw new LegacyDriveError(code, "refused");
      },
    });
    const error = await refusal(() => readTenantDriveFile(FILE_ID, deps, MAX));
    assert.equal(error.code, code, "the underlying gate's verdict must survive");
    assert.ok(!("bytes" in error), "a refusal must not carry file bytes");
  }
});

test("a cross-tenant OAuth file is refused as forbidden", async () => {
  // downloadTenantFile throws this when appProperties.smartArchiveTenantId
  // does not match the caller's tenant.
  const { deps } = spyDeps("oauth", {
    oauth: async () => {
      throw new Error("Google Drive file belongs to a different organization");
    },
  });
  const error = await refusal(() => readTenantDriveFile(FILE_ID, deps, MAX));
  assert.equal(error.code, "forbidden");
  assert.equal(driveReadStatus(error.code), 403);
});

test("the deps bundle is the only way to reach a reader", async () => {
  // Nothing in the module reaches a tenant except through the injected deps,
  // so a route cannot accidentally read another tenant's file by passing a
  // different id - the readers are already bound to one tenant.
  const { deps, calls } = spyDeps("legacy-service-account");
  await readTenantDriveFile(FILE_ID, deps, MAX);
  await readTenantDriveFile("9ZyXwVuTsRqPoNmLkJiHgFeDcBa98765", deps, MAX);
  assert.equal(calls.legacy, 2);
  assert.equal(calls.resolve, 2, "every read re-resolves; no cached cross-request state");
});

// ------------------------------------------------------- Drive failures
test("Drive HTTP statuses map to their own typed failures", async () => {
  const cases: Array<[string, string, number]> = [
    ["Google Drive download failed (404)", "not-found", 404],
    ["Google Drive download failed (401)", "auth-failed", 503],
    ["Google Drive download failed (403)", "denied", 503],
    ["Google Drive download failed (429)", "transient", 503],
    ["Google Drive download failed (500)", "transient", 503],
    ["Google Drive download failed (503)", "transient", 503],
  ];
  for (const [message, code, status] of cases) {
    const { deps } = spyDeps("oauth", {
      oauth: async () => {
        throw new Error(message);
      },
    });
    const error = await refusal(() => readTenantDriveFile(FILE_ID, deps, MAX));
    assert.equal(error.code, code, message);
    assert.equal(driveReadStatus(error.code), status, message);
  }
});

test("size and completeness failures keep their own codes", async () => {
  const cases: Array<[string, string]> = [
    ["File exceeds the allowed download size", "too-large"],
    ["Google Drive returned an incomplete file (3/9 bytes)", "incomplete"],
    ["Invalid Google Drive file ID", "invalid-id"],
  ];
  for (const [message, code] of cases) {
    const { deps } = spyDeps("oauth", {
      oauth: async () => {
        throw new Error(message);
      },
    });
    const error = await refusal(() => readTenantDriveFile(FILE_ID, deps, MAX));
    assert.equal(error.code, code, message);
  }
});

test("a dead OAuth connection is reported as not-configured, not not-found", async () => {
  // Telling a user "the file does not exist" when the connection is broken
  // is how a configuration fault gets mistaken for data loss.
  for (const message of [
    "يلزم ربط Google Drive بحساب المكتب.",
    "انتهت صلاحية ربط Google Drive. أعد ربط حساب المكتب.",
  ]) {
    const { deps } = spyDeps("oauth", {
      oauth: async () => {
        throw new Error(message);
      },
    });
    const error = await refusal(() => readTenantDriveFile(FILE_ID, deps, MAX));
    assert.equal(error.code, "not-configured");
    assert.notEqual(error.code, "not-found");
  }
});

test("an unrecognised error fails closed as transient", async () => {
  const { deps } = spyDeps("oauth", {
    oauth: async () => {
      throw new Error("something nobody anticipated");
    },
  });
  const error = await refusal(() => readTenantDriveFile(FILE_ID, deps, MAX));
  assert.equal(error.code, "transient");
});

test("a non-Error throw is still refused safely", async () => {
  const { deps } = spyDeps("oauth", {
    oauth: async () => {
      throw "a bare string";
    },
  });
  const error = await refusal(() => readTenantDriveFile(FILE_ID, deps, MAX));
  assert.equal(error.code, "transient");
});

// ----------------------------------------------------------- disclosure
test("a refusal message never carries the id, a filename or a tenant", async () => {
  const { deps } = spyDeps("oauth", {
    oauth: async () => {
      throw new Error(`failed for ${FILE_ID} in tenant e7c9121b owner secret.pdf (500)`);
    },
  });
  const error = await refusal(() => readTenantDriveFile(FILE_ID, deps, MAX));
  assert.ok(!error.message.includes(FILE_ID), "the Drive id leaked into the message");
  assert.ok(!error.message.includes("e7c9121b"), "a tenant id leaked into the message");
  assert.ok(!error.message.includes("secret.pdf"), "a filename leaked into the message");
});

test("classifyOAuthError never returns a code outside the known set", () => {
  const known = new Set([
    "invalid-id", "not-legacy", "not-configured", "not-referenced", "forbidden",
    "not-found", "denied", "auth-failed", "too-large", "incomplete", "transient",
  ]);
  for (const input of ["", "x", "(999)", "Google Drive", null, undefined, 7, {}]) {
    assert.ok(known.has(classifyOAuthError(input)));
  }
});

// ------------------------------------------------- the module's own shape
test("the read path contains no write and no object-storage call", () => {
  const source = readFileSync(join(currentDir, "driveRead.ts"), "utf8");
  const code = source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
  for (const forbidden of [
    "savePrivateObject", "saveTenantPrivateObject", "deletePrivateObject",
    "downloadPrivateObject", "objectStorageClient", "supabaseAdmin",
    'method: "POST"', 'method: "PATCH"', 'method: "PUT"', 'method: "DELETE"',
    "writeFileSync", "/permissions", "decryptRefreshToken",
  ]) {
    assert.ok(!code.includes(forbidden), `driveRead.ts must not reference ${forbidden}`);
  }
});

test("the module imports nothing but the pure reader types", () => {
  const source = readFileSync(join(currentDir, "driveRead.ts"), "utf8");
  const imports = [...source.matchAll(/^import .*? from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["./legacyDriveReader"]);
});

// ------------------------------------------- every route uses the one path
test("all nine Drive read sites go through readTenantDriveFile", () => {
  const routes = [
    ["../routes/sa/attachments.ts", 2],
    ["../routes/sa/ai.ts", 1],
    ["../routes/sa/emailArchive.ts", 1],
    ["../routes/sa/hr/files.ts", 2],
    ["../routes/sa/hr/candidates.ts", 1],
    ["../routes/sa/upload.ts", 1],
    ["../routes/sa/tenantStorage.ts", 1],
  ] as const;
  let total = 0;
  for (const [rel, expected] of routes) {
    const source = readFileSync(join(currentDir, rel), "utf8");
    const used = (source.match(/readTenantDriveFile\(/g) ?? []).length;
    assert.equal(used, expected, `${rel} should call readTenantDriveFile ${expected}x`);
    assert.ok(
      !/\bdownloadTenantFile\s*\(/.test(source),
      `${rel} still calls downloadTenantFile directly`,
    );
    assert.ok(
      source.includes("driveReadDepsFor("),
      `${rel} must bind the reader to its own tenant`,
    );
    total += used;
  }
  assert.equal(total, 9, "all nine original call sites are accounted for");
});

test("the routes still read Replit Object Storage exactly as before", () => {
  // The baseline is taken from git rather than hard-coded, so this asserts
  // the real invariant - the non-Drive path is untouched - instead of
  // whatever number happened to be true when the test was written.
  const routes = [
    "routes/sa/upload.ts",
    "routes/sa/attachments.ts",
    "routes/sa/ai.ts",
    "routes/sa/emailArchive.ts",
    "routes/sa/hr/files.ts",
    "routes/sa/tenantStorage.ts",
  ];
  // READ calls only. The write calls used to be listed here too, but Phase
  // 18DS routes every write through storeTenantDocument, so comparing their
  // count against the previous commit would fail on the intended change.
  // They are not unguarded: storeDocument.test.ts asserts the routes make
  // ZERO direct write calls, which is stronger than "unchanged since HEAD".
  const storageCalls = [
    "downloadPrivateObject(", "getPrivateObjectMetadata(", "isTenantPrivateObject(",
    "downloadSupabaseObject(",
  ];
  const count = (text: string, needle: string) =>
    (text.match(new RegExp(needle.replace("(", "\\("), "g")) ?? []).length;

  for (const rel of routes) {
    const now = readFileSync(join(currentDir, "..", rel), "utf8");
    const base = execFileSync(
      "git",
      ["show", `HEAD:artifacts/api-server/src/${rel}`],
      { cwd: join(currentDir, "..", "..", "..", ".."), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
    for (const call of storageCalls) {
      assert.equal(
        count(now, call),
        count(base, call),
        `${rel}: ${call} count changed - the object-storage path must not move`,
      );
    }
  }
});

test("every status in the mapper is a real HTTP status", () => {
  const codes = [
    "invalid-id", "not-legacy", "not-configured", "not-referenced", "forbidden",
    "not-found", "denied", "auth-failed", "too-large", "incomplete", "transient",
  ] as const;
  for (const code of codes) {
    const status = driveReadStatus(code);
    assert.ok(status >= 400 && status <= 599, `${code} -> ${status}`);
  }
  assert.equal(driveReadStatus("not-found"), 404);
  assert.equal(driveReadStatus("not-referenced"), 404);
  assert.equal(driveReadStatus("forbidden"), 403);
  assert.equal(driveReadStatus("invalid-id"), 400);
  assert.equal(driveReadStatus("too-large"), 413);
  assert.equal(driveReadStatus("transient"), 503);
});

// ===================================================================
// Phase 18CK - the historical reader must survive an OAuth connection.
//
// Connecting OAuth upserts tenant_storage_connections and overwrites
// encrypted_credentials, which is where the historical marker lived. The
// tenant therefore flips from "legacy-service-account" to "oauth", and a
// newly created Web client cannot see files a DIFFERENT app uploaded,
// because drive.file only ever shows an app its own files. Without a
// rescue, connecting makes every migrated document unreadable.
// ===================================================================

/** What the OAuth reader throws for a file its app did not create. */
const oauthCannotSee = () => {
  throw new Error("Google Drive request failed (404)");
};

test("BEFORE connecting: a historical file is served by the legacy reader", async () => {
  const { deps, calls } = spyDeps("legacy-service-account");
  const result = await readTenantDriveFile(FILE_ID, deps, MAX);
  assert.equal(result.filename, "doc.pdf");
  assert.equal(calls.legacy, 1);
  assert.equal(calls.oauth, 0, "the OAuth reader must never be reached");
});

test("AFTER connecting: the SAME historical file is still readable", async () => {
  // the regression this phase exists to prevent
  const { deps, calls } = spyDeps("oauth", {
    oauth: async () => oauthCannotSee(),
    legacy: async () => file("historical.pdf"),
    legacyAvailable: true,
  });
  const result = await readTenantDriveFile(FILE_ID, deps, MAX);
  assert.equal(result.filename, "historical.pdf");
  assert.equal(calls.oauth, 1, "OAuth is still tried FIRST");
  assert.equal(calls.legacy, 1, "and the historical reader rescues it");
});

test("the rescue passes the SAME file id and size limit, unaltered", async () => {
  const { deps, calls } = spyDeps("oauth", {
    oauth: async () => oauthCannotSee(),
    legacyAvailable: true,
  });
  await readTenantDriveFile(FILE_ID, deps, MAX);
  assert.deepEqual(calls.legacyArgs[0], [FILE_ID, MAX],
    "file ids and paths must be preserved exactly");
});

test("a REVOKED OAuth token does not take historical documents down", async () => {
  const { deps, calls } = spyDeps("oauth", {
    oauth: async () => { throw new Error("Google Drive request failed (401)"); },
    legacy: async () => file("still-here.pdf"),
    legacyAvailable: true,
  });
  const result = await readTenantDriveFile(FILE_ID, deps, MAX);
  assert.equal(result.filename, "still-here.pdf");
  assert.equal(calls.legacy, 1);
});

test("an EXPIRED connection message does not take them down either", async () => {
  const { deps } = spyDeps("oauth", {
    oauth: async () => { throw new Error("انتهت صلاحية ربط Google Drive"); },
    legacy: async () => file("still-here.pdf"),
    legacyAvailable: true,
  });
  const result = await readTenantDriveFile(FILE_ID, deps, MAX);
  assert.equal(result.filename, "still-here.pdf");
});

test("the rescue is NOT attempted when the service account is absent", async () => {
  const { deps, calls } = spyDeps("oauth", {
    oauth: async () => oauthCannotSee(),
    legacyAvailable: false,
  });
  await assert.rejects(() => readTenantDriveFile(FILE_ID, deps, MAX), LegacyDriveError);
  assert.equal(calls.legacy, 0, "no historical reader, no rescue");
});

test("the rescue does NOT bypass the legacy reader's own gates", async () => {
  // cross-tenant / cross-project: the file is not referenced by THIS tenant
  let served: unknown = null;
  const { deps, calls } = spyDeps("oauth", {
    oauth: async () => oauthCannotSee(),
    legacy: async () => {
      throw new LegacyDriveError("not-referenced", "الملف المطلوب غير مرتبط بأرشيف هذه المؤسسة");
    },
    legacyAvailable: true,
  });
  await assert.rejects(async () => { served = await readTenantDriveFile(FILE_ID, deps, MAX); });
  assert.equal(served, null, "no content may be returned");
  assert.equal(calls.legacy, 1, "the gate ran and refused");
});

test("a genuinely missing file still fails, and fails as 404", async () => {
  const { deps } = spyDeps("oauth", {
    oauth: async () => oauthCannotSee(),
    legacy: async () => { throw new LegacyDriveError("not-found", "الملف غير موجود"); },
    legacyAvailable: true,
  });
  const thrown = await readTenantDriveFile(FILE_ID, deps, MAX).catch((e) => e);
  assert.ok(thrown instanceof LegacyDriveError);
  assert.equal(driveReadStatus(thrown.code), 404);
});

test("failures that are NOT about identity never trigger a rescue", async () => {
  // Retrying a too-large or corrupt file under another identity would fail
  // identically while hiding the real cause.
  for (const message of [
    "File exceeds the allowed download size",
    "Google Drive returned an incomplete file",
    "Google Drive request failed (503)",
    "Invalid Google Drive file ID",
  ]) {
    const { deps, calls } = spyDeps("oauth", {
      oauth: async () => { throw new Error(message); },
      legacyAvailable: true,
    });
    await assert.rejects(() => readTenantDriveFile(FILE_ID, deps, MAX));
    assert.equal(calls.legacy, 0, `must not rescue: ${message}`);
  }
});

test("when the rescue also fails, the CONNECTED provider's error is reported", async () => {
  const { deps } = spyDeps("oauth", {
    oauth: async () => { throw new Error("Google Drive request failed (401)"); },
    legacy: async () => { throw new LegacyDriveError("not-referenced", "x"); },
    legacyAvailable: true,
  });
  const thrown = await readTenantDriveFile(FILE_ID, deps, MAX).catch((e) => e);
  assert.ok(thrown instanceof LegacyDriveError);
  assert.equal(thrown.code, "auth-failed", "the operative failure is the OAuth one");
});

test("no error carries file content or credential material", async () => {
  const secretish = "BEGIN PRIVATE KEY blob and 1//refresh-token";
  const { deps } = spyDeps("oauth", {
    oauth: async () => { throw new Error(`Google Drive request failed (401) ${secretish}`); },
    legacy: async () => { throw new LegacyDriveError("not-referenced", secretish); },
    legacyAvailable: true,
  });
  const thrown = await readTenantDriveFile(FILE_ID, deps, MAX).catch((e) => e);
  assert.ok(!thrown.message.includes("PRIVATE KEY"));
  assert.ok(!thrown.message.includes("1//refresh-token"));
  assert.ok(!thrown.message.includes("synthetic"), "no file bytes in the message");
});

test("a tenant with NO connection is still refused outright", async () => {
  // null provider must not become a free pass to the service account
  const { deps, calls } = spyDeps(null, { legacyAvailable: true });
  const thrown = await readTenantDriveFile(FILE_ID, deps, MAX).catch((e) => e);
  assert.ok(thrown instanceof LegacyDriveError);
  assert.equal(thrown.code, "not-configured");
  assert.equal(calls.legacy, 0, "no reader may run without a resolved provider");
  assert.equal(calls.oauth, 0);
});
