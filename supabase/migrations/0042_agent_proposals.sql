-- 0042_agent_proposals.sql
-- Agent proposals — a Claude-to-app action queue (additive only).
--
-- An external Claude agent (via the nff-dashboard MCP server) can't and
-- shouldn't write the app's real domain tables directly: creating a
-- project is a tail-ranked insert, an event is an RRULE + occurrence
-- tree, a chore fans out across anchors — invariants that live in the
-- React hooks, not in raw SQL. Instead the agent PROPOSES: it inserts a
-- row here, and the app surfaces it on the Proposals page for James to
-- approve. On approve the app runs the SAME create paths every in-app
-- create uses, so an approved proposal is indistinguishable from one
-- built by hand; on reject it's discarded. Nothing here ever mutates
-- domain data on its own.
--
-- Write path: the MCP server inserts with the SUPABASE_SECRET_KEY, which
-- bypasses RLS (same as scripts/backup-db.mjs). The app reads and
-- updates status under the usual admin gate. Because the only thing an
-- agent can do is enqueue a row James must approve, even a future public
-- (phone / claude.ai) endpoint can't corrupt real data.

create table if not exists public.agent_proposals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Which agent / surface queued it (free text, e.g. 'claude-mcp').
  source text,
  -- What the proposal creates. 'event' and 'chore' land in later slices
  -- but are allowed now so adding them needs no migration.
  kind text not null,
  -- Human-readable one-liner for the review card.
  title text not null,
  -- Claude's rationale / longer context ("why"), optional.
  summary text,
  -- The structured proposal the app's apply-handler consumes.
  payload jsonb not null default '{}'::jsonb,
  -- pending -> applied | rejected | failed. 'failed' keeps the error so
  -- James can fix and retry.
  status text not null default 'pending',
  -- What the apply produced (e.g. {"project_id": "..."}), set on apply.
  applied_ref jsonb,
  -- Failure detail when status = 'failed'.
  error text,
  -- Who acted and when (approve / reject).
  reviewed_by text,
  reviewed_at timestamptz,
  -- Optional note James leaves when rejecting.
  review_note text
);

-- Constrain kind + status (idempotent guards so a re-run never errors on
-- a duplicate constraint).
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'agent_proposals_kind_chk'
  ) then
    alter table public.agent_proposals
      add constraint agent_proposals_kind_chk
        check (kind in ('project', 'event', 'chore'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'agent_proposals_status_chk'
  ) then
    alter table public.agent_proposals
      add constraint agent_proposals_status_chk
        check (status in ('pending', 'applied', 'rejected', 'failed'));
  end if;
end $$;

-- The review queue: pending first, newest first.
create index if not exists agent_proposals_pending_idx
  on public.agent_proposals (created_at desc)
  where status = 'pending';

alter table public.agent_proposals enable row level security;

drop policy if exists agent_proposals_read on public.agent_proposals;
create policy agent_proposals_read on public.agent_proposals
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists agent_proposals_write on public.agent_proposals;
create policy agent_proposals_write on public.agent_proposals
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Realtime so a proposal queued from a phone shows up on the Proposals
-- page instantly.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'agent_proposals'
  ) then
    execute 'alter publication supabase_realtime '
      || 'add table public.agent_proposals';
  end if;
end $$;
