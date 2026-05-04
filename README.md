# North Foster Farm — Admin Dashboard

Custom internal admin app for [North Foster Farm](https://northfosterfarm.com)
(Foster, RI). Lives at <https://admin.northfosterfarm.com>.

## Stack

- **Vite** + **React 18** (SPA, plain JS, no router library — internal section
  state in `App.jsx`)
- **Supabase** for Postgres, auth (Google OAuth + admin allowlist), realtime
- **Netlify** for hosting + the daily heartbeat function that keeps the
  Supabase free tier from auto-pausing
- **lucide-react** icons; inline styles via `theme.js` (no CSS framework)
- Fonts loaded from Google Fonts in `index.html`

## Develop

```bash
npm install
cp .env.example .env.local      # then fill in real values
npm run dev                     # http://localhost:5173
npm run build
npm run preview
```

To test the Netlify scheduled function locally, install the Netlify CLI and
run `netlify dev` — that one needs `SUPABASE_SECRET_KEY` set in `.env.local`.

## Layout

```text
src/
├── main.jsx               entry; wraps <App> in <LoginGate>
├── App.jsx                root; merges JSON + DB reference data
├── theme.js               design tokens
├── sections.jsx           sidebar/section registry
├── components/            chrome (TopBar, Sidebar, LoginGate, …)
├── pages/                 per-section views
├── lib/
│   ├── supabase.js        single Supabase client
│   ├── data/              hooks: useReferenceData, useChoreCompletions,
│   │                      useActivityLog, useBatchAssignments
│   ├── chores.js          chore engine (recurrence, deadlines, day expansion)
│   ├── recurrence.js      event-instance recurrence expansion
│   ├── productCost.js     broiler cost-floor math
│   └── dates.js           date helpers
└── data/
    ├── nff-data.json      JSON fallback + costs/meta/modelNotes (still
    │                      authoritative for these three slices)
    └── choreSeeds.js      canonical chore definitions; source for the
                           Supabase seed and a fallback if the DB is empty

netlify/
└── functions/
    └── heartbeat.mjs      daily scheduled fn; upserts the heartbeat row

supabase/
└── migrations/            0001…0006, all idempotent, all checked in

scripts/
├── gen-batch2-seed.mjs    regenerates chore_definitions seed block from
│                          choreSeeds.js
├── gen-batch3-seed.mjs    regenerates events + product_kinds seed blocks
│                          from nff-data.json
└── gen-batch4-seed.mjs    regenerates threads seed block from nff-data.json
```

## Data flow

`useReferenceData` loads every migrated table in parallel and returns objects
keyed by the same names the UI already used on the JSON. App.jsx merges:
JSON (always present, instantaneous) → DB values overlay non-null keys when
they arrive. Components never see a half-loaded state.

Mutations (chore completions, batch assignments, activity log) go through
their own hooks with optimistic updates and realtime subscriptions.

## Migrations

Apply by pasting each `supabase/migrations/000N_*.sql` file into Supabase →
SQL Editor → Run, in order. They're idempotent: rerun on a populated DB is
safe (upserts on every seed, `if not exists` on every schema object).

If you change `choreSeeds.js` or sections of `nff-data.json` that drive a
seed, regenerate the affected seed block:

```bash
node scripts/gen-batch2-seed.mjs > /tmp/chore-seed-block.sql
# then paste the result into the migration before reapplying
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

After changing any env var, redeploy with cache cleared.
