# ISC Prep

Practice exams for the SailPoint Identity Security Administrator and Identity Security Engineer certifications (DOMC format, separate question banks, performance dashboard).

## Structure

- `public/index.html` — the whole site (HTML, CSS and vanilla JavaScript).
- `src/index.js` — Worker that serves the site and the progress-sync API (`/api/state`).
- `schema.sql` — D1 table used to store each person's progress.
- `wrangler.jsonc` — Worker, static assets and D1 binding.

## Progress sync

Each browser gets a private sync key. Progress is saved locally and to D1 through `/api/state`, so it survives across days and devices. Opening the private link (`#sync-<key>`) on another device loads the same progress.

## Deploy

Pushing to `main` deploys through Workers Builds. Manual deploy: `npx wrangler deploy`.
