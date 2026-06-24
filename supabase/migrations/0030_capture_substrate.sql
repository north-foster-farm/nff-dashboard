-- 0030_capture_substrate.sql
-- Schedule feature — S2: the versioned-capture substrate.
--
-- A reusable, app-wide pattern for long-term capture of versioned JSON
-- documents (per .ignored/schedule-feature/versioned-capture-substrate.md).
-- Each captured document is tagged with the exact (schema_id, version) it
-- was written at; the schema is a real JSON Schema, stored in the DB; when
-- a shape changes a new version + a pure code-side upcaster lift old docs
-- to the latest shape on read, so consumer code only handles the current
-- version. The Schedule's confirmed-day snapshot (S5) is the first
-- consumer; metrics / KPI / telemetry follow later.
--
-- ADDITIVE — new extension, two new tables, one RPC. Nothing existing is
-- touched. Each migration runs in a transaction, so a failure (e.g. the
-- pg_jsonschema sanity block below) rolls the whole thing back cleanly.

-- ── pg_jsonschema (server-side validation) ─────────────────────────────
-- Supabase first-party extension. `with schema extensions` keeps it out of
-- public (linter-clean); search_path below resolves it whether it lands in
-- extensions (fresh) or public (pre-existing).
create extension if not exists pg_jsonschema with schema extensions;
set search_path = public, extensions;

-- ── capture_schemas: the schema registry (DB mirror of the repo files) ──
create table if not exists public.capture_schemas (
  schema_id   text not null,                 -- dotted type, e.g. schedule.confirmed_day
  version     int  not null,                 -- monotonic per schema_id, from 1
  json_schema jsonb not null,                -- the JSON Schema (draft 2020-12)
  app_version text,                          -- meta.version at which it shipped
  status      text not null default 'active'
    check (status in ('active', 'deprecated')),
  notes       text,
  created_at  timestamptz not null default now(),
  primary key (schema_id, version)
);

alter table public.capture_schemas enable row level security;
drop policy if exists capture_schemas_read on public.capture_schemas;
create policy capture_schemas_read on public.capture_schemas
  for select to authenticated
  using (public.current_user_is_admin());
-- No client write policy — schemas are published by migration only.

-- ── captures: the append-only document store ───────────────────────────
create table if not exists public.captures (
  id            uuid primary key default gen_random_uuid(),  -- client-generated
  schema_id     text not null,
  schema_version int not null,
  subject_type  text,                         -- polymorphic owner, e.g. schedule_day
  subject_id    text,
  captured_on   date not null,                -- the business day (daily grain)
  captured_at   timestamptz not null default now(),
  actor_email   text,
  doc           jsonb not null,               -- valid against (schema_id, schema_version)
  supersedes    uuid references public.captures(id) on delete set null,
  foreign key (schema_id, schema_version)
    references public.capture_schemas(schema_id, version)
);

create index if not exists captures_schema_day_idx
  on public.captures (schema_id, captured_on);
create index if not exists captures_subject_idx
  on public.captures (subject_type, subject_id, captured_on);

alter table public.captures enable row level security;
drop policy if exists captures_read on public.captures;
create policy captures_read on public.captures
  for select to authenticated
  using (public.current_user_is_admin());
-- No client write policy — writes go through record_capture (below).

