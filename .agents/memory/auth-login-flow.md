---
name: Auth & Login Flow
description: How employee and manager login works in Smart Archive
---

## Login — Two Sides

### Employee Side
- Logs in with: **email** (the one invited by admin) + **password** (set during accept-invite page)
- Uses Supabase Auth
- After login: if `status = pending` → blocked, sees waiting screen. If `status = active` → enters system.
- Forgotten-password recovery uses Supabase Auth recovery links and applies only to employee email accounts. The separate local manager login is intentionally excluded.
**Why:** Supabase provides expiring, single-use recovery tokens tied to the employee account, while the local manager account follows a separate authentication design.
**How to apply:** Keep employee password recovery on the public recovery pages; do not route the local manager credentials through Supabase recovery.

### Manager Side ("جهة داري")
- Separate login using **username + password** (not email)
- Manager credentials: username `admin`, password `admin123`
- The manager has full control: invite users, approve or reject pending accounts, assign roles, and perform final deletion.
**Why:** The product uses one clear administrator role; the separate super-admin role is intentionally removed.

## User Flow (full)
Invite (by manager) → Employee receives magic link → `/accept-invite` page → sets password → status = `pending` → Manager approves or rejects in Users panel → status = `active` → employee can login

## Profiles Table
- `id` (ref auth.users), `email`, `role`, `status`
- Trigger auto-inserts into profiles on new auth.users row with status=`pending`
- Roles: `admin`, `data_entry`, `viewer`. The legacy `employee` role is treated as `data_entry`.

## Permission policy
- `admin`: complete control, including user management and final deletion.
- `data_entry`: view, print, upload, create, and edit; cannot delete.
- `viewer`: view and print only.
**Why:** Architectural archive data must be protected from accidental deletion while still allowing controlled operational entry.
**How to apply:** Any new write or destructive feature must enforce these roles on both its UI and API, and successful actions should appear in the audit log with actor and timestamp.

## Supabase
- URL stored in env var: `SUPABASE_URL` and `VITE_SUPABASE_URL`
- Anon key: `VITE_SUPABASE_ANON_KEY`
- Service role key: `SUPABASE_SERVICE_ROLE_KEY` (used only in api-server for admin ops like inviteUserByEmail)

## Signed session alignment

Archive features that protect private data, including employee messaging, must use the server-signed archive session and send credentials explicitly from the PWA.

**Why:** Browser `sessionStorage` can still show an active user while a narrowly scoped or missing server Cookie causes protected requests to return 401.

**How to apply:** Scope the archive Cookie to `/`, use `credentials: "include"` on API calls, and let Supabase users re-exchange their active access token if a protected request loses its Cookie.
