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
-0.01em`; eyebrow `font-ui 10–11px/600–700/uppercase/0.12–0.16em`; body
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
- **NowRule** · Stable · the "now" divider — a 7px dot + glow + "Now · time"
  eyebrow INLINE at the left, the green hairline filling the rest of the row to
  the right (the rule is broken by the text — matches the style guide). Takes a
  preformatted `time` (or a `label` override); today-views only. Used by the
  **phone Today glance** (a divider, no block row to highlight). The desktop
  Schedule no longer uses it — it marks the current block on the row via
  `NowTag` (slice D refinement). Source: `src/components/ui.jsx` (`NowRule`).
- **NowTag** · Converging · the desktop Schedule's now-marker: the current
  block's row gets a faint green-accent fill (`bg-accent/[0.08]`) + this small
  "Now" word in primary green, in the block-list sidebar, the whole-day list,
  and the master-detail header. Replaces a divider rule above the row (which
  read as belonging to the gap, not the block). Source: `src/components/ui.jsx`
  (`NowTag`).
- **FinishStamp** · Stable · celadon ✓ in a square + "Finished · who · window
  · N/N" (C5 — the word "Sealed" is killed). Whole-run, never a sub-bucket;
  anchors the Rounds wrap. Block completion auto-derives (no submit gate); the
  Schedule confirm-DAY action is a SEPARATE, KEPT plan-level concept, not this.
  Source: `src/components/ui.jsx` (`FinishStamp`).
- **LoadSpine** · Stable · the day-load silhouette — one bar per block,
  interleaved with the day's project gaps, reading `farmLoad.spine` directly.
  Color is by KIND, not a load-state ramp (slice D, F23/F26): a chore bar is
  `--c-chore` (teal, height ∝ item count); a man-down `hole` keeps the chore
  color and carries a small conflict `AlertTriangle` (F23 — a symbol, NOT a
  hatch/fill, replaces the old warn treatment); a project bar is `--c-project`
  (slate, height ∝ block DURATION), solid when `planned` and a blue cross-hatch
  (`HATCH_UNPLANNED`, the F11/F26 shared util) when unplanned. **No per-bar item
  counts** (F23). Bars clamped to the track + `overflow-hidden` (B2); the
  optional `summary` read sits beside it. Kept distinct from the Rounds
  completion-fraction bar. Source: `src/components/ui.jsx` (`LoadSpine`).
- **WarmingBadge** · Converging · the binary warn/due signal (slice D, F24/F25)
  that REPLACED the continuous should-heat gradient. A Lucide `ClockAlert`,
  reading a `farmLoad.warming` bucket `{ warn:[…], due:[…] }`: any DUE-today
  chore → red (`--c-cat-processing`, the deadline red); else WARN amber
  (`--c-warn`). `×N` when more than one chore is warm; the hover names each chore
  + when it's due (F25). **Inline — no background fill or padding**, just the
  colored glyph, so it reads as part of its line. Three surfaces: the day-load
  summary (after a `·`), the affected `DayRailSpine` block row (count hidden),
  and the week pane (per warming day, count hidden — fed by `warmingByISO`).
  Backed by exported `dayWarming(...)` in `farmLoad` (the focal day-load and the
  week scan share it). Source: `src/components/ui.jsx` (`WarmingBadge`).
- **WeekStrip** · Stable · the week drawn ONCE off `farmLoad.week`, desktop
  sidebar only (the phone `layout="header"` variant + its should-heat tick were
  DELETED — slice D, NO-LEGACY). A row per day · count mini-spine · identity
  symbols on the right (F15–F17): the per-day number + heat box are dropped for a
  teal **Moon** when an overnight chore touches that day (`overnightByISO` —
  both calendar days a night spans), a periwinkle **E** `KindBadge` when the day
  has an event (hover → count), a warn/due `WarmingBadge` (ClockAlert) when it
  has a warming chore (`warmingByISO`), and an amber conflict `AlertTriangle`
  when it has man-down conflicts (hover → count, fed by `conflictsByISO`). The
  symbol cell is a FIXED width, LEFT-aligned, so every day's mini-spine is the
  same width and the badges line up in a column. Bars scaled to `week.max`,
  clamped +
  `overflow-hidden` (B1 — no silent overflow). **Folded in + deleted (Step 3):**
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
- **Master–detail** (Schedule desktop) — left load rail · center detail ·
  right week sidebar (→ one WeekStrip). The left rail speaks the WeekStrip
  visual language (F1–F3): no dividers, an outlined active row (the border is
  the indicator, **green `border-resolved`** like the week pane), lighter-on-
  hover, equal heights; each row is a `KindBadge` (C/P/E) + label
  ("Chores"/"Project"/event title) + time, with the current block marked by a
  green-accent fill + a `NowTag` "Now" (not a divider rule). The chore load rail
  fills in the chore identity color (teal). The **overnight** wrap reads
  "Overnight" + a teal `Moon` on the row's right edge; **events** appear here
  too (periwinkle **E** + title) where present. Phone collapses to day-strip +
  column; the strip's chore bars fill in the same chore teal (done rises in
  `resolved`), and the current block's bar carries an **inset 2px `now`
  ring** painted above the fills (see the `now` token note).
- **Full-screen takeover** (Rounds) — Lora hero count + progress + NowRule +
  PlaceSwitcher + CheckTarget rows + tray + FinishStamp on wrap.
- **Dashboard glance** — stack of flush panes; EventRow + LoadSpine + NowRule.
- **Phone Today glance** (Proposed) — signals stacked in tap-priority:
  NowRule → AttentionCard (if down) → LoadSpine+count → block groups → deep-link
  to Rounds.
- **Attention placement** — man-down=AttentionCard (everywhere it appears);
  overdue=AttentionCard.Row (Hole.row) in the row; page notices=AlertStrip;
  offline=OutboxIndicator; now=`NowTag` on the block row (Schedule) /
  `NowRule` divider (phone glance), today only.
- **Approval queue** (Proposals) — the surface where actions an external Claude
  chat proposes land for human sign-off. Pending / History tabs over a stack of
  flush `ProposalCard`s; Approve runs the app's real create path, Reject
  discards — nothing an agent proposes mutates data until James approves it here
  (principle 8: surface + prompt, never silent mutation). Backed by the
  `agent_proposals` table + `useAgentProposals`; proposals arrive live via
  realtime, so one queued from a phone shows up instantly. The agent's write
  tools (`mcp/`) are propose-only, which also keeps a future public endpoint
  low-risk — it can only enqueue, never corrupt.

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
