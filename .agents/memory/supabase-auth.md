---
name: Supabase Auth Integration
description: How Supabase Auth is wired into the smart-archive API server and frontend, including security decisions made.
---

## Architecture
- **Frontend**: `artifacts/smart-archive/src/lib/supabase.ts` — Supabase client using VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
- **Backend**: `artifacts/api-server/src/lib/supabase.ts` — anon client for JWT verification, admin client (requires SUPABASE_SERVICE_ROLE_KEY) for management
- **Auth middleware**: `artifacts/api-server/src/middleware/auth.ts` — `requireAuth`, `requireRole`, `softAuth`

## Security decisions

**Global route protection**: `requireAuth` is applied at the SA router level in `index.ts` before all subrouters. This means every `/api/sa/*` route requires a valid Supabase JWT.

**Audit header hardening**: After `requireAuth` succeeds, a middleware in `index.ts` overwrites `x-user-id` and `x-user-label` headers with values from `req.authUser`. This prevents the existing route handlers from trusting client-supplied headers for audit attribution.

**Role hierarchy**: Enforced in `users.ts` via `canActorAssignRole()`:
- Only `super_admin` can assign/modify `super_admin` or `admin` roles
- `admin` can only invite/manage `employee` accounts
- `super_admin` accounts cannot be deleted
- Self-deletion is prevented

**Auto-promotion**: The first user whose Gmail matches `ADMIN_EMAIL` env var gets auto-created as `super_admin` in the `profiles` table on their first login.

## Required env vars
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` — set as non-secrets (public Supabase config)
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — same values but with VITE_ prefix for frontend
- `SUPABASE_SERVICE_ROLE_KEY` — Replit Secret, needed for invite + user management
- `ADMIN_EMAIL` — Replit Secret, the super admin's Gmail

## Supabase dashboard setup needed
1. Run SQL in `SUPABASE_SETUP.md` to create `profiles` table + RLS policies
2. Enable Google provider in Authentication → Providers
3. Add redirect URL: `https://<domain>/smart-archive/auth/callback`

**Why:** Without these steps, auth works (ANON_KEY suffices for JWT verification) but invites and user management return 503.
