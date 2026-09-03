# Jeffdesign101 v2 — Engineering Audit

## Fixed in this build

1. **Async render race conditions** — slow Employer overview/files/detail/trash requests now abort stale renders after navigation.
2. **Timer lifecycle leakage** — timer intervals are stopped on sign-out, page backgrounding and unload, then safely resumed when visible.
3. **Modal scroll-lock bug** — backdrop and Escape-key close paths now use the same modal cleanup path.
4. **Rich-text rendering** — existing allow-list sanitizer retained for Employer task HTML; unsafe attributes and non-http(s) links are stripped.
5. **External URL handling** — website links are normalized and limited to `http:` / `https:`.
6. **Login messaging** — unknown usernames now use a generic credential failure message in the UI.
7. **File upload guard** — 25 MB client-side limit and missing-project guard added.
8. **Database hot-path indexes** — clients, tasks, time entries and invoices receive practical lookup/sort indexes.
9. **SECURITY DEFINER hardening** — migration functions now pin `search_path` to `pg_catalog, public`.
10. **Auditability** — Admin-only `activity_log` plus row-change triggers for clients, tasks, time entries and invoices.
11. **Edge Function validation** — UUID, username length, password bounds, request-size limit, no-store/nosniff headers.
12. **Modern UX** — updated visual system, responsive polish, reduced-motion support, animated transitions, hover/focus states and Ctrl/⌘ K quick navigation.

## Architecture decision

The frontend intentionally remains zero-build vanilla JavaScript. Moving to React/Vite/TypeScript would be a separate migration with new deployment/build/runtime dependencies and would increase regression risk for a currently static GitHub Pages + Supabase architecture. The v2 upgrade focuses on production hardening while preserving deployment compatibility.

## Production checks still required

- Run the SQL migration in a staging Supabase project first and verify the existing base table columns/types match assumptions.
- Test RLS with two real test identities: one Admin and one Employer.
- Enable MFA for Admin accounts and review Supabase Auth redirect/site URL configuration.
- Confirm Storage bucket limits and MIME/file policies appropriate for the business.
- Deploy the Edge Function and test create/reset login from an Admin session and denial from an Employer session.
- Test on actual Safari iOS, Chrome Android, desktop Chrome/Edge/Firefox because automated browser tooling is not bundled in this ZIP.

## Static validation completed

- `node --check app.js` passes.
- HTML parser accepts `index.html`.
- CSS delimiter balance checked.
- No service-role key is present in frontend `config.js`.
