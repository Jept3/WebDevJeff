# Jeffdesign101 v2.19 — Project Operations

v2.19 builds on v2.18 and focuses on operational clarity between the VA/Admin and Employer portals.

## Database order

If your database is already upgraded through v2.18, run only:

`V2.19-PROJECT-OPERATIONS-MIGRATION.sql`

If v2.18 has not been applied yet, run `V2.18-PROJECT-ASSET-LIBRARY-MIGRATION.sql` first, then v2.19.

## Major changes

- New Admin **Project Activity** page.
- Shared Website Project activity timeline for Admin and Employer.
- Database-triggered history for project creation, status, intake, assets, logo/gallery, preview updates, and publish/unpublish.
- Project health indicators on the Admin Website Projects hub and Admin Workspace.
- Admin Website Projects search and status filtering.
- Logo proof now includes light, dark, and transparency/checkerboard contexts.
- Removed duplicate logo/screenshot upload logic from **Save Production Settings**. Uploads remain immediate; Save handles metadata only.
- Replaced the remaining browser URL prompt in rich-text editing with an in-app glass dialog.
- Existing project Asset Library remains the canonical project file source.

## Recommended workflow

### Employer
1. Create Website Project.
2. Complete / update Website Intake.
3. Upload categorized source assets to that project.
4. View production progress and published previews.
5. Review project activity timeline.

### Admin / VA
1. Open **Website Projects**.
2. Filter/search and identify projects that need attention.
3. Open **Admin Workspace**.
4. Manage status, site URL, Employer update, logo and screenshots.
5. Review categorized source Asset Library.
6. Review/copy Employer intake.
7. Use **Project Activity** for cross-project operational history.

## Important

The frontend can still load if the v2.19 activity migration is not installed, but activity panels will be empty and the Activity Center will not contain history. Run the migration for the complete feature set.
