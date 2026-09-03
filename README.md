# Jeffdesign101 — Supabase Cloud Edition

This is the upgraded multi-user version of Jeffdesign101 for GitHub Pages + Supabase.

## What changed

- Real email/password authentication with Supabase Auth
- Admin and Client roles
- Admin can see every client
- Client can only see the active client record matching their authenticated email
- Cloud PostgreSQL database instead of browser localStorage
- Private cloud file uploads using Supabase Storage
- Client upload portal for PDF, Word, Excel, images, ZIP, and other files
- Client-supplied information with autosave
- Admin client directory, Edit/Delete, Trash, Restore, Delete Forever
- Dashboard, status donut, project graph and project board
- GitHub Pages compatible

## 1. Create a Supabase project

Create a project at Supabase.

In the Supabase dashboard, copy:

- Project URL
- Publishable key (or anon key for older projects)

Open `config.js` and replace:

```js
window.LIME_CRM_CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabasePublishableKey: "YOUR_SUPABASE_PUBLISHABLE_KEY"
};
```

Never put the **service_role** key in this website.

## 2. Create the database and security policies

Open:

`supabase-schema.sql`

Copy the full file into:

**Supabase Dashboard → SQL Editor**

Run it once.

This creates:

- `profiles`
- `clients`
- `client_submissions`
- private `client-files` Storage bucket
- Row Level Security policies
- Admin/client access helpers

## 3. Create your Admin account

Open the CRM after configuring it and click **Create client account** using your own admin email/password.

Confirm the email if Supabase asks you to.

Then run this in the Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com');
```

Sign out and sign back in. You will now see the Admin dashboard.

## 4. Add a client

From Admin:

1. Click **Add Client**.
2. Enter the client's real email address.
3. Add the website/project information.
4. Save.

The email is important because it links the secure client portal to that client.

## 5. Client account

Give the client your GitHub Pages URL.

They click **Create client account** and use the **same email address** you entered in their client record.

After they verify and sign in:

- they see only their own project
- they can add information requested by you
- their information autosaves
- they can upload files
- they cannot see other clients
- they cannot access the Admin dashboard/trash

## 6. GitHub Pages

Upload these files to your GitHub repository root:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

`supabase-schema.sql` can stay in the repository as setup documentation, or you can keep it private.

Then enable:

**GitHub → Repository Settings → Pages → Deploy from a branch → main → /root**

## Security model

The browser contains only the Supabase publishable/anon key. That key is designed for public/browser use.

Sensitive access is controlled inside PostgreSQL with Row Level Security (RLS):

- Admin role → all client records
- Client role → only the client record whose email matches the authenticated account
- Client submissions → only that signed-in client and admin
- Files → private bucket; only admin or the matching client can access the project folder

Do not disable RLS and do not place a Supabase `service_role` key in `config.js`.

## Recommended Supabase settings

For client accounts:

- Enable Email provider
- Keep email confirmation enabled for stronger identity verification
- Set your GitHub Pages URL as the Site URL / allowed Redirect URL
- Configure SMTP later if you want branded/reliable production email delivery

## Files

Supabase Storage limits depend on your Supabase project/plan and configuration. You can also add client-side size validation if you want a strict per-file limit.


# Client Portal v2 Upgrade

This edition adds the client-facing workflow requested:

## Client portal

After login, a client sees the ongoing project linked to their account.

They can see:

- current project status
- project timeline
- project overview
- deliverables
- website setup
- Task of the Day
- project notes / information editor
- project files

## Task of the Day

Clients with **Can Edit** permission can:

- add daily tasks
- mark tasks complete
- delete tasks

Tasks are stored in Supabase and are visible to the administrator.

## Rich text information editor

The client information area is no longer a plain textarea.

It supports:

- Bold
- Italic
- Underline
- Highlight
- Bulleted list
- Numbered list
- Clear formatting
- Automatic clickable links when a full `https://...` link is typed
- Autosave

The formatted HTML and plain text are stored in `client_submissions`.

## View Only / Can Edit

Every client record now has a **Portal Permission** selector.

`Can Edit`:
- client can edit rich text information
- client can create/update Task of the Day
- client can upload and delete files

`View Only`:
- client can view project details
- client can view existing tasks
- client can open existing files
- editing and uploads are blocked in the UI **and by Supabase RLS policies**

## Username and password controlled by Admin

The Admin edit form now includes:

- Client username
- Temporary password
- **Create / Reset Login** button

For security, the password is **not stored in the browser or clients table**.

The button calls this Supabase Edge Function:

`supabase/functions/admin-create-client-user/index.ts`

The Edge Function uses the Supabase service role only on the server and creates/resets the real Auth user.

The login page accepts either:

- Client username
- Client email

## Deploy the Edge Function

Install the Supabase CLI and link the project, then deploy:

```bash
supabase functions deploy admin-create-client-user
```

The hosted Supabase function automatically receives the project's standard Supabase environment variables, including the service-role credential used server-side.

Do **not** place the service role key in `config.js`, `app.js`, GitHub Pages, or any browser code.

## Database upgrade

Run the latest `supabase-schema.sql` again in the Supabase SQL Editor.

It adds:

