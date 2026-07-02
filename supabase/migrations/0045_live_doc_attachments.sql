-- 0045 — live HTML doc attachments (batch 42.8).
--
-- An attached .html file can be OPENED as a working page inside the
-- app: the viewer renders it in a sandboxed iframe and swaps the
-- page's localStorage for a per-attachment key/value store here, so
-- user-entered data persists to the database (and syncs realtime)
-- instead of one browser's localStorage.
--
--   attachment_doc_data  — the key/value store. One row per
--     localStorage key per attachment; per-KEY granularity so James
--     and Jim editing different keys (e.g. nff_draft_james vs
--     nff_draft_jim) can never clobber each other.
--   attachment_doc_locks — advisory write lock, one row per
--     attachment. Claimed on Edit, heartbeat-renewed while editing;
--     a stale heartbeat (~90s) is claimable, so a closed laptop lid
--     never wedges the doc.
--
-- Also: project_attachments grows a nullable phase_id so attachments
-- (and live docs) can hang off a phase, matching project/step.
-- Additive only — the app is live in production.

alter table public.project_attachments
  add column if not exists phase_id uuid
    references public.project_phases(id) on delete cascade;

create index if not exists project_attachments_phase_idx
  on public.project_attachments (phase_id);

-- ── attachment_doc_data ──────────────────────────────────────────────
create table if not exists public.attachment_doc_data (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null
    references public.project_attachments(id) on delete cascade,
  key text not null,
  value text,
  updated_at timestamptz not null default now(),
  updated_by text,
  unique (attachment_id, key)
);

create index if not exists attachment_doc_data_attachment_idx
  on public.attachment_doc_data (attachment_id);

alter table public.attachment_doc_data enable row level security;

drop policy if exists attachment_doc_data_all
  on public.attachment_doc_data;
create policy attachment_doc_data_all on public.attachment_doc_data
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- ── attachment_doc_locks ─────────────────────────────────────────────
create table if not exists public.attachment_doc_locks (
  attachment_id uuid primary key
    references public.project_attachments(id) on delete cascade,
  locked_by text not null,
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);

alter table public.attachment_doc_locks enable row level security;

drop policy if exists attachment_doc_locks_all
  on public.attachment_doc_locks;
create policy attachment_doc_locks_all on public.attachment_doc_locks
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- ── Realtime: doc edits + lock state sync across devices ────────────
do $$
declare t text;
begin
  foreach t in array
    array['attachment_doc_data', 'attachment_doc_locks'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.'
        || t;
    end if;
  end loop;
end $$;
