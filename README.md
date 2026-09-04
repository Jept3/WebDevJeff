# Jeffdesign101 v2.14 — Project Showcase

Adds an Admin-controlled ongoing website showcase with logo preview, staging/live link, automatic screenshot carousel, fullscreen image preview, and white/dark logo background inspection.

## Upgrade from v2.13
1. Run `V2.14-PROJECT-SHOWCASE-PATCH.sql` once in Supabase SQL Editor.
2. Deploy all v2.14 frontend files.
3. If installed as a PWA, fully close and reopen after deployment.

# Jeffdesign101 CRM / Employer Portal — v2 Modern

A production-focused upgrade of the clean rebuild. It remains **zero-build** and GitHub-Pages-friendly while using Supabase for authentication, RLS, storage and data.

## v2 upgrades

- Modern glass/dark design system with improved hierarchy, spacing and responsive behavior.
- Motion system for page transitions, panels, modals and ambient effects, with `prefers-reduced-motion` support.
- Global quick-navigation palette (`Ctrl+K` / `⌘K`) for Admin and Employer views.
- Stronger session/timer lifecycle: timers stop on sign-out/backgrounding and resume safely when visible.
- Safer external website URL handling and existing rich-text sanitizer retained.
- Employer file uploads now enforce a 25 MB client-side limit before storage upload.
- Generic login failure messaging reduces username enumeration leakage in the UI.
- Database performance indexes for clients, tasks, time entries and invoices.
- Database audit log + triggers for clients, tasks, time entries and invoices.
- Hardened `SECURITY DEFINER` search paths (`pg_catalog, public`).

## Deployment

### 1. Database
Run only:

`supabase-migration-clean.sql`

The migration is intended to be rerunnable. Review it in a staging Supabase project before production, especially if your existing base tables differ from the expected schema.

### 2. Edge Function
Deploy the function named exactly:

`admin-create-client-user`

Source:

`supabase/functions/admin-create-client-user/index.ts`

Keep **Verify JWT with legacy secret = OFF**. The function validates the caller with `auth.getUser()` and then confirms the caller has an Admin profile before using the service-role client.

### 3. Frontend
Deploy these files together:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `assets/`

`config.js` should contain only the Supabase project URL and publishable/anon key. Never put the service-role key in browser code.

## Security model

- Admin / VA: full workspace access through RLS.
- Employer: linked by `clients.auth_user_id`.
- Employer task rich text is sanitized before rendering.
- Admin cannot edit Employer-authored task content at the DB trigger layer; Admin can manage workflow state.
- Employer can update only allowed project status fields through the client guard trigger.
- Storage remains private and is accessed through signed URLs / RLS.
- Audit records are Admin-readable only.

## Important production recommendations

Before a public launch, enable MFA for Admin accounts in Supabase Auth, configure email/security alerts, validate your production Auth redirect URLs, and add automated RLS integration tests using separate Admin and Employer test users.

## Local smoke test

Because this is a static frontend, serve the directory with any local static server rather than opening `index.html` via `file://`. Example: `python -m http.server 8080`.

## v2.5 Paste + Employer Request Delete Fix
- Fixed Office/Word rich-paste being swallowed on Safari/iOS/PWA when clipboardData or selection is unavailable.
- Added safe native-paste fallback and post-paste sanitization.
- Added cursor/execCommand/append fallbacks so pasted content is not lost.
- Employer can delete their own requests from Overview and Tasks when portal permission is `edit`.
- Delete remains protected by Supabase RLS and is limited to the signed-in employer's own project/task.


## v2.8 mobile scroll fix
- Fixed glass-modal overflow conflict that prevented touch scrolling on mobile.
- Added iOS momentum scrolling and safe-area-aware modal heights.
- Expanded task previews now fully reveal content.
- Updated PWA cache version so installed apps receive the fix.


## v2.9 Admin mobile task scroll fix
- Admin Task Info now scrolls using the modal backdrop on mobile/iOS.
- Long task instructions and action buttons remain reachable by touch.
- Sticky task header keeps the close control reachable while scrolling.
- PWA cache version bumped so installed apps receive the fix.

## v2.10 — Editable work time
Admin Time Log entries now include an Edit action. You can correct employer, task/description, start date/time, end date/time, and hourly rate. Duration is recalculated automatically. Active sessions may keep the end time blank. Invoiced entries display a warning because editing the time log does not retroactively recalculate an already-created invoice.

No database migration is required when using the existing `time_admin_all` RLS policy from the clean migration.


## v2.12 Website Workspace

Adds an Admin Prompt Library and an Employer Website Project intake workspace. Before using these new pages, run `V2.12-WEBSITE-WORKSPACE-PATCH.sql` once in Supabase SQL Editor. Existing data is preserved. Website assets use the existing private `client-files` storage bucket under `<client-id>/website-assets/`.

## v2.13 Multi Website Projects

Run `V2.13-MULTI-WEBSITE-PROJECTS-PATCH.sql` after v2.12. Employers can then create multiple Website Projects, each with its own intake, notes, status, and assets. Admin Employer Details shows every project and provides Copy Full Intake per project. Existing v2.12 intake data is migrated automatically when possible; previous v2.12 website assets are preserved as legacy uploads.
