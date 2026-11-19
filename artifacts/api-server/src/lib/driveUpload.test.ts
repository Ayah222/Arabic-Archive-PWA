// Tests for the verified direct-to-Drive upload transaction, the tenant
// and the tenant allowlist flag.
//
// No credential, no network, no database, no Drive. Every effect is a fake
// that records what it was asked, so the failure branches that matter most -
// a checksum that does not match, a revoked token, a retry, a crash between
// upload and verification - are exercised directly rather than hoped for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DriveUploadError,
  ORIGIN_NATIVE,
  ORIGIN_PROPERTY,
  UPLOAD_KEY_PROPERTY,
  disambiguate,
  folderSegmentsFor,
  uploadDocumentToDrive,
  uploadKeyFor,
  type DriveObject,
  type UploadDeps,
  type UploadRequest,
} from "./driveUpload";
import {
  directDriveUploadEnabled,
  directDriveUploadSummary,
  directDriveUploadTenants,
} from "./driveFlags";

const currentDir = dirname(fileURLToPath(import.meta.url));
const TENANT = "e7c9121b-2450-402f-be8d-07bd65fa0156";
const OWNER = "fb086ffd3438";
const BYTES = Buffer.from("عقد المشروع - محتوى تجريبي", "utf8");
const SHA = createHash("sha256").update(BYTES).digest("hex");

const request = (over: Partial<UploadRequest> = {}): UploadRequest => ({
  tenantId: TENANT,
  projectId: "62146f8d-0598-4a11-9f00-000000000001",
  projectLabel: "مشروع المدينة المنورة",
  category: "01 Contracts",
  filename: "عقد المقاول.pdf",
  bytes: BYTES,
  contentType: "application/pdf",
  ...over,
});

/** A Drive that behaves, unless told otherwise. */
function fakeDrive(over: Partial<UploadDeps> & { stored?: Partial<DriveObject> } = {}) {
  const calls = {
    upload: 0, getMetadata: 0, remove: 0, find: 0,
    uploaded: [] as Array<Record<string, unknown>>, removed: [] as string[],
  };
  const store = new Map<string, DriveObject>();
  const deps: UploadDeps = {
    isEnabled: over.isEnabled ?? (() => true),
    findByUploadKey: over.findByUploadKey ?? (async (_t, key) => {
      calls.find += 1;
      for (const file of store.values()) {
        if (file.appProperties?.[UPLOAD_KEY_PROPERTY] === key) return file;
      }
      return null;
    }),
    upload: over.upload ?? (async (input) => {
      calls.upload += 1;
      calls.uploaded.push({ ...input, bytes: input.bytes.length });
      const id = `drv${calls.upload}${"x".repeat(10)}`;
      store.set(id, {
        id, name: input.filename, mimeType: input.contentType,
        size: String(input.bytes.length),
        sha256Checksum: createHash("sha256").update(input.bytes).digest("hex"),
        trashed: false, owners: [{ emailAddress: "institution@example.org" }],
        appProperties: input.appProperties,
        ...(over.stored ?? {}),
      });
      return { objectName: `drive://${id}` };
    }),
    getMetadata: over.getMetadata ?? (async (_t, id) => {
      calls.getMetadata += 1;
      const file = store.get(id);
      if (!file) throw new Error("Google Drive download failed (404)");
      return file;
    }),
    remove: over.remove ?? (async (_t, id) => {
      calls.remove += 1;
      calls.removed.push(id);
      store.delete(id);
    }),
    expectedOwnerDigest: OWNER,
    digestOf: over.digestOf ?? (() => OWNER),
  };
  return { deps, calls, store };
}

async function refusal(fn: () => Promise<unknown>): Promise<DriveUploadError> {
  try {
    await fn();
  } catch (error) {
    assert.ok(error instanceof DriveUploadError, `expected DriveUploadError, got ${error}`);
    return error;
  }
  throw new assert.AssertionError({ message: "expected a refusal, got a result" });
}

// ------------------------------------------------------------- the flag
test("the flag is off for everyone by default", () => {
  assert.deepEqual(directDriveUploadTenants({} as NodeJS.ProcessEnv), []);
  assert.equal(directDriveUploadEnabled(TENANT, {} as NodeJS.ProcessEnv), false);
  assert.equal(directDriveUploadEnabled(TENANT, { DRIVE_DIRECT_UPLOAD_TENANTS: "" } as never), false);
});

