-- 0011_push_notifications.sql
-- Web push for Batch 11.3 — Chores notifications.
--
--   * push_subscriptions — one row per (user, device) that has opted
--     into web push. Stores the endpoint + the AES128GCM keys the
--     server side needs to encrypt payloads (p256dh, auth). Each
--     authenticated admin can read and write only their own rows;
--     the Netlify function reads cross-user via the secret key (RLS
--     bypass), so no service-role policy is needed here.
--
--   * chore_runs.notified_at — idempotency marker for the run-done
--     push trigger. The Netlify function claims a row with a single
--     UPDATE (state='done' AND notified_at IS NULL) and skips
--     delivery when another concurrent click already claimed it.

-- ── push_subscriptions ───────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index if not exists push_subscriptions_endpoint_unique
  on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_user_email_idx
  on public.push_subscriptions (user_email);

alter table public.push_subscriptions enable row level security;

-- An authenticated admin can see / write only their own rows. Cross-
-- user reads happen from the Netlify function with the secret key,
-- which bypasses RLS entirely.
drop policy if exists push_subscriptions_read on public.push_subscriptions;
create policy push_subscriptions_read on public.push_subscriptions
  for select to authenticated
  using (
    public.current_user_is_admin()
    and user_email = (auth.jwt() ->> 'email')
  );

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated
  with check (
    public.current_user_is_admin()
    and user_email = (auth.jwt() ->> 'email')
  );

drop policy if exists push_subscriptions_update on public.push_subscriptions;
create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated
  using (
    public.current_user_is_admin()
    and user_email = (auth.jwt() ->> 'email')
  )
  with check (
    public.current_user_is_admin()
    and user_email = (auth.jwt() ->> 'email')
  );

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated
  using (
    public.current_user_is_admin()
    and user_email = (auth.jwt() ->> 'email')
  );


-- ── chore_runs.notified_at ───────────────────────────────────────────
alter table public.chore_runs
  add column if not exists notified_at timestamptz;
