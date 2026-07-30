# Findings — 2026-06-30 audit (Round-3 Schedule UI feedback)

_CAPTURE→TRIAGE pass over James's 2 walkthroughs of the Round-3 Schedule
changes (Steps 0→4a, uncommitted on `feat/harvest-remix`). Numbering
restarts at F1. Each finding: page · James's words · frame · diagnosis ·
size · checkbox. **Triaged 2026-06-30 — see Triage Outcome below.**_

Format key — size: S (small/localized), M (medium/one component),
L (large/multi-file). Diagnoses cite current uncommitted code.

---

# 🔧 TRIAGE OUTCOME (2026-06-30, with James)

All 34 findings triaged. The three open decisions are **resolved**:

- **F12 — block naming:** chore blocks are **labelled "Chores"** (exactly
  as project blocks are labelled "Project"). The C badge + time + position
  distinguish them; the per-block names (Sunrise/Mid-Morning) are dropped
  from the row label.
- **F17 — time-off symbol:** **DEFERRED.** Root cause James named: break
  time is currently modeled as "time off," which is **semantically
  incorrect** — unresolved. Ship the **E (event) + conflict-triangle**
  week symbols now; add NO time-off symbol until the break-vs-time-off
  model question is settled (parked below).
- **F19 — widths:** **left sidebar stays 180** (`DayRailSpine` already
  `w-[180px]`); **right week pane 300 → 240** (`Schedule.jsx:2824`
  `w-[300px]`), which hands the center timeline +60px — the "center needs
  to be bigger" ask.

**Parked semantic question (not a UI finding):** break time is stored as
time-off but isn't time-off. Resolve the model before any time-off UI.

### Build slices — priority order (build onto `feat/harvest-remix`)

**A · Identity & color foundation** *(do first — B/C/D hang on it)*
- **F9** chore color token = AMBER-GLOW (~`#C77000`); stop using green for
  chore identity.
- **F8** C/P/E lettered bordered-box badges — new shared `KindBadge`
  primitive (chore=amber, project=slate `#3F6DA3`, event=periwinkle).
- Document the new token + `KindBadge` in both design-library faces.

**B · Block-list (`DayRailSpine`) → WeekStrip visual language**
- **F1** drop `border-b` dividers, outlined-row active state, clean left
  border · **F2** active bounding-box (subset of F1) · **F3** equal row
  heights (decouple the load gauge from row height).
- **F4** Whole-day: drop "overview · N items" subtext · **F5** normalize
  the Whole-day icon · **F6** drop "0/1" counts from row titles.
- **F12** chore rows labelled **"Chores"** · **F10** project title →
  normal text color (badge carries identity) · **F13** row title type
  matches WeekStrip day labels · **F14** overnight → "Until …" / "After …".
- **F7 + F34** (merged) render the canonical **NowRule** in the block list.

**C · Week pane (`WeekStrip`) + layout**
- **F15** remove explainer caption (`Schedule.jsx:2837–2839`) · **F16**
  remove legend.
- **F17** E-badge + conflict-triangle symbols replace the number +
  heat-box (time-off symbol deferred).
- **F19** right aside `300→240`, left stays `180`.
- **F20** header button-row padding (rule too close) · **F21** WeekStrip
  hover/active (lighter-on-hover, bg active no border) on the view-toggle
  + Time-off/Add-chore/Split-block/Add-one-off buttons.
- **F18** no-action (week bars stay chores-only — recorded so it's not
  re-raised).

**D · Day-load silhouette + warming**
- **F22** render the base day-load regardless of assignment · **F23**
  chore-color bars, no counts, conflict-only symbol.
- **F24** binary **warn/due** model via a **ClockAlert** icon (day-load
  summary line + the affected chore row, `×N`, hover detail) — replaces
  the should-heat gradient · **F25** name *which* chore is warming
  (folded into F24).
- **F26** day-load project bars = slate, height ∝ block duration, unplanned
  cross-hatch (shares the blue cross-hatch util with **F11**).

**E · Remove two-lane + trim recap**
- **F27** delete the two-lane "who's on what" pane (NO-LEGACY) · **F28**
  collapse the over-detailed recap to a count + on-demand detail · **F29**
  remove "for learning the routine, not grading" · **F31** recap
  typography audit · **F30** "looking back" minor/optional · **F33**
  project checkbox — defer (no-op now).

