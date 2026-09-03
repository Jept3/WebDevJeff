# LimeCRM

A modern, dependency-free client and website project CRM designed for GitHub Pages.

## Features

- Dashboard with client totals, ongoing/completed counts, average completion time
- Donut chart for project statuses
- Monthly client activity graph
- Client directory
- Click a client name/row to open a detailed client page
- Back button and client-page search
- Global search
- Professional sorting:
  - Last updated
  - Name A–Z / Z–A
  - Newest / oldest
  - Deadline soonest
- Status filtering
- Project monitoring board:
  - Ongoing
  - In Review
  - Waiting
  - Complete
  - Paused
- Add, edit and delete client records
- Browser autosave with localStorage
- Responsive mobile layout
- Lime-green glassmorphism UI with subtle animation
- No build tools and no dependencies

## Important data note

This version stores CRM data in the browser using `localStorage`.

That makes it perfect for a simple private/single-browser admin workspace hosted as a static GitHub Pages site. It does **not** sync data between devices and it does not provide login/security or a shared database.

For a public production CRM with multiple users, authentication, shared data, backups or file uploads, connect the frontend to a backend such as Supabase, Firebase, Appwrite, PocketBase, or your own API.

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload:
   - `index.html`
   - `styles.css`
   - `app.js`
3. Commit the files.
4. Open repository **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Choose your main branch and `/ (root)`.
7. Save.

GitHub will provide the public Pages URL after deployment.

## Customize

Open `styles.css` and edit the variables at the top:

```css
:root {
  --lime: #baff3a;
  --lime2: #91ef19;
}
```

Open `app.js` to modify sample data, statuses or default behavior.

## Reset demo data

Open browser developer tools and run:

```js
localStorage.removeItem('limeCRM.clients.v1');
location.reload();
```

The sample clients will be recreated.
