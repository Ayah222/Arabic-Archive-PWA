---
name: Supabase-js unwrap() typing
description: TypeScript inference gotcha when wrapping the untyped supabase-js client's single-row query results.
---

## Explicit generics needed on single-row `unwrap()` calls

When using `@supabase/supabase-js` without generated database types, a shared `unwrap(result)` helper around `.single()` / insert / update calls returns an ambiguous/untyped shape. `tsc --noEmit` fails to infer the row type at call sites that then access specific fields.

**Why:** Hit ~10 such call sites failing typecheck in one file after migrating mock in-memory data to Supabase-backed CRUD functions. Adding an explicit generic argument, e.g. `unwrap<Record<string, unknown>>(...)`, resolved all of them without touching the helper itself.

**How to apply:** When writing Supabase CRUD functions against an untyped client, pass an explicit type argument to any shared unwrap/result-parsing helper at single-row call sites (insert `.select().single()`, update `.select().single()`, etc.) rather than relying on inference.
