// Tests for the one storage decision and the namespace folder mapper.
//
// The point of these is narrow and important: with the flag OFF every one of
// the nine upload sites must behave EXACTLY as it did before, and with the
// flag ON a Drive failure must never become a Replit write.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { storeTenantDocument, type StoreDeps, type StoreRequest } from "./storeDocument";
import {
  KNOWN_NAMESPACES,
  folderSegmentsForNamespace,
  projectFolderName,
  sanitiseSegment,
} from "./driveDestination";
import { DriveUploadError, type DriveObject, type UploadDeps } from "./driveUpload";

const currentDir = dirname(fileURLToPath(import.meta.url));
const TENANT = "e7c9121b-2450-402f-be8d-07bd65fa0156";
const OWNER = "fb086ffd3438";
const BYTES = Buffer.from("محتوى تجريبي", "utf8");

const request = (over: Partial<StoreRequest> = {}): StoreRequest => ({
  tenantId: TENANT,
  namespace: "attachments",
  filename: "عقد.pdf",
  bytes: BYTES,
  contentType: "application/pdf",
  segments: ["p1", "letter"],
  destination: { projectId: "62146f8d-0598", projectLabel: "مشروع المدينة", category: "letter" },
  ...over,
});

function deps(enabled: boolean, driveOver: Partial<UploadDeps> = {}) {
  const calls = {
    replit: 0, drive: 0,
    replitArgs: [] as Array<Record<string, unknown>>,
    driveArgs: [] as Array<Record<string, unknown>>,
  };
  const uploadDeps: UploadDeps = {
    isEnabled: () => true,
    findByUploadKey: driveOver.findByUploadKey ?? (async () => null),
    upload: driveOver.upload ?? (async (input) => {
      calls.drive += 1;
      calls.driveArgs.push({ ...input, bytes: input.bytes.length });
      return { objectName: "drive://drvFILE000001" };
    }),
    getMetadata: driveOver.getMetadata ?? (async (): Promise<DriveObject> => ({
      id: "drvFILE000001", name: "عقد.pdf", mimeType: "application/pdf",
      size: String(BYTES.length),
      sha256Checksum: createHash("sha256").update(BYTES).digest("hex"),
      trashed: false, owners: [{ emailAddress: "inst@example.org" }],
    })),
    remove: driveOver.remove ?? (async () => {}),
    expectedOwnerDigest: OWNER,
    digestOf: () => OWNER,
  };
  const store: StoreDeps = {
    isEnabled: () => enabled,
    saveToObjectStorage: async (input) => {
      calls.replit += 1;
      calls.replitArgs.push({ ...input, bytes: input.bytes.length });
      return { objectName: `app/${input.tenantId}/${input.namespace}/x.bin` };
    },
    uploadDeps,
    urlFor: (name) => (name.startsWith("drive://")
      ? `/api/sa/storage/files/${name.slice(8)}`
      : `/api/sa/files/${Buffer.from(name, "utf8").toString("base64url")}`),
  };
  return { store, calls };
}

// ------------------------------------------------------------- flag OFF
test("with the flag OFF every namespace still writes to Replit, unchanged", async () => {
  for (const namespace of KNOWN_NAMESPACES) {
    const { store, calls } = deps(false);
    const out = await storeTenantDocument(request({ namespace }), store);
    assert.equal(calls.replit, 1, namespace);
    assert.equal(calls.drive, 0, `${namespace} must not reach Drive`);
    assert.ok(out.objectName.startsWith("app/"), namespace);
    assert.equal(out.verified, false);
  }
});

test("the OFF branch passes the ORIGINAL arguments through untouched", async () => {
  const { store, calls } = deps(false);
  await storeTenantDocument(request(), store);
  assert.deepEqual(calls.replitArgs[0], {
    tenantId: TENANT,
    namespace: "attachments",
    filename: "عقد.pdf",
    bytes: BYTES.length,
    contentType: "application/pdf",
    segments: ["p1", "letter"],
  });
  // the Drive-only field must NOT leak into the object-storage call
  assert.ok(!("destination" in (calls.replitArgs[0] as object)));
});

// -------------------------------------------------------------- flag ON
test("with the flag ON a document goes to Drive and is verified", async () => {
  const { store, calls } = deps(true);
  const out = await storeTenantDocument(request(), store);
  assert.equal(calls.drive, 1);
  assert.equal(calls.replit, 0, "no Replit write may happen when Drive is in use");
  assert.ok(out.objectName.startsWith("drive://"));
  assert.equal(out.verified, true);
  assert.ok(out.sha256);
});