**F · Project continuity**
- **F32** projects populate the whole day + a "Continue" copy button (uses
  the same project model as F26).

**Cross-slice:** the blue cross-hatch (F11 block-list project rows + F26
day-load project bars) is one util built once. F8's `KindBadge` is reused
in block list (F8), week symbols (F17), and day-load (F23). Decide
slice A first — it unblocks the rest.

---

## Clip 1 — `2026-06-30_04-04-26.mp4` (~4.3 min, 35 segments)

Subject: desktop Schedule **Day** view, almost entirely about the **left
block-list pane** (`DayRailSpine` in `ScheduleSidebars.jsx`) vs. the right
**"THIS WEEK" pane** (`WeekStrip` in `ui.jsx`), which James prefers.

### F1 — Block-list pane should adopt the WeekStrip's visual language · M
- **Words:** "this pane on the left… does need some improvements… the
  styling of this pane on the right, this week, I like much better… most
  of this could be adopted by this component. I like that it has this
  clean left border and no dividers between each of these items, unlike
  this menu over here. I like the outline of the row, the border as the
  indicator, and I like the hover state."
- **Frames:** `0004_00-20`, `0005_00-27`, `0007_00-36`, `0008_00-43`,
  `0009_00-50`
- **Diagnosis:** `DayRailSpine` rows (`ScheduleSidebars.jsx:80–259`) use
  `border-b border-line` **dividers** between every row, and mark
  selection with `bg-row-active` + a 2px right-edge color rule
  (`absolute right-0 … w-[2px]`). `WeekStrip` sidebar rows
  (`ui.jsx:564–572`) instead use a per-row `border` (transparent by
  default, `border-resolved` for the indicator), **no** `border-b`
  dividers (just `gap-1`), a clean container left edge, `bg-row-active`
  selection + `hover:bg-row-hover`. Restyle `DayRailSpine` to match:
  drop `border-b` dividers, switch selection/today to a full-row
  bounding-box `border`, keep hover.
- [x] triaged

### F2 — Selected/active row needs a bounding-box outline, not just bg · S
- **Words:** "We have some of the hover-state behavior, but we don't have
  that same active bounding box, and I would like to see that."
- **Frame:** `0011_01-00`
- **Diagnosis:** subset of F1. Active row = `bg-row-active` fill + 2px
  right rule only; James wants the WeekStrip-style outline box around the
  active row (cf. "Tue 30" boxed in the week pane via `border-resolved`).
- [x] triaged

### F3 — Block-list row heights vary too much · M
- **Words:** "the height of each of these rows — I like the padding —
  seems to vary a lot over here. I'm not exactly sure why. I think it
  might have something to do with the number of chores assigned to each
  of these blocks."
- **Frames:** `0012_01-08`, `0013_01-15`, `0014_01-23`
- **Diagnosis:** correct guess. Each row's left load gauge is sized by
  count: `barSize(b.count, max, 16, 34)` (blocks),
  `projSize(b.durationMin, 16, 34)` (projects); rows are `min-h-[52px]`
  so a tall gauge pushes the whole row taller → uneven list. WeekStrip
  rows are all equal height (gauge scales *within* a fixed `h-7` track).
  Fix: fixed row height; let the gauge scale inside it.
- [x] triaged

### F4 — "Whole day" row: drop "overview" word + the items count · S
- **Words:** "I don't know why it says 'overview' right here — that's not
  useful information… 54 items… it does say it right here in the day
  load. I'd say we don't need to know 54 items here in the whole day.
  This can just be a simple 'Whole day' label with an icon to the left."
- **Frames:** `0021_02-15`, `0022_02-24`, `0023_02-30`, `0024_02-38`
- **Diagnosis:** `ScheduleSidebars.jsx:94–99` renders the subtext
  `overview · {totalItems} items`. Remove the subtext entirely → just the
  "Whole day" label + icon. (Count is already in the DAY LOAD header
  "54 items".)
- [x] triaged

### F5 — "Whole day" icon weight/color inconsistent with row icons · S
- **Words:** "the icon being used here, I think is okay, although it looks
  like it's a different weight or different color than some of the other
  icons. I don't exactly know why."
- **Frames:** `0019_02-00`, `0020_02-07`
- **Diagnosis:** `LayoutList` is `size={16}` and turns `text-accent` when
  active (`ScheduleSidebars.jsx:92–93`), whereas block/overnight/project
  icons are `size={15}` with `text-faint`/`text-accent-deep`/`text-project`
  defaults (lines 129, 175–177, 236–239). Normalize the Whole-day icon
  size + resting color to match the other rows.
