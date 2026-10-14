---
name: Auth & Login Flow
description: How employee and manager login works in Smart Archive
---

## Login — Two Sides

### Employee Side
- Logs in with: **email** and the temporary password created by an organization admin (or the employee's later password)
- Uses Supabase Auth
- After login: if `status = pending` → blocked, sees waiting screen. If `status = active` → enters system.
- Forgotten-password recovery uses Supabase Auth recovery links and applies only to employee email accounts. The separate local manager login is intentionally excluded.
**Why:** Supabase provides expiring, single-use recovery tokens tied to the employee account, while the local manager account follows a separate authentication design.
**How to apply:** Keep employee password recovery on the public recovery pages; do not route the local manager credentials through Supabase recovery.

### Manager Side ("جهة داري")
- Separate login using environment-configured **username + password** (not email)
- The local system manager has system-wide administration: can view and switch across every organization, create users in the selected organization, and manage its users. Employee `admin` memberships remain scoped to their organizations.
**Why:** The owner requires the management account to administer every organization while preserving tenant isolation for ordinary accounts.
**How to apply:** Grant the global bypass only through the signed local-manager login; never infer system-admin status from a client-supplied role or grant it to Supabase-authenticated employees.

## User Flow (full)
An organization admin creates an employee directly with a temporary password → Supabase Auth account is email-confirmed by the admin API → profile and active membership are attached to the admin's tenant → employee logs in with email and password. No invitation or confirmation email is sent.
**Why:** The owner explicitly chose immediate administrator-provisioned access to avoid Supabase's invitation email limits.
**How to apply:** Only use the verified signed admin session's tenant ID; never accept an organization ID from the client. Keep the service-role key server-side and do not return or log passwords.

## Profiles Table
- `id` (ref auth.users), `email`, `role`, `status`
- The current Supabase project has no `auth.users` trigger for profiles; the server account-creation route must create the active profile.
- Roles: `admin`, `data_entry`, `viewer`. The legacy `employee` role is treated as `data_entry`.

**Why:** The replacement Supabase project was inspected and had no profile-creation trigger, so Auth invitations alone do not create the row required by login and approval.

**How to apply:** Keep profile and membership tables inaccessible to browser roles; use the API's service-role client to create an active profile and tenant membership during direct account creation.

## Permission policy
- `admin`: complete control, including user management and final deletion.
- `data_entry`: view, print, upload, create, and edit; cannot delete.
- `viewer`: view and print only.
**Why:** Architectural archive data must be protected from accidental deletion while still allowing controlled operational entry.
**How to apply:** Any new write or destructive feature must enforce these roles on both its UI and API, and successful actions should appear in the audit log with actor and timestamp.

## One-organization membership and role enforcement
- A Supabase-authenticated account belongs to one organization only; the local system-admin identity `admin` is the sole exception and can switch organizations using its signed server session.
**Why:** The owner requires strict organization isolation while retaining one global platform administrator.
**How to apply:** Preserve the partial unique membership constraint for Supabase users, derive API permissions from the signed session rather than role headers, scope service-role queries to the session tenant, and keep RLS role-aware.

## Supabase
- URL stored in env var: `SUPABASE_URL` and `VITE_SUPABASE_URL`
- Anon key: `VITE_SUPABASE_ANON_KEY`
- Service role key: `SUPABASE_SERVICE_ROLE_KEY` (used only in api-server for admin account operations such as createUser)
- Supabase's built-in Auth email sender has a shared project-wide rate limit; only password recovery still depends on Auth email.
**Why:** Direct employee provisioning avoids invitation mail, but password recovery continues to use Supabase Auth's email provider.
**How to apply:** Configure custom SMTP if reliable password-recovery email is required; never send invite or account-creation emails from the new direct-provisioning flow.

## Signed session alignment

Archive features that protect private data, including employee messaging, must use the server-signed archive session and send credentials explicitly from the PWA.

**Why:** Browser `sessionStorage` can still show an active user while a narrowly scoped or missing server Cookie causes protected requests to return 401.

**How to apply:** Scope the archive Cookie to `/`, use `credentials: "include"` on API calls, and let Supabase users re-exchange their active access token if a protected request loses its Cookie.
