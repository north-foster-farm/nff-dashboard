-- 0054: take EXECUTE away from anon on every SECURITY DEFINER function
-- that still had it.
--
-- Supabase grants anon and authenticated execute on a new function by
-- default, and `revoke ... from public` does not remove those explicit
-- grants. Earlier migrations revoked them function by function; four
-- were missed:
--
--   current_user_is_admin()                 anon may call it. It reads
--                                           auth.uid(), so for anon it
--                                           answers false; no data.
--   fire_batch_created_automations()        trigger functions: Postgres
--   fire_feed_reorder_automations()         refuses to run them outside
--   retire_once_chores()                    a trigger, so they were not
--                                           reachable as RPCs either.
--
-- The trigger functions run as the table owner, so no role needs
-- EXECUTE (the same lock-down 0007 gave the others). The admin check
-- stays callable by signed-in users, which the policies rely on.
--
-- scripts/rls/rls.test.js fails the build if a
-- definer function is ever left callable by anon again.
--
-- Additive and idempotent; touches no data.

revoke execute on function public.current_user_is_admin() from anon;

revoke execute on function public.fire_batch_created_automations()
  from public, anon, authenticated;
revoke execute on function public.fire_feed_reorder_automations()
  from public, anon, authenticated;
revoke execute on function public.retire_once_chores()
  from public, anon, authenticated;
