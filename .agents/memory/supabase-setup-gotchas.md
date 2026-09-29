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

## `DATABASE_URL` / `PGUSER` / `PGDATABASE` are Replit's own Postgres, not Supabase
This project has both a Replit-managed Postgres (host contains "helium") and a separate Supabase project (used for real app data, e.g. `*.supabase.co`). The workspace's standard Postgres env vars point at the Replit database, which is unrelated/unused here — they cannot be used to run DDL against the Supabase project.

**Why:** Confirmed via direct env inspection that `DATABASE_URL` resolves to a completely different host than `VITE_SUPABASE_URL`. Only `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `VITE_SUPABASE_ANON_KEY` are available for the real Supabase project — there is no Supabase Postgres password/connection string exposed, so SQL DDL against Supabase cannot be run programmatically and must be pasted into the Supabase SQL Editor by the user.

**How to apply:** Before assuming `DATABASE_URL` reaches the app's real database in this project, check which host it points to. When schema changes are needed against Supabase, prepare the SQL and ask the user to run it in the Supabase SQL Editor rather than trying to execute it via a Postgres client/connection string.

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
