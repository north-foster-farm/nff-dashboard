-- 0022_feed_schedules_realtime.sql
-- Animals pages rethink (Batch 25.2).
--
-- feed_schedules / feed_schedule_stages were created in 0004 but never
-- added to the realtime publication — they had no editing surface, so
-- nothing needed to observe them. Batch 25.2 ships the feed schedule
-- editor (replacing the "Manage feed" placeholder), and the Feed
-- page's reorder projections (Batch 25.1) read consumption from these
-- tables, so edits need to propagate live to every open client.

do $$
declare
  t text;
begin
  foreach t in array array[
    'feed_schedules', 'feed_schedule_stages'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end $$;
