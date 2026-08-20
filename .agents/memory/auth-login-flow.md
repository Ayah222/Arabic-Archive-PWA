---
name: Auth & Login Flow
description: How employee and manager login works in Smart Archive
---

## Login — Two Sides

### Employee Side
- Logs in with: **email** (the one invited by admin) + **password** (set during accept-invite page)
- Uses Supabase Auth
- After login: if `status = pending` → blocked, sees waiting screen. If `status = active` → enters system.

### Manager Side ("جهة داري")
- Separate login using **username + password** (not email)
- Manager credentials: username `admin`, password `admin123`
- The manager has full control: invite users, approve or reject pending accounts, and assign Manager/Employee roles.
**Why:** The product uses one clear administrator role; the separate super-admin role is intentionally removed.

## User Flow (full)
Invite (by manager) → Employee receives magic link → `/accept-invite` page → sets password → status = `pending` → Manager approves or rejects in Users panel → status = `active` → employee can login

## Profiles Table
- `id` (ref auth.users), `email`, `role`, `status`
- Trigger auto-inserts into profiles on new auth.users row with status=`pending`
- Roles: `admin`, `employee`

## Supabase
- URL stored in env var: `SUPABASE_URL` and `VITE_SUPABASE_URL`
- Anon key: `VITE_SUPABASE_ANON_KEY`
- Service role key: `SUPABASE_SERVICE_ROLE_KEY` (used only in api-server for admin ops like inviteUserByEmail)
