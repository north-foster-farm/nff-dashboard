# Rotation log

One line per rotation of a secret (`docs/secrets.md`): name, date,
environment, reason, who. Names and dates only, never a value.
`npm run check` fails when a secret in `.env.example`, or a secret row
in the table in `docs/secrets.md`, has no line here.

Reason is `seed` (the last change is not recorded; counts as due in
the first window), `schedule`, `set up`, `leak`, `lost device`,
`access ended` or `revoked` (the day an old credential was destroyed,
after the 31-day overlap).

A secret not set up yet has a `planned` line: `planned` in the date
column and `planned, not done` as the reason. James's word that it
exists replaces it with a dated line.

name | date | environment | reason | who
--- | --- | --- | --- | ---
SUPABASE_SECRET_KEY | 2026-11-11 | production | seed | James
VAPID_PRIVATE_KEY | 2026-11-11 | production | seed | James
VAPID_PUBLIC_KEY | 2026-11-11 | production | seed | James
VITE_VAPID_PUBLIC_KEY | 2026-11-11 | production | seed | James
VITE_SUPABASE_PUBLISHABLE_KEY | 2026-11-11 | production | seed | James
Google OAuth client secret | 2026-11-11 | production | seed | James
PROD_AUDIT_PING_URL | 2026-11-11 | production | seed | James
Supabase CLI login | 2026-11-11 | James's Mac | seed | James
Supabase database password | 2026-11-11 | production | seed | James
Claude Action token | planned | production | planned, not done | James
PUSH_CALLER_SECRET | planned | production | planned, not done | James
