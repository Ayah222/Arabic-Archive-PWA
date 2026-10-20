---
name: Supabase setup gotchas
description: Non-obvious Postgres/Supabase quirks hit while writing SQL setup scripts and wiring the app to Supabase in this project.
---

## `CREATE POLICY IF NOT EXISTS` is invalid syntax
Postgres does not support `IF NOT EXISTS` on `CREATE POLICY`. For an idempotent/rerunnable RLS setup script, use `DROP POLICY IF EXISTS <name> ON <table>;` immediately followed by a plain `CREATE POLICY <name> ON <table> ...;` (works fine inside a `DO $$ ... FOREACH ... END $$` loop over table names).

**Why:** Hit this as a real syntax error when the user ran the generated `supabase-setup-archive.sql` in the Supabase SQL Editor. The fix let the script stay safely rerunnable.

**How to apply:** Any time you write or edit a Supabase/Postgres setup script that creates RLS policies and needs to be safely rerun.

## Storage object keys must be ASCII-safe
Supabase Storage can reject object keys containing Arabic or mojibake characters with `Invalid key`, even though the original uploaded file is valid. Keep the user-facing filename unchanged in metadata, but generate the storage key from an ASCII-safe filename.

**Why:** An Arabic `.xlsx` upload passed file validation but failed during Storage upload because the generated key contained non-ASCII characters.

**How to apply:** Sanitize only the storage path component; preserve the original filename for display and download metadata.

## Use the configured Supabase MCP for direct migrations
`DATABASE_URL` / `PGUSER` / `PGDATABASE` point to Replit-managed Postgres, not the app's Supabase database. This workspace has a Supabase MCP that can apply DDL migrations directly; do not assume the SQL Editor is the only path.

**Why:** The app connects through `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, while the Replit Postgres variables target a separate database. A clean-project migration was successfully applied through Supabase MCP and verified in the database and API runtime.

**How to apply:** Check the app's Supabase environment-variable precedence and confirm the MCP project is the active app project before making changes. Use `mcpSupabase_applyMigration` for DDL, then verify the migration record, expected tables/columns/policies, and API startup. Never use the Replit `DATABASE_URL` for Supabase DDL.

## Development and Production Supabase target
The user confirmed on 2026-10-20 that `VITE_SUPABASE_URL` in both Development and Production points to the active `ARCHIVE-AI` project in `eu-west-1`. Its project reference matches the non-secret URL configured in `.replit`.

**Why:** Supabase URLs are secrets in this workspace and their values must not be inspected. The user verified both environments directly after the visible project name and region were matched against the configured Supabase project.

**How to apply:** Do not change either environment's Supabase URL unless the user confirms a different target. Continue checking Development and Production separately without reading or printing secret values.

## The live Supabase schema may lag behind the setup SQL
Treat additive columns in the setup file as desired schema, not proof that the live Supabase table already has them. For persistent attachments, preserve compatibility with the legacy URL column when the newer object-path column is absent.

**Why:** The live attachment table accepted its older fields but rejected the newer object-path field through PostgREST, even though the checked-in setup SQL declared that field.

**How to apply:** When adding persistence fields, verify the live API behavior and either provide a safe backward-compatible path or give the user explicit SQL to apply in Supabase before relying exclusively on the new column.

## Managed migrations may omit table grants
Tables created through Supabase's managed migration API can have RLS enabled but no privileges for `service_role`, `anon`, or `authenticated`. Explicitly grant the roles required by each API path and verify them with `has_table_privilege`.

**Why:** The app returned `permission denied for table projects` after a successful schema migration; granting table and sequence privileges fixed API access.

**How to apply:** After creating tables with a managed migration API, add explicit `GRANT` statements to the migration and the checked-in setup SQL. Do not assume the SQL Editor's default grants also apply.

## Public execute on the automatic RLS event trigger
Some Supabase projects expose `public.rls_auto_enable()` with default `EXECUTE` privileges to `PUBLIC`, `anon`, and `authenticated`. If the security advisor flags it, inspect that it is the table-creation event trigger, then revoke direct execution without removing the trigger.

**Why:** A fresh project security check reported the function as an externally callable `SECURITY DEFINER`; revoking execute cleared the warning while leaving the automatic RLS behavior intact.

**How to apply:** Check for the function before revoking, then rerun the Supabase security advisor. Do not assume the function is present in every project.