- [x] triaged

### F6 — Block/overnight/project rows: drop the "0/1" done count · S
- **Words:** "the label here, 'overnight', and then it's trying to say
  zero of one, meaning zero of one task is complete… I don't know exactly
  why it's represented here like that. I don't think that's necessary. I
  think just the label works."
- **Frames:** `0027_03-00`, `0028_03-07`, `0029_03-14`, `0030_03-22`
- **Diagnosis:** the `· done/count` suffix is appended to row titles:
  Overnight `Overnight · ${b.done}/${b.count}` (line 181), Project
  `Project · ${b.done}/${b.count}` (line 135), regular blocks via the
  gauge only. Remove the count suffix from the row title (the gauge fill
  already shows done-vs-load). Keep the "now" marker (F7).
- [x] triaged

### F7 — Promote "now" from a text keyword to the canonical NowRule · M
- **Words:** "We have the keyword 'now' here… [opens the style guide] the
  now rule — we have this pattern for, right? I want to see this show up
  over here."
- **Frames:** `0030_03-22`, `0034_04-00`, `0035_04-17`
- **Diagnosis:** the block list marks "now" with a small uppercase text
  tag + a `resolved` ring on the gauge (lines 172, 185–189, 228–230,
  250). James wants the documented `NowRule` (green hairline + dot +
  glow; `ui.jsx` `NowRule`, "Stable" in the style guide) rendered in the
  block list at the current-time position — a horizontal now-line across
  the list, like the Schedule timeline already uses. Positive: keep the
  "now" signal; this is an upgrade, not a removal.
- [x] triaged

---

## Clip 2 — `2026-06-30_04-15-43.mp4` (~58 min, dense design direction)

Subject: a long, detailed pass over the desktop Schedule — block-list
identity/color, the week pane, layout widths, the day-load silhouette,
warming, the two-lane pane, and the confirm/recap area. James repeatedly
references the **Rethinker mockup** (`nff-admin-schedule-rethinker.
netlify.app`, "Schedule Design Bracket Round 2") as the design target,
and live-prototypes several changes in Firefox devtools.

**Color grounding (style-guide Color page, frames `0019`/`0030`):** the
ramps James names map exactly — **AMBER-GLOW** (currently → `cat-popup`,
he also cites deliveries; ~`#C77000`/`#CC7700`) = his desired **chore**
color; **SLATE-BLUE** `#3F6DA3` = **project** (already mapped);
**PERIWINKLE** (currently unmapped) = his desired **event** color.

### F8 — Replace block icons with lettered bordered-box badges (C/P/E) · L
- **Words:** "these little clock and sun icons are just not good enough at
  denoting what this block is… I want to see this font being used up
  here… Inter, 600 point, with a border around it… instead of the word
  'task', I want the letter C for chore… the project just has this SVG —
  project is slate blue 3F6DA3 — now we have a clear indicator this is a
  project block… anywhere there's a chore block it should have a C next
  to it." Later: an **E** in a box (periwinkle) for events.
- **Frames:** `0029`, `0030`, `0035`, `0122` (live devtools prototype:
  `border-color:#c77000` for C, `#3f6da3` for P), `0136`
- **Diagnosis:** `DayRailSpine` (`ScheduleSidebars.jsx`) currently uses
  Lucide glyphs per block (`blockIcon()`, `ClockArrowLeft/Right`,
  `FolderKanban`, `LayoutList`). Replace with a small bordered-box badge
  holding a single letter (Inter ~600, tight border): **C** = chore
  block (amber), **P** = project (slate), **E** = event (periwinkle).
  New shared primitive (e.g. `KindBadge`) — document in both design-lib
  faces. Same badge is reused in the week pane (F17) and day-load (F23).
- [x] triaged

### F9 — Introduce a dedicated CHORE color (amber-glow), stop using green · L
- **Words:** "chores need a color other than accent green — it's being
  used too far and too wide, we need a set color for it… this amber glow,
  which is right now used for the pop-up category and for deliveries —
  this is the color scheme I'd like to apply to chores… this gold, this
  rust… the lighter one, the center, ~CC7700."
