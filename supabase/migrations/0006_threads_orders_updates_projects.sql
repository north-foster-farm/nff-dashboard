-- ============================================================================
-- 0006_threads_orders_updates_projects.sql
-- ============================================================================
-- Final slice of the reference-data migration. Covers the CRM/operational
-- domain — the "things you'll edit during the day" that aren't already
-- schema-rich enough to warrant their own batch:
--
--   threads    — the open-question / decision-record list (seeded from JSON)
--   orders     — customer orders (schema only, empty at launch)
--   updates    — short-form farm news / posts (schema only, empty)
--   projects   — multi-step initiatives (schema only, empty)
--
-- Threads are the only one with seed data because they're the only one
-- the team has actually been maintaining in JSON. Orders / updates /
-- projects all have shapes the UI already reads (orders.status, etc.) but
-- empty arrays — we lock the schemas down now so future editing UIs land
-- without further migrations.
--
-- Apply: paste into Supabase → SQL Editor → Run.
-- ============================================================================


-- ── threads ────────────────────────────────────────────────────────────────
-- Status is text, not an enum, so a future "in_progress" / "blocked" /
-- "wont_fix" doesn't require an enum migration. UI filters by string match.
create table if not exists public.threads (
  id text primary key,
  title text not null,
  question text,
  status text not null default 'open',
  resolution text,
  notes text,
  ordinal integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists threads_status_idx
  on public.threads (status);

-- updated_at trigger so editing a thread automatically bumps the timestamp.
-- Pattern reused from migration 0001's chore_completions setup.
create or replace function public.touch_threads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists threads_touch_updated_at on public.threads;
create trigger threads_touch_updated_at
  before update on public.threads
  for each row execute function public.touch_threads_updated_at();

alter table public.threads enable row level security;

drop policy if exists threads_read on public.threads;
create policy threads_read on public.threads
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists threads_write on public.threads;
create policy threads_write on public.threads
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── orders ─────────────────────────────────────────────────────────────────
-- Empty at launch. Shape derived from how Overview.jsx reads orders:
-- `o.status === "open" || o.status === "pending"`. UUID id because orders
-- will be created from a UI form rather than seeded.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  status text not null default 'open',
  total_cents integer,
  notes text,
  placed_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  line_items jsonb not null default '[]'::jsonb
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_placed_idx on public.orders (placed_at desc);

alter table public.orders enable row level security;

drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists orders_write on public.orders;
create policy orders_write on public.orders
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── updates ────────────────────────────────────────────────────────────────
-- Short-form farm news. Status reflects the editorial workflow Overview.jsx
-- already keys off of (`ready_for_review`, `reviewed`).
create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  status text not null default 'draft',
  author_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists updates_status_idx on public.updates (status);
create index if not exists updates_created_idx on public.updates (created_at desc);

alter table public.updates enable row level security;

drop policy if exists updates_read on public.updates;
create policy updates_read on public.updates
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists updates_write on public.updates;
create policy updates_write on public.updates
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── projects ───────────────────────────────────────────────────────────────
-- Multi-step initiatives. Overview.jsx filters by `status === "in_progress"`.
-- Stub schema — fields chosen to support a future Kanban-style board if
-- that materializes, without forcing it.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'planned',
  owner_email text,
  started_at date,
  target_date date,
  completed_at date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists projects_status_idx on public.projects (status);

alter table public.projects enable row level security;

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ============================================================================
-- Threads seed block — appended by scripts/gen-batch4-seed.mjs.
-- ============================================================================
insert into public.threads (
  id, title, question, status, resolution, notes, ordinal
)
select id, title, question, status, resolution, notes, ordinal
from jsonb_to_recordset($seed$
[
  {
    "id": "thread_customers_in_admin",
    "title": "Customers: same app or separate app?",
    "question": "Will customers log in to this same admin app to see their orders, or get a separate customer-facing app?",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 1
  },
  {
    "id": "thread_sheep_data",
    "title": "Sheep are unaccounted for in livestock",
    "question": "Sheep referenced in chore but no livestock data provided.",
    "status": "resolved",
    "resolution": "3 Katahdin sheep — Lily, Ivy, Violet. Pets, no production. Consolidated into a single group 'Lily, Ivy, and Violet'.",
    "notes": null,
    "ordinal": 2
  },
  {
    "id": "thread_spaces_section",
    "title": "Spaces / Infrastructure as a top-level section?",
    "question": "First-class entities or inline labels?",
    "status": "resolved",
    "resolution": "Yes — top-level section with kinds + items structure.",
    "notes": null,
    "ordinal": 3
  },
  {
    "id": "thread_suppliers_section",
    "title": "Suppliers as a top-level section?",
    "question": "Top-level Suppliers, or kept inline?",
    "status": "resolved",
    "resolution": "Yes — top-level section.",
    "notes": null,
    "ordinal": 4
  },
  {
    "id": "thread_chore_recurrence_model",
    "title": "Chore recurrence semantics",
    "question": "Need a recurrence model rich enough for daily, twice-daily, weekly, and conditional schedules.",
    "status": "resolved",
    "resolution": "Specific times, ranges, multiple times/ranges, sunrise/sunset anchors, and conditional state-based recurrence.",
    "notes": null,
    "ordinal": 5
  },
  {
    "id": "thread_chore_edit_scope_ux",
    "title": "Chore edit scope UX",
    "question": "Adopt Google Calendar's edit-scope pattern?",
    "status": "resolved",
    "resolution": "Yes. 'This instance / this and following / all instances.' Past completions are immutable.",
    "notes": null,
    "ordinal": 6
  },
  {
    "id": "thread_events_taxonomy",
    "title": "Generic event/log substrate?",
    "question": "What's the data model for chore completions, temp readings, feed logs?",
    "status": "resolved",
    "resolution": "Polymorphic discriminated union. 'Event' is reserved for sales occasions and is its own top-level menu category.",
    "notes": null,
    "ordinal": 7
  },
  {
    "id": "thread_pasture_compliance",
    "title": "Pasture-raised compliance computation",
    "question": "Hard alert or soft KPI?",
    "status": "resolved",
    "resolution": "Soft KPI.",
    "notes": null,
    "ordinal": 8
  },
  {
    "id": "thread_log_naming_convention",
    "title": "Log naming convention",
    "question": "Naming for the polymorphic log base type.",
    "status": "resolved",
    "resolution": "'LogEntry' base; subtypes follow '<Domain>Log'.",
    "notes": null,
    "ordinal": 9
  },
  {
    "id": "thread_tractor_terminology",
    "title": "Tractor terminology convention",
    "question": "'Tractor' is overloaded.",
    "status": "resolved",
    "resolution": "'Tractor' (unqualified) means the Kubota or future agricultural utility vehicle. 'Chicken tractor' means the mobile broiler pens.",
    "notes": null,
    "ordinal": 10
  },
  {
    "id": "thread_market_details",
    "title": "Farmers market details",
    "question": "Which market(s)? Day(s), location, season dates, vendor fees.",
    "status": "resolved",
    "resolution": "Three markets captured: Scituate Rotary (Sat 9–1, May 9 – Nov 1, North Scituate); Foster Farmers Market (Sun 9–12, Jun 1 – Nov 1, Foster); Summer Market at Tilted Barn (Wed 4–7pm, Jun 3 2025 – Aug 26 2026, Exeter — date range to verify). Vendor fees and setup/breakdown still TBD.",
    "notes": null,
    "ordinal": 11
  },
  {
    "id": "thread_egg_drop_details",
    "title": "Egg drop details",
    "question": "Location, day/time, customer list management, products sold.",
    "status": "resolved",
    "resolution": "Scituate Egg Drop, Saturdays 10–11 AM, Nov 2 – April 30, at 46 Institute Lane (same site as Scituate Rotary). Customer list management and product range still TBD.",
    "notes": null,
    "ordinal": 12
  },
  {
    "id": "thread_broiler_batches_data",
    "title": "Broiler batches need their own structured data",
    "question": "Each batch needs arrival, count, processing date, week-by-week feed, mortality, location.",
    "status": "open",
    "resolution": null,
    "notes": "Partially populated: Batch 1 and Batch 2 captured (count=275 each). Still TBD: arrival/processing dates, locations, status, feed consumption, mortality.",
    "ordinal": 13
  },
  {
    "id": "thread_brooder_temp_schedule",
    "title": "Full brooder temperature schedule",
    "question": "Week 1 = 85°F. The full week-by-week schedule wasn't specified.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 14
  },
  {
    "id": "thread_feed_schedule",
    "title": "Full broiler feed schedule (amounts)",
    "question": "Week-by-week feed amounts for the broiler cycle.",
    "status": "open",
    "resolution": null,
    "notes": "Stage feed types resolved (starter / grower / finisher). Amounts captured for weeks 1–4. Weeks 5–7 still TBD.",
    "ordinal": 15
  },
  {
    "id": "thread_chore_completion_ux",
    "title": "Chore completion UX (likely mobile-first)",
    "question": "Confirm mobile-first design priority for the completion flow.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 16
  },
  {
    "id": "thread_recurrence_state_model",
    "title": "State model for conditional chore recurrence",
    "question": "Conditional recurrence needs a state expression language.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 17
  },
  {
    "id": "thread_layer_pasture_specs",
    "title": "Layer pasture specs",
    "question": "Need dimensions and satellite-image boundary.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 18
  },
  {
    "id": "thread_chicken_tractor_inventory",
    "title": "Chicken tractor inventory and specs",
    "question": "How many? Identifiers? Capacity?",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 19
  },
  {
    "id": "thread_brooder_specs",
    "title": "Brooder specs",
    "question": "B1 and B2 — physical location, capacity, heat source, dimensions.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 20
  },
  {
    "id": "thread_mobile_coop_specs",
    "title": "Mobile coop specs",
    "question": "MC1 and MC2 — capacity, dimensions, build details.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 21
  },
  {
    "id": "thread_specific_suppliers",
    "title": "Specific supplier identities",
    "question": "Names, contacts, terms for pullet sources and chick hatchery.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 22
  },
  {
    "id": "thread_machine_management",
    "title": "Machine management depth",
    "question": "Maintenance logs, hours tracking, attachments inventory — or lightweight reference list for now?",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 23
  },
  {
    "id": "thread_sheep_location",
    "title": "Sheep enclosure / location",
    "question": "Where do Lily, Ivy, and Violet live? Should their enclosure be a Space?",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 24
  },
  {
    "id": "thread_layer_arrival_history",
    "title": "Arrival dates for older layer generations",
    "question": "No bands and blue bands have unknown arrival dates.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 25
  },
  {
    "id": "thread_age_format_gap",
    "title": "Age formatting: 5–8 week gap",
    "question": "Spec listed [1-4] weeks then [2-11] months. Confirm interpretation (currently: weeks for ≤4 weeks, months for 1–11 months, '1 year' exact, then 'Y years, M months').",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 26
  },
  {
    "id": "thread_log_storage",
    "title": "Log storage architecture",
    "question": "Where do LogEntry instances live? Single global array vs. distributed by domain.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 27
  },
  {
    "id": "thread_tilted_barn_date_range",
    "title": "Tilted Barn market date range",
    "question": "Captured range is 'June 3, 2025 – August 26, 2026' — 14 months continuous, unusual for a summer market. Likely a typo (should both years be 2026?). Confirm.",
    "status": "resolved",
    "resolution": "Confirmed both years are 2026. Season runs June 3, 2026 – August 26, 2026.",
    "notes": null,
    "ordinal": 28
  },
  {
    "id": "thread_popup_event_year",
    "title": "Year on pop-up event dates",
    "question": "The source image listed pop-up dates without a year. Claude assumed 2026.",
    "status": "resolved",
    "resolution": "Confirmed: 2026 is correct.",
    "notes": null,
    "ordinal": 29
  },
  {
    "id": "thread_feed_specifics",
    "title": "Feed specifics — supplier, prices, lead times",
    "question": "Cost-per-lb figures, reorder points, reorder quantities, lead times, and package sizes are illustrative placeholders. Replace with real figures from the actual feed mill and hay supplier.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 30
  },
  {
    "id": "thread_broiler_feed_pattern",
    "title": "Broiler feed amount pattern (decreasing?)",
    "question": "Week 3 = 100 lb/day, week 4 = 75 lb/day. Decreasing consumption is unusual for Cornish Cross. Confirm pattern direction and fill in weeks 5–7.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 31
  },
  {
    "id": "thread_schedule_full_scope",
    "title": "Schedule view — full feature set deferred",
    "question": "Prototype has calendar, timeline, filters, click-to-detail. Deferred: drag-and-drop, in-place editing, GCal push-sync, multi-month views.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 32
  },
  {
    "id": "thread_chore_schedule_population",
    "title": "Chores need specific times to populate Schedule",
    "question": "Most chores still have when=TBD. Until specific times are defined, the Schedule's Chores filter has nothing to render.",
    "status": "resolved",
    "resolution": "Replaced TBD chore data with the full structured schedule (daily AM / PM / evening, weekly, twice-weekly, monthly). Chore definitions now carry frequency, period, startTime, deadline, and optional per-day-of-week assignment.",
    "notes": null,
    "ordinal": 33
  },
  {
    "id": "thread_breed_correction",
    "title": "Broiler breed correction",
    "question": "Earlier capture said 'Cornish Rock Hybrid'.",
    "status": "resolved",
    "resolution": "Corrected to 'Cornish Cross (straight run)' across livestock, supplier descriptions, and feed-pattern thread.",
    "notes": null,
    "ordinal": 34
  },
  {
    "id": "thread_processing_yields",
    "title": "Processing yields — confirm with processor",
    "question": "Industry rule-of-thumb yields seeded in costs.broilers.yieldDressedBreakdown (live→dressed 0.70; breast 32% / thighs 17% / drumsticks 11% / wings 11% / frame 29%). Confirm or correct after first processing day.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 35
  },
  {
    "id": "thread_chick_cost",
    "title": "Broiler chick purchase cost",
    "question": "Per-chick cost from the hatchery is needed to complete cost-per-bird math. Currently null in costs.broilers.chickPurchasePerBird.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 36
  },
  {
    "id": "thread_batch_assignment",
    "title": "Broiler batches for the 8 processing days",
    "question": "8 processing days are scheduled (May 4 → Oct 6, 2026), but only 2 placeholder batches exist in livestock.broilers.groups. Need to define one batch per processing day with arrival date (≈5–7 weeks before) and assign batchId on each processing event. UI for assigning a batch to a processing day is also pending.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 37
  },
  {
    "id": "thread_packaging_cost",
    "title": "Packaging costs (egg cartons, chicken bags, labels)",
    "question": "Per-dozen carton/label cost, per-whole-bird bag cost, per-cut-package bag/label cost. Probably small but needed to close the COGS picture.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 38
  },
  {
    "id": "thread_whole_vs_cut_ratio",
    "title": "Whole-vs-cut ratio per batch",
    "question": "What fraction of each broiler batch goes whole vs broken into cuts? Plan: ask processor for a recommendation on the first batch, then refine based on actual sales mix.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 39
  },
  {
    "id": "thread_egg_inventory_model",
    "title": "Egg inventory: count-before-market vs log-as-collected",
    "question": "Current practice is to count cartons just before going to a market. Future option is daily collection logging that builds up the lot in real time.",
    "status": "open",
    "resolution": null,
    "notes": "Captured for now as count-before-market: lots exist by collectionDate but quantities are entered/updated when convenient. Schema supports both flows without migration.",
    "ordinal": 40
  },
  {
    "id": "thread_pricing_targets",
    "title": "Pricing targets / margin policy",
    "question": "What target gross margin per SKU (or per category — eggs vs whole vs cuts)? Needed before the Products page can surface concrete recommended prices.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 41
  },
  {
    "id": "thread_processing_day_process",
    "title": "Broiler processing day — define the process",
    "question": "Steps from transport to processor through inventory creation. Captured at a high level (transport → pickup → sort by size & cut → create lots → compute batch cost). Worth a formal Process entry once Processes section is built.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 42
  },
  {
    "id": "thread_seasonal_availability",
    "title": "Seasonal availability per product",
    "question": "Eggs are year-round; broilers/cuts only available after each processing day until sold out. Surface availability windows in Products view eventually.",
    "status": "open",
    "resolution": null,
    "notes": null,
    "ordinal": 43
  }
]
$seed$::jsonb) as x(
  id text, title text, question text, status text,
  resolution text, notes text, ordinal integer
)
on conflict (id) do update set
  title = excluded.title,
  question = excluded.question,
  status = excluded.status,
  resolution = excluded.resolution,
  notes = excluded.notes,
  ordinal = excluded.ordinal;
