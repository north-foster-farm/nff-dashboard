# Staging

Staging is a second copy of the dashboard over a second Supabase
project, where a release is looked at before it reaches the farm. It
never reads or writes production. Written 2026-11-22 for #74 (F1.2);
the back end it needs is F1.1 (#73), which James creates, and until
it exists none of this runs.

## What is where

| | Production | Staging |
| --- | --- | --- |
| Branch | `main` | `staging` (F2.1, #75) |
| URL | https://admin.northfosterfarm.com | https://staging--nff-dashboard.netlify.app |
| Supabase | the linked production project | its own project (F1.1) |
| Local env file | `.env.local` | `.env.staging.local` (from `.env.staging.sample`) |
| Netlify env values | the "Production" context | the `staging` branch context |
| Data | the farm's | made up |
| Scheduled functions | run | do not run (Netlify runs schedules on the published production deploy only) |

## Setting it up (James, once)

1. **The Supabase project** (F1.1): create it in the same
   organization, on the free tier. Note its URL, publishable key and
   secret key.
2. **Apply the migrations** to it without relinking the CLI, so the
   linked project stays production's and nothing pushes there by
   accident:
   ```
   supabase db push --db-url 'postgresql://postgres:<password>@db.<staging-ref>.supabase.co:5432/postgres'
   ```
   The early migrations seed baseline rows (`gen-batch*-seed.mjs`
   wrote them from `src/data/nff-data.json`). Once C1 (#55) has made
   that file free of contact data, the seed is fit for staging as is.
3. **A staging VAPID pair**: `node scripts/generate-vapid-keys.mjs`.
   Never reuse production's.
4. **Netlify env values**, for the `staging` branch only. In the UI:
   Projects, `nff-dashboard`, Project configuration, Environment
   variables; for each of `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY`,
   `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`, add a value for "Branch
   deploys" scoped to `staging`. A variable with no staging value
   falls back to the shared one, which is production's: set all
   eight.
5. **Branch deploys**: Project configuration, Build and deploy,
   Branches and deploy contexts. Set "Branch deploys" to "Let me add
   individual branches" and add `staging` alone, so `next` and
   feature branches build nothing.
6. **Deploy previews** (#94). Today every pull request builds a deploy
   preview with the shared values, which are production's: a preview
   is a live client of the production database. Give the "Deploy
   previews" context the staging values too (step 4, scoped to
   "Deploy Previews").

## A staging build on the Mac

```
/bin/cp -f .env.staging.sample .env.staging.local   # then fill it in
npm run build -- --mode staging
npm run dev -- --mode staging
```

Vite's `--mode staging` loads `.env.staging.local` over `.env.local`.
A name missing from it falls through to `.env.local`, which is
production, so the sample lists every one.

## The scripts

`backup-db.mjs`, `restore-db.mjs`, `check-consistency.mjs` and
`prod-read.sh` read `.env.local` and so reach production only. Their
`--staging` flag (reading `.env.staging.local`, with typed
confirmation before any production write) is F1.2's second half,
waiting on its criteria tests and the shared `bin/confirm` (D3, #62).

## Not done

- No staging project exists yet (F1.1, #73).
- The `staging` branch does not exist yet (F2.1, #75).
- No one has followed this page from a fresh clone; that is F1.2's
  first "Done when", checked once F1.1 lands.