- **Frames:** `0018`, `0019`, `0030`
- **Diagnosis:** chores currently render in `--accent`/green throughout
  (block bars, C-context). Add a semantic **chore** token mapped to the
  AMBER-GLOW ramp (~`#C77000`) and repoint chore identity (C-badge
  border, chore block bars in list + day-load) to it. Keep green for
  other roles. NOTE: AMBER-GLOW is currently the `cat-popup` mapping —
  triage whether to remap categories (James said events can later
  collapse to one color, but "not what I want to get into right now").
  Document the new token in the design library Color page.
- [x] triaged

### F10 — Project row: keep "Project" name but not blue text · S
- **Words:** "we don't need the word 'project' to be blue — we can just
  use the regular text color, like the other ones. The time is good,
  'both free' is good."
- **Frames:** `0035`, `0122`
- **Diagnosis:** `ScheduleSidebars.jsx:131–142` renders the project title
  + time in `text-project` (slate blue). Switch the title to the normal
  `text-fg`; the **P badge** (F8) carries the slate-blue identity now.
  Keep the time + "both free" subtext.
- [x] triaged

### F11 — Project rows: planned vs unplanned indication (blue cross-hatch) · M
- **Words:** "we need a way of indicating if they're free/planned or not…
  [finds the cross-hatch on the ribbon 'wash eggs'] this linear gradient
  — instead of this color scheme we'd use a corresponding blue one. That
  would be an unbooked/unplanned project. A planned project — I'd love to
  see 'Plan'… and this would change from cross-hatch to a more solid
  design."
- **Frames:** `0055`–`0060` (cross-hatch ref), `0074` (planned/"Plan")
- **Diagnosis:** project rows have no planned/unplanned state today.
  Add: **unplanned** = blue cross-hatch (repeating-linear-gradient over
  `--c-project`); **planned** = solid project fill. Surface a **"Plan"**
  affordance on unplanned project rows. The cross-hatch precedent exists
  on the ribbon (the "wash eggs" gradient) — port it to blue. Ties to
  the day-load project bars (F26).
- [x] triaged

### F12 — Block naming consistency — RESOLVED: label chore blocks "Chores" · S
- **Words:** "the block name — overnight, sunrise, mid-morning — let's get
  rid of that then… if it doesn't seem necessary to have projects called
  'project' and chores to have these special names… they can keep their
  name here, but they need to be called 'chore' instead… actually not
  sure, but rather 'chores'."
- **Frames:** `0103`–`0110`
- **Diagnosis / RESOLUTION (James):** **option (b)** — relabel all chore
  blocks to **"Chores"**, exactly as every project block is labelled
  "Project". The C badge (F8) + the time subtext + position carry the
  identity; the per-block names (Sunrise/Mid-Morning/Overnight) are
  dropped from the row label. Overnight stays a chore row labelled
  "Chores" but keeps its F14 "Until/After" time treatment.
- [x] triaged

### F13 — Block-list row title typography should match WeekStrip dates · S
- **Words:** "we need consistency. Font size 13 here, text size 12 there…
  this font style should be the same as this font style — this date
  should be the same as the title. Both active and inactive should match.
  This subtext (the time) can stay. The bottom typography styles are
  fine."
- **Frames:** `0090`–`0095`
- **Diagnosis:** row titles in `DayRailSpine` are `text-[13px]`/`[12px]`
  with mixed weights; WeekStrip day labels are `text-[12px]` tabular.
  Unify the block-list title type ramp with the WeekStrip day-title
  (same size/weight, active + inactive). Keep the time subtext.
- [x] triaged

### F14 — Overnight range label too long; use "Until …" / "After …" · S
- **Words:** "this time label on overnight is unnecessary and too long.
  When the overnight is at the top (started yesterday) we'd want to see
  'Until [5:16 AM]' — cleaner. When it's at the bottom (starts today) we
  see 'After 8:57'."
- **Frames:** `0097`, `0098`, `0101`, `0102`
- **Diagnosis:** `ScheduleSidebars.jsx:191–193` shows the full
  `rangeLabel` ("8:57 PM–5:16 AM"). For the lead (top) overnight show
  `Until <end>`; for the trailing (bottom) overnight show `After
  <start>`. `b.side` already distinguishes lead/trail.
- [x] triaged

### F15 — Remove the confusing week-pane explainer caption · S
- **Words:** "the meaning of this box… 'the tick warms toward a should
  chore's deadline' — that's very confusing to somebody who doesn't
  understand what that means. I'd prefer that text didn't exist there."
