# NFF QA Walkthrough — Findings (2026-07-01)

Capture-phase log from the recorded-walkthrough audit. One finding per
issue. Numbering restarts at F1 for this run. **No fixes/commits until we
triage together.** Frame paths are relative to each clip's
`processed/<clip>/` dir.

## Sources (3 clips, 2 sessions)

- **June 30 session** — `2026-06-30_04-04-26` (35 seg, ~4.5 min) +
  `2026-06-30_04-15-43` (275 seg, ~58 min). These are **one continuous
  session**: clip 2 opens mid-sentence continuing clip 1's now-indicator
  thread. A deep Schedule visual-redesign session, much of it done live
  in devtools. Findings **F1–F27**.
- **July 1 session** — `2026-07-01_12-25-24` (300 seg, ~29 min). A
  separate, more recent pass over Schedule (desktop + mobile), Rounds,
  and Projects — revisits June 30's topics and adds a large new
  availability / working-hours / time-off feature cluster. Findings
  **F28–F60**.

Per James: **the July 1 session supersedes but does not negate June 30.**
Where the two sessions disagree, the conflict is flagged in §0 and inline
(`↔ F#`), *not* silently resolved in favor of the newer clip.

## Legend

- **Kind:** BUG · UX · DESIGN · FEATURE · MOBILE · DATA · DECISION.
- **Size:** S (quick) · M (a session) · L (multi-session / design).
- Boxes are unchecked until triaged. `↔ F#` = relates to / extends /
  supersedes / contradicts that finding.

> **Character of this walkthrough:** it is mostly **design redirection +
> net-new features**, not a bug list. The genuine BUGs are called out in
> §0.2 for fast picking. The big-ticket items are a Schedule visual
> redesign (C/P/E badges, chore color, planned/unplanned project fill,
> now-marker, This-Week symbols) and a new **availability model**
> (working hours + time off + breaks + who's-here + availability-based
> default assignment).

---

## §0 · Read first

### §0.1 Cross-session contradictions (RESOLVED by James 2026-07-01)

All three resolved in triage. The July 1 direction wins, with intent:
**This Week should be a truer representation of the whole week, not just a
load-comparison tool.**

- [x] **X1 — Overnight in the This Week panel → INCLUDE.** Overnight
  shifts are represented in the This Week bars. Overrides the June 30
  "don't need it" decision (F18). ↔ F18 (retired), F49.
- [x] **X2 — Projects + events in the This Week bars → INCLUDE BOTH.**
  The bars carry the full set: chores, projects, and events — truer
  week representation. Overrides June 30 (F19). ↔ F19 (retired), F40.
- [x] **X3 — Presence → FOLD INTO the availability cluster.** Availability
  and assignment are "two sides of the same coin" for mapping resources
  to tasks — one system, not two. The old assignment-only who's-on-what
  pane (F24) is subsumed by the availability model (F45–F51). ↔ F24, F51.

**Batch scoping decision:** the availability cluster (F45–F51) is a
**slice within the Schedule redesign batch**, not separate work — it's
integral to the schedule. Aiming for **feature-complete** on this batch.

### §0.2 The genuine BUGs (fast-pick list)

- [x] **F31 — mobile: teal chore-block bars missing** on Schedule
  (regression, confirmed iOS). **FIXED `042fb53`** — DayStrip inline
  styles used nonexistent bare CSS vars (`var(--accent-deep)` etc.);
  now `var(--color-*)`. Same defect fixed in ScheduleZoom month heat.
- [x] **F36 — mobile: the 3 header buttons are misaligned** (right-
  aligned + odd left padding). **FIXED `9220384`** — wrapped trio is
  now full-width justify-between on phones; desktop unchanged.
- [x] **F52 — split-block then move a task to a chore block: the task
  doesn't appear** in that block. **FIXED `1ba1cda`** — doSplit now
  routes the sitting time through segmentForStart; rows re-home into
  the owning chore block. NOTE: the stranded walkthrough row
  (commitments `e07183cd`, m-tractor-move @ 16:00) was left in prod —
  redo that split in-app and it'll land in Late Afternoon.
- [x] **F57 — BLOCKER: a Rounds Quick-Action sheet (Mortality/Eggs)
  fills the whole mobile screen with no way to close** — no X, Escape
  does nothing, can't scroll to the close button. Confirmed frame 0261.
  **FIXED `3a61628`** — root cause: body density zoom × `vh` units
  (90vh = 108–135% of screen); capped modal cards at `max-h-full` +
  added Escape. Same fix applied to Buffer/ScheduleEdit/SplitBlock/
  Reservation sheets + ConflictsPanel (identical pattern).
