-- ============================================================================
-- 0001_auth_admins.sql — admin allowlist for NFF dashboard
-- ============================================================================
-- This migration creates the single gate that decides "can this authenticated
-- user use the app at all?" Google OAuth gets someone *into* auth.users with
-- a verified email; this table decides whether that email is allowed to
-- actually see the app. Every future table's RLS policies will reference the
-- `public.current_user_is_admin()` function defined below.
--
-- Apply: paste this file into Supabase → SQL Editor → Run.
-- Idempotent: safe to re-run (uses `create ... if not exists` / `create or
-- replace` / `on conflict do nothing` throughout).
-- ============================================================================

-- ── Allowlist table ─────────────────────────────────────────────────────────
-- Keyed by email (not user_id) so rows can be seeded BEFORE the user has
-- ever logged in. On first login, Google verifies the email and the session's
-- JWT will carry it; we match against this table to gate access.
create table if not exists public.admins (
  email text primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- ── Seed the two admins ─────────────────────────────────────────────────────
-- Safe to re-run: `on conflict do nothing` leaves existing rows alone.
insert into public.admins (email, display_name) values
  ('james@northfosterfarm.com', 'James'),
  ('jim@northfosterfarm.com',   'Jim')
on conflict (email) do nothing;

-- ── Lock down direct reads ──────────────────────────────────────────────────
-- RLS enabled with no policies = nobody can select/insert/update/delete
-- directly. Access only flows through the SECURITY DEFINER function below,
-- which is the one controlled entry point.
alter table public.admins enable row level security;

-- ── The one function every RLS policy will use ─────────────────────────────
-- SECURITY DEFINER lets this function read `public.admins` even though the
-- caller (an authenticated user) has no direct select permission. The
-- `set search_path = public` line is a hardening best practice — without it
-- a malicious schema-shadowing attack could redirect the `admins` lookup.
--
-- auth.jwt() returns the decoded JWT claims; Google OAuth puts the verified
-- Gmail address in the `email` claim.
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where email = (auth.jwt() ->> 'email')
  );
$$;

-- Authenticated users can call it; anon users can't (they'd always get
-- false anyway since auth.jwt() is null, but this makes the intent explicit).
revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;