- **Frames:** `0120`–`0124`
- **Diagnosis:** the caption under the WeekStrip ("Taller bar = heavier
  block · the tick warms toward a should-chore's deadline. Tap a day to
  open it.") — remove it.
- [x] triaged

### F16 — Remove the week-pane legend at the bottom · S
- **Words:** "we can dispense with this legend at the bottom."
- **Frames:** `0150`, `0151`
- **Diagnosis:** drop the week-pane legend block.
- [x] triaged

### F17 — Week rows: replace number + heat-box with E/conflict symbols · M
- **Words:** "instead of this number, which I don't know what it means,
  and this box which I don't know what it means — I'd like symbols. An
  **E in a box, periwinkle**, to indicate an event that day. If there's a
  conflict, the **triangle with exclamation in the conflict color**. I
  need to hover and see what they mean — hover the E → 'event today';
  hover the conflict icon → 'X conflicts'. Conflict + events, that's all
  we'll worry about." (Time-off mentioned, then dropped.)
- **Frames:** `0133`–`0150`
- **Diagnosis:** `WeekStrip` sidebar rows (`ui.jsx:597–610`) render a
  heat-color box + `day.total` number on the right. Replace with up to
  two symbols: **E badge** (periwinkle, F8 family) when the day has an
  event (hover "event today"); **AlertTriangle** in `--warn`/conflict
  color when the day has conflicts (hover "N conflicts"). Needs farmLoad
  to expose per-day event-present + conflict-count. Hole-needs-cover /
  reservation should also surface in the bars.
- **RESOLUTION (James):** ship **E (event) + conflict-triangle** only.
  **No time-off symbol** — break time is currently stored as "time off"
  but that's semantically wrong (break ≠ time off); the model question is
  parked (see Triage Outcome) and no time-off UI lands until it's settled.
- [x] triaged

### F18 — Week bars: overnight/projects representation — NO CHANGE · — 
- **Words:** "I feel there's something missing — the overnight bar… you
  know what, I don't think we need to worry about that. This is fine in
  this current implementation. It's okay that projects are omitted —
  those are just the spaces between chores."
- **Frames:** `0113`–`0118`
- **Diagnosis:** resolved-no-action. James considered then rejected
  adding overnight/project bars to the week. Keep current week bars
  (chores only). Recorded so it isn't re-raised.
- [x] triaged

### F19 — Center timeline too cramped; rebalance sidebar widths · M
- **Words:** "the timeline is getting too cramped and crowded… the center
  column needs to be slightly bigger. Reduce the width of [a sidebar]…
  once we add the icons to the week and get rid of the numbers, this
  column can get smaller… 240 is a good width for this side, 180 for this
  side."
- **Frames:** `0153`–`0167`
- **Diagnosis / RESOLUTION (James):** **left `DayRailSpine` stays
  `w-[180px]`** (no change); **right week aside `Schedule.jsx:2824`
  `w-[300px]` → `w-[240px]`**. The 60px reclaimed goes to the center
  timeline (the "center needs to be bigger" ask), enabled by F16/F17
  stripping the week pane's numbers + legend.
- [x] triaged

### F20 — Header button-row padding (rule too close to buttons) · S
- **Words:** "I don't like the proximity of this horizontal rule to the
  bottom of these buttons… ~25 padding left/right is appropriate, ~10
  top, button row 15 margin-bottom, justify to the end."
- **Frames:** `0168`–`0179`
- **Diagnosis:** the Schedule header / Day-Week-Month-Review toggle row
  sits too tight to its underline rule. Loosen padding/margins per the
  approximate values James dialed in devtools (treat as targets, match
  the style-guide spacing scale).
- [x] triaged

### F21 — Adopt WeekStrip hover/active interaction on Schedule buttons · M
- **Words:** "the active day is just a background with no border. As I
  hover the other options, rather than getting darker, I'd like a
  slightly **lighter** hue of gray that follows the cursor; when clicked,
  the same active style. Use this same hover state for the Time-off /
  Add-chore buttons too — and split block, add one-off task."
- **Frames:** `0184`–`0192`, `0244`–`0250`
- **Diagnosis:** the Day/Week/Month/Review toggle + Schedule action
  buttons currently darken on hover. Switch to the WeekStrip day-button
  model: active = `bg-row-active`, no border; hover = a *lighter* gray
  (`bg-row-hover`), click = active. Apply to view-toggle + Time off / Add
  chore / Split block / Add one-off task. (Pairs with F1/F2.)
- [x] triaged

### F22 — Day-load vanishes on unassigned days · S
- **Words:** "on Monday the day load goes away — I suppose because no one
  is assigned. That's something I can work on."
- **Frames:** `0153`, `0261`–`0263`
- **Diagnosis:** the center day-load silhouette / "who's on what" only
  renders when chores are assigned (confirmed: shows Sun + Wed, not
  others). The base day-load should render regardless of assignment;
  only the per-person lanes depend on assignment (and those are being
  removed, F27).
- [x] triaged

### F23 — Day-load bars: chore color, no counts, conflict-only symbol · M
- **Words:** "the first block of the day, sunrise, should be the color of
  chores. I don't need to see how many items are there. All I need is a
  conflict symbol if there's a conflict."
- **Frames:** `0194`–`0196`
- **Diagnosis:** the day-load `LoadSpine`/silhouette bars should use the
  new chore color (F9); drop per-bar item counts; show a conflict symbol
  on a bar only when that block has a conflict.
- [x] triaged

### F24 — Warming model → discrete WARNING/DUE via ClockAlert icon · L
- **Words:** "we're NOT going to worry about incremental warming. It's one
  of two things: **warning** (a chore due this current week → warn color,
  same as the 'not done yesterday' banners) or **due** (due today →
  red). A **clock-alert icon** shows up in the day load, inline with '68
  items · 5 blocks · 4 projects', with a contrasting background. Hover
  tells me the level/when due. Multiple chores → 'clock-alert ×3'. When I
  scroll to that chore-block row, the clock-alert icon shows up again at
  the same level."
- **Frames:** `0197`–`0229` (ClockAlert chosen at `0206`/`0207`)
- **Diagnosis:** today warming is a continuous should-heat gradient
  (`farmLoad` heat + week tick). James wants it **binary**: WARNING
  (`--warn`) vs DUE (`--danger`/red), surfaced by a Lucide **ClockAlert**
  icon (a) in the day-load summary line and (b) on the affected
  chore-block row, with a `×N` multiplier + hover detail. This simplifies
  the heat model — coordinate with F15 (removing the "warms toward
  deadline" caption) and the week should-heat. Big change: farmLoad heat
  → warn/due booleans + counts; new ClockAlert affordance in day-load +
  rows. Document in design library.
- [x] triaged

### F25 — Surface WHICH chore is warming · S
- **Words:** "Monday claims to have a warming chore but I don't know which
  one — it doesn't tell me here. It's kind of a problem. [In the day load
  we see] the sunrise block has a chore popping up, 'Modellon', three
  days left."
- **Frames:** `0199`–`0203`
- **Diagnosis:** part of F24 — the ClockAlert hover / day-load detail
  must name the specific warming/due chore(s) and days-left, not just
  signal that *something* is warm.
- [x] triaged

### F26 — Day-load project bars: slate, duration-height, unplanned hatch · M
- **Words:** "the project block height should be relative to how long the
  block is going to be… and that same unplanned status for the project
  block should be represented here too. The day load should mostly follow
  what we had in the rethinker mockup."
- **Frames:** `0233`–`0239`
- **Diagnosis:** Step 4a added project spine bars (`kind:"project"`,
  total:0, slate). This extends them: **height ∝ block duration**, and
  the **unplanned cross-hatch** (F11) shown on day-load project bars too.
  Reference the Rethinker day-load silhouette.
- [x] triaged

### F27 — Remove the two-lane "who's on what" pane for now · M
- **Words:** "the two-lane approach relies so heavily on us assigning
  chores… it doesn't need to be represented. I think this entire pane can
  go away for now. The day-load who's-on-what — let's just get rid of
  that for now."
- **Frames:** `0136`, `0239`–`0243`, `0261`–`0263`
- **Diagnosis:** remove the per-person two-lane overlay / "DAY LOAD ·
  WHO'S ON WHAT" section (the `farm.lanes` overlay + person-lanes block).
  NO-LEGACY: delete it, don't hide it. Resolves F22's "only on assigned
  days" oddity. (`buildPersonLanes` in farmLoad becomes unused — drop the
  call/consumer; keep or prune per no-legacy.)
- [x] triaged

### F28 — Confirm/recap shows too much (every undone/changed name) · M
- **Words:** "this needs to change — there's too much information here. We
  don't need to see the name of every single thing that's been left
  undone or changed."
- **Frames:** `0253`–`0255`, `0136` ("15 changes since you confirmed …"),
  `0005`/clip-1 ("Yesterday — 61 must-dos unfinished")
- **Diagnosis:** the "N changes since confirmed" / "Yesterday — N
  must-dos unfinished" recap enumerates each item. Collapse to a summary
  count (passive `AlertStrip`) with detail on demand, not an inline list
  of every name.
- [x] triaged

### F29 — Remove "for learning the routine, not grading" microcopy · S
- **Words:** "I'd like to dispense with this text — 'for learning the
  routine, not grading'. We don't need that information there."
- **Frames:** `0256`, `0257`
- **Diagnosis:** delete that accountability microcopy line. (Note vs
  memory [[chores-accountability]] — the *principle* stays; the on-screen
  caption goes.)
- [x] triaged

### F30 — "Looking back" heading — optional/minor · S
- **Words:** "the text that says 'looking back' — I don't think that's
  necessary. Well, it's fine. Whatever."
- **Frames:** `0259`, `0260`
- **Diagnosis:** low priority; James waffled to "fine." Park unless we're
  already in that area.
- [x] triaged

### F31 — Recap-area typography "looks funny" — verify vs style guide · S
- **Words:** "the typography here looks a little funny, I don't know why.
  Something to check — make sure it matches our style guide."
- **Frames:** `0258`, `0259`
- **Diagnosis:** audit the confirm/recap area type against the design
  library (likely a stray size/weight/family). Fix to the type ramp.
- [x] triaged

### F32 — Projects populate the whole day + a "Continue" copy button · M
- **Words:** "projects need to be populated for the entire day, even
  though the only thing that gets added is the first undone task. There
  really needs to be a button that just says 'Continue' / 'Continue
  project above' — a quick button to keep working on the same project; it
  copies the project down to the next project block."
- **Frames:** `0264`–`0271`
- **Diagnosis:** project blocks should appear across the day's gaps (not
  just one), and each later project block gets a **Continue** action that
  copies the prior project + its first-undone task down. Pairs with the
  day-load project bars (F26).
