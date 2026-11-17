// Guards the Phase 18CD safety correction.
//
// The hazard was not a bug in logic - it was an automatic command wired into a
// merge hook. Logic tests cannot catch that coming back, so these tests read
// the real repository files and exercise the real guard against fixtures.
//
// Touches no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// artifacts/api-server/test -> repository root
const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const POST_MERGE = join(ROOT, "scripts", "post-merge.sh");
const GUARD = join(ROOT, "scripts", "guard-db-push.mjs");
const DB_PKG = join(ROOT, "lib", "db", "package.json");

const runGuard = (cwd) => {
  try {
    const stdout = execFileSync(process.execPath, [join(cwd, "scripts", "guard-db-push.mjs")], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.status ?? 1, out: (error.stdout ?? "") + (error.stderr ?? "") };
  }
};

/** A throwaway copy of the guard plus a schema directory we control. */
function fixture(schemaSource) {
  const dir = mkdtempSync(join(tmpdir(), "guardfix-"));
  mkdirSync(join(dir, "scripts"), { recursive: true });
  mkdirSync(join(dir, "lib", "db", "src", "schema"), { recursive: true });
  cpSync(GUARD, join(dir, "scripts", "guard-db-push.mjs"));
  if (schemaSource !== null) {
    writeFileSync(join(dir, "lib", "db", "src", "schema", "index.ts"), schemaSource);
  }
  return dir;
}

// ------------------------------------------------ the merge hook itself
test("the post-merge hook runs NO database command", () => {
  const hook = readFileSync(POST_MERGE, "utf8");
  // Only the executable lines matter; the comment block deliberately quotes
  // the dangerous command to explain why it was removed.
  const code = hook.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  for (const line of code) {
    assert.ok(
      !/drizzle|db\s+push|push-force|psql|migrate|DATABASE_URL/i.test(line),
      `the merge hook must not touch the database, found: ${line}`,
    );
  }
});

test("the post-merge hook still installs dependencies", () => {
  const hook = readFileSync(POST_MERGE, "utf8");
  assert.match(hook, /pnpm install --frozen-lockfile/,
    "removing the push must not also remove dependency installation");
});

test("no automatic hook or workflow invokes a schema push", () => {
  // .replit is the only place Replit reads hooks and workflows from.
  const replit = readFileSync(join(ROOT, ".replit"), "utf8");
  const referenced = [...replit.matchAll(/path\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  for (const relative of referenced) {
    let source;
    try {
      source = readFileSync(join(ROOT, relative), "utf8");
    } catch {
      continue; // a hook pointing at a file that does not exist cannot run one
    }
    const code = source.split("\n").map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    for (const line of code) {
      assert.ok(!/drizzle-kit|db\s+push|push-force/i.test(line),
        `${relative} is wired into .replit and must not push a schema: ${line}`);
    }
  }
});

// ------------------------------------------------------ the guard wiring
test("both push scripts are gated by the guard", () => {
  const pkg = JSON.parse(readFileSync(DB_PKG, "utf8"));
  for (const name of ["push", "push-force"]) {
    assert.ok(pkg.scripts[name], `the ${name} script should still exist`);
    assert.ok(pkg.scripts[name].startsWith("node ../../scripts/guard-db-push.mjs &&"),
      `${name} must run the guard FIRST, and only proceed on success: ${pkg.scripts[name]}`);
  }
});

// -------------------------------------------- the guard, against fixtures
test("the guard REFUSES a schema that declares no tables", () => {
  const dir = fixture("export {};\n");
  try {
    const { code, out } = runGuard(dir);
    assert.equal(code, 1, "an empty schema must be refused");
    assert.match(out, /drop every table/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the guard REFUSES a pgTable that is only inside a comment", () => {
  // This is the real repository's current state, and the trap: the template
  // schema looks populated to a naive grep.
  const dir = fixture([
    "// export const postsTable = pgTable(\"posts\", {",
    "//   id: serial(\"id\").primaryKey(),",
    "// });",
    "/* pgTable(\"also_not_real\", {}) */",
    "export {};",
  ].join("\n"));
  try {
    const { code } = runGuard(dir);
    assert.equal(code, 1, "a commented-out table is not a declared table");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the guard ALLOWS a schema that really declares tables", () => {
  const dir = fixture([
    "import { pgTable, text } from \"drizzle-orm/pg-core\";",
    "export const projects = pgTable(\"projects\", { name: text(\"name\") });",
    "export const files = pgTable(\"files\", { path: text(\"path\") });",
  ].join("\n"));
  try {
    const { code, out } = runGuard(dir);
    assert.equal(code, 0, "a real schema must not be blocked");
    assert.match(out, /declares 2 table\(s\): files, projects/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the guard FAILS SAFE when the schema cannot be read", () => {
  const dir = fixture(null); // directory exists, no files in it
  try {
    const { code } = runGuard(dir);
    assert.equal(code, 1, "an unreadable schema is not evidence that a push is safe");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the guard touches no database", () => {
  const source = readFileSync(GUARD, "utf8");
  for (const forbidden of ["pg", "postgres", "DATABASE_URL", "drizzle-kit", "connect"]) {
    const code = source.split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
      .join("\n");
    assert.ok(!new RegExp(`\\b${forbidden}\\b`).test(code),
      `the guard must not reference ${forbidden} in executable code`);
  }
});

test("no source file carries a literal NUL byte", () => {
  // A real NUL in source makes grep treat the file as binary and refuse
  // to print matching lines, which silently weakens every text-based
  // scan run over the release - including the secret scan. It has
  // happened once before, in driveUpload.ts. Write it as
  // String.fromCharCode(0) when a test needs the character itself.
  const roots = [join(ROOT, "artifacts", "api-server", "src"),
                 join(ROOT, "artifacts", "api-server", "test")];
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|mts|cts|js|mjs|cjs|json|sql|sh)$/.test(entry.name)) continue;
      if (readFileSync(full).includes(0)) offenders.push(full);
    }
  };
  for (const r of roots) walk(r);
  assert.deepEqual(offenders, [], `literal NUL bytes found in: ${offenders.join(", ")}`);
});