- [x] **F59 — Project block shows "nothing planned"** — the auto-pull of
  the top project's next step isn't firing; Swap button gone (maybe WIP).
  **FIXED `8cbe932`** (with F60 — same root cause: the reflow engine only
  ran while the Projects page was open). Swap-button piece = F22 feature
  work, still open.
- [x] **F60 — Projects ranking doesn't sync to today's schedule** — had
  to hit "Sync now" manually; unsynced state isn't surfaced.
  **FIXED `8cbe932`** — engine now also mounts on the Schedule: stale
  strip + Sync now shown there, and the 30s auto-fallback fires while
  viewing. Open question answered conservatively: viewing does NOT force
  an instant sync; the debounced auto does it (honoring the toggle).
- [x] **F26 — a warming chore is claimed on a day but the row doesn't say
  which one** (`04-15` `[45:45]`–`[46:00]`). **ALREADY FIXED on main**
  (`aa37e6e`, June 30 remix, post-recording): the week-pane WarmingBadge
  hover names each chore + days left — verified live 2026-07-01.
- [x] **F2 — left-spine row heights/padding vary** for no clear reason.
  **ALREADY FIXED on main** (`aa37e6e`): DayRailSpine rows are equal
  (`min-h-[46px]`, self-stretching load rail) — verified live.

---

## §1 · June 30 session (`04-04` + `04-15`)

Continuous Schedule redesign. Left block-spine → This Week panel → center
pane, in that order.

### Left block-spine — styling

- [ ] **F1** · DESIGN · M — Adopt the **This Week panel's cleaner row
  styling** on the left spine: clean left border, **no dividers** between
  items, a **row outline/border as the active indicator** (an active
  bounding box, which the spine lacks today), and a clear hover state.
  "The styling of this pane on the right I like much better than this on
  the left… most of this could be adopted by this component."
  `04-04` `[00:27]`–`[01:08]` `frames/0005_00-27.jpg`,`0008_00-43.jpg`.
- [x] **F2** · BUG/DESIGN · S — **Left-spine row heights/padding vary**
  inconsistently (he suspects it tracks the chore count per block).
  Normalize. `04-04` `[01:08]`–`[01:23]` `frames/0012_01-08.jpg`.
  **Already fixed on main** (`aa37e6e` June 30 remix — see §0.2).
- [x] **F3** · DESIGN · S — **"Whole day" row**: drop the "overview"
  sub-label (not useful info), drop the "54 items" count — just a label +
  icon. Its icon looks a **different weight/color** than the others.
  `04-04` `[02:00]`–`[02:46]` `frames/0022_02-24.jpg`.
  **Superseded by F28** (batch 42.2): the desktop row is deleted
  entirely; the label cleanup had already shipped on main.
- [x] **F4** · DESIGN · S — **Overnight row "0 of 1" count** in the spine
  is unnecessary — just the label. `04-04` `[03:00]`–`[03:22]`
  `frames/0027_03-00.jpg`.
  **Already on main** (verified in code, session 6): the visible row is
  label + time only; the count survives only in the hover title.
- [x] **F5** · DESIGN · M — Bring the **NowRule / now-marker pattern**
  (the style-guide component) into the spine — "this tells us how the now
  indicator should appear… I want to see this show up over here."
  `04-04` `[03:30]`–`04-15` `[00:15]` `frames/0035_04-17.jpg`.
  **FIXED batch 42.3** — the NowRule (dot + "Now · time" + hairline) IS
  the current block's time line in the spine row (in the row, never a
  rule above it); NowRule generalized (no baked padding, span root,
  trailing-children slot); NowTag stays on center-pane rows.

### Left block-spine — the badge/color system

- [x] **F6** · DESIGN · M — **Chore blocks get a "C" badge** in place of
  the clock/sun icons: the style-guide badge treatment (Inter ~600, a
  character in a bordered box). Every chore block in the list shows a C.
  `04-15` `[00:23]`–`[06:00]`, `[05:37]`–`[05:54]`
  `frames/0009_01-30.jpg`,`0031_05-45.jpg`.
  **Already on main** (verified live 2026-07-01 session 6, desktop 1280): C badges render on every chore block in the spine.
- [x] **F7** · DESIGN · M — **Chores get a dedicated color** other than
  accent green (green is overused app-wide). Adopt the **amber-glow**
  scheme currently used for pop-up/delivery events (a gold/rust, ~a
  lighter step of it). Tighter border to match the badge style.
  `04-15` `[02:00]`–`[03:30]`, `[07:30]`–`[07:51]`
  `frames/0019_02-55.jpg`,`0021_03-11.jpg`.
  **Done with a settled deviation** (verified live session 6): the
  dedicated chore color shipped as **teal**, not amber-glow — amber
  was tried and reversed (collided with `warn`; see DESIGN-SYSTEM.md
  "slice D" note). Treat teal as final unless James reopens it.
