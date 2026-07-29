# NFF Design System — machine reference

The build-time companion to the visual docs (`index.html`, `foundations.html`,
`components.html`, `patterns.html` in this folder). When building UI, follow
this. The visual docs are the same system for a human to browse. Source of
truth for token VALUES is `index.html`; this file points at the canonical
component/source files.

Status tags: **Stable** = shipped + ratified. **Converging** = agreed
direction, partially shipped (build toward it; the old form still exists in
places). **Proposed** = decided in design, not yet built (don't rely on it in
code). We iterate aggressively — expect churn; keep this file current.

## Principles (ranked — earlier wins a conflict)

1. **Flush, not raised.** Panes = `border` on `--c-bg`. Attention fills =
   `color-mix(in srgb, var(--c-warn) N%, var(--c-bg))`. Only floating elements
   over a scrim (sheets/modals/trays) stay raised (`bg-surface`).
2. **Color is functional, never decorative.** A hue always means a state
   (resolved/warn/accent/project) or a category. No color "for looks."
3. **Sharp corners.** Cards/panes/rows/inputs are square. `rounded-full` only
   on dots, badges, avatars, toggle knobs.
4. **Three type roles, no fourth.** Lora = headings; Inter = uppercase
   eyebrows/labels; Nacelle = body. Each role has its job.
5. **Tokens only.** Never a raw hex in a component. Both themes must read.
6. **Field reality decides ties.** Phone tier wins: one-handed, gloves, sun,
   offline. Must-see states stay loud everywhere.
7. **A bounded list of options.** One canonical component per job + finite
   variants. New looks are proposed in this system first, not improvised.
8. **Fold the old in, then delete it (NO-LEGACY).** No dual-source shims. And
   never mutate committed data as a side effect of display — surface + prompt.
9. **Words are design material.** Active voice, sentence case, plain verbs.
   Name by what the operator controls; an action keeps its name through the
   flow; empty states invite, errors instruct.
10. **Interactive elements LOOK interactive** (batch 42.1, F65) — never
   instructional text. One standard, desktop + phone: rest-state "key" fill
   `bg-row-active-dim` where hover can't carry the signal (dense touch
   strips); `hover:bg-row-hover` background tint (a fill change, never
   text-color-only); active/selected `bg-row-active` (+ a border bounding
   box only for a row in a series); pressed = `active:bg-row-active` for
   tap feedback. Hover detail beyond a short label uses `Tooltip`, never
   the native `title`.

## Tokens (values in `index.html`; mapped to Tailwind in `src/styles.css`)

Use the Tailwind utility (`bg-*`/`text-*`/`border-*`); never the raw hex.
Format: `token` — LIGHT / DARK.

Surfaces: `bg` #f6f6f6/#101614 · `surface` #fff/#151a15 · `surface-alt`
#ececec/#1d231e · `line` (border) #d6d6d6/#3e473d.
Text ramp (loud→faint): `fg` #14180f/#f2efe4 · `dim` #2f3329/#c4bfad ·
`muted` #4d4a3e/#8e8877 · `faint` #6f6b5d/#6a6658.
State: `accent` #297d5a/#adc8ad · `accent-deep` #1d5a40/#297d5a ·
`warn` #a06d10/#e6b85a · `resolved` #297d5a/#4cba85.
Now/focus rings on Schedule strip bars: an INSET `accent-deep` ring
(2px now / 1px `accent` focus) with a 1px `bg`-colored separation gap
between ring and fill, painted above the bar's fill layers. Accent IS
the active-state color — don't swap the hue for contrast; the gap does
the contrast work (luminance, not saturation) on any fill, any theme.
The day-load (LoadSpine) now-ring is the **bg | accent | bg sandwich**
(42.3 round 4): a bg line on BOTH flanks of the 2px ring —
`accent-deep` and the project slate share luminance, so the single
inner gap wasn't enough on project fills.
An outset ring falsifies the bar's height relative to its neighbours;
there is no dedicated `now` token. Ring widths are authored as
`calc(Npx * var(--inv-zoom))` (styles.css) so they rasterize at true
device pixels under the density zoom — raw px would paint 2.4px+ and
antialias a mud pixel onto one flank. On-fill text:
`on-accent` #fff/#0d1410, `on-cat` #fff/#0d1410. No `white` token.
Block-identity trio (Schedule, F8/F9 — the `KindBadge` letters + bars):
`chore` #0c7e6e/#2bb6a2 (teal, letter **C**) · `project` #3f6da3/#7d9ec9
(slate-blue, **P**) · `event` #5b54a8/#b6afe9 (periwinkle, **E**). Each badge
also gets a 16% same-hue background wash so adjacent C/P/E stay distinct. Chore
was recolored amber-glow → **teal** (slice D): amber was overloaded and
collided with the `warn` UI. Chores don't borrow `accent` green either; green
stays a state color only.
Row tints (rgba): `row-active`, `row-hover`, `row-active-dim`.
Category hues (`cat-*`): fm (farmers market), popup, egg, chore, deliveries,
farm-visits, pickups, processing, default — see foundations.html.
Decorative ramps (50→950): sky-aqua, celadon, turf-green, tea-green,
amber-glow, honey-bronze, hot-fuchsia, slate-blue, periwinkle, **teal**, and the
two new palette additions **mulberry** + **terracotta** (unmapped) (+ 3 dupes to
collapse: frozen-lake=sky-aqua, honey-bronze=amber-glow,
grapefruit-pink=hot-fuchsia). Mappings: periwinkle → `event`, teal → `chore`;
amber-glow now serves only `cat-popup` (no longer chore).

## Typography

Families: `--font-body` Nacelle (vendored woff2) · `--font-heading` Lora
(Google) · `--font-ui` Inter (Google). Sizes are authored as fixed px then
scaled by `body { zoom: 1.20 }` (comfortable 1.35 / spacious 1.50).

Scale by role: page title `font-heading 32px/700/-0.02em`; hero number
`font-heading 26–44px/600`; section/card title `font-heading 17–22px/600/
-0.01em`; ROW title `font-body 12px/500` (day-spine block names + This
Week day labels — one size, one weight for active AND inactive, state
speaks through fill/border/color; F11 settled 2026-07-01: SANS, the Lora
heading stays a header treatment and does not reach list rows);
eyebrow `font-ui 10–11px/600–700/uppercase/0.12–0.16em`; body
`font-body 12–13px/leading-relaxed`; caption `9–10px text-faint`.
Data/numbers: ALWAYS `[font-variant-numeric:tabular-nums]` + fixed-width
container so digits align (times, durations, counts, metric columns).

