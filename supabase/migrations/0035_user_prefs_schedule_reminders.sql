-- 0035 — per-user Schedule reminder preferences (S10 / Epic K).
--
-- The daily build/confirm push nudge (netlify/functions/schedule-reminder.mjs)
-- is opt-out per user, with a frequency. These columns live on the existing
-- per-user user_preferences row so the scheduled function (secret key, RLS
-- bypass) can read each subscriber's choice and the Settings UI can set it.
--
-- Additive only: two columns with safe defaults (enabled, daily) so existing
-- rows keep working unchanged. No data is moved or dropped.

alter table public.user_preferences
  add column if not exists schedule_reminder_enabled boolean not null
    default true;

alter table public.user_preferences
  add column if not exists schedule_reminder_frequency text not null
    default 'daily'
    check (schedule_reminder_frequency in ('daily', 'weekdays'));