test("only a listed tenant is enabled", () => {
  const env = { DRIVE_DIRECT_UPLOAD_TENANTS: `other-tenant, ${TENANT}` } as never;
  assert.equal(directDriveUploadEnabled(TENANT, env), true);
  assert.equal(directDriveUploadEnabled("someone-else", env), false);
  assert.equal(directDriveUploadSummary(TENANT, env).configured, 2);
});

test("a wildcard CANNOT switch every tenant on", () => {
  const env = { DRIVE_DIRECT_UPLOAD_TENANTS: "*" } as never;
  assert.deepEqual(directDriveUploadTenants(env), []);
  assert.equal(directDriveUploadEnabled(TENANT, env), false);
});

test("an unlisted tenant cannot upload even with everything else correct", async () => {
  const { deps, calls } = fakeDrive({ isEnabled: () => false });
  const error = await refusal(() => uploadDocumentToDrive(request(), deps));
  assert.equal(error.code, "not-enabled");
  assert.equal(calls.upload, 0, "nothing may reach Drive for an unapproved tenant");
});

// ------------------------------------------------------- the happy path
test("a verified upload returns a resolvable reference", async () => {
  const { deps, calls } = fakeDrive();
  const out = await uploadDocumentToDrive(request(), deps);
  assert.match(out.objectPath, /^drive:\/\/.+/);
  assert.equal(out.sha256, SHA);
  assert.equal(out.size, BYTES.length);
  assert.equal(out.reused, false);
  assert.equal(calls.upload, 1);
  assert.equal(calls.getMetadata, 1, "every upload is read back before it is reported");
});

test("the original Arabic filename and extension survive", async () => {
  const { deps, calls } = fakeDrive();
  const out = await uploadDocumentToDrive(request(), deps);
  assert.equal(out.filename, "عقد المقاول.pdf");
  assert.equal(calls.uploaded[0].filename, "عقد المقاول.pdf");
  assert.equal(out.contentType, "application/pdf", "the real MIME type, never octet-stream");
});

test("tenant, project and origin are stamped on the file", async () => {
  const { deps, calls } = fakeDrive();
  await uploadDocumentToDrive(request(), deps);
  const props = calls.uploaded[0].appProperties as Record<string, string>;
  assert.ok(props[UPLOAD_KEY_PROPERTY], "an idempotency key is always written");
  assert.equal(props[ORIGIN_PROPERTY], ORIGIN_NATIVE,
    "born-in-Drive and migrated must never blur");
  assert.ok(props.archhiveProjectId);
});

test("the folder path is human readable and project-stable", () => {
  const segments = folderSegmentsFor({
    projectId: "62146f8d-0598-4a11", projectLabel: "مشروع المدينة المنورة", category: "01 Contracts",
  });
  assert.deepEqual(segments, ["01 Projects", "مشروع المدينة المنورة (62146f8d)", "01 Contracts"]);
  // the id in the folder name is what lets a project be renamed freely
  const renamed = folderSegmentsFor({
    projectId: "62146f8d-0598-4a11", projectLabel: "اسم جديد", category: "01 Contracts",
  });
  assert.equal(renamed[1].endsWith("(62146f8d)"), true);
});

test("a path segment cannot escape the tenant subtree", () => {
  const segments = folderSegmentsFor({
    projectId: "p1", projectLabel: "../../etc", category: "../secrets",
  });
  for (const segment of segments) {
    assert.ok(!segment.includes("/"), `segment must not contain a separator: ${segment}`);
    assert.ok(segment !== ".." && segment !== ".");
  }
});

// -------------------------------------------------------- idempotency
test("the same file sent twice uploads ONCE", async () => {
  const { deps, calls } = fakeDrive();
  const first = await uploadDocumentToDrive(request(), deps);
  const second = await uploadDocumentToDrive(request(), deps);
  assert.equal(calls.upload, 1, "the retry must not create a second file");
  assert.equal(second.reused, true);
  assert.equal(second.fileId, first.fileId);
});

test("the same bytes under a different category are two documents", async () => {
  const { deps, calls } = fakeDrive();
  await uploadDocumentToDrive(request(), deps);
  await uploadDocumentToDrive(request({ category: "03 Drawings" }), deps);
  assert.equal(calls.upload, 2, "a deliberate second filing is not a duplicate");
});

