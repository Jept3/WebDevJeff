# Jeffdesign101 v2.18

## Deployment order

1. Back up the Supabase database.
2. Run `V2.18-PROJECT-ASSET-LIBRARY-MIGRATION.sql` in Supabase SQL Editor.
3. Deploy the v2.18 frontend files.
4. If installed as a PWA, fully close and reopen the app to refresh the service-worker cache.

## New canonical workflow

Employer website materials are uploaded inside a specific Website Project and assigned a category. Admin sees the same categorized files inside the Admin Website Workspace. Admin production showcase files (final logo/screenshots) stay separate from Employer/source assets.
