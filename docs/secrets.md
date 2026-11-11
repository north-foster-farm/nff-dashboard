# Secrets

Every credential the dashboard holds, where each copy lives, who
rotates it and how. Names only: values belong in Netlify, Supabase,
the password manager and the ignored `.env.local`, never here. The
tracked `.env.example` lists the names the code reads; this page says
what to do with them. The site's secrets have their own page in its
repository (`docs/secrets.md` there), and the rules below follow it.

## The rules

1. **James creates every credential and sets every value. Agents never
   see one.** A secret is never pasted into chat, an issue, a commit,
   a log or an agent's report. If one lands in such a place, treat it
   as leaked and rotate it at once.
2. **The password manager's "NFF dashboard" folder is the master copy
   of every value.** Netlify and Supabase never show a secret again,
   so it is the only copy that can be read back.
3. **A change on Netlify needs a deploy.** Functions read their
   environment at deploy time. Wait for the deploy to publish before
   revoking the old value.
4. **New first, old last.** Create the replacement, set it, deploy,
   prove it, then revoke the old one. A routine rotation keeps the old
   credential for 31 days (or to its own expiry, if sooner), then
   revokes it. Both dates go in the rotation log.
5. **A leak is not routine: revoke at once,** with no overlap.
6. **Every copy.** A secret often lives in two places (the table says
   which). Update both in one sitting.
7. **Set secrets as secret.** On Netlify, mark each value secret and
   set it for its own context only.
8. **Write it down.** Every rotation gets a line in
   `docs/rotation-log.md`: name, date, environment, reason and who.
   `npm run check` fails on a secret in `.env.example`, or a row in the
   table below, with no line there (`scripts/check-rotation-log.mjs`).
   An unlogged secret would never be reminded.

## Schedule

- **Every secret rotates between Dec 1 and Jan 1,** once a year.
- **Credentials that can expire are set to expire on Jan 31** of the
  next year, so a missed rotation shows as a failure, not silence.
- **Ids, public keys and ping URLs** rotate only on a leak, except
  where a section below says a public key follows its private pair.
- **The reminder is James's.** Until the dashboard sends a reminder of
  its own, open this log on Dec 1 and rotate every secret whose latest
  line predates it.

## Where they live

| Name | Kind | Set on | Also kept in | Issued by |
| --- | --- | --- | --- | --- |
| `SUPABASE_SECRET_KEY` | secret | Netlify production | `.env.local`, password manager | Supabase |
| `VAPID_PRIVATE_KEY` | secret | Netlify production | `.env.local`, password manager | us |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | key, public | Netlify build | `.env.local` | Supabase |
| `VITE_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY` | key, public | Netlify build and runtime | `.env.local` | us |
| `Google OAuth client secret` | secret | Supabase Auth provider settings | password manager | Google |
| `PUSH_CALLER_SECRET` | secret | Netlify production; callers | `.env.local`, password manager | us |
| `PROD_AUDIT_PING_URL` | ping URL | GitHub Actions secret | password manager | healthchecks.io |
| `Supabase CLI login` | secret | James's Mac (the CLI's own store) | none | Supabase |
| `Supabase database password` | secret | James's Mac (read by `supabase db push --linked`) | password manager | Supabase |
| `Claude Action token` | secret | GitHub Actions secret, once PR #86 lands | password manager | Anthropic |

`VITE_SUPABASE_URL`, `SUPABASE_URL` and `VAPID_SUBJECT` are
configuration, not secrets. A name beginning `VITE_` is bundled into
the browser, so only public values may carry that prefix.

## Supabase secret key

Bypasses row-level security; the functions use it to read and write
without a signed-in user. Rotate: Supabase dashboard, Project
Settings, API Keys, create a new secret key, set `SUPABASE_SECRET_KEY`
on Netlify production, deploy, check `/.netlify/functions/heartbeat`
answers `ok`, then delete the old key after the overlap. Also update
`.env.local`, since it is also read by `mcp/supa.mjs`,
`scripts/backup-db.mjs`, `scripts/restore-db.mjs`,
`scripts/check-consistency.mjs`, `scripts/chores-cutover.mjs` and
`scripts/prod-read.sh`. Who: James.

## VAPID key pair

The private key signs push notices. Replacing it orphans every
subscription, so a routine rotation is a reset: generate a pair with
`node scripts/generate-vapid-keys.mjs`, set both keys on Netlify,
deploy, then ask each device to turn notices off and on. The public
key rotates with its pair and is logged under its own name. Because
the old pair stops working at once, there is no overlap. Who: James.

## Supabase publishable key

Safe in the browser; row-level security protects the data. Rotate only on
a leak or if Supabase advises it: create a
new publishable key, set it on Netlify, deploy, delete the old one.
Who: James.

## Google OAuth client secret

Entered in the Supabase dashboard (Authentication, Providers,
Google); it is not in Netlify or the repository. Rotate: Google Cloud
console, create a second client secret, paste it into Supabase, sign
in once to prove it, then delete the old secret after the overlap.
Who: James. Sign-in uses the `admins` allowlist, so a failed rotation
locks the farm out; keep the old secret until a sign-in works.

## Push caller secret (planned, #57)

Planned work: `PUSH_CALLER_SECRET` will let `notify-run-done` and
`schedule-reminder` accept only callers that hold it. Its log line says
`planned` until James sets it on Netlify. The name is provisional;
rename it here and in the log if #57 chooses another, and add it to
`.env.example` when #57 lands. We generate it ourselves, so a rotation
swaps it at once on Netlify and in every caller in one sitting, with no
overlap. Who: James.

## Healthchecks ping URL

`PROD_AUDIT_PING_URL` is the GitHub Actions secret the daily
production audit pings. The URL is the credential: anyone holding it
can fake a healthy run. Rotate only on a leak: make a new check URL in
healthchecks.io, update the GitHub secret, delete the old check. Who:
James. The workflow that uses this secret lands with PR #30; until
then the secret has no reader.

## Supabase CLI login and database password

The CLI's login (`supabase login`) and the database password that
`supabase db push --linked` asks for live on James's Mac, outside
`.env.local`. Rotate the login by logging out, revoking the access
token under Supabase account settings and logging in again. Rotate the
database password under Project Settings, Database, then save it in the
password manager. A new password does not disturb the functions, which
use the secret key. Who: James.

## Claude Action token

When PR #86 lands, the Claude GitHub Action reads a token kept as a
GitHub Actions secret. Planned until then. Rotate by creating a new
token with the issuer, replacing the GitHub secret and revoking the old
token after the overlap. Who: James.

## Accounts and two-factor sign-in

Each account that holds or issues a secret must use two-factor
sign-in: Supabase, Netlify, GitHub, Google Cloud, healthchecks.io and
the password manager. James confirms each on #68.

## Lost laptop

Treat every value in `.env.local` as leaked. In order: revoke the
Supabase secret key and create a new one; reset the VAPID pair; rotate
the Google OAuth client secret; rotate `PUSH_CALLER_SECRET`; log the
Supabase CLI out and revoke its token; change the Supabase database
password; replace the Claude Action token once it exists; sign the
lost device out of GitHub, Netlify, Supabase and the password manager.
Log each as reason `lost device`.
