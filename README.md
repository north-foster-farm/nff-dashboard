# North Foster Farm — Admin Dashboard

Custom internal admin app for [North Foster Farm](https://northfosterfarm.com)
(Foster, RI). Lives at <https://admin.northfosterfarm.com>.

## Stack

- **Vite** + **React 18** (SPA, plain JS, no router *library* — a
  hand-rolled pushState router in `src/lib/router.js`)
- **Supabase** for Postgres, auth (Google OAuth + admin allowlist), realtime
- **Netlify** for hosting + the daily heartbeat function that keeps the
  Supabase free tier from auto-pausing
- **lucide-react** icons; **Tailwind v4** utility classes over CSS
  custom-property tokens (`src/styles.css` maps the `--c-*` palette from
  `index.html` into the Tailwind `@theme`)
- Fonts loaded from Google Fonts in `index.html`

## Develop

```bash
npm install
bash scripts/setup-hooks.sh     # installs the pre-commit gate
cp .env.example .env.local      # then fill in real values
npm run dev                     # http://localhost:5173
npm test                        # vitest; must be green to commit
npm run build
npm run preview
```

To test the Netlify scheduled function locally, install the Netlify CLI and
run `netlify dev` — that one needs `SUPABASE_SECRET_KEY` set in `.env.local`.

## Layout

Orientation, not a tree (trees rot — the code is the map):

- `src/lib/` — pure business logic + the vitest suite (`*.test.js`)
- `src/lib/data/` — Supabase hooks (one per slice, ~50 of them)
- `src/pages/` + `src/components/` — the UI; `src/sections.jsx` is the
  sidebar/section registry
- `src/styles.css` + `index.html` — the token layer (Tailwind `@theme`
  over the `--c-*` palettes)
- `public/style-guide/` — the design system (visual docs +
  `DESIGN-SYSTEM.md`)
- `docs/` — the feature-history catalog, specs, and workshop playbooks
- `audits/` — dated walkthrough findings; `scripts/` — backup/restore,
  seeds, hooks; `netlify/functions/` — heartbeat + the two web-push
  senders; `supabase/migrations/` — 0001…0050, additive-only; `mcp/` —
  the agent-bridge server

## Data flow

`useReferenceData` loads every migrated table in parallel and returns objects
keyed by the same names the UI already used on the JSON. App.jsx merges:
JSON (always present, instantaneous) → DB values overlay non-null keys when
they arrive. Components never see a half-loaded state.

Mutations (chore completions, batch assignments, activity log) go through
their own hooks with optimistic updates and realtime subscriptions.

## Migrations

The app is LIVE. Migrations are additive-only and applied with
`supabase db push`, never by hand and never re-run. Before every push:
`node scripts/backup-db.mjs` (read-only full export to a gitignored
`.backups/<ts>/`), then confirm the events/chores row counts look
right. Disaster recovery only:
`node scripts/restore-db.mjs <backupDir> --yes`. See CLAUDE.md →
"Data safety" for the full protocol.

If you change `choreSeeds.js` or sections of `nff-data.json` that drive a
seed, regenerate the affected seed block:

```bash
node scripts/gen-batch2-seed.mjs > /tmp/chore-seed-block.sql
```

## Auth

Two-factor allowlist: a Supabase session via Google OAuth + the email must
exist in `public.admins`. RLS policies on every table check
`current_user_is_admin()`. To grant access, insert a row into `admins`
through the Supabase Table Editor.

## Deploy

`netlify.toml` drives the build (`npm run build` → `dist`) and registers the
`netlify/functions/` directory. The `heartbeat` function self-schedules via
its inline `config.schedule = "@daily"` export — no cron config needed in
`netlify.toml`.

Required Netlify env vars (Site settings → Environment variables):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-side only — never prefix with `VITE_`)
- `VITE_VAPID_PUBLIC_KEY` (client half of the web-push pair)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — required by
  the `notify-run-done` / `schedule-reminder` push functions;
  `VAPID_PRIVATE_KEY` is server-only and pairs with
  `VITE_VAPID_PUBLIC_KEY`

After changing any env var, redeploy with cache cleared.
