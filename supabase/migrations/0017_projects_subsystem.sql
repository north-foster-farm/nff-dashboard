-- 0017_projects_subsystem.sql
-- Projects subsystem rewrite (Batch 22).
--
-- Hierarchy: Project → Phase → Step → Checklist → Checklist item.
--
--   projects                — extended (additive) from the Batch-4 stub:
--                             markdown body, archiving, created_by,
--                             sort_order, updated_at.
--   project_phases          — ordered phases inside a project. A phase
--                             whose steps are all complete (or that is
--                             explicitly checked off) counts as a
--                             "milestone reached".
--   project_steps           — ordered steps inside a phase. The unit of
--                             real work: markdown body, assignees,
--                             start/target dates, completion.
--   project_checklists      — named checklists inside a step (the
--                             Trello pattern: a step can carry several).
--   project_checklist_items — checkable items inside a checklist.
--   project_links           — cross-links from a project to other
--                             entities (event series, chores, places,
--                             other projects).
--   project_dependencies    — step-level "X blocks Y" edges. When a
--                             predecessor's dates move and
--                             shift_dependents is true, dependents'
--                             dates shift by the same delta
--                             (lib/projectProgress.js owns the math —
--                             the DB just stores the edges).
--   project_attachments     — metadata for Supabase Storage uploads
--                             (bucket `project-files`); the object
--                             itself lives in Storage.
--
-- Completeness rule (computed client-side, no DB state):
--   phases > 1  → milestones drive % ("x/y milestones reached")
--   phases == 1 → steps drive %      ("x/y steps complete")

-- ── projects (extend the Batch-4 stub, additive only) ────────────────
alter table public.projects
  add column if not exists body_md text,
  add column if not exists created_by text,
  add column if not exists archived_at timestamptz,
  add column if not exists sort_order int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_projects_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_projects_updated_at();

create index if not exists projects_active_idx
  on public.projects (sort_order, created_at desc)
  where archived_at is null;