- [x] triaged

### F33 — Project checkbox semantics — DEFER · S
- **Words:** "we have our checkbox here, but checking this box doesn't
  actually mean we finished it… I don't want a million empty checkboxes
  laying around. No, I guess it's fine for now. We just want that quick
  copy button."
- **Frames:** `0271`–`0274`
- **Diagnosis:** James explicitly defers — keep the checkbox as-is for
  now; the Continue/copy button (F32) is the priority. Record so it's not
  re-litigated.
- [x] triaged

### F34 — NowRule pattern in the block list (reinforces clip-1 F7) · M
- **Words:** "there should be some way of using the same pattern — that's
  the whole point of having the component — this tells us how the now
  indicator should appear."
- **Frames:** `0001`–`0003` (continues directly from clip 1's close)
- **Diagnosis:** duplicate signal of **F7** — render the canonical
  `NowRule` in the block list rather than the text "now" tag. Merge into
  F7 at triage; logged here for completeness.
- [x] triaged

---

## Cross-cutting themes (for triage)

- **One identity system:** lettered bordered-box badges (C/P/E) + three
  fixed colors — **chore = amber-glow**, **project = slate-blue**,
  **event = periwinkle** — applied consistently across block list (F8),
  week symbols (F17), and day-load bars (F23/F26). Green stops carrying
  "chore." This is the spine that F8/F9/F10/F17/F23/F26 all hang on —
  decide it first.
- **Adopt the WeekStrip's visual language everywhere on Schedule:** no
  dividers, outlined/bg states, lighter-on-hover, matched typography
  (F1/F2/F3/F13/F21).
- **Simplify warming to binary warn/due** with a ClockAlert icon
  (F24/F25), and strip the explanatory captions/legends (F15/F16) and
  over-detailed recaps (F28/F29).
- **The Rethinker mockup** (`…-rethinker.netlify.app`) is the standing
  visual reference James points to (frames `0074`, `0136`, `0199`,
  `0207`). Worth a side-by-side during triage.
- **Recommended build slice (post-triage):** (1) the color/badge identity
  system; (2) block-list restyle to WeekStrip language; (3) week-pane
  symbols + width rebalance; (4) day-load chore/project bars + ClockAlert
  warming; (5) remove two-lane pane + trim recap; (6) project "Continue".