test("the upload key is deterministic and content-bound", () => {
  const a = uploadKeyFor({ tenantId: TENANT, projectId: "p", category: "c", filename: "f", bytes: BYTES });
  const b = uploadKeyFor({ tenantId: TENANT, projectId: "p", category: "c", filename: "f", bytes: BYTES });
  const c = uploadKeyFor({
    tenantId: TENANT, projectId: "p", category: "c", filename: "f", bytes: Buffer.from("other"),
  });
  assert.equal(a, b, "the key must not depend on time or ordering");
  assert.notEqual(a, c);
  assert.ok(a.length <= 40, "must fit Drive's property size limit");
});

test("a failed idempotency lookup never becomes a duplicate upload", async () => {
  const { deps, calls } = fakeDrive({
    findByUploadKey: async () => {
      throw new Error("Google Drive download failed (503)");
    },
  });
  const error = await refusal(() => uploadDocumentToDrive(request(), deps));
  assert.equal(error.code, "transient");
  assert.equal(calls.upload, 0, "an unknown prior state must not be overwritten");
});

test("an earlier file that does not match is refused, not overwritten", async () => {
  const { deps, calls } = fakeDrive({
    findByUploadKey: async () => ({
      id: "drvOLD00000000", size: "999", sha256Checksum: "f".repeat(64),
      trashed: false, owners: [{ emailAddress: "institution@example.org" }],
    }),
  });
  const error = await refusal(() => uploadDocumentToDrive(request(), deps));
  assert.equal(error.code, "verification-failed");
  assert.equal(calls.upload, 0);
  assert.equal(calls.remove, 0, "an earlier file is never deleted by a later attempt");
  assert.equal(error.evidence.fileId, "drvOLD00000000", "the evidence names what to look at");
});

// --------------------------------------------------- verification gate
test("a checksum mismatch fails the upload and removes the file", async () => {
  const { deps, calls } = fakeDrive({ stored: { sha256Checksum: "a".repeat(64) } });
  const error = await refusal(() => uploadDocumentToDrive(request(), deps));
  assert.equal(error.code, "verification-failed");
  assert.equal(error.evidence.reason, "checksum");
  assert.equal(calls.remove, 1, "an unverifiable file must not be left behind");
});

test("a size mismatch fails the upload", async () => {
  const { deps } = fakeDrive({ stored: { size: "1" } });
  const error = await refusal(() => uploadDocumentToDrive(request(), deps));
  assert.equal(error.evidence.reason, "size");
});

test("a file Drive did not checksum is NOT accepted", async () => {
  // Google-native documents have no checksum. They must never pass as verified.
  const { deps } = fakeDrive({ stored: { sha256Checksum: undefined } });
  const error = await refusal(() => uploadDocumentToDrive(request(), deps));
  assert.equal(error.evidence.reason, "no-checksum");
});

test("a file owned by the WRONG account fails verification", async () => {
  const { deps, calls } = fakeDrive({ digestOf: () => "0000deadbeef" });
  const error = await refusal(() => uploadDocumentToDrive(request(), deps));
  assert.equal(error.evidence.reason, "owner");
  assert.equal(calls.remove, 1);
});

test("a trashed file fails verification", async () => {
  const { deps } = fakeDrive({ stored: { trashed: true } });
  const error = await refusal(() => uploadDocumentToDrive(request(), deps));
  assert.equal(error.evidence.reason, "trashed");
});

test("an interruption between upload and verification leaves actionable evidence", async () => {
  const { deps, calls } = fakeDrive({
    getMetadata: async () => {
      throw new Error("Google Drive download failed (503)");
    },
  });
  const error = await refusal(() => uploadDocumentToDrive(request(), deps));
  assert.equal(calls.upload, 1, "the bytes did land");
  assert.equal(error.evidence.orphan, true, "the sweep needs to know an orphan may exist");
  assert.ok(error.evidence.fileId, "and which file to look for");
});

test("a failed cleanup is reported as orphan-left, not as a clean failure", async () => {
  const { deps } = fakeDrive({
    stored: { sha256Checksum: "b".repeat(64) },
    remove: async () => {
      throw new Error("Google Drive download failed (403)");
    },
  });
  const error = await refusal(() => uploadDocumentToDrive(request(), deps));
  assert.equal(error.code, "orphan-left");
  assert.equal(error.evidence.orphan, true);
});

