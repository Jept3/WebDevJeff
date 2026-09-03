# Jeffdesign101 Clean Rebuild v1

This package is a clean rebuild of the CRM/Employer Portal. It is not another patch layered over the previous `app.js`.

## What was wrong in the uploaded build

The audit found:

- several generations of RLS policies in one 900+ line SQL file;
- old email-matching policies mixed with the newer `auth_user_id` account-link system;
- authentication handled from both form-submit and auth-state callbacks, creating race conditions;
- repeated listeners and render paths added during later upgrades;
- employer rich-text task HTML inserted back into Admin pages without a proper sanitizer;
- billing/invoice access rules added as late patches rather than one coherent policy set;
- task update permissions split between UI assumptions and multiple triggers.

The clean rebuild uses one role model:

- **Admin / VA** — full workspace.
- **Employer** — linked through `clients.auth_user_id`.

## Included features

### Admin / VA
- Dashboard
- Employer directory
- Employer details
- Task Inbox + unread badge
- Read-only Employer task content
- Mark task Complete / Reopen
- Multi-client active work timers
- Manual hours
- Time history
- Invoice generator (Time Log or manual hours)
- Invoice popup
- Mark Paid
- Rate & Billing
- Trash / Restore
- Employer username/password creation/reset

### Employer
- Overview
- Rich-text task composer
- Tasks with See more / See less
- Employer-only task editing
- Project Information
- Shared Notes
- File upload/download/delete
- Project status Active / Paused / Complete
- Work Monitor (day/week/month + live timer)
- Small closable VA-status pill
- Incoming/Paid invoices
- Invoice popup
- Account password change

## IMPORTANT: database cleanup

Do **not** rerun the old accumulated `supabase-schema.sql`.

Run only:

`supabase-migration-clean.sql`

in Supabase SQL Editor. It is written to be idempotent and replaces the conflicting policies/triggers with one consistent set.

## Edge Function

Keep the function name exactly:

`admin-create-client-user`

Replace its code with:

`supabase/functions/admin-create-client-user/index.ts`

In Supabase Edge Function settings, keep **Verify JWT with legacy secret = OFF**.

The function itself validates the signed-in Admin before creating/resetting an Employer login.

## GitHub

Replace your current repository frontend with:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `assets/`

Then hard-refresh after GitHub Pages deploys.

## Security note

Employer rich-text task HTML is sanitized before being displayed in either Employer or Admin views. Admin cannot edit Employer task content at the database layer; Admin can only mark tasks seen/completed/reopened.
