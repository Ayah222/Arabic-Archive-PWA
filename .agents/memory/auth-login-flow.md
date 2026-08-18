---
name: Auth & Login Flow
description: How login works for employees vs admin/super-admin in Smart Archive
---

## Login — Two Sides

### Employee Side
- Logs in with: **email** (the one invited by admin) + **password** (set during accept-invite page)
- Uses Supabase Auth
- After login: if `status = pending` → blocked, sees waiting screen. If `status = active` → enters system.

### Admin / Super Admin Side ("جهة داري")
- Separate login using **username + password** (not email)
- Current test credentials: username `Admin`, password `shAdmin123` — **do not change**
- Super Admin has full control: invite users, approve pending accounts, assign roles

## User Flow (full)
Invite (by super admin) → Employee receives magic link → `/accept-invite` page → sets password → status = `pending` → Super Admin approves in Users panel → status = `active` → employee can login

## Profiles Table
- `id` (ref auth.users), `email`, `role`, `status`
- Trigger auto-inserts into profiles on new auth.users row with status=`pending`
- Roles: `super_admin`, `admin`, `employee`

## Supabase
- URL stored in env var: `SUPABASE_URL` and `VITE_SUPABASE_URL`
- Anon key: `VITE_SUPABASE_ANON_KEY`
- Service role key: `SUPABASE_SERVICE_ROLE_KEY` (used only in api-server for admin ops like inviteUserByEmail)
