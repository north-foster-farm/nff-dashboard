-- 0007_activity_log_quality.sql
-- Activity feed quality improvements:
--   1. Debounce: rapid check → uncheck within 10s removes BOTH entries
--      from activity_log so a misclick doesn't leave a noisy
--      "James completed X" + "James un-checked X" pair.
--   2. Inline edit: a new `edited_summary` column lets the UI override
--      the generated summary text on a per-row basis.
--   3. Owner-scoped edit / delete RPCs callable from the client. RLS
--      stays restrictive (no direct UPDATE/DELETE policies); these RPCs
--      run as SECURITY DEFINER and check that the caller owns the row
--      before mutating. Preserves the audit-trail invariant — only the
--      author of an entry can rewrite or remove it.

-- ── edited_summary column ──────────────────────────────────────────────
alter table public.activity_log
  add column if not exists edited_summary text;

-- ── Trigger: debounce check↔uncheck within 10s ────────────────────────
-- Replaces the existing log_chore_uncompletion. The function checks for a
-- recently-logged `chore_completed` row that matches the same
-- (chore_id, completion_date) pair and deletes it instead of writing a
-- balancing `chore_uncompleted` entry, keeping the feed clean for
-- misclicks.
create or replace function public.log_chore_uncompletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
  recent_completion_id uuid;
begin
  actor := coalesce((auth.jwt() ->> 'email')::text, old.completed_by_email);

  select id into recent_completion_id
  from public.activity_log
  where kind = 'chore_completed'
    and (payload ->> 'chore_id') = old.chore_id
    and (payload ->> 'completion_date') = old.completion_date::text
    and occurred_at > now() - interval '10 seconds'
  order by occurred_at desc
  limit 1;

  if recent_completion_id is not null then
    -- Misclick — strip both legs of the pair.
    delete from public.activity_log where id = recent_completion_id;
    return old;
  end if;

  insert into public.activity_log (actor_email, kind, payload)
  values (
    actor,
    'chore_uncompleted',
    jsonb_build_object(
      'chore_id', old.chore_id,
      'completion_date', old.completion_date,
      'originally_completed_by', old.completed_by_email
    )
  );
  return old;
end;
$$;

-- Trigger binding doesn't change — the function name is the same — but
-- run create-or-replace just in case the trigger reference was dropped.
drop trigger if exists chore_uncompletion_logged on public.chore_completions;
create trigger chore_uncompletion_logged
  after delete on public.chore_completions
  for each row execute function public.log_chore_uncompletion();

-- Trigger-only function; not meant to be called as an RPC.
revoke execute on function public.log_chore_uncompletion()
  from public, anon, authenticated;


-- ── RPC: edit_activity_entry ───────────────────────────────────────────
-- Sets edited_summary on a row owned by the caller. Empty / whitespace-
-- only summaries are stored as NULL so the UI falls back to the
-- generated summary.
create or replace function public.edit_activity_entry(
  entry_id uuid,
  new_summary text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
begin
  if not public.current_user_is_admin() then
    raise exception 'not authorized';
  end if;
  caller_email := (auth.jwt() ->> 'email');

  update public.activity_log
  set edited_summary = nullif(btrim(new_summary), '')
  where id = entry_id
    and actor_email = caller_email;

  if not found then
    raise exception 'entry not found or not owned by caller';
  end if;
end;
$$;

revoke all on function public.edit_activity_entry(uuid, text) from public;
revoke execute on function public.edit_activity_entry(uuid, text) from anon;
grant execute on function public.edit_activity_entry(uuid, text) to authenticated;


-- ── RPC: delete_activity_entry ─────────────────────────────────────────
create or replace function public.delete_activity_entry(entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
begin
  if not public.current_user_is_admin() then
    raise exception 'not authorized';
  end if;
  caller_email := (auth.jwt() ->> 'email');

  delete from public.activity_log
  where id = entry_id
    and actor_email = caller_email;

  if not found then
    raise exception 'entry not found or not owned by caller';
  end if;
end;
$$;

revoke all on function public.delete_activity_entry(uuid) from public;
revoke execute on function public.delete_activity_entry(uuid) from anon;
grant execute on function public.delete_activity_entry(uuid) to authenticated;


-- Note on realtime: Supabase's default `supabase_realtime` publication
-- broadcasts INSERT, UPDATE, and DELETE for every table added to it. The
-- earlier migration (0002) already added activity_log to the publication,
-- so the UPDATE / DELETE events from edited_summary writes and the
-- delete_activity_entry RPC will propagate to subscribed clients without
-- additional changes here.
