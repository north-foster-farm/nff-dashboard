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
`warn` #a06d10/#e6b85a · `resolved` #297d5a/#4cba85 ·
`project` #3f6da3/#7d9ec9. On-fill text: `on-accent` #fff/#0d1410,
`on-cat` #fff/#0d1410. No `white` token.
Row tints (rgba): `row-active`, `row-hover`, `row-active-dim`.
Category hues (`cat-*`): fm (farmers market), popup, egg, chore, deliveries,
farm-visits, pickups, processing, default — see foundations.html.
Decorative ramps (50→950): sky-aqua, celadon, turf-green, tea-green,
amber-glow, honey-bronze, hot-fuchsia, slate-blue, periwinkle (+ 3 dupes to
collapse: frozen-lake=sky-aqua, honey-bronze=amber-glow,
grapefruit-pink=hot-fuchsia; emerald/periwinkle unmapped).

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

- **Pane** · Converging · flush bordered section + eyebrow/Lora header; the
  default container, replaces raised `Card`. Not for overlays (raised).
  Source: `src/components/ui.jsx:42` (Card, raised today → flip flush).
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
- **StatTile** · Converging · Lora number + uppercase label KPI; flush w/ Pane
  migration (`ui.jsx:88`).
- **CheckTarget + ChoreCheckRow** · Converging · the ONE completion row,
  keyed (chore, place), shared Rounds+Schedule, one outbox path. 28px box
  (`w-7 h-7 border-2`, done=bg-resolved). Kill the 20/16/14px reimpls.
  Source: `src/components/ChoreCheckRow.jsx:22`.
- **EventRow** · Converging · row with left color-bar in the category hue.
  Unify the 2 mechanisms (`Schedule.jsx:246` border-left,
  `Overview.jsx:489` inset box-shadow).
- **AttentionCard / Hole** · Converging · flush amber card (`color-mix warn`),
  ⚠ eyebrow + work + reason + ONE solid-amber action; hole = amber inset ring +
  45° hatch. The one treatment for blocked/orphaned obligations; supersedes
  ChoreCheckRow's raised `border-l-2 bg-warn/5`. Source: `Schedule.jsx:2078`.
- **Attention banner** · Stable · flush full-width warn strip (border-on-bg).
  Source: `Schedule.jsx:2237`.
- **NowRule** · Converging · green hairline + 7px dot + glow + "Now · time"
  eyebrow; today-views only. Collapse `NowMarker` + pool copy. Not a colored
  block. Source: `Schedule.jsx:340` (NowMarker).
- **SealStamp** · Proposed · celadon "✓ Sealed · who · window · N/N"; anchors
  the Rounds wrap; no separate "confirm the day" (sealed by completion).
  Home: `Rounds.jsx:470` (WrapCard).
- **LoadSpine** · Converging · count-driven height bars per block; ALWAYS show
  the count beside it, never height alone. Keep semantically distinct from a
  progress bar. Source: `DayRibbon.jsx`, `WeekSpines.jsx`, `ScheduleSidebars`.
- **WeekStrip** · Converging · the week drawn ONCE, in the sidebar list, each
  row = inline mini-spine + should-heat tick. Resolves the duplicate week
  (center `WeekSpines` + sidebar `WeekList`).
- **should-heat / heatColor()** · Converging→Proposed · warn ramp over a
  deadline runway → `cat-processing` on the deadline day; one shared
  `heatColor()` in a future `lib/load/farmLoad.js`. Ships as `weekShouldHeat`
  (`lib/schedule/weekView.js`).
- **CommandPalette** · Stable · ⌘K app-wide search, keyboard-first
  (`src/components/CommandPalette.jsx`).
- **Sheet / Modal** · Proposed · NO shared primitive (15 hand-rolled
  `fixed inset-0`). Extraction target: QuickActionsTray's internal `Sheet`
  (bottom-sheet phone / centered desktop, raised over scrim).
- **OutboxIndicator** · Stable · offline/queued/failed sync state; one impl in
  TopBar + Rounds (`src/components/OutboxIndicator.jsx`).
- **EmptyState** · Converging · dashed box + a line that says what to do;
  consolidate the several shapes. An empty screen invites an action.

## Patterns (page-level — see patterns.html)

- **Page shell** — header (Lora title + uppercase back-link + bottom hairline)
  over flush eyebrow-titled sections.
- **Master–detail** (Schedule desktop) — left load rail · center detail ·
  right week sidebar (→ one WeekStrip). Phone collapses to day-strip + column.
- **Full-screen takeover** (Rounds) — Lora hero count + progress + NowRule +
  PlaceSwitcher + CheckTarget rows + tray + SealStamp on wrap.
- **Dashboard glance** — stack of flush panes; EventRow + LoadSpine + NowRule.
- **Phone Today glance** (Proposed) — signals stacked in tap-priority:
  NowRule → AttentionCard (if down) → LoadSpine+count → block groups → deep-link
  to Rounds.
- **Attention placement** — man-down=AttentionCard (everywhere it appears);
  overdue=Hole in the row; page notices=flush banner; offline=OutboxIndicator;
  now=NowRule (today only).

## Consolidation backlog (the bounded-options payoff)

Collapse, don't re-litigate: raised Card/StatTile/PlaceSection/WeekList →
flush Pane; 4 checkbox sizes → one 28px CheckTarget; BTN_* + 3 inline →
one Button; 15 overlays → one Sheet/Modal; 3 result-row impls → one ResultRow;
StatusPill + other pill bases → one base; 2 now-markers → one NowRule;
2 event-bars → one EventRow; inline `T.*` idiom (Chores.jsx) → token classes;
delete the `/rethinker` scratch after promotion.

Migration order (cheapest-first): Step 1 — Card→Pane flush flip, ChoreCheckRow
escalation→Hole, unify NowRule. Step 2 — promote AttentionCard/SealStamp/
CheckTarget/LoadSpine into ui.jsx, add `lib/load/farmLoad.js`. Step 3 — fold
week into sidebar WeekStrip, delete center WeekSpines + DayRibbon. Last —
delete `/rethinker`. (Full rationale, from repo root:
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