// -------------------------------------------------- failures and input
test("there is no path from a Drive failure into Replit storage", () => {
  const source = readFileSync(join(currentDir, "driveUpload.ts"), "utf8");
  const code = source.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  for (const forbidden of [
    "objectStorage", "savePrivateObject", "saveTenantPrivateObject",
    "downloadPrivateObject", "supabaseStorage", "fallback",
  ]) {
    assert.ok(!code.includes(forbidden), `driveUpload.ts must not reference ${forbidden}`);
  }
});

test("a revoked token is reported as auth-revoked, not as a retryable blip", async () => {
  const { deps } = fakeDrive({
    upload: async () => {
      throw new Error("invalid_grant");
    },
  });
  const error = await refusal(() => uploadDocumentToDrive(request(), deps));
  assert.equal(error.code, "auth-revoked");
});

test("rate limiting and outages are distinguished from permission denial", async () => {
  const cases: Array<[string, string]> = [
    ["Google Drive upload setup failed (429)", "rate-limited"],
    ["userRateLimitExceeded", "rate-limited"],
    ["Google Drive upload setup failed (500)", "transient"],
    ["Google Drive upload setup failed (403)", "denied"],
  ];
  for (const [message, code] of cases) {
    const { deps } = fakeDrive({
      upload: async () => {
        throw new Error(message);
      },
    });
    const error = await refusal(() => uploadDocumentToDrive(request(), deps));
    assert.equal(error.code, code, message);
  }
});

test("empty and malformed input is refused before anything leaves the process", async () => {
  const { deps, calls } = fakeDrive();
  await refusal(() => uploadDocumentToDrive(request({ bytes: Buffer.alloc(0) }), deps));
  await refusal(() => uploadDocumentToDrive(request({ filename: "   " }), deps));
  await refusal(() => uploadDocumentToDrive(request({ projectId: "" }), deps));
  assert.equal(calls.upload, 0);
  assert.equal(calls.find, 0);
});

test("duplicate names get a deterministic suffix, unique names are untouched", () => {
  const key = "abcdef0123456789";
  assert.equal(disambiguate("تقرير.pdf", key, false), "تقرير.pdf");
  assert.equal(disambiguate("تقرير.pdf", key, true), "تقرير (abcdef).pdf");
  assert.equal(
    disambiguate("تقرير.pdf", key, true),
    disambiguate("تقرير.pdf", key, true),
    "the same input must always produce the same name",
  );
  assert.equal(disambiguate("noext", key, true), "noext (abcdef)");
});

test("the app requests the non-sensitive drive.file scope, never the restricted one", () => {
  const source = readFileSync(join(currentDir, "tenantDrive.ts"), "utf8");
  const declared = source.match(/const DRIVE_SCOPE = "([^"]+)";/);
  assert.ok(declared, "DRIVE_SCOPE must be declared exactly once");
  assert.equal(declared![1], "https://www.googleapis.com/auth/drive.file");
  // the restricted scope would force Google verification and a CASA audit
  assert.notEqual(declared![1], "https://www.googleapis.com/auth/drive");
});
test("the provider switch lives in exactly ONE module, not in the routes", () => {
  // Phase 18BS moved it out of attachments.ts: nine routes each owning a
  // copy of this branch is how two providers drift apart.
  const store = readFileSync(join(currentDir, "storeDocument.ts"), "utf8");
  assert.equal((store.match(/isEnabled\(/g) ?? []).length, 1,
    "one decision, in storeTenantDocument");
  const routes = join(currentDir, "..", "routes", "sa");
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name))
      : e.name.endsWith(".ts") ? [join(dir, e.name)] : []));
  for (const file of walk(routes)) {
    const source = readFileSync(file, "utf8");
    // A route MAY read the flag for policy - attachments uses it to refuse
    // an external storage reference once Drive is authoritative - but it
    // must never use it to choose where a file is written. Every reading
    // in a route has to be a driveEnabled: argument, never a branch.
    for (const line of source.split(String.fromCharCode(10))) {
      if (!/directDriveUploadEnabled\s*\(/.test(line)) continue;
      assert.ok(/driveEnabled:/.test(line) || /^import/.test(line.trim()),
        `${file} reads the flag outside a policy argument: ${line.trim()}`);
    }
    assert.ok(!/uploadDocumentToDrive\s*\(/.test(source),
      `${file} must not call the Drive uploader directly`);
  }
});