-- ── project_phases ───────────────────────────────────────────────────
create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.projects(id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0,
  start_date date,
  target_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_phases_project_idx
  on public.project_phases (project_id, sort_order);

create or replace function public.touch_project_phases_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists project_phases_touch_updated_at
  on public.project_phases;
create trigger project_phases_touch_updated_at
  before update on public.project_phases
  for each row execute function public.touch_project_phases_updated_at();

alter table public.project_phases enable row level security;

drop policy if exists project_phases_read on public.project_phases;
create policy project_phases_read on public.project_phases
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists project_phases_write on public.project_phases;
create policy project_phases_write on public.project_phases
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── project_steps ────────────────────────────────────────────────────
-- project_id is denormalized (derivable via phase_id) so the detail
-- page can fetch every step of a project in one query and RLS/indexes
-- stay simple.
create table if not exists public.project_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.projects(id) on delete cascade,
  phase_id uuid not null
    references public.project_phases(id) on delete cascade,
  title text not null,
  body_md text,
  sort_order int not null default 0,
  start_date date,
  target_date date,
  completed_at timestamptz,
  -- Display names, same convention as chore_assignment_rules.assignees
  -- ("James", "Jim"). jsonb array of strings.
  assignees jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_steps_project_idx
  on public.project_steps (project_id);
create index if not exists project_steps_phase_idx
  on public.project_steps (phase_id, sort_order);

create or replace function public.touch_project_steps_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists project_steps_touch_updated_at
  on public.project_steps;
create trigger project_steps_touch_updated_at
  before update on public.project_steps
  for each row execute function public.touch_project_steps_updated_at();

alter table public.project_steps enable row level security;

drop policy if exists project_steps_read on public.project_steps;
create policy project_steps_read on public.project_steps
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists project_steps_write on public.project_steps;
create policy project_steps_write on public.project_steps
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── project_checklists ───────────────────────────────────────────────
create table if not exists public.project_checklists (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null
    references public.project_steps(id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists project_checklists_step_idx
  on public.project_checklists (step_id, sort_order);

alter table public.project_checklists enable row level security;

drop policy if exists project_checklists_read on public.project_checklists;
create policy project_checklists_read on public.project_checklists
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists project_checklists_write on public.project_checklists;
create policy project_checklists_write on public.project_checklists
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── project_checklist_items ──────────────────────────────────────────
create table if not exists public.project_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null
    references public.project_checklists(id) on delete cascade,
  body text not null,
  done_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists project_checklist_items_checklist_idx
  on public.project_checklist_items (checklist_id, sort_order);

alter table public.project_checklist_items enable row level security;

drop policy if exists project_checklist_items_read
  on public.project_checklist_items;
create policy project_checklist_items_read on public.project_checklist_items
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists project_checklist_items_write
  on public.project_checklist_items;
create policy project_checklist_items_write on public.project_checklist_items
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── project_links ────────────────────────────────────────────────────
-- Cross-links from a project to other entities. target_kind is text
-- (not an enum) so new linkable kinds don't need a migration:
--   'event_series' | 'chore' | 'place' | 'project'
-- target_id is text to accommodate non-uuid ids (chore ids are text).
create table if not exists public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.projects(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  label text,
  created_at timestamptz not null default now(),
  unique (project_id, target_kind, target_id)
);

create index if not exists project_links_project_idx
  on public.project_links (project_id);
create index if not exists project_links_target_idx
  on public.project_links (target_kind, target_id);

alter table public.project_links enable row level security;

drop policy if exists project_links_read on public.project_links;
create policy project_links_read on public.project_links
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists project_links_write on public.project_links;
create policy project_links_write on public.project_links
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── project_dependencies ─────────────────────────────────────────────
-- "predecessor blocks dependent" edges between steps of the same
-- project. shift_dependents: when the predecessor's dates move, shift
-- every (transitive) dependent's dates by the same number of days.
create table if not exists public.project_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.projects(id) on delete cascade,
  predecessor_step_id uuid not null
    references public.project_steps(id) on delete cascade,
  dependent_step_id uuid not null
    references public.project_steps(id) on delete cascade,
  shift_dependents boolean not null default true,
  created_at timestamptz not null default now(),
  unique (predecessor_step_id, dependent_step_id),
  check (predecessor_step_id <> dependent_step_id)
);

create index if not exists project_dependencies_project_idx
  on public.project_dependencies (project_id);
create index if not exists project_dependencies_predecessor_idx
  on public.project_dependencies (predecessor_step_id);
create index if not exists project_dependencies_dependent_idx
  on public.project_dependencies (dependent_step_id);

alter table public.project_dependencies enable row level security;

drop policy if exists project_dependencies_read on public.project_dependencies;
create policy project_dependencies_read on public.project_dependencies
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists project_dependencies_write on public.project_dependencies;
create policy project_dependencies_write on public.project_dependencies
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── project_attachments ──────────────────────────────────────────────
-- Metadata rows for files uploaded to the `project-files` Storage
-- bucket. step_id is nullable — an attachment can hang off the project
-- itself (cover photos, reference docs) or off a specific step.
create table if not exists public.project_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.projects(id) on delete cascade,
  step_id uuid
    references public.project_steps(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists project_attachments_project_idx
  on public.project_attachments (project_id);
create index if not exists project_attachments_step_idx
  on public.project_attachments (step_id);

alter table public.project_attachments enable row level security;

drop policy if exists project_attachments_read on public.project_attachments;
create policy project_attachments_read on public.project_attachments
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists project_attachments_write on public.project_attachments;
create policy project_attachments_write on public.project_attachments
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── projects RLS already exists (0006); realtime for everything ──────
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'project_phases', 'project_steps', 'project_checklists',
    'project_checklist_items', 'project_links', 'project_dependencies',
    'project_attachments'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end $$;


-- ── Storage: the project-files bucket ────────────────────────────────
-- Bucket creation is a plain insert (works under the postgres role).
-- Policies on storage.objects need table ownership, which newer hosted
-- Supabase projects reserve for supabase_storage_admin — so they're
-- attempted in a guarded block. If the block raises a warning, add the
-- four policies by hand: Dashboard → Storage → project-files →
-- Policies → "give admins full access" (select/insert/update/delete
-- for authenticated, USING bucket_id = 'project-files' AND
-- public.current_user_is_admin()).
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

do $$
begin
  begin
    execute $pol$
      create policy project_files_select on storage.objects
        for select to authenticated
        using (
          bucket_id = 'project-files'
          and public.current_user_is_admin()
        )
    $pol$;
    execute $pol$
      create policy project_files_insert on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'project-files'
          and public.current_user_is_admin()
        )
    $pol$;
    execute $pol$
      create policy project_files_update on storage.objects
        for update to authenticated
        using (
          bucket_id = 'project-files'
          and public.current_user_is_admin()
        )
    $pol$;
    execute $pol$
      create policy project_files_delete on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'project-files'
          and public.current_user_is_admin()
        )
    $pol$;
  exception
    when insufficient_privilege then
      raise warning
        'storage.objects policies not created (insufficient privilege) — add them via the Dashboard';
    when duplicate_object then
      null; -- policies already exist (re-run)
  end;
end $$;
