-- 0050_layer_lifecycle — give layers the same two-part lifecycle as
-- broilers (Batch 42.17, F20.2), now that processes can be species-
-- scoped (0049).
--
-- The pattern mirrors the post-0038 broiler setup exactly:
--   * an automation ("Layer batch arrival") whose only job is to create
--     the arrival EVENT (batch_milestones) when a layer group is added
--     — the anchor the process hangs off;
--   * a species-scoped process ("Layer pasture (lifecycle)") that
--     expands off that arrival event into the lifecycle CHORES:
--       - Move to pasture   +20 days  (batch-anchored)
--       - Brooder cleanout  +27 days  (~1 week after the move;
--                                      former-occupancy 'brooder' anchor)
-- Offsets are the editable defaults James gave (~20d move, ~1wk after);
-- tune them later in the process editor.
--
-- Additive + idempotent (guards on name). Because the process is scoped
-- species_id='layers' (and broiler processes were scoped in 0049),
-- neither species' lifecycle can fire on the other's arrival.

-- ── 1. arrival automation (creates the anchor event only) ────────────
insert into public.automations (name, trigger_kind, trigger_config, actions)
select
  'Layer batch arrival',
  'batch_created',
  jsonb_build_object('species_id', 'layers'),
  '[
    {"type": "event", "role": "arrival",
     "kind_id": "batch_milestones", "label": "{batch} — arrival"}
  ]'::jsonb
where not exists (
  select 1 from public.automations where name = 'Layer batch arrival'
);

-- ── 2. lifecycle process + kind link + steps ─────────────────────────
with newproc as (
  insert into public.processes
    (title, description, is_active, lookahead_days, species_id)
  select
    'Layer pasture (lifecycle)',
    'Move layers to pasture and clean the brooder after each cohort '
      || 'arrives.',
    true, 60, 'layers'
  where not exists (
    select 1 from public.processes
    where title = 'Layer pasture (lifecycle)'
  )
  returning id
),
klink as (
  insert into public.process_event_kind_links (process_id, event_kind_id)
  select id, 'batch_milestones' from newproc
  returning process_id
)
insert into public.process_steps
  (process_id, title, body_md, offset_days, kind, sort_order,
   block_id, anchor_type, anchor_kind_tag)
select
  np.id, s.title, s.body_md, s.offset_days, 'chore', s.sort_order,
  (select id from public.chore_blocks where slug = 'morning'),
  s.anchor_type, s.anchor_kind_tag
from newproc np
cross join (values
  ('Move to pasture',
   'Move the layers out of the brooder and onto pasture.',
   20, 0, 'batch', null::text),
  ('Brooder cleanout',
   'Clean out the brooder about a week after the layers move to pasture.',
   27, 1, 'former_occupancy', 'brooder')
) as s(title, body_md, offset_days, sort_order, anchor_type, anchor_kind_tag);
