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