test("a Drive failure NEVER becomes a Replit write", async () => {
  for (const failure of [
    async () => { throw new Error("Google Drive upload setup failed (500)"); },
    async () => { throw new Error("invalid_grant"); },
    async () => { throw new Error("Google Drive upload setup failed (429)"); },
  ]) {
    const { store, calls } = deps(true, { upload: failure as UploadDeps["upload"] });
    await assert.rejects(() => storeTenantDocument(request(), store), DriveUploadError);
    assert.equal(calls.replit, 0, "a silent fallback would misreport where the file is");
  }
});

test("an unverifiable Drive upload fails rather than being recorded", async () => {
  const { store, calls } = deps(true, {
    getMetadata: async () => ({
      id: "drvFILE000001", size: "9999", sha256Checksum: "f".repeat(64),
      trashed: false, owners: [{ emailAddress: "inst@example.org" }],
    }),
  });
  await assert.rejects(() => storeTenantDocument(request(), store), DriveUploadError);
  assert.equal(calls.replit, 0);
});

test("each namespace lands in its own Drive folder", async () => {
  const expected: Record<string, string> = {
    attachments: "01 Projects",
    hr: "02 HR",
    "email-archive": "03 Email Archive",
    agencies: "04 Agencies",
    "project-photos": "01 Projects",
    uploads: "09 Uploads",
  };
  for (const namespace of KNOWN_NAMESPACES) {
    const { store, calls } = deps(true);
    await storeTenantDocument(request({ namespace }), store);
    const segments = calls.driveArgs[0].folderSegments as string[];
    assert.equal(segments[0], expected[namespace], namespace);
  }
});

// ------------------------------------------------------- the folder mapper
test("HR documents are never filed under a project", () => {
  const segments = folderSegmentsForNamespace("hr", { projectId: "p1", category: "contracts" });
  assert.equal(segments[0], "02 HR");
  assert.ok(!segments.join("/").includes("01 Projects"),
    "filing HR under a project would expose it to that project's viewers");
});

test("a project folder carries its id so a rename stays cosmetic", () => {
  const a = projectFolderName("62146f8d-0598-4a11", "مشروع المدينة");
  const b = projectFolderName("62146f8d-0598-4a11", "اسم مختلف تماماً");
  assert.ok(a.endsWith("(62146f8d)"));
  assert.ok(b.endsWith("(62146f8d)"), "the id is what identifies the folder");
  assert.notEqual(a, b);
});

test("a missing project label still produces a usable folder", () => {
  assert.equal(projectFolderName("62146f8d-0598", undefined), "Project 62146f8d");
  assert.equal(projectFolderName("", ""), "Project unknown");
});

test("no segment can traverse, escape or be empty", () => {
  for (const nasty of ["../../etc", "..", ".", "", "a/b/c", "   "]) {
    const cleaned = sanitiseSegment(nasty, "fallback");
    assert.ok(!cleaned.includes("/"), nasty);
    assert.notEqual(cleaned, "..");
    assert.notEqual(cleaned, ".");
    assert.ok(cleaned.length > 0, nasty);
  }
  for (const namespace of [...KNOWN_NAMESPACES, "something-unknown"]) {
    for (const segment of folderSegmentsForNamespace(namespace, {
      projectId: "../p", projectLabel: "../../x", category: "..",
    })) {
      assert.ok(!segment.includes("/"), `${namespace}: ${segment}`);
      assert.ok(segment.trim().length > 0);
    }
  }
});

test("an unknown namespace lands somewhere predictable, not at the root", () => {
  const segments = folderSegmentsForNamespace("brand-new-thing", {});
  assert.equal(segments[0], "09 Uploads");
  assert.ok(segments.length >= 2, "never a bare root-level file");
});

test("Arabic names and extensions survive the sanitiser", () => {
  assert.equal(sanitiseSegment("مشروع المدينة المنورة", "x"), "مشروع المدينة المنورة");
  assert.equal(sanitiseSegment("01 Contracts", "x"), "01 Contracts");
});

// ------------------------------------------- every write site uses the one
test("NO route writes to object storage directly any more", () => {
  const routes = join(currentDir, "..", "routes", "sa");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else if (entry.name.endsWith(".ts")) files.push(join(dir, entry.name));
    }
  };
  walk(routes);
  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (/\bsaveTenantPrivateObject\s*\(/.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, [],
    "every upload must go through storeTenantDocument, or the providers diverge");
});

test("the store module cannot fall back to object storage on a Drive error", () => {
  const source = readFileSync(join(currentDir, "storeDocument.ts"), "utf8");
  const code = source.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  assert.ok(!/catch/.test(code), "a catch here could only be used to fall back");
  // compare the CALL sites inside the function, not the import line
  const body = code.slice(code.indexOf("export async function storeTenantDocument"));
  const replitAt = body.indexOf("deps.saveToObjectStorage(");
  const driveAt = body.indexOf("await uploadDocumentToDrive(");
  assert.ok(replitAt >= 0 && driveAt >= 0, "both branches must exist");
  assert.ok(replitAt < driveAt, "the Replit branch returns before Drive is reached");
});