- `clients.client_username`
- `clients.portal_permission`
- `client_submissions.info_html`
- `client_tasks`
- username login resolver
- updated RLS policies for View Only / Can Edit
- Storage policies that honor portal permissions

## Suggested workflow

1. Admin creates a client record with the client's real email.
2. Admin chooses a username.
3. Admin chooses `Can Edit` or `View Only`.
4. Admin enters a temporary password and clicks **Create / Reset Login**.
5. Give the client the username + temporary password.
6. Client logs in.
7. Client sees only their own project portal.
8. Client adds Task of the Day, rich-text project information, and files according to the permission you selected.


# VA Workflow Upgrade

This version is designed around a Virtual Assistant / web-development workflow.

## Time Login / Logout

Admin has a **Time Log** page.

Workflow:

1. Select client.
2. Enter what you are working on.
3. Click **Login / Start**.
4. Work timer runs live.
5. Click **Logout / Stop** when finished.
6. The hours are automatically saved to Supabase.
7. Dollar value is automatically calculated using the active hourly rate.

Default hourly rate is **$3.00/hour** and can be changed under **Rate & Billing**.

## Rate & Billing Settings

Admin can change:

- hourly rate
- business / VA name
- full name
- email
- phone
- address
- payment instructions

These values are used automatically in invoices.

## Invoice Generator

Admin can:

- choose a client
- choose work-period start/end
- automatically collect uninvoiced time entries
- calculate billable hours
- use the current hourly rate
- preview a professional invoice
- create the invoice
- mark invoice Paid

Time entries included in an invoice are marked as invoiced so they are not billed twice.

## Client Invoice Page

Clients can access the **Invoices** page.

They can see:

- Incoming / pending invoices
- Paid invoices
- Hours
- Hourly rate
- Invoice total
- Invoice date
- Work period
- Professional invoice preview

Clients cannot create or mark invoices paid.

## Database update

Run the latest `supabase-schema.sql` in the Supabase SQL Editor again.

It adds:

- `billing_settings`
- `time_entries`
- `invoices`
- Row Level Security policies for admin and client access

## Important

The site records work-session timestamps and calculates billable time. For invoicing, review the generated hours before sending an invoice to ensure your records match your actual work agreement with the client.


## Jeffdesign101 branding

This edition includes the custom Jeffdesign101 logo and cover artwork:

- `assets/jeffdesign101-logo.png`
- `assets/jeffdesign101-cover.png`

The logo is used in the sidebar and login screen.
The cover artwork is used as the main dashboard hero background.


## Login hotfix v2
This build fixes a Supabase auth callback deadlock that could leave the login screen on `Signing in...`. It also adds cache-busting query strings for GitHub Pages.


## Manual Hours Entry

The Time Log page now supports two ways to record work:

1. **Login / Start → Logout / Stop** for live timer tracking.
2. **Add Hours Worked** for manual entries.

For a manual entry, select:

- client
- work date
- hours worked
- hourly rate
- task / description

The amount is calculated automatically.

Example:

`7 hours × $3.00/hour = $21.00`

Manual entries are saved to the same Supabase `time_entries` table and can be included automatically in invoice generation.


# Full Dedicated Client Portal + Username-only Login

## Client does NOT need an email address

Client login is now fully controlled by the administrator.

Admin creates:

- Client username
- Temporary password
- Portal permission: `Can Edit` or `View Only`

The client only receives:

- Website URL
- Username
- Password

They do not need to provide or use an email address for login.

Internally, the Supabase Edge Function creates a hidden Auth identity and links the Auth user directly to the client record through `clients.auth_user_id`.

## Dedicated Client Portal

Client navigation is now:

- Overview
- Tasks
- Progress
- Files
- Invoices
- Account

The client does not see the Admin CRM sidebar.

### Overview
Shows:
- project status
- progress
- open tasks
- amount due
- project dates
- project overview
- shared information

### Tasks
Client can send the VA:
- task title
- detailed instructions
- priority
- due date

The task is stored in Supabase and visible in the project workflow.

### Progress
Client can review:
- total worked hours
- this week's hours
- work log
- work description
- start/finish times
- project progress

### Files
Client can open project files.
When `Can Edit`, they can upload/delete files.
When `View Only`, uploads are disabled by both UI and RLS.

### Invoices
Client sees:
- Incoming invoices
- Paid invoices
- hours
- hourly rate
- total amount
- professional invoice preview

### Account
Client sees:
- username
- access level
- Sign out
- Change password

## IMPORTANT DATABASE UPDATE

Run the latest `supabase-schema.sql` in Supabase SQL Editor.

This migration adds direct Auth-user linking and updates RLS policies.

## IMPORTANT EDGE FUNCTION UPDATE

Redeploy:

```bash
supabase functions deploy admin-create-client-user
```

The updated Edge Function is required for username-only client accounts.

Existing admin login continues using your normal admin email/password.


## Manual Hours Directly in Invoice Generator

The invoice page now has an **Hours Source** selector:

- `Use Time Log`
- `Enter Hours Manually`

With manual mode, you can enter the number of billable hours directly.

Example:

- Hours: `7`
- Hourly rate: `$3.00`
- Total: `$21.00`

Manual invoices do not require a Time Log entry. Time Log mode still prevents the same tracked work entry from being invoiced twice.
