#!/usr/bin/env node
// Refuses a drizzle-kit push that would be a mass delete.
//
// "drizzle-kit push" makes the database match the declared schema. When the
// schema declares no tables, matching it means dropping every table that
// exists. The Drizzle schema in this repo is still the generated template, so
// today both push scripts are destructive-only - and "push-force" skips the
// confirmation prompt entirely.
//
// This guard does not migrate anything and never touches a database. It reads
// the schema and refuses when a push could only destroy. If real tables are
// ever declared here, it steps out of the way.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "lib", "db", "src", "schema");

function fail(message) {
  console.error("REFUSED: " + message);
  console.error(
    "\n  A push against a schema that declares no tables is a mass delete, not a\n"
    + "  no-op. If you need a schema change, write SQL and apply it deliberately.\n"
    + "  If you have just added real tables to lib/db/src/schema, this guard will\n"
    + "  pass on its own.",
  );
  process.exit(1);
}

/** Strip comments so a pgTable inside a comment is not mistaken for a declaration. */
function stripComments(source) {
  // Block comments first, then line comments. Neither appears inside a string
  // literal in this schema, and a false strip can only make the guard stricter.
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|mts|cts|js|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(SCHEMA_DIR);
} catch (error) {
  // Fail safe. An unreadable schema is not evidence that a push is harmless.
  fail(`the Drizzle schema directory could not be read (${SCHEMA_DIR}): ${error.message}`);
}

if (files.length === 0) fail(`no schema source files found under ${SCHEMA_DIR}`);

const declared = new Set();
for (const file of files) {
  const source = stripComments(readFileSync(file, "utf8"));
  for (const match of source.matchAll(/pgTable\s*\(\s*["'`]([^"'`]+)["'`]/g)) {
    declared.add(match[1]);
  }
}

if (declared.size === 0) {
  fail("the Drizzle schema declares no tables, so this push would drop every table in the database");
}

console.log(`drizzle schema declares ${declared.size} table(s): ${[...declared].sort().join(", ")}`);
