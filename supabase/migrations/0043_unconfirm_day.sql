-- 0043 — un-confirm a day (42.3 round 4).
--
-- The captures substrate is append-only by design (0030: the only write
-- path is the record_capture RPC). Un-confirming a schedule day — tap
-- the "Confirmed" chip to revert the day to a draft — is the one place a
-- capture must actually go away: any surviving row reads as "confirmed"
-- to the day header and the week/month confirmed-day stamps.
--
-- Additive only: a DELETE policy scoped to the one schema this applies
-- to. Nothing else may be deleted; the substrate stays append-only for
-- every other capture kind.

drop policy if exists captures_delete_confirmed_day on public.captures;
create policy captures_delete_confirmed_day on public.captures
  for delete to authenticated
  using (
    public.current_user_is_admin()
    and schema_id = 'schedule.confirmed_day'
  );
