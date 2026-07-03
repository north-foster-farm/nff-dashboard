-- 0048_event_attachments — files attached to an event series (Batch
-- 42.15, F22d). Cut-size sheets for a processing day are now uploaded
-- files, not a free-text field. Mirrors project_attachments (0017): the
-- objects live in the SAME `project-files` Storage bucket (its policies
-- are bucket-scoped to admins, so an `events/<seriesId>/…` prefix is
-- already covered — no new bucket or storage policy needed); only the
-- metadata table is new.
--
-- Additive-only, per the production rules. Nothing is dropped: the old
-- payload.cut_sheet field simply stops being written (all prod values
-- were already null).

create table if not exists public.event_attachments (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null
    references public.event_series(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists event_attachments_series_idx
  on public.event_attachments (series_id);

alter table public.event_attachments enable row level security;

drop policy if exists event_attachments_read on public.event_attachments;
create policy event_attachments_read on public.event_attachments
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists event_attachments_write on public.event_attachments;
create policy event_attachments_write on public.event_attachments
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Realtime, matching every other domain table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'event_attachments'
  ) then
    alter publication supabase_realtime add table public.event_attachments;
  end if;
end $$;
