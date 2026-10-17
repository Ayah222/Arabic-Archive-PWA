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
- The recovery page must handle both PKCE `code` and `token_hash` links, subscribe to auth changes before checking the session, and recheck the session after an exchange error because Supabase may consume the code automatically.
**Why:** An unhandled duplicate/automatic code exchange could leave the page stuck in its checking state even when the recovery session was being established.
**How to apply:** Guard URL exchange and always finish loading; recognize the recovery event and verify the resulting session before enabling the new-password form.

### Manager Side ("جهة داري")
- Separate login using environment-configured **username + password** (not email)
- The local system manager has system-wide administration: can view and switch across every organization, create users in the selected organization, and manage its users. Employee `admin` memberships remain scoped to their organizations.
**Why:** The owner requires the management account to administer every organization while preserving tenant isolation for ordinary accounts.
**How to apply:** Grant the global bypass only through the signed local-manager login; never infer system-admin status from a client-supplied role or grant it to Supabase-authenticated employees.

## User Flow (full)
An organization admin creates an employee invitation → the system generates a one-time Supabase invite URL without sending email → the admin shares it manually → the employee chooses a password on `/accept-invite` → the API activates only that user's pending membership in the inviting admin's tenant.
**Why:** The owner chose manual link sharing to avoid paid SMTP, phone verification, and Supabase's built-in email rate limits.
**How to apply:** Do not claim the app emailed the invitation. Keep the one-time URL visible only to the inviting admin after creation; only use the verified signed admin session's tenant ID and activate only the matching pending profile and membership.

Invitation display names are archive profile data, not email sender branding; configure the sender identity separately through the Auth mail/SMTP settings.
**Why:** The owner wants the employee's chosen name shown inside the archive, without replacing the invitation's inbox sender identity with that name.
**How to apply:** Save the submitted name to the tenant user's archive profile; do not use it as Supabase Auth sender metadata or as a substitute for SMTP sender configuration.

## Profiles Table
- `id` (ref auth.users), `email`, `role`, `status`
- The current Supabase project has no `auth.users` trigger for profiles; the server account-creation route must create the active profile.
- Roles: `admin`, `data_entry`, `viewer`. The legacy `employee` role is treated as `data_entry`.

**Why:** The replacement Supabase project was inspected and had no profile-creation trigger, so Auth invitations alone do not create the row required by login and approval.

**How to apply:** Keep profile and membership tables inaccessible to browser roles; create pending profile and tenant membership when inviting, then activate them only after the authenticated invitee chooses a password.

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
- Supabase's built-in Auth email sender has a shared project-wide rate limit. Manual invitation links avoid that email sender; password recovery still depends on Auth email.
**Why:** The owner chose a no-cost invitation flow without linking a phone or configuring SMTP.
**How to apply:** Generate a Supabase invite link server-side and let the manager share it manually; keep service-role operations server-side and never send tenant invitations through the legacy workspace Gmail connection.
- Invitation redirects must use the public app origin and that exact destination must be allowed in Supabase Auth URL Configuration; custom email templates should use `{{ .RedirectTo }}` or `{{ .ConfirmationURL }}`, not a hardcoded `{{ .SiteURL }}` destination.
**Why:** Supabase's default Site URL can be a local development address, and a custom template that ignores the per-invite redirect can send invitees to localhost even when the server supplied the correct app URL.
**How to apply:** Keep the Site URL set to the current published app, allow its exact `/accept-invite` URL, and pass that public origin as `redirectTo` when generating invitation links.
- For manually shared one-time auth links, share an app landing URL containing `token_hash` and verification type, then call `verifyOtp` only after an explicit user action; do not expose Supabase's direct GET `/verify` action link.
**Why:** Supabase Auth logs showed the one-time token being verified successfully and then rejected as “One-time token not found” by rapid repeat GET requests, consistent with link scanners or duplicate opens consuming the token.
**How to apply:** Have the app route show a deliberate “continue” action before verifying invite/recovery tokens; test that opening or previewing the landing URL alone does not consume the token.

## Signed session alignment

Archive features that protect private data, including employee messaging, must use the server-signed archive session and send credentials explicitly from the PWA.

**Why:** Browser `sessionStorage` can still show an active user while a narrowly scoped or missing server Cookie causes protected requests to return 401.

**How to apply:** Scope the archive Cookie to `/`, use `credentials: "include"` on API calls, and let Supabase users re-exchange their active access token if a protected request loses its Cookie.