-- ── record_capture RPC ─────────────────────────────────────────────────
-- The single client-callable write path (rides the outbox like
-- log_run_event). Validates the doc against the stored JSON Schema with
-- pg_jsonschema before inserting, so a stale/buggy client can't write a
-- malformed durable record. Idempotent on the client-generated id.
create or replace function public.record_capture(
  p_id uuid,
  p_schema_id text,
  p_schema_version int,
  p_captured_on date,
  p_doc jsonb,
  p_subject_type text default null,
  p_subject_id text default null,
  p_supersedes uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_email text;
  v_schema jsonb;
  v_existing uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'not authorized';
  end if;
  caller_email := (auth.jwt() ->> 'email');

  -- Idempotent replay: same client id already stored -> return it.
  select id into v_existing from public.captures where id = p_id;
  if v_existing is not null then
    return v_existing;
  end if;

  select json_schema into v_schema
    from public.capture_schemas
    where schema_id = p_schema_id and version = p_schema_version;
  if v_schema is null then
    raise exception 'unknown capture schema %/%', p_schema_id, p_schema_version;
  end if;

  if not jsonb_matches_schema(schema := v_schema::json, instance := p_doc) then
    raise exception 'capture doc fails schema %/%: %',
      p_schema_id, p_schema_version,
      array_to_string(
        jsonschema_validation_errors(v_schema::json, p_doc::json), '; ');
  end if;

  insert into public.captures
    (id, schema_id, schema_version, subject_type, subject_id,
     captured_on, actor_email, doc, supersedes)
  values
    (p_id, p_schema_id, p_schema_version, p_subject_type, p_subject_id,
     p_captured_on, caller_email, p_doc, p_supersedes);

  return p_id;
end;
$$;

revoke all on function public.record_capture(
  uuid, text, int, date, jsonb, text, text, uuid) from public;
revoke execute on function public.record_capture(
  uuid, text, int, date, jsonb, text, text, uuid) from anon;
grant execute on function public.record_capture(
  uuid, text, int, date, jsonb, text, text, uuid) to authenticated;

-- ── realtime ───────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'captures') then
    execute 'alter publication supabase_realtime add table public.captures';
  end if;
end $$;

-- ── publish schedule.confirmed_day v1 ──────────────────────────────────
-- First consumer's schema. Canonical copy lives at
-- src/lib/capture/schemas/schedule.confirmed_day/v1.schema.json — keep the
-- two identical (future schema versions get their own migration).
insert into public.capture_schemas (schema_id, version, json_schema, app_version, notes)
values (
  'schedule.confirmed_day', 1,
  '{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "schedule.confirmed_day/v1",
    "title": "Confirmed day (v1)",
    "type": "object",
    "additionalProperties": false,
    "required": ["date", "confirmed_by", "confirmed_at", "blocks"],
    "properties": {
      "date": { "type": "string" },
      "confirmed_by": { "type": "string" },
      "confirmed_at": { "type": "string" },
      "people": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["name"],
          "properties": {
            "name": { "type": "string" },
            "planned_start": { "type": ["string", "null"] },
            "actual_start": { "type": ["string", "null"] }
          }
        }
      },
      "blocks": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["block_id", "label"],
          "properties": {
            "block_id": { "type": "string" },
            "label": { "type": "string" },
            "planned_start": { "type": ["string", "null"] },
            "planned_end": { "type": ["string", "null"] }
          }
        }
      },
      "shoulds": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["ref", "label", "outcome"],
          "properties": {
            "ref": { "type": "string" },
            "label": { "type": "string" },
            "outcome": { "type": "string", "enum": ["pulled", "deferred"] },
            "reason": { "type": ["string", "null"] },
            "hard_deadline": { "type": ["string", "null"] }
          }
        }
      },
      "entries": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["source_type", "label"],
          "properties": {
            "source_type": { "type": "string" },
            "source_ref": {},
            "label": { "type": "string" },
            "block_id": { "type": ["string", "null"] },
            "clock_time": { "type": ["string", "null"] },
            "assignee": { "type": ["string", "null"] }
          }
        }
      }
    }
  }'::jsonb,
  '0.10.43-alpha',
  'First consumer of the capture substrate (S2). Frozen planned shape per scope-document.md 2.4; may go to v2 in S5.'
)
on conflict (schema_id, version) do nothing;

-- ── pg_jsonschema sanity (fails the migration if validation is broken) ──
-- Proves jsonb_matches_schema both accepts a valid doc and rejects an
-- invalid one, at push time, inside the transaction.
do $$
begin
  if not jsonb_matches_schema(
    '{"type":"object","required":["a"]}'::json, '{"a":1}'::jsonb) then
    raise exception 'pg_jsonschema sanity: a valid doc was rejected';
  end if;
  if jsonb_matches_schema(
    '{"type":"object","required":["a"]}'::json, '{}'::jsonb) then
    raise exception 'pg_jsonschema sanity: an invalid doc was accepted';
  end if;
end $$;