## Shape & motion

Sharp corners (above). Motion is sparse + fast: `animate-flyout-in/out`
(140ms ease, translateX(-8px)+fade), theme swap (bg+color 120ms ease). No
ambient/decorative animation. Respect `prefers-reduced-motion`; visible focus
is non-negotiable.

## Components (bounded list — one per job)

Each: STATUS · what · use/not · canonical source.

- **Pane** · Stable · flush bordered section + eyebrow/Lora header; the
  default container. Built flush (`border` on `--c-bg`, never `bg-surface`);
  the raised `Card` was folded into it and deleted (NO-LEGACY) — all four
  former call sites (Overview/Metrics/BatchMetrics/BatchPage) import `Pane`.
  `tone="warn"` flat-tints via color-mix. Not for overlays (raised).
  Source: `src/components/ui.jsx` (`Pane`). Still-raised cousins to migrate:
  StatTile, PlaceSection. (WeekList folded into `WeekStrip`.)
- **Eyebrow** · Converging · uppercase Inter section/card label. Not body/data.
  Pattern everywhere; consolidate to one component.
- **Heading** · Converging · Lora title, -0.01..-0.02em. Unify the 3 impls
  (`PageHeader.jsx`, Chores inline h2, Rounds hero).
- **Button** · Proposed · 3 kinds: accent (primary) / ghost (secondary) /
  warn (the one attention action). No shared component yet
  (`ui.jsx` BTN_* + 3 inline impls). One accent per surface.
- **Input + label** · Stable · square input, focus→accent; tiny uppercase
  label. Two surface variants only (`ui.jsx:14/17/21`).
- **StatusPill** · Stable · one-word status chip; tones done/future/live/warn/
  muted (`ui.jsx:64/73`). The one pill base — other chips consolidate onto it.
- **ChoreRemainingPill / BlockBadge / BatchStatePill** · Stable · countdown /
  time-of-day glyph / batch lifecycle. (`src/components/*`.)
  ChoreRemainingPill is BINARY since batch 42.5 (F21 — the row matches
  the WarmingBadge model): due-today AND overran are ONE red "due" tone
  (`--c-cat-processing`) with the ClockAlert glyph; runway whose deadline
  lands THIS week (the same Sun-first rule as `dayWarming`) is warn amber
  + glyph; farther runway is the quiet neutral, no glyph. Labels keep
  their words ("due today" / "overran" / "Fri Jul 3 · 4 days left") —
  only the tone collapsed. The row's escalation tint follows: one
  `bg-cat-processing/[0.06]` wash for both due states.
- **KindBadge** · Converging · the Schedule block-identity box (F8): a single
  Inter-600 letter in a tight bordered square, tinted to the kind token —
  `chore` **C** (teal), `project` **P** (slate-blue), `event` **E**
  (periwinkle). Each badge also carries a 16% same-hue background wash
  (`bg-<kind>/[0.16]`) so adjacent C/P/E stay legibly distinct (the three hues
  are close). Square `size` px edge, letter scales ~0.6×. Replaces the
  per-block Lucide glyphs; reused in the block list, week-pane day symbols,
  and day-load. Source: `src/components/ui.jsx` (`KindBadge`).
- **StatTile** · Converging · Lora number + uppercase label KPI; flush w/ Pane
  migration (`ui.jsx:88`).
- **CheckTarget + ChoreCheckRow** · Stable · the ONE completion box, factored
  into `ui.jsx` and composed by ChoreCheckRow — keyed (chore, place), shared
  Rounds+Schedule, one outbox path. 28px box (`w-7 h-7 border-2`,
  done=bg-resolved; `queued` warms the border). Kills the 20/16/14px reimpls.
  Source: `src/components/ui.jsx` (`CheckTarget`).
- **EventRow** · Stable · one row with an inset 3px left color-bar in the
  category hue + a faint color-mix wash (an inset shadow, not a border, so
  rows stay column-aligned). Unified the 2 mechanisms (`Schedule.jsx:246`
  border-left, `Overview.jsx:489` inset box-shadow); chore-time blue reserved
  (C7). Source: `src/components/ui.jsx` (`EventRow`).