- [x] **F8** · DESIGN · S — **Project blocks get a "P" badge**, slate
  blue **#3F6DA3**. Keep the word "project" as the row name but in the
  **regular text color**, not blue. `04-15` `[06:00]`–`[08:30]`
  `frames/0034_06-20.jpg`,`0044_08-12.jpg`.
  **Already on main** (verified live 2026-07-01 session 6, desktop 1280): P badge slate-blue; "Project" is regular text color.
- [x] **F9** · DESIGN/FEATURE · M — **Project rows: planned vs
  unplanned.** Unplanned/"free" = a **cross-hatch linear-gradient** fill
  (a blue version of the wash-eggs cross-hatch ribbon in the style
  guide); planned = a **solid** fill. `04-15` `[08:43]`–`[18:20]`
  `frames/0055_11-30.jpg`,`0057_12-11.jpg`,`0074_18-00.jpg`.
  **FIXED batch 42.3** — spine project rows: hatch (16) when free, solid
  wash (11) when a step occupies the gap; phone strip bars follow (45);
  shared `hatchUnplanned(strength)` util (was LoadSpine-private).
  Verified live both themes: Jul 1 planned=solid, Jul 4 free=hatch.
- [x] **F10** · DESIGN · S — **Genericize chore-block row names to
  "Chores"** in the spine (was Sunrise / Mid-Morning / Overnight); the
  block keeps its real name elsewhere. Projects stay labeled "Project".
  (July-1 frames show this already applied.) `04-15` `[21:43]`–`[22:26]`
  `frames/0085_21-43.jpg`,`0088_22-00.jpg`.
  **Already on main** (verified live 2026-07-01 session 6, desktop 1280): spine rows read "Chores <time>" / "Project <time>".
- [x] **F11** · DESIGN · S — **Spine typography consistency**: block-name
  font should match the title font; active and inactive states should
  match; the time subtext is fine (title ~13px, text ~12px).
  `04-15` `[22:30]`–`[23:23]` `frames/0092_23-00.jpg`.
  **FIXED batch 42.3 (settled round 2)** — the inconsistency was SIZE:
  spine block names 13→12px matching the This Week day labels, body
  SANS (a first-pass Lora reading was built and reversed — Lora stays a
  header treatment), ONE weight for active and inactive (state =
  fill/border/color only); documented as the "row title" type role in
  both library faces.
- [x] **F12** · DESIGN · S — **Overnight time label** "8:57 PM–5:16 AM"
  is too long/unnecessary; simplify (e.g. show "after 8:57" when the
  overnight sits at the bottom of today). `04-15` `[24:00]`–`[24:50]`
  `frames/0097_24-00.jpg`,`0101_24-30.jpg`.
  **Already on main** (verified in code, session 6): the spine renders
  "Until <end>" (lead) / "After <start>" (trail).

### This Week panel

- [x] **F13** · UX/DESIGN · S — **Remove the "tick warms toward a
  should-chore's deadline" helper text** under the bars — confusing to
  anyone who doesn't already know what it means. `04-15` `[26:54]`–
  `[27:26]` `frames/0121_27-00.jpg`.
  **Already on main** (verified live 2026-07-01 session 6, desktop 1280): helper text is gone from This Week.
- [x] **F14** · DESIGN/FEATURE · M — **Replace the number + box** at the
  right of each week row (meaning unclear) with **symbols**: an **"E"
  badge (periwinkle)** when a day has an event; a **conflict triangle**
  (exclamation, conflict color) when a day has a conflict. Hover: E →
  "event today"; triangle → "N conflicts". `04-15` `[29:00]`–`[32:18]`
  `frames/0136_29-42.jpg`,`0139_30-10.jpg`,`0147_32-00.jpg`.
  **Already on main** (verified live 2026-07-01 session 6, desktop 1280): E badge + conflict triangle show per day (Sun 28 both, Wed 1 E, Mon 29 clock); hover depth is F41's tooltip work.
- [x] **F15** · DESIGN · S — **Dispense with the This Week legend** at the
  bottom of the panel. `04-15` `[32:18]`–`[32:30]`
  `frames/0151_32-30.jpg`.
  **Already on main** (verified live 2026-07-01 session 6, desktop 1280): legend is gone.
- [x] **F16** · DESIGN · S — **Column widths**: reduce This Week, widen
  the center column a touch. Landed on **left spine 240px, This Week
  180px**; the center gets the reclaimed space. `04-15` `[33:07]`–
  `[37:18]` `frames/0156_33-25.jpg`,`0166_37-00.jpg`.
  **FIXED batch 42.2** — spine 180→240, This Week 240→180 (WeekStrip
  compressed: day cell w-11, symbol cell w-14, tighter gaps).
