// Tests for the client-supplied storage reference guard.
//
// The attack this blocks: an authenticated user of any tenant posts an
// attachment with no file and storagePath = "<someone else's key>". The row
// is tenant-scoped so every later check passes - the attacker owns it - and
// the download hands that string to the SERVICE-ROLE Supabase client.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  StorageReferenceError,
  assertClientStoragePath,
  isSafeStorageKey,
  storageReferenceStatus,
} from "./attachmentReference";

const currentDir = dirname(fileURLToPath(import.meta.url));
const PROJECT = "62146f8d-0598-4a11-9f00-000000000001";
const ENTITY = "letter";
const ok = `attachments/${PROJECT}/${ENTITY}/عقد.pdf`;

const call = (storagePath: unknown, driveEnabled = false) =>
  assertClientStoragePath({ storagePath, projectId: PROJECT, entityType: ENTITY, driveEnabled });

function refusal(fn: () => unknown): StorageReferenceError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof StorageReferenceError, `expected StorageReferenceError, got ${error}`);
    return error;
  }
  throw new assert.AssertionError({ message: "expected a refusal" });
}

test("a legitimate in-project reference is still accepted", () => {
  assert.equal(call(ok), ok);
  assert.equal(call(`attachments/${PROJECT}/${ENTITY}/sub folder/تقرير (1).pdf`),
    `attachments/${PROJECT}/${ENTITY}/sub folder/تقرير (1).pdf`);
});

test("a reference outside this project is refused", () => {
  const other = "62146f8d-0598-4a11-9f00-999999999999";
  const error = refusal(() => call(`attachments/${other}/${ENTITY}/secret.pdf`));
  assert.equal(error.code, "outside-project");
  assert.equal(storageReferenceStatus(error.code), 400);
});

test("a reference outside this entity type is refused", () => {
  assert.equal(refusal(() => call(`attachments/${PROJECT}/contract/x.pdf`)).code, "outside-project");
});

test("traversal, absolute and encoded paths are refused", () => {
  for (const nasty of [
    "../../../etc/passwd",
    `attachments/${PROJECT}/${ENTITY}/../../../other/secret.pdf`,
    `/attachments/${PROJECT}/${ENTITY}/x.pdf`,
    `attachments/${PROJECT}/${ENTITY}//x.pdf`,
    `attachments\\${PROJECT}\\${ENTITY}\\x.pdf`,
    `attachments/${PROJECT}/${ENTITY}/.`,
    `attachments/${PROJECT}/${ENTITY}/..`,
  ]) {
    const error = refusal(() => call(nasty));
    assert.ok(["invalid-path", "outside-project"].includes(error.code), nasty);
  }
});

test("a NUL byte in the path is refused", () => {
  assert.equal(isSafeStorageKey(`attachments/${PROJECT}/${ENTITY}/x${String.fromCharCode(0)}.pdf`), false);
});

test("non-strings, empties and absurd lengths are refused", () => {
  for (const bad of [null, undefined, 42, {}, [], "", "   ", "x".repeat(2000)]) {
    assert.equal(isSafeStorageKey(bad), false, String(bad).slice(0, 20));
    refusal(() => call(bad));
  }
});

test("a path with too many segments is refused", () => {
  const deep = `attachments/${PROJECT}/${ENTITY}/` + Array.from({ length: 30 }, () => "a").join("/");
  assert.equal(isSafeStorageKey(deep), false);
});

test("once Drive is the provider, an external reference is refused outright", () => {
  const error = refusal(() => call(ok, true));
  assert.equal(error.code, "provider-mismatch");
  assert.equal(storageReferenceStatus(error.code), 409);
});

test("the refusal names no path, no bucket and no tenant", () => {
  const error = refusal(() => call("attachments/someone-else/letter/payroll.pdf"));
  assert.ok(!error.message.includes("someone-else"));
  assert.ok(!error.message.includes("payroll"));
  assert.ok(!error.message.toLowerCase().includes("bucket"));
});

test("the route validates BEFORE it creates the row", () => {
  const source = readFileSync(join(currentDir, "..", "routes", "sa", "attachments.ts"), "utf8");
  const guard = source.indexOf("assertClientStoragePath(");
  const create = source.indexOf("objectPath: supabaseObjectPath(");
  assert.ok(guard > 0 && create > 0, "both must be present");
  assert.ok(guard < create, "a row must never be written from an unchecked path");
  assert.ok(!/supabaseObjectPath\(String\(req\.body\.storagePath\)\)/.test(source),
    "the raw client value must never reach supabaseObjectPath again");
});

test("Supabase writes remain impossible regardless of this change", () => {
  const source = readFileSync(join(currentDir, "supabaseStorage.ts"), "utf8");
  const fn = source.slice(source.indexOf("export async function uploadSupabaseObject"));
  assert.ok(/throw new Error\(SUPABASE_STORAGE_DISABLED_MESSAGE\)/.test(fn.slice(0, 400)),
    "uploadSupabaseObject must stay a hard-disabled stub");
});