- **AttentionCard / Hole** · Stable · flush amber card (`color-mix warn` body
  + 50%-warn border), ⚠ eyebrow + Lora work line + reason + ONE solid-amber
  action (C6). The compact `AttentionCard.Row` (Hole.row) is the one-line
  inline variant. Flat fill only — a man-down on the LoadSpine reads as a
  conflict `AlertTriangle` on the bar (slice D, F23), never behind prose (C4).
  The one treatment for blocked/
  orphaned obligations; supersedes ChoreCheckRow's raised `border-l-2
  bg-warn/5` (de-raised to a flat fill in Step 1, full card promoted Step 2).
  Source: `src/components/ui.jsx` (`AttentionCard`).
- **AlertStrip** · Stable · flush passive warn strip with an inset 3px left
  rule — offline / "N changes since confirmed" / yesterday's-unfinished. Never
  a gate (the confirm-day affordance is separate). Absorbs the Schedule banner
  + source-change ribbon. Source: `src/components/ui.jsx` (`AlertStrip`).
- **WindowBar** · Stable · the window-of-time track for one obligation — the
  L5 should/must signal kept as a visual with the WORDS dropped (C3); fill =
  open fraction, color warms amber → `--c-cat-processing` as it narrows.
  Replaces `ChoreRemainingPill`'s should/must text. Shared-curve aggregation
  feeding it lands in Step 4. Source: `src/components/ui.jsx` (`WindowBar`).
- **NowRule** · Stable · the "now" marker — a 7px dot + glow + "Now · time"
  eyebrow INLINE at the left, the green hairline filling the rest of the row to
  the right (the rule is broken by the text — matches the style guide). Takes a
  preformatted `time` (or a `label` override); `children` land AFTER the
  hairline as a trailing annotation; spacing is the caller's (no baked
  padding); root is a span so it can sit inside a row button. Today-views
  only. `size="sm"` = the in-list variant (8px/0.1em text, 6px dot, 2px
  glow — scaled to sit under a 13px row title). Two carriers: the **phone
  Today glance** (a divider, no block row to highlight, default size) and
  the **desktop DayRailSpine** (batch 42.3, F5, `sm`), where the rule IS
  the current block's time line — riding IN the accent-filled row, never
  above it (a rule above a row read as belonging to the gap). EDGE form
  (round 3): when now falls outside the day's blocks (`nowEdge`
  before/after), no block is marked — the spine draws the full-width
  horizontal rule above/below its rows, and bar groups (LoadSpine, phone
  strip) draw `NowEdgeLine` (the marker turned vertical: 2px green line +
  glow dot) at the group's start/end. Source: `src/components/ui.jsx`
  (`NowRule`, `NowEdgeLine`).
- **NowTag** · Converging · the inline "Now" word for CENTER-PANE rows (the
  whole-day list + the master-detail header): the current block's row gets a
  faint green-accent fill (`bg-accent/[0.08]`) + this small word in primary
  green. The day-spine graduated to the full `NowRule` as its time line
  (42.3, F5); the tag stays where a rule has no room. Source:
  `src/components/ui.jsx` (`NowTag`).
- **Tooltip** · Stable · the real hover tip (batch 42.1, F41) — replaces the
  native `title` attribute wherever the tip should be INSTANT or FORMATTED
  (multi-line, bold lead-ins). Hover shows it; a tap toggles it (touch has no
  hover — a11y trade-off accepted for this internal app). Surface + hairline +
  `shadow-md`; body `text-dim` 11px font-ui, lead-ins bold `text-fg`;
  `whitespace-pre-line` so string tips break on `\n`; `pointer-events-none` on
  the tip and NO stopPropagation on the wrapper (a badge inside a clickable
  row must not eat the row's click). `side="top"|"bottom"`. VIEWPORT
  GUARDRAILS (round 6): on open the tip is measured (`useLayoutEffect`,
  before paint) and shifted horizontally so neither edge passes the
  viewport (8px margin) — a sidebar tip hugs the screen edge instead of
  running off it; the centered position stays the default. Carriers:
  `WarmingBadge`, the `WeekStrip` day symbols AND bars (42.5, F42 —
  chore/project/event details), the day-spine rows (via `BadgeHint`),
  the Confirmed chip. Source: `src/components/ui.jsx` (`Tooltip`).
- **BadgeHint** · Stable · the sidebar glyph's hover-detail cue (42.3; a
  kit primitive since round 4): `Tooltip` + a dotted `border-faint`
  underline beneath the glyph (the `abbr` convention — "details on hover"
  without a word of instruction) + `cursor-pointer`. The badge, not the
  whole row, owns the tip; a badge click still falls through to its row.
  SIDEBARS ONLY (day-spine + This Week) — center-pane badges are labels,
  not hover targets. Wraps every sidebar glyph: C/P/E KindBadges, the
  conflict `AlertTriangle`, the overnight `Moon`, the event count;
  `WarmingBadge cue` is the same treatment built in. Source:
  `src/components/ui.jsx` (`BadgeHint`).
- **EditedTag** · Stable · the "edited" affordance on a rescheduled row
  (42.3 round 4): a 10px semibold uppercase `accent` tag + a trailing
  chevron that points right closed and rotates to point down while the
  row's `EditedHistory` is open (140ms ease, the app's motion beat);
  hover/press tint is `row-active` (row-hover's 9% is imperceptible on
  white). Rides beside the row's 12-hour set time — the "time · tag" line
  the spine project rows wear: time in 10px tabular `faint`, tag colored
  semibold. Round 5: in `ChoreCheckRow` the tag lives on the WHERE line
  (place · days-left · edited), beside the new `DaysLeftTag`; `AdHocRow`
  keeps it on the title line. Shared by `ChoreCheckRow` and `AdHocRow`.
  History entries read
  **"Rescheduled from X to Y"** (from = the source block or previous set
  time, times 12-hour via `fmtClock12`) — never "Moved"/"Split" — with the
  datetime and the actor's capitalized first name. Source:
  `src/components/EditedHistory.jsx` (`EditedTag`, `fmtClock12`).
- **DaysLeftTag** · New (round 5) · the quiet deadline-runway disclosure on
  a chore row: the old "FRI JUL 3 · 1 DAY LEFT" pill + "optional today"
  collapsed into an `accent-deep` EditedTag-language dropdown reading
  "N days left" on the row's WHERE line; expanding shows "Due Fri, Jul 3,
  5:00 PM" (from `computeDeadline`). Due-today / overran keep the loud
  inline `ChoreRemainingPill`. 42.5 (F21): when the deadline lands THIS
  week the tag WARMS — `text-warn` + the ClockAlert glyph — becoming the
  row-level repeat of the binary warning signal; farther runway stays
  the quiet accent tag. Its expanded panel indents INSIDE a full-width
  wrapper (round 6 — an `ml` on a `basis-full` flex item overflowed the
  row by the margin: the phone's horizontal page-scroll bug; same fix in
  `EditedHistory`). Source:
  `src/components/ChoreCheckRow.jsx` (`DaysLeftTag`).
- **CoveredBadge** · New (round 5; restyled F10) · the "cover accepted"
  mark: a Lucide `CircleCheck` in `text-accent` — a small success cue —
  that REPLACES the warn conflict triangle once a needs-cover unit is
  accepted. Hover (BadgeHint cue via `cue`) leads with the coverage
  ("Jim covers — …") and names the block(s); the accept TIMESTAMP is
  deliberately not shown (F9 — noise, and batch-accepted covers all
  carry the same minute). Surfaces: the day-load stat row, the
  day-spine block rows, the This Week day symbols (`coveredByISO`).
  Source: `src/components/ui.jsx` (`CoveredBadge`).
- **Species icons** · New (F27) · one central species→glyph map
  (`iconForSpecies`) so the sidebar, command palette, and any animal
  surface draw the SAME mark for a species — layers `Egg`, broilers
  the custom `Chicken` glyph, sheep the custom `Sheep` glyph —
  instead of each call site hardcoding its own (a sheep batch used to
  wear a `Bird` in the palette). lucide has no sheep or chicken, so
  both are house glyphs in lucide's stroke language (24×24,
  currentColor, 2px round joins): `Sheep` a woolly back on two legs,
  `Chicken` a plump hen — one silhouette from tail point through a
  jagged comb to a closed beak, eye dot, two legs. lucide's `Bird` is
  freed for generic non-species bird surfaces (e.g. the command
  palette's no-species batch fallback). Unknown species fall back to
  a neutral `PawPrint`. Source: `src/components/animalIcons.jsx`.
- **TimePoint / AnchoredRange** · New (F15) · the sun-anchorable time
  field: a select (Clock time · Sunrise · Sunset) + a `type="time"`
  input shown only for clock times; `AnchoredRange` pairs two with a
  "to" joiner. Working-hours windows and breaks use it (rows label as
  "Sunrise – 5 PM" via `rowWindowLabel`); time off keeps the plain
  `TimeRange`. Sun sides resolve per date at the farm's coordinates in
  the engine (`resolveWindow`, availability.js). Source:
  `src/pages/Availability.jsx`.
- **NeedsCoverCard** · New (round 5) · ONE card per scheduled time off (or
  per event putting the farm a man down), covering EVERY block it
  overlaps — replaces the per-chore AttentionCard leak + CoverSheet + the
  acknowledge step (NO-LEGACY). AttentionCard chrome (flush amber, warn
  eyebrow). Title: the block's name (one block), the capitalized window
  phrase + "· Sat, Jul 4" (several — the small mid-dot, round 6), or
  "All day · Fri, Jul 3". Body:
  "[person] is [off-site|on a break|out|off] [9 AM–1 PM|until X|after
  X|all day]." — the compact range, not "from X to Y" (F10). A "N
  chores" EditedTag-language dropdown lists the affected work — grouped
  under per-block mini-headings when more than one block is hit. The
  button ("[person] will cover" / "Cover accepted", F9) is the SINGLE
  confirmation — compact and right-aligned, not a full-width slab
  (F10): one write (the reservation's `source_ref.cover`, or an
  event-keyed override delta) resolves every overlapped block. Renders
  above the block header row, below the confirm/+ Add row. Source:
  `src/pages/Schedule.jsx` (`NeedsCoverCard`).
- **NobodyCard** · New (round 6) · when uncovered units from DIFFERENT
  people overlap (an event always counts as its own person — someone
  must be there), nobody can cover: the overlapping units' cards
  collapse into ONE "Nobody at the farm" card. Same flush-amber
  AttentionCard chrome, warn eyebrow "Nobody at the farm". Title line(s):
  every span where ≥2 of the group are out at once (a sweep over the
  unit windows) as "From X to Y · Sat, Jul 18 · 1 h" (duration always
  stated). Body lists each part bold: "**[who]** — event, 9 AM–12 PM" /
  "**[who]** — off all day". The button is **"Got it"** (F9 — plain
  conventional language; compact right-aligned, F10) — there is
  no coverer; it writes an `{ack:true, at}` cover to EVERY unit in the
  group (same write path as cover acceptance), and the covered
  read-backs (stat row, spine, This Week) say "acknowledged" instead of
  "covers"/"covered". Grouping = union-find over overlapping uncovered
  units; same-person overlaps (an appointment inside a day off) never
  group. Source: `src/pages/Schedule.jsx` (`NobodyCard`,
  `coverGroups`, `acknowledgeNobody`).
- **FinishStamp** · Stable · celadon ✓ in a square + "Finished · who · window
  · N/N" (C5 — the word "Sealed" is killed). Whole-run, never a sub-bucket;
  anchors the Rounds wrap. Block completion auto-derives (no submit gate); the
  Schedule confirm-DAY action is a SEPARATE, KEPT plan-level concept, not this.
  Source: `src/components/ui.jsx` (`FinishStamp`).
- **LoadSpine** · Stable · the day-load silhouette — one bar per block,
  interleaved with the day's project gaps, reading `farmLoad.spine` directly.
  Color is by KIND, not a load-state ramp (slice D, F23/F26): a chore bar is
  `--c-chore` (teal, height ∝ item count); a bar overlapped by an UNCOVERED
  time off / event REPLACES its fill with the alternating conflict
  stripes — `hatchConflict(kind)`, round 6; the round-5 bg-stripes + warn
  border are gone, and the stat row's conflict badge carries the count;
  a project bar is `--c-project`
  (slate, height ∝ block DURATION), solid when `planned` and a blue cross-hatch
  when unplanned — see **planned vs unplanned** below. **No per-bar item
  counts** (F23). `events` (round 5, the event-rail mockup): each event
  draws a horizontal RAIL below the bars — bars + rails share one CSS grid
  so the rail spans from the first overlapped bar's left edge to
  the last's right edge; the rail carries the E `KindBadge` (BadgeHint cue
  → the event's name + times) and the NowRule language adapted into a
  periwinkle start—end timeline ("1:15 PM ——— 5:00 PM" — the leading
  mid-dot dropped, round 6). Round 6 sizing: the rail's FLOOR is its own
  content + padding (`min-w-max`); when that beats the bar span it
  aligns with, it CENTERS over the span (flex wrapper) instead of
  stretching the grid — short events never overflow their rail.
  `nowId` (today only, gate at the call site) rings the
  current block's bar with the day-strip's offset inset now-ring (2px
  `accent-deep` + a bg separation line, `--inv-zoom`-compensated) — chore
  buckets are farmLoad blockIds, so the Schedule passes `nowBucket`
  straight through; `nowEdge` draws the vertical `NowEdgeLine` at the
  group's start/end instead when now is outside the blocks. The header
  counters (both surfaces, one shared node): `N chores` (chore
  obligations only — one-off tasks and project steps aren't chores) ·
  `N blocks` (everything the spine shows: chore blocks + project gaps +
  events + overnight) · `N projects` (DISTINCT projects placed, not
  gaps) · `N events` (round 5) — each pluralized; then the warming
  ClockAlert, the conflict badge, and the `CoveredBadge` when
  accepted cover exists — all with the BadgeHint cue. The conflict
  badge (warn triangle ×N) is THE conflicts entry point since round 6:
  it counts every today-conflict, its hover bolds each NAME
  ("**who/what** — when"), and CLICKING it opens the conflict list —
  the old toolbar conflicts chip is deleted. Bars clamped to the track (B2 — the frame's
  `overflow-hidden` was dropped in 42.3 round 4: it clipped the
  NowEdgeLine's glow dot); the optional `summary` read sits beside it.
  Round 4: `nowId` is resolved by WINDOW across kinds (the bar whose
  [start, end) contains now — a project gap rings its own bar, not the
  chore block before it), and the ring is the **bg | accent | bg
  sandwich** (see the now-ring note below). The day load itself is
  CHROMELESS: bg-bg, no border/padding chrome, full column width, closed
  by the page hairline (both surfaces). Kept distinct from the Rounds
  completion-fraction bar. **Event rail — coverage marker** (batch 42
  slice 7, F47): the event rail's trailing annotation gains "N of M
  here" (a muted `UserX` + tabular count) whenever fewer than everyone
  is available during the event's window; nobody available turns it
  `text-warn`. Silent when full coverage — the marker only speaks up
  when it's informative. Hover (`Tooltip`) names each person "here" or
  "out". Source: `src/components/ui.jsx` (`LoadSpine`).
- **WarmingBadge** · Converging · the binary warn/due signal (slice D, F24/F25)
  that REPLACED the continuous should-heat gradient. A Lucide `ClockAlert`,
  reading a `farmLoad.warming` bucket `{ warn:[…], due:[…] }`: any DUE-today
  chore → red (`--c-cat-processing`, the deadline red); else WARN amber
  (`--c-warn`). `×N` when more than one chore is warm; the hover names each chore
  + when it's due (F25) — a real `Tooltip` since batch 42.1, bold chore names. **Inline — no background fill or padding**, just the
  colored glyph, so it reads as part of its line. Three surfaces: the day-load
  summary (after a `·`), the affected `DayRailSpine` block row (count hidden),
  and the week pane (per warming day, count hidden — fed by `warmingByISO`).
  `cue` (42.3 round 4, sidebars only): adds the BadgeHint dotted underline
  + pointer so the glyph advertises its hover detail like every other
  sidebar badge. Backed by exported `dayWarming(...)` in `farmLoad` (the
  focal day-load and the week scan share it). Source:
  `src/components/ui.jsx` (`WarmingBadge`).
- **DayRailSpine — time-off row** · Stable · a person's unavailability
  rides the desktop spine as its own quiet row kind (batch 42 slice 7,
  F45): no kind rail, no fill, a muted `UserX` (via `BadgeHint`) + "«person»
  out" + the window ("All day" or a compact range). It never takes
  focus — a work-segment convention (accent fill, bounding box) would
  overstate an absence — clicking opens the Availability page instead
  of picking the row. Sits above the first work row when the absence
  starts before the day's blocks. Desktop only; the phone pager stays
  work-segments-only.
  Source: `src/components/ScheduleSidebars.jsx` (`DayRailSpine`, the
  `kind === "timeoff"` branch).
- **AddTaskBar** · Stable · the Schedule's one-off task entry (batch 42.2,
  F58): lives in the TOP toolbar (an "Add task" button beside Add chore
  expands it) — one line of text + a target selector pulling the day's
  real chore blocks AND its project gaps ("Project · 3 PM" — 42.3 round
  4), merged in time order; Overnight is excluded (O7, not pickable for
  adds). A project-gap choice routes by `clockTime` (the gap's start), a
  chore block by its block id. Defaults to the NOW block (today) or the
  day's first; "Anytime" — the app's documented no-block landing spot
  (the edit sheet's block picker offers the same) — sits LAST, a
  deliberate choice, never the default. Replaced the per-block foot
  inputs (NO-LEGACY): a bottom inline input implied the task joined the
  block above it. Specific-time one-offs deferred (triage 2026-07-01).
  Enter adds, Escape closes. Source: `src/pages/Schedule.jsx`
  (`AddTaskBar`).
- **WeekStrip** · Stable · the week drawn ONCE off `farmLoad.week`, desktop
  sidebar only (the phone `layout="header"` variant + its should-heat tick were
  DELETED — slice D, NO-LEGACY). A row per day · IDENTITY BARS (42.5,
  F40 — the accent-green count-only bars are gone) · identity
  symbols on the right (F15–F17). The bars are `farmLoad.week` day
  `bars`, time-ordered, the complete set: chore blocks with items
  (`--c-chore` at 85%, height ∝ count vs `week.max`; empty blocks draw
  NO stub), project gaps (`--c-project`, height ∝ duration vs the
  week's longest gap; planned solid / free `hatchUnplanned` +
  45%-slate inset ring), events (`--c-event` 45% wash + 55% ring,
  fixed mid height — presence, not magnitude). Every bar wears a real
  `Tooltip` (F42): chore → **block name** + N chores + window; project
  → **Planned/Free project block** + window + who's free; event →
  **name** + time (window labels preformatted in farmLoad —
  `windowLabel` — so ui.jsx stays free of the time utils). Bar data is
  fed by `weekRes` (the horizon reservations, gap splitting) +
  `weekTimed` (the week's timed deltas, the planned test); the FOCAL
  day reads its live deltas/reservations instead, so edits show
  instantly. The symbols: the per-day number + heat box are dropped for a
  teal **Moon** when an overnight chore touches that day (`overnightByISO` —
  both calendar days a night spans), a periwinkle **E** `KindBadge` when the day
  has an event (hover → the events' NAMES + times, round 5 — fed by
  `farmLoad.week` day `eventList`), a warn/due `WarmingBadge` (ClockAlert)
  when it has a warming chore (`warmingByISO`), an amber conflict
  `AlertTriangle` when it has uncovered conflicts (hover → count, fed by
  `conflictsByISO` — round 5: conflicts count as UNITS, one per uncovered
  time off), and the muted `CoveredBadge` when a day's time off has
  accepted cover (`coveredByISO`, round 5; both icons coexist when a day
  has covered + unresolved). **Out-all-day** (batch 42 slice 7, F46): a
  muted `UserX` per person with zero availability that day (`outByISO`
  — a scheduled day off OR an all-day/window-swallowing time off, per
  the engine's `outAllDay`), hover names who; sits after the conflict
  triangle. A busy week row can carry several symbols — the fixed-width
  cell wraps rather than clips (worth a visual check on a crowded day).
  The
  symbol cell is a FIXED width, LEFT-aligned, so every day's mini-spine is the
  same width and the badges line up in a column; every symbol wears
  `BadgeHint` (round 4 — the full affordance standard, not a bare
  Tooltip). ONE BASELINE GRID (round 4, F37 re-open): the row is
  `items-end`, so the day label's baseline, the bar bottoms, and the
  symbol column all sit on the track's bottom edge — never three center
  lines. The overnight Moon is fed by a WEEK-WIDE night scan (round 4):
  every night touching the viewed week is tested from one range read of
  timed commitments, not just the focal day's loaded entries (the Moon
  used to appear only once an overnight day was selected). Bar HEIGHTS
  clamp to the track (B1); bar WIDTHS never clip
  — bars are ≥5px and the widest day's BAR count (chores + gaps +
  events since 42.5) sets one fixed track
  width for every row, which in turn sizes the whole This Week sidebar
  (the F16 fixed 180px gave way to this content rule, 42.3 feedback).
  Day label = the row-title type at 12px (F11).
  **Folded in + deleted (Step 3):**
  the center `WeekSpines` (`schedule/WeekSpines.jsx`, removed) + the sidebar
  `WeekList` (removed from `ScheduleSidebars.jsx`); the Schedule renders this
  once in the right sidebar. Source: `src/components/ui.jsx` (`WeekStrip`).
- **day-load color (by kind)** · Stable · the day-load no longer has a load-state
  fill ramp or a should-heat gradient — both `loadColor()` and `heatColor()` were
  DELETED (slice D, NO-LEGACY). Bars color by kind directly: chore=`--c-chore`,
  project=`--c-project`; warming is the binary `WarmingBadge` (warn=`--c-warn`,
  due=`--c-cat-processing`). `weekShouldHeat` (`lib/schedule/weekView.js`) is
  gone; `farmLoad` still folds `weekFullness` for the week silhouette.
- **CommandPalette** · Stable · ⌘K app-wide search, keyboard-first
  (`src/components/CommandPalette.jsx`).
- **Sheet / Modal** · Proposed · NO shared primitive (15 hand-rolled
  `fixed inset-0`). Extraction target: QuickActionsTray's internal `Sheet`
  (bottom-sheet phone / centered desktop, raised over scrim).
- **OutboxIndicator** · Stable · offline/queued/failed sync state; one impl in
  TopBar + Rounds (`src/components/OutboxIndicator.jsx`).
- **EmptyState** · Converging · dashed box + a line that says what to do;
  consolidate the several shapes. An empty screen invites an action.
- **ProposalCard** · Converging · the review card for an *agent proposal* — an
  action a Claude chat queued via the MCP server (`mcp/`), awaiting approval.
  Flush bordered card (principle 1) with a 2px accent left rule while pending:
  head = kind glyph (FolderKanban/CalendarRange/ListChecks in accent) + Lora
  title + an Inter "Bot · Project · proposed <time>" eyebrow; body previews the
  payload (description, numbered steps, an italic "why"); actions = one accent
  "Approve & create" beside a ghost "Reject". Approve runs the app's REAL create
  path (`useProjects().createProjectTree`), so an approved proposal is
  indistinguishable from a hand-built one; reject discards. The history variant
  swaps actions for a StatusPill (applied/rejected/failed) + an "Open project"
  deep link or a Retry. NO-LEGACY debt: locally reimplements Tab / EmptyState /
  StatusPill (same as Inbox.jsx) — fold onto the canonical primitives when the
  pill/tab consolidation lands. Source: `src/pages/Proposals.jsx`.

## Patterns (page-level — see patterns.html)

- **Page shell** — header (Lora title + uppercase back-link + bottom hairline)
  over flush eyebrow-titled sections.
- **Editor list (settings surfaces)** — the add → rows → inline-edit shape
  for small config lists, shared by Chores → Blocks and the Availability
  page (batch 42 slice 6, F50/F51: time off, per-person weekly hours +
  per-date exceptions, farm-wide breaks). One-line intro + ONE accent add
  button (Pane `actions`); a `bg-surface-alt` inline form of tiny-uppercase
  labeled fields — a segmented control for finite choices (person,
  all-day/part, hours/off), native date/time inputs; saved entries =
  `bg-surface border` rows that WRAP on the phone (no fixed grids), value
  text `text-dim`, ghost Pencil/X icon actions right, past/paused rows
  dimmed `opacity-55` (kept, not hidden). EVERY saved row is editable
  in place (Phase-1 sweep, F13/F16/F17): time-off rows reopen their
  form prefilled, exception rows swap to the inline WindowEditor,
  break rows reopen the BreakForm (name included). Time off adds a
  per-person Segmented filter (Everyone · names). The weekly-hours
  grid is the sanctioned `gap-px bg-line` hairline-divider stack
  (7 rows, Sun..Sat); a day with NO saved row renders its whole window
  in `text-faint` — the dimness IS the "default" signal; the word
  "(default)" is retired (F14). Sun-anchorable windows use TimePoint /
  AnchoredRange (F15, see Components). Availability adds only those
  two small field components — Pane / BTN_* / AlertStrip + these
  shapes cover all three lists. Sources:
  `src/components/ChoresBlocksTab.jsx`, `src/pages/Availability.jsx`.
- **Master–detail** (Schedule desktop) — left load rail · center detail ·
  right week sidebar (→ one WeekStrip). PAGE HEADER (42.3 round 4): the
  "Schedule" Lora h1 and the Day/Week/Month/Review tabs share ONE
  full-width row above the whole workbench (spine included), closed by
  the page hairline; the DATE ("Thursday, Jul 2") is the center column's
  Lora h2, with the day's events on its sub-line (F15). The left rail
  speaks the WeekStrip
  visual language (F1–F3): no dividers, an outlined active row (the border is
  the indicator, **green `border-resolved`** like the week pane), lighter-on-
  hover, equal heights; each row is a `KindBadge` (C/P/E) + label
  ("Chores"/"Project"/event title, the ROW-TITLE type: body sans 12px
  medium, one weight active AND inactive — 42.3, F11 settled; This Week
  day labels wear the same) + time, with the current block marked by a
  green-accent fill + the `NowRule` (`sm`) as its time line (42.3, F5); the
  day-load's current bar carries the **now-ring** (the day-strip's offset
  inset ring, `LoadSpine nowId`). Every row wears its **kind tint** (see
  below) beside a **solid, saturated 5px rail** in the identity color (the
  old done-fraction rail meter is retired — the tooltip carries the
  count); **project rows** swap the tint for the cross-hatch when free
  (planned vs unplanned). Row hover detail is a real `Tooltip` (REAL block
  name · done count · time · needs-cover / planned · who's free), cued by
  a dotted underline beneath the C/P/E badge (the `abbr` convention — see
  the affordance standard). The spine is a **fixed 200px** — never
  content-sized (a shifting center pane on day clicks is worse than any
  width). The **overnight** wrap reads "Overnight" + a teal `Moon` on the
  row's right edge; **events** appear here too (periwinkle **E** + title)
  where present. The desktop whole-day overview is **ELIMINATED** (42.3
  round 2): one block is always open — re-picking is a no-op, and opening
  a day from This Week / Week / Month lands on its FIRST block (today:
  follows now); its content lives in the spine tooltips. The overview
  state survives only for the phone's Whole-day toggle. Phone collapses
  to day-strip + column: the strip header is the day-load header (same
  eyebrow + the SAME shared counter node as desktop), its columns carry
  no rest fill (the bars are the affordance), and the strip PAGES at
  more than 5 rails — max 4 visible, arrow slots page the group with a
  directional slide (`nff-page-from-left/right`), the default page opens
  on the now rail, one arrow leaves 4 rails / two leave 3, and the
  NowEdgeLine rides outside the rail count. The phone toolbar is the
  **primary + Add menu** pattern (see patterns.html). The
  strip's chore bars fill in the same chore teal (done rises in
  `resolved`), project bars fill by planned state, and the current block's
  bar carries an **inset 2px `now` ring** painted above the fills (see the
  `now` token note).
- **Kind-tinted list rows** (42.3) — the list-group language for kinded
  rows: a light wash of the row's identity color (chore teal / project
  slate / event periwinkle) from `kindTint(cssVar, strength=11)`
  (`src/components/ui.jsx`), beside a solid, saturated 5px rail in the
  same color (uniform across kinds — no data encoded in the rail). The
  wash is an alpha background-IMAGE (never background-color) so the
  shell's hover/active/now background-color tints show through; the
  KindBadge letter keys the color. Carrier: the day-spine; any future
  kinded list should speak it.
- **Planned vs unplanned time** (42.3, F9) — one fill language for project
  time everywhere it's drawn: a gap with a real step in it is SOLID project
  slate; a free/unbooked gap wears the 45° blue cross-hatch (the wash-eggs
  ribbon pattern in `--c-project`) from the shared `hatchUnplanned(strength)`.
  Its needs-cover siblings (`src/components/ui.jsx`):
  * `hatchCover(strength)` — the SAME stripe language in `--c-warn`,
    layered over a FLAT fill only (a planned spine row's kind tint:
    `hatchCover(12)`).
  * `hatchConflict(kindVar, warnStrength, kindStrength)` (round 6) —
    the ALTERNATING warn/kind diagonals for any surface that is itself
    striped or a solid bar (two overlaid hatch sets stacked into mud).
    Uneven duty on purpose: a 3px warn tick / 7px kind — a 50/50
    alternation of two saturated mid-luminance hues strobes at bar
    size; thin ticks over the dominant identity color read as "warning
    ON the bar". Carriers: free+needs-cover spine project rows (14/10,
    light), day-load conflict bars (full — the fill IS the stripes; no
    border), the phone strip's chore remainder + project columns
    (full / 45). Accepting cover removes it and the `CoveredBadge`
    takes over.
  Bare bars take full strength (LoadSpine 60,
  phone strip 45); row backgrounds with text on top take the light forms
  (day-spine rows: hatch **10** — dropped from 16 in round 4, the 12px row
  text sat on the heavier diagonals in light mode; the rail + badge +
  "both free" tag carry the free signal / planned = the `kindTint` wash
  11). All fills
  are alpha background-IMAGES so hover/active row background-colors show
  through. `planned` = a step occupies the gap (`projectEntries` items /
  `farmLoad`'s `projNodeMins` walk; the This Week bars test the week's
  timed deltas per day, live deltas on the focal day).
- **Full-screen takeover** (Rounds) — Lora hero count + progress + NowRule +
  PlaceSwitcher + CheckTarget rows + tray + FinishStamp on wrap.
- **Dashboard glance** — stack of flush panes; EventRow + LoadSpine + NowRule.
- **Phone Today glance** (Proposed) — signals stacked in tap-priority:
  NowRule → AttentionCard (if down) → LoadSpine+count → block groups → deep-link
  to Rounds.
- **Attention placement** — man-down=AttentionCard (everywhere it appears);
  overdue=AttentionCard.Row (Hole.row) in the row; page notices=AlertStrip;
  offline=OutboxIndicator; now=`NowRule` (phone-glance divider + the
  day-spine row's time line) / `NowTag` on center-pane rows, today only.
- **Approval queue** (Proposals) — the surface where actions an external Claude
  chat proposes land for human sign-off. Pending / History tabs over a stack of
  flush `ProposalCard`s; Approve runs the app's real create path, Reject
  discards — nothing an agent proposes mutates data until James approves it here
  (principle 8: surface + prompt, never silent mutation). Backed by the
  `agent_proposals` table + `useAgentProposals`; proposals arrive live via
  realtime, so one queued from a phone shows up instantly. The agent's write
  tools (`mcp/`) are propose-only, which also keeps a future public endpoint
  low-risk — it can only enqueue, never corrupt.
- **Live HTML doc** (batch 42.8) — an attached `.html` file opens as a
  WORKING page, not a download: `LiveDocViewer` renders it full-screen
  in a sandboxed iframe (`allow-scripts allow-forms` — opaque origin,
  no app session/storage reach) and an injected shim swaps the page's
  `localStorage` for the per-attachment key/value store
  (`attachment_doc_data`, per-KEY rows so two editors on different
  keys never clobber). The doc opens READ-ONLY; "Edit" claims the
  advisory lock (`attachment_doc_locks`, 30s heartbeat, 90s stale
  cutoff), "Done" releases; the other editor sees a live lock chip
  ("Jim is editing") and their realtime saves stream into an open
  page as storage events. Chrome: filename + lock chip + Edit/Done +
  close over the iframe; HTML rows in AttachmentsBlock wear an
  accent Globe icon. Engine: `lib/docdata/liveDoc.js` (shim,
  injection, lockState — TDD'd); data: `useDocData`. Source:
  `src/components/LiveDocViewer.jsx`.
- **Project URLs + attachment deep links** (0047) — projects live at
  `/projects/<slug>` (immutable slug from the title, `lib/slug.js`;
  uuid links still resolve and canonicalize to the slug on load).
  Every attachment row carries a ghost `Link2` copy-URL action (flips
  to an accent Check for 1.5s) whose link,
  `/projects/<slug>/files/<attachmentId>`, reopens that file:
  live HTML docs open the LiveDocViewer, anything else opens its
  signed URL. Phase headers wear the same hover `GripVertical`
  drag-reorder grip as steps and ranked projects (one dnd-kit
  language, three levels). The "Linked to" section adds a
  **Project** kind — project→project references on the same
  `project_links` rows; clicking navigates to the target project.
  Sources: `src/lib/router.js`, `src/components/ProjectBits.jsx`,
  `src/pages/ProjectPage.jsx`.

## Consolidation backlog (the bounded-options payoff)

**App-wide flush-flip propagation (2026-06-30) — DONE for the page layer.**
The "Schedule first, then app-wide" plan ([[project_rethinker_design_arc]])
shipped across ~20 page surfaces in 6 commits (`9290268`→`897e1ce`): Chores,
Processes, Projects, Inventory, Customers, Observations, Settings, PlacePage,
Products, SpeciesPage, ProjectPage, Feeds, FeedSchedulesPage, Processing,
Calendar, Activity, Roadmap, Inbox, Now, Orders. The sweep = (1) raised
`bg-surface border` in-page content sections → flush `border` on `--c-bg`
(principle 1); (2) hand-rolled accent/ghost buttons → `BTN_ACCENT`/`BTN_GHOST`;
(3) clean-mapping status chips → `StatusPill`; (4) `bg-surface`+eyebrow sections
→ `Pane`; (5) Chores' whole inline-`T.*` idiom → token classes + `CheckTarget`.
**Deliberately LEFT raised** (the bounded "don't touch" set): `bg-surface` row
fills inside `gap-px bg-line` hairline-divider grids (load-bearing), form-control
surfaces (inputs/selects/search fields), floating overlays/modals/trays, dynamic
per-entity colors, and danger/neutral-toggle/icon-only/odd-sized buttons.
**Remaining page holdouts (follow-ups):** `Rounds` (the full-screen takeover —
its own raised pattern, left for a focused pass) and `ChoreFieldsEditor`'s
`editInputStyle` (the last inline-style object, used by Chores + Processes
editors). Component-layer surfaces (SitesAdmin, PricingGrid, CalendarViews, the
sheets/editors) were not in this page-layer pass.

Collapse, don't re-litigate: raised Card/StatTile/PlaceSection →
flush Pane (Card done; WeekList folded into WeekStrip, not Pane; the page-layer
flush-flip is now propagated app-wide — see above); 4 checkbox
sizes → one 28px CheckTarget (Chores Today now adopts it — the page's last
hand-rolled 20px box is gone); BTN_* + 3 inline →
one Button; 15 overlays → one Sheet/Modal; 3 result-row impls → one ResultRow;
StatusPill + other pill bases → one base; 2 now-markers → one NowRule;
2 event-bars → one EventRow; inline `T.*` idiom (Chores.jsx) → token classes
(✓ DONE — the whole page is on token Tailwind classes + the shared
CheckTarget / BTN_ACCENT / BTN_GHOST; `ChoreFieldsEditor`'s `editInputStyle`
is the remaining inline-style holdout, a separate follow-up);
delete the `/rethinker` scratch after promotion.

Migration order (cheapest-first): Step 1 — Card→Pane flush flip, ChoreCheckRow
escalation→Hole, unify NowRule. ✓ SHIPPED (`feat/harvest-remix`): Pane built
flush + Card deleted; escalation de-raised to flat fill; NowRule unified +
NowMarker collapsed. Step 2 — promote the vocabulary into ui.jsx
(`lib/load/farmLoad.js` is built; step 0). ◐ IN PROGRESS (`feat/harvest-remix`):
CheckTarget / AttentionCard(+Hole.row) / FinishStamp / LoadSpine / EventRow /
WindowBar / AlertStrip / WeekStrip promoted into `ui.jsx`; phone Today glance +
in-run cover card + Schedule needs-cover wired. Step 3 — fold the week + demote
DayRibbon. ✓ SHIPPED (`feat/harvest-remix`): Schedule reads one `farmLoad` memo;
inline daySilhouette/personLanes/week/shouldHeat deleted; the day-load is a
LoadSpine, the two-lane ribbon a conditional `farm.lanes` overlay; the week is
one sidebar WeekStrip (center WeekSpines + sidebar WeekList deleted). Findings
slice D (`feat/harvest-remix`, F22–F26): the day-load colors by kind (chore
teal / project slate, height ∝ duration, unplanned blue cross-hatch), a
man-down is a conflict triangle on the bar (not a hatch), and warming collapsed
to the binary `WarmingBadge` (ClockAlert warn/due) — `weekShouldHeat`,
`heatColor`, `loadColor`, and the WeekStrip should-heat tick all DELETED. Chore
identity recolored amber-glow → **teal** + `KindBadge` gained a same-hue bg wash
(James, 2026-06-30); **mulberry** + **terracotta** added to the palette
(unmapped). Findings slice E (`feat/harvest-remix`, F27–F31): the two-lane
"who's on what" `DayRibbon` overlay + `personLoad`/`buildPersonLanes` are
DELETED (it leaned on per-chore assignment the farm doesn't commit to); the
Schedule recap ("N changes since you confirmed" + "Yesterday — N must-dos
unfinished") collapsed to passive `AlertStrip`s showing a count with names
behind an on-demand detail toggle, and the "for learning the routine, not
grading" caption was dropped. Findings slice F (`feat/harvest-remix`, F32):
Schedule Project blocks carry a project DOWN the day — an empty later block
offers a **"Continue ⟨project⟩"** action (a `CornerDownRight`, project-color
button) that copies the carried project's next undone step into that gap, so one
project can span multiple blocks without re-searching (`nextProjectStepFor` in
`lib/projects.js`). Last — delete `/rethinker`. (Full rationale, from repo root:
`.ignored/playbooks/design-bracket/examples/harvest-remix/DESIGN.md`.)

## Voice

Two layers, both hosted in the docs (`voice.html`; raw source `voice-guide.md`):
- **Brand voice** = customer-facing copy (farm updates, product descriptions,
  market posts): warm, plainspoken, lightly funny, scrupulously honest; the
  "employees" gag; seasonal titles; gratitude close; smart quotes;
  `pasture-raised`/`non-GMO` spelled exactly.
- **Product/UI voice** = dashboard microcopy (buttons, labels, empty states,
  errors): principle 9 above (active voice, sentence case, plain verbs,
  name-by-what-the-operator-controls, an action keeps its name, empty invites,
  errors instruct). Don't put the brand gag on a Save button; do carry over the
  mechanics (smart quotes, correct value-prop terms, warm honest register).
Apply the right layer to any copy you write.

## Hosting

This whole system lives at `public/style-guide/` — served by the app and
viewable in-app under the **Style guide** nav item (Other group), embedded via
`src/pages/StyleGuide.jsx` (iframe `?embed=1`, theme-synced). Editing these
files updates both the standalone site and the in-app view (single source).

## Canonical source files

Tokens/fonts/themes: `index.html`, `src/styles.css`, `src/theme.js`.
Primitives: `src/components/ui.jsx`. Completion row:
`src/components/ChoreCheckRow.jsx`. Page-title: `src/components/SectionHeader.jsx`
/ `PageHeader.jsx`. Schedule patterns: `src/pages/Schedule.jsx`,
`src/components/ScheduleSidebars.jsx`. Search: `CommandPalette.jsx`.