- [ ] **F17** · DESIGN · S — **Day/Week/Month/Review tab buttons** should
  use the This Week hover/active pattern: active = filled background, no
  border; hover = a slightly **lighter** gray that follows the cursor
  (not darker); click = the active style. `04-15` `[44:00]`–`[44:39]`
  `frames/0188_44-14.jpg`,`0189_44-21.jpg`.

### This Week — decisions (may be revisited)

- [ ] **F18** · DECISION · — **Overnight NOT represented in This Week**
  ("this is fine in this current implementation"). **↔ X1 / F49 — July 1
  reverses this.** `04-15` `[26:06]`–`[26:30]` `frames/0117_26-24.jpg`.
- [ ] **F19** · DECISION · — **Projects omitted from the This Week load
  bars is fine** (they're just the gaps between chores). **↔ X2 / F40 —
  July 1 reverses this.** `04-15` `[26:06]`–`[26:18]`.

### Center pane

- [ ] **F20** · DESIGN · S — **Day-load mini-bars**: the first block
  (sunrise) should be the **chore color**; drop item counts; show a
  **conflict symbol** when relevant. `04-15` `[44:49]`–`[45:23]`
  `frames/0194_45-00.jpg`.
- [ ] **F21** · DESIGN/FEATURE · L — **Warming = binary, not a gradient.**
  Land on two states: **warning** (a chore due this current week) and
  **due** (due today, red) — "there's not going to be an incrementally
  moving state." Use the **clock-alert icon**, colored warning vs red.
  Show it (a) inline in the day-load summary line (next to "N items · N
  blocks · N projects"), as **clock-alert ×N** for multiples, and (b) on
  the chore **row** at the same level; hover explains it. **Note: this
  contradicts the shipped CH-Pill gradient** ("N days left → due today →
  overran") — the pill would need to collapse to warning/due.
  **FIXED batch 42.5** — (a)/(b) were already live (WarmingBadge, 42.3);
  the remaining collapse shipped: ChoreRemainingPill is binary now
  (due-today AND overran = ONE red "due" tone, `--c-cat-processing`,
  with the ClockAlert glyph; runway landing THIS week = warn amber +
  glyph; farther runway = quiet neutral), DaysLeftTag warms amber +
  ClockAlert when the deadline lands this week, and the row's escalation
  tint is the one red wash for both due states.
  `04-15` `[45:30]`–`[50:50]` `frames/0207_48-00.jpg`,`0220_49-43.jpg`.
- [ ] **F22** · FEATURE/UX · M — **Project blocks should populate for the
  entire day** (every gap), even though only the first undone step
  auto-adds. Add a **"Continue project"** quick button on later project
  blocks that copies the same project down from the previous one.
  `04-15` `[56:30]`–`[57:46]` `frames/0264_56-30.jpg`,`0268_57-08.jpg`.
- [ ] **F23** · DESIGN · M — **Project-block height** should be relative
  to the block's duration (needs a way to assign height); show the
  planned/unplanned status (F9) here too. `04-15` `[51:00]`–`[52:09]`
  `frames/0234_51-30.jpg`.
- [ ] **F24** · DESIGN · S — **Remove the "who's on what" day-load pane**
  for now (leans too hard on explicit assignment). **↔ X3 — July 1 wants
  presence back as availability.** `04-15` `[52:09]`–`[52:45]`
  `frames/0242_52-30.jpg`.
- [x] **F25** · DESIGN · S — **Header/block action buttons** (Time off,
  Add chore; per-block: Add one-off task, Split block, Open rounds, Add
  buffer) should live in a consistent top toolbar using the This Week
  hover pattern. `04-15` `[53:00]`–`[54:28]` `frames/0248_54-00.jpg`.
  **DONE by main + batch 42.2** — the toolbar row (conflicts · Time off
  · Add chore, hover pattern) was already on main; 42.2 adds Add task
  (F58). Per-block actions already use the hover pattern; Open rounds
  stays the block's primary CTA by design.
- [x] **F26** · BUG/UX · S — **A warming chore is claimed on a day but the
  row doesn't say which chore** — "Monday claims to have a warming chore
  but I don't know which one." `04-15` `[45:45]`–`[46:26]`
  `frames/0200_45-54.jpg`,`0202_46-13.jpg`.
  **Already fixed on main** (`aa37e6e` — WarmingBadge hover names each
  chore; verified live. See §0.2).
- [x] **F27** · UX/copy · S — **Review tab copy**: remove "For learning
  the routine, not grading"; "looking back" text is unnecessary (he then
  softened — "fine, whatever"); check the typography matches the style
  guide. Also the **"Yesterday — N must-dos unfinished" banner** shows
  too much — don't list every undone/changed item by name.
  `04-15` `[54:38]`–`[55:40]` `frames/0256_55-00.jpg`.
  **Already on main** (verified in code, session 6): the "not grading"
  line no longer renders anywhere; the yesterday banner is a passive
  count strip with no item names. The "Looking back" subtitle stays
  (James softened on it).
- [x] **F66** · DESIGN/question · S — **The empty gutter left of the chore
  rows** ("these drawer blocks") — "I know they're supposed to be
  something here… but it's just not clear to me." Undecided what belongs
  in that rail; needs a design answer (candidate: the badge/route/order
  indicator). `04-15` `[18:30]`–`[19:00]` `frames/0077_18-44.jpg`.
  **SPIKE DELIVERED batch 42.3** — mockup at
  `f66-gutter-mockup.html` (this dir): A numbered route stops · B route
  line/dots · C drop it. Recommendation A (numbers carry order AND
  required sequence; ties to F56, build lands with slice 8's
  order-preserve).
  **DECIDED 2026-07-02 round 5: OPTION C** — gutter dropped, chore rows
  go full width (R5.1, batch 42.4). Revisit only if slice 8's
  order-preserve work needs a visible indicator.

---

## §2 · July 1 session (`12-25-24`)

Revisits June 30's Schedule topics (badges, events, This Week, project
blocks) and adds a large availability / time-off / working-hours cluster,
plus Rounds and Projects.

### Schedule chrome (desktop + mobile)

- [x] **F28** · DESIGN/UX · S — **Kill the "Whole day" tab on desktop** —
  redundant; its items are the left-spine timeline, which is the real
  nav. (On mobile it also duplicates the timeline; keep the block nav.)
  ↔ supersedes F3. `[00:16]`–`[01:23]` `frames/0004_00-16.jpg`,
  `0014_01-17.jpg`.
  **FIXED batch 42.2** — desktop spine row deleted (re-picking the open
  block collapses to the overview; mobile keeps its toggle). F3 dies
  with it.
- [ ] **F29** · MOBILE/UX/DESIGN · M — **Mobile day-nav isn't discoverable
  — not just small tap targets.** (Refined by James in triage.) The core
  problem is it's **not evident you can navigate by tapping the Today
  spine bars at all**; the small "tap a block to see it" text isn't
  enough and instructional text is the wrong fix. The UI itself must make
  tappability obvious — background highlight / tint on hover following the
  **established button patterns** (↔ F65) — on **both mobile and
  desktop**. `[00:38]`–`[01:00]` `frames/0009_00-46.jpg`.
- [x] **F30** · DESIGN · S — **Projects still show the folder icon** in
  the spine — swap for the **P badge**. (So F8's badge work isn't done
  yet.) ↔ F8. `[01:53]`–`[02:06]` `frames/0021_02-00.jpg`.
  **Already on main** (verified live 2026-07-01 session 6, desktop 1280): spine shows P badges, no folder icons.
- [x] **F31** · BUG/MOBILE · M — **The teal chore-block bars are missing
  on mobile Schedule** (Safari macOS; confirmed the same on iOS).
  `[01:28]`–`[01:45]` `frames/0018_01-37.jpg`.
  **FIXED `042fb53`** (see §0.2 note).
- [x] **F32** · DESIGN · S — **Chores still show sun icons** in the spine
  — swap for the **C badge** (the time is already shown). ↔ F6.
  `[02:06]`–`[02:18]` `frames/0023_02-12.jpg`.
  **Already on main** (verified live 2026-07-01 session 6, desktop 1280): spine shows C badges, no sun icons.
- [x] **F36** · BUG/MOBILE/DESIGN · S — **Mobile: the three header
  buttons (0 conflicts · Time off · Add chore) are right-aligned with
  awkward left padding** — align them properly. `[03:11]`–`[03:29]`
  `frames/0034_03-17.jpg`. **FIXED `9220384`** (see §0.2 note).

### Events on the schedule

- [ ] **F33** · FEATURE · M — **Day-load + left sidebar don't show
  events; they should.** Populate events into the day load so you can see
  an event at its time; clicking an event shows **event details** in the
  pane (or a link to the event page), **not** a chore list; two same-time
  events stack sequentially; use the **E** nomenclature + the established
  event color. ↔ F14. `[02:18]`–`[03:11]` `frames/0027_02-36.jpg`,
  `0030_02-53.jpg`.

### This Week (desktop)

- [ ] **F37** · DESIGN · S — **Vertical alignment**: want **baseline
  alignment** — bar bottoms sit on the text baseline so text + icons
  align; the load bars shift up (or center). `[03:30]`–`[04:06]`
  `frames/0039_03-41.jpg`,`0043_04-00.jpg`.
- [ ] **F40** · DESIGN/FEATURE · S — **This Week bars are missing project
  + events** — should be indicated; the complete set = projects, chores,
  events. **↔ X2 — contradicts F19.** `[04:12]`–`[04:35]`
  `frames/0046_04-19.jpg`.
  **FIXED batch 42.5** — `farmLoad` builds per-day identity bars
  (`week.days[].bars`): chore blocks (teal, count-scaled) + project gaps
  (slate, duration-scaled, planned solid / free cross-hatch, fed by the
  horizon reservations + week timed deltas) + events (periwinkle wash),
  time-ordered; WeekStrip renders them (the accent-green count bars are
  gone).
- [ ] **F41** · FEATURE/UX · M — **True tooltips on This Week symbols.**
  Hover E → brief event details; hover the needs-cover icon → why it
  exists; hover the clock-alert → today it only shows the native `title`
  attribute, he wants a **real JS/HTML tooltip** (instant on mouseover,
  more formatting). Accepts the a11y trade-off for this internal app.
  ↔ F14. `[04:41]`–`[06:42]` `frames/0050_04-41.jpg`,`0057_05-20.jpg`.
- [ ] **F42** · FEATURE · M — **Day-load hover details**: chore block →
  name + item count + time window; project → project name + phase/step
  hierarchy; event → event details. `[06:00]`–`[06:42]`
  `frames/0064_06-00.jpg`,`0068_06-22.jpg`.
  **This Week half FIXED batch 42.5** — every This Week bar carries a
  real Tooltip (chore → block name + count + window; project →
  planned/free + who's free + window; event → name + time); the symbols
  had theirs since rounds 4–5. The DAY-LOAD half rides slice 5 (the
  time-axis rework).
- [ ] **F43** · DESIGN/FEATURE · M — **Replicate the day-load time axis**:
  he likes the time axis and wants that WHEN-axis on the day-load, with
  the block color coding (chores/project/etc.) so you can read when each
  thing occurs. `[06:49]`–`[07:15]` `frames/0073_06-49.jpg`.
- [ ] **F44** · FEATURE/UX · M — **Buffers need a home** — the buffer
  concept needs to live somewhere represented in the list. `[07:15]`–
  `[07:30]` `frames/0078_07-23.jpg`.

### Availability / time off / working hours (new cluster)

- [ ] **F45** · FEATURE · L — **Unavailability represented on the
  schedule**: a clickable tab in the left spine (like Projects/Chores)
  showing someone is out from time A→B. `[08:00]`–`[08:24]`
  `frames/0085_08-00.jpg`.
- [ ] **F46** · FEATURE · M — **Whole-day unavailability shown on the
  day** (This Week): reuse the needs-cover icon or a person-with-a-line
  icon so a glance says "I'll be the only one there." ↔ X3.
  `[08:30]`–`[09:00]` `frames/0091_08-43.jpg`.
- [ ] **F47** · FEATURE · M — **Event-coverage indicator**: when an event
  happens, one of us must cover it — indicate that during that window.
  `[09:18]`–`[09:27]` `frames/0099_09-23.jpg`.
- [ ] **F48** · FEATURE · L — **Who's-here tracker**: across a time axis,
  show how many people are on the farm at each point (1 → 2 → 1). ↔ X3.
  `[09:30]`–`[09:57]` `frames/0103_09-43.jpg`.
- [ ] **F49** · BUG/UX · S — **Overnight indicator only shows on days that
  actually have an overnight block** — carry that signal through to This
  Week. **↔ X1 — contradicts F18.** `[20:30]`–`[20:54]`
  `frames/0217_20-36.jpg`.
  **CLOSED BY VERIFICATION (batch 42.5 de-taint)** — round 4's
  week-wide overnight scan (`weekOvernightISOs` + the WeekStrip Moon
  badge, both nights of every wrap) already carries the signal through
  This Week. Nothing left to build.
- [ ] **F50** · FEATURE · L — **Time-off entry page**: a page (under user
  settings, or a Schedule sub-tab) to enter time off — optional details,
  start/finish or all-day, a from-day→to-day shorthand, or a specific
  partial (an hour off / half day). Explicitly **not an "event"** (breaks
  the domain definition). `[10:00]`–`[11:11]` `frames/0107_10-05.jpg`,
  `0112_10-37.jpg`.
- [ ] **F51** · FEATURE · L — **Working hours + breaks + availability-
  based default assignment** (the structural core):
  * **Working hours** set **per person** (default e.g. 9–5) with per-day
    exceptions (early/late chore days). `[11:11]`–`[12:36]`.
  * **Breaks**: scheduled breakfast / lunch / an extended evening break
    between the last rounds and the end of the project block; breaks are
    for everyone (no per-person break schedules yet). `[13:42]`–`[14:30]`.
  * **Default assignment = availability**: if nothing is explicitly
    assigned, fall back to *everyone available* (working hours ∩ not
    time-off) — make it a structured rule; solves the "everything has no
    assignment" problem. ↔ X3. `[12:36]`–`[13:36]`.
  * **Working hours gate project time**: the 6pm project cutoff should be
    derived, not magic — projects can't run outside working hours unless
    explicitly allowed; an over-long project block raises a **warn**
    ("longer than possible given your working hours"). `[14:30]`–`[15:16]`.
  `frames/0121_11-30.jpg`,`0140_13-17.jpg`,`0157_14-54.jpg`.
- [ ] **F51b** · FEATURE · M — **Create / modify project blocks**:
  today they're auto-created from the chore schedule with no editing;
  need to **modify** them and to **create ad-hoc** ones (e.g. back at
  6–7pm for a one-hour project). `[15:16]`–`[15:54]` ↔ F22, F23.
  `frames/0164_15-30.jpg`.

### Block & task rules

- [x] **F52** · BUG · M — **Split a block, move a task into a chore block
  → the task doesn't appear there.** He split, said 4 PM, moved "move
  chicken tractors" and expected it in the 4 PM chore block; it didn't
  show. (He also floats dropping split-block entirely for better rules.)
  `[16:00]`–`[16:43]` `frames/0172_16-24.jpg`,`0173_16-30.jpg`.
  **FIXED `1ba1cda`** (see §0.2 note; drop-split-entirely stays open
  as part of the F53 rules redesign).
- [ ] **F53** · FEATURE/rule · M — **Task carry-over**: an incomplete
  task rolls to the **next available chore block**. Exception =
  **duplication**: if the same chore recurs in a later block, don't roll
  it — absorb it into that later block, but **indicate it was left
  undone** and mark it urgent/priority. `[16:49]`–`[17:25]`
  `frames/0177_16-56.jpg`,`0181_17-15.jpg`.
- [ ] **F54** · FEATURE · M — **Move a chore to a different day.** The
  move/edit only allows a time/block within the **same day**; need to put
  a recurring chore (e.g. "compost discarded eggs", M/W/F) onto a Tuesday
  ad-hoc, optionally at a Tuesday time block. `[17:25]`–`[18:30]`
  `frames/0184_17-30.jpg`,`0190_18-16.jpg`.
- [ ] **F55** · UX/FEATURE · M — **Chore rows lack place/animal detail.**
  "fill waterers / fill feeders" show no place or animal — surface it
  ("sheep waterers at the bar"), maybe tap-to-expand accordion. No
  Schedule pattern for this yet (the chores-edit screen has it, but that
  edit UI is being retired here). `[18:30]`–`[19:34]`
  `frames/0195_18-42.jpg`,`0203_19-30.jpg`.
- [ ] **F56** · FEATURE · L — **Chore order within a block matters.**
  Grouping by Mobile Coop 1 / 2 is good; order should follow a **set
  route** (not yet built) **and** a required sequence (Mon AM: fill
  waters → fill feeders → move chickens to fresh grass, in that order).
  Preserve the order from where it's set. `[19:40]`–`[20:29]`
  `frames/0207_19-50.jpg`,`0213_20-19.jpg`.
- [x] **F58** · UX/FEATURE · M — **"Add a one-off task" belongs in the
  top toolbar**, not the bottom inline input (which implies it adds to
  the sunrise group). Want single-line entry + a **block selector**
  (pulling the current day's blocks, incl. Overnight) + optional time. A
  specific-time one-off (3:30 PM) can't be made here — **deferred** by
  James. `[20:54]`–`[22:30]` `frames/0221_21-00.jpg`,`0235_22-10.jpg`.
  **FIXED batch 42.2** — `AddTaskBar` in the top toolbar ("Add task"
  button beside Add chore): text + block selector (day's blocks incl.
  Overnight), defaulting to the now/first block; "Anytime" (the
  documented no-block landing spot, same as the edit sheet's picker)
  is the deliberate last option. All three per-block foot inputs
  removed (NO-LEGACY); specific-time stays deferred. NOTE: a
  purge-of-anytime premise from a side review was checked — no purge
  ever happened in code (`anytime` is intentional since 41.4, ROADMAP
  345/3607). BUT the June-28 audit round (F1–F80, still untriaged)
  lists "remove the Anytime concept" as a recurring James theme — so
  the wish is real and on record. Anytime is kept as the deliberate
  last option here; actually removing the concept = a triage decision
  from the 6-28 round (touches the edit sheet + the anytime fold).

### Rounds

- [x] **F57** · BUG/MOBILE · M — **BLOCKER: a Quick-Action sheet
  (Mortality / Eggs) fills the entire mobile screen with no way to
  close** — no X, Escape does nothing, and you can't scroll to reach the
  close button. Bounds exceeded; likely affects all rounds log sheets.
  Confirmed frame 0261. `[25:00]`–`[25:25]` `frames/0261_25-06.jpg`.
  **FIXED `3a61628`** (see §0.2 note).
- [ ] **F62** · DATA/UX · S — **Recent rounds are full of junk test
  data** — need a way to clean up recent rounds. `[23:42]`–`[23:48]`
  `frames/0247_23-42.jpg`.
- [ ] **F63** · UX/DESIGN · L — **Rounds mobile navigation needs a polish
  pass** (broadened by James in triage): jumping between places and
  showing events feels **clunky on mobile**. Includes: the **Place / Kind
  toggle → dropdown** (it's hard to tell the option list scrolls; the
  laid-out approach won't fit the phone — selected option + arrow; tap →
  arrow rotates down, options below; pick → animation reverses; same for
  the Note/MASH/Mortality/Eggs selector), plus the broader place-jump /
  event-surfacing flow. `[24:00]`–`[24:57]` `frames/0250_24-00.jpg`,
  `0256_24-36.jpg`.
- [ ] **F64** · BUG/design · M — **Eggs Quick-Action uses the wrong
  model.** It asks for flock/cohort; it should just ask **which coop**
  you're collecting from — the *where* is all that matters. Eggs are
  gathered only from mobile coops; whoever's in that coop laid them.
  `[25:30]`–`[26:14]` `frames/0266_25-36.jpg`,`0271_26-07.jpg`.

### Projects

- [x] **F59** · BUG · M — **Project block shows "nothing planned"** — the
  auto-pull of the top project's next step isn't firing on the schedule;
  the Swap button is gone (he flags it may be mid-development).
  ↔ F22, F60. `[28:00]`–`[28:36]` `frames/0289_28-10.jpg`,
  `0291_28-30.jpg`. **FIXED `8cbe932`** (see §0.2; Swap → F22).
- [x] **F60** · BUG/UX · M — **Projects ranking doesn't sync to today's
  schedule** — "today's schedule doesn't reflect this ranking"; he had to
  hit **Sync now** manually. Want auto-sync; when unsynced, **surface it
  on the schedule**; open question whether viewing the schedule should
  force a sync. `[28:42]`–`[29:29]` `frames/0294_28-49.jpg`,
  `0297_29-07.jpg`. **FIXED `8cbe932`** (see §0.2 note).
- [ ] **F61** · FEATURE · L — **Projects need a simple mode.** Creating a
  flat project (name + 2 to-dos, "putting on my socks → sock one, sock
  two") shouldn't force phases or due dates — that friction/those
  warnings should go. Variable hierarchy: opt into more structure, then
  derive steps from it. `[26:42]`–`[27:55]` `frames/0281_27-23.jpg`,
  `0285_27-45.jpg`.

### Cross-cutting

- [ ] **F65** · DESIGN · M — **Consistent hover/active affordances
  app-wide.** (Cross-cutting theme James emphasized in triage.)
  Interactive elements must *look* interactive without instructional
  text: a shared **background highlight / tint on hover** + a clear
  **active** treatment, following the button patterns already
  established. This is the unifying thread behind F1 (spine active box +
  hover), F17 (tab hover), F25 (action-button hover), F29 (mobile spine
  tappability), F41 (hover tooltips), and F63 (rounds nav). Treat as one
  affordance standard applied everywhere, mobile and desktop.

---

## Notes for triage

- **F-number gaps** (F34/F35/F38/F39 unused) are intentional — I kept the
  July-1 numbers grouped by area rather than strict transcript order.
  Every number that exists is a real finding.
- Several July-1 items are **the same ask as June 30 but still unbuilt**
  (F30↔F8, F32↔F6): evidence the badge redesign hasn't landed yet.
- **Batch scoping (decided):** the availability cluster (F45–F51) is a
  **slice within the Schedule redesign batch**, feature-complete target
  (see §0.1). The rest of Schedule is the visual redesign + the
  cross-cutting affordance standard (F65).
- Genuine, self-contained BUGs to consider fixing first: **F57, F52,
  F31, F36, F59, F60, F2, F26.**
