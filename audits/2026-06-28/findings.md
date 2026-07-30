# NFF QA Walkthrough — Findings (2026-06-28)

Capture-phase log from the v2 recorded-walkthrough audit. One finding per
issue. Numbering restarts at F1 for this run. **No fixes/commits until we
triage together.** Frame paths are relative to each clip's
`processed/<clip>/` dir.

Legend — **Size:** S (quick) · M (a session) · L (multi-session / design).
**Kind:** BUG · UX · DESIGN · FEATURE · MOBILE · SYNC. Boxes are unchecked
until triaged.

---

## Clip 1 — `2026-06-28_02-00-56` · Schedule + app chrome (≈45 min)

### App chrome / TopBar (cross-cutting)

- [ ] **F1** · BUG · MOBILE · S — Notifications **bell on mobile** opens a
  panel with **no close button**; clicking outside happened to dismiss it
  but the control is broken. `[00:15]` `frames/0004_00-15.jpg`,
  `0005_00-21.jpg`.
- [ ] **F2** · BUG · MOBILE · M — **Search on mobile doesn't work
  correctly**; the whole TopBar/chrome section needs a mobile-compat pass.
  `[00:45]` `frames/0009_00-45.jpg`.
- [ ] **F3** · UX · S — Remove the **⌘Enter keybind** in the
  notifications/settings panel — it collides with James's terminal hotkey.
  Drop the browser hotkey entirely (keep the action's button).
  `[02:00]` `frames/0020_02-00.jpg`.
- [ ] **F4** · DESIGN · S — Settings/notifications panel copy is
  **over-explanatory**; make descriptions terse / drop the redundant
  description (the title is self-explanatory). `[02:16]`
  `frames/0023_02-24.jpg`.
- [ ] **F5** · DESIGN · M — **Inconsistent pane header convention**: some
  cards have a top "header pane" (close + title) + body; others replicate
  the title in the body without the split. Pick one and standardize across
  panes/cards. `[02:35]` `frames/0026_02-41.jpg`.
- [ ] **F6** · DESIGN · S — Desktop TopBar **search is over-built** vs
  mobile's plain magnifying-glass — same click target, far more chrome.
  Reduce to a single magnifying-glass icon; remove the literal word
  "Search" and the visible ⌘K hint (keep ⌘K working). `[03:00]`
  `frames/0030_03-05.jpg`, `0037_03-39.jpg`.
- [ ] **F7** · DESIGN · M — **Missing hover affordance app-wide.** TopBar
  icons (and many clickable items elsewhere) have no hover feedback. Every
  clickable element needs a consistent hover tint/treatment in addition to
  the pointer cursor. `[03:49]` `frames/0042_04-00.jpg`,
  `0044_04-14.jpg`.
- [ ] **F8** · UX · S — The **logo** (desktop + mobile) should be
  **clickable → home** (expected convention). `[04:35]`
  `frames/0048_04-41.jpg`.

### Schedule — arrival & layout

- [ ] **F9** · DESIGN · S — **Duplicate "Schedule" heading**: an h1 in the
  top section AND an h1 in the main pane. On desktop, **eliminate the top
  section** so it's just the left spine + center pane (he mocked the delete
  and preferred it). `[05:00]` `frames/0053_05-11.jpg`,
  `0058_05-52.jpg`.
- [ ] **F10** · DESIGN · MOBILE · S — On mobile, keep the date but use the
  **full-width horizontal-rule** convention rather than the inline header;
  "Schedule" should appear only once. `[06:00]` `frames/0060_06-06.jpg`.
- [ ] **F11** · DESIGN · L — **Now-block color is muddy.** The focused
  "now" block's background + gradient and the chore-block current-item dark
  green aren't unified by a convention; the right (week) pane is the better
  reference for color/cleanliness. Bucket: **dedicated design iteration on
  the Schedule color scheme** (prefers gradient-as-tint, more minimalist).
  `[07:14]` `frames/0073_07-30.jpg`, `0080_08-18.jpg`.
- [ ] **F12** · UX · M — **S125 today-status not glanceable.** He can read
  *yesterday's* status but can't tell what's been achieved *today*; the
  "53 items" count doesn't respond to ticking. Make today's
  done/remaining/overdue actually legible & live. `[08:51]`
  `frames/0089_09-17.jpg`.
- [ ] **F13** · UX — **S126 earlier-today distinguished** left unverified;
  he checked it off only to stop pursuing it, predicting it'll resurface if
  it's genuinely hard to find your place in the day. Re-examine during a
  daytime session. `[10:54]` `frames/0105_11-30.jpg`.
- [ ] **F14** · FEATURE · MOBILE · L — **Week / Month / Review missing on
  mobile** (day-only). He wants these on phone too (with adaptation), not
  just desktop — flagged as a big gap. `[11:47]` `frames/0110_12-00.jpg`.
- [ ] **F15** · BUG · S — **S11 market-day not surfaced.** Today is a
  market day (an event); the header sub-line / status area doesn't surface
  it anywhere. `[12:30]` `frames/0118_13-00.jpg`.

### Schedule — SYNC (recurring, high priority)

- [ ] **F16** · BUG · SYNC · L — **Chore completion doesn't reliably sync
  between clients.** Same person signed in on desktop + phone; ticking on
  desktop didn't appear on phone (sometimes only after a second action),
  and **unticking did not propagate** (stayed checked on the other client).
  `[09:30]`–`[10:41]` `frames/0094_10-00.jpg`, `0097_10-30.jpg`.
- [ ] **F17** · BUG · SYNC · M — **Confirm-state + change-ribbon don't
  sync.** After confirming on desktop, the phone shows neither the
  confirmation nor the "N changes since you confirmed" ribbon. (The added
  *task* did sync; the confirmation/divergence did not.) `[16:24]`–`[16:51]`
  `frames/0144_16-30.jpg`, `0145_16-37.jpg`.
  - Note: block **rename** *did* sync in real time on both clients
    (`[37:30]`), so the sync gap is specific to completion + confirm state,
    not all writes.

### Schedule — Draft → Confirm (mostly working)

> Confirmed working and praised: **S1/S3/S9** (today pre-populated as a
> usable, clearly-marked draft), **S2/S8** (one-click confirm → green
> badge), **S7/S119** (durable record), **S6/S10** (divergence visible;
> can confirm while uncertain), **S95/BD44** desktop ribbon. No findings
> except sync (F17) and:

- [ ] **F18** · UX · M — **Carry-over banner (S12) over-shares + has no
  durable view.** "62 must-dos unfinished" is enough; the banner shouldn't
  try to *list* the chores inline. Missing: a **materialized view** of
  yesterday's unfinished chores in the conventional chore style (review +
  quick check-off) — not a new tab/sub-page, just a view. `[16:51]`–`[18:28]`
  `frames/0151_17-20.jpg`, `0158_18-05.jpg`.
- [ ] **F19** · BUG · S — **Carry-over banner dismissal doesn't persist** —
  reappears on refresh. Needs dismissed-state (per client, since it's a
  per-client banner). `[18:30]`–`[19:07]` `frames/0165_18-49.jpg`.

### Schedule — header controls & banners (layout)

- [ ] **F20** · UX · M — **Day/Week/Month/Review tabs shuffle position**
  when switching (pane reflow moves the control). Lift this control to a
  static, higher level so it never moves. Part of a stated pet-peeve:
  **action targets must not move under the cursor.** `[19:14]`–`[20:42]`
  `frames/0172_19-40.jpg`, `0173_19-46.jpg`.
- [ ] **F21** · DESIGN · M — **Separate informational from active controls
  in the header strip.** Confirm button (now informational once confirmed)
  + info banners should group; swap the active row and info row so
  confirmation sits at the top level and info banners propagate beneath.
  Also: long banner text pushes buttons down (reflow) — keep targets fixed.
  `[20:42]`–`[23:08]` `frames/0195_22-07.jpg`, `0202_23-00.jpg`.
- [ ] **F22** · DESIGN · S — **Standardize banner styling.** The carry-over
  banner and the change banner differ in height/style (bg color, left
  border, dismissibility). Unify them. `[23:30]`–`[24:00]`
  `frames/0208_23-43.jpg`.
- [x] **F23** · DESIGN · S (batch 42.21) — **Conflicts button shows an icon, not a
  count.** With none it should read "0 conflicts" with a muted/disabled
  look (still clickable, still has hover); with conflicts, emphasize with
  color. `[24:13]`–`[24:44]` `frames/0214_24-20.jpg`.
- [ ] **F24** · DESIGN · S — Conflicts / Time off / Add chore buttons
  **lack hover state** (same as F7). `[24:00]` `frames/0211_24-00.jpg`.

### Schedule — Time off (BROKEN)

- [ ] **F25** · BUG · L — **Time off is broken: a break is created as a
  TASK.** Scheduling an 11–12 "lunch" break produced a `(task)` row (TASK
  badge) in the **Anytime** group at 11:00, and a second test produced
  another. Breaks/time-off aren't being created or represented as
  reservations. (S39/S40/S47/S50 all fail.) `[24:52]`–`[26:13]`,
  `[29:30]`–`[30:08]` `frames/0221_25-16.jpg`, `0249_29-39.jpg`.
- [ ] **F26** · BUG · M — **Time off doesn't render on the day.** Even
  setting aside F25, the reserved time shows no chip on the day surface
  (desktop or mobile). `[26:00]`, `[43:22]` `frames/0224_26-00.jpg`,
  `0369_43-30.jpg`.

### Schedule — Buffers

- [ ] **F27** · FEATURE · M — **Buffer UI is too narrow.** You can only
  buffer the block you clicked. Anything schedulable (tasks, a brooder,
  etc.) should be bufferable, with the full set of options/parameters.
  `[26:30]`–`[27:40]` `frames/0231_27-07.jpg`.

### Schedule — Add chore / change tracking

- [ ] **F28** · FEATURE · M — **"N changes since confirmed" should be a
  navigable counter.** As you add items the banner just grows a list;
  instead show a count + **next/prev** to cycle through each change (wrap to
  top). `[27:40]`–`[28:30]` `frames/0239_28-08.jpg`, `0240_28-15.jpg`.
- [ ] **F29** · UX · S — **All banners should be dismissible** (consistent
  rule; today they're inconsistent). `[28:30]` `frames/0242_28-30.jpg`.
  (S33 search itself worked — "clean egg washer" matched fine.)

### Schedule — the "Anytime" concept

- [ ] **F30** · DESIGN · L — **Rethink/remove "Anytime."** James rejects
  free-floating anytime tasks: anything not done should roll to the **next
  available block**; chores must be **bound to a block**, never exist
  ephemerally/unattached. Eliminate the "Anytime" group from the schedule
  component (and the app's mental model). `[30:00]`–`[31:00]`,
  `[40:44]`–`[41:15]` `frames/0253_30-17.jpg`, `0318_37-13.jpg`.

### Schedule — left-pane (desktop) day component

- [ ] **F31** · BUG · S — **Hover/padding defect on the "Whole day" group.**
  Padding stops the hover target filling the row height and creates an
  over-extended top margin (more negative space above the "whole day" text
  than below). `[31:14]`–`[31:53]` `frames/0266_31-37.jpg`.
- [ ] **F32** · BUG · S — **Missing timeline bars** on the left pane that
  the right (week) pane has; the left should show matching bars with the
  same proportions. `[31:53]`–`[32:13]` `frames/0270_32-07.jpg`.
- [ ] **F33** · DESIGN · S — **"Now" uses primary green**; pick a distinct,
  better color for the now-marker so it doesn't read as just another green.
  `[32:13]` `frames/0272_32-20.jpg`.

### Schedule — Project blocks

- [ ] **F34** · FEATURE · M — **Let me clear an auto-pulled project item,
  not just Swap.** The auto-pulled item here is a *processing-day chore made
  by a process*; since it's a chore it should be removable from today's
  schedule directly. `[32:30]`–`[33:42]` `frames/0278_33-00.jpg`,
  `0282_33-30.jpg`.
- [ ] **F35** · FEATURE · M — **Make schedule items drillable.** The
  auto-pulled chore ties to an event, a batch (broilers? pigs?), and a
  process with sibling chores — none of that is reachable from the row. Surface
  drill-through to the linked event/batch/process. `[33:42]`–`[34:20]`
  `frames/0287_34-00.jpg`, `0288_34-06.jpg`.
- [ ] **F36** · DESIGN · M — **"Project" label is repeated on every project
  block** ("project project project…") and the gradient is disliked. Find a
  less redundant treatment; move the auto-pulled project *name* to a better
  spot. `[34:20]`–`[35:18]` `frames/0291_34-27.jpg`, `0293_34-36.jpg`.

### Schedule — mobile day component

- [ ] **F37** · DESIGN · MOBILE · M — **Mobile block list color/UX must
  match desktop** (same component). Colors/state-on-click behave
  inconsistently (5:15a green; selection toggles green; current-day-start
  turns green) — standardize the colored-list pattern across desktop &
  mobile. `[35:30]`–`[36:27]` `frames/0304_35-49.jpg`, `0307_36-07.jpg`.
- [ ] **F38** · BUG · MOBILE · S — **Mobile gradient cuts through text /
  iconography** (corner overlap); doesn't sit flush. Remove the gradient
  entirely. `[36:30]`–`[36:51]` `frames/0312_36-37.jpg`.
- [ ] **F39** · MOBILE · M — **Mobile tap targets too small** (fits, but
  not usable for a phone). Enlarge. `[36:51]`–`[37:13]`
  `frames/0316_37-00.jpg`.
- [ ] **F40** · FEATURE · MOBILE · M — **Mobile block strip is cramped**;
  even removing "Anytime" won't give enough horizontal room. Propose
  **prev/next paging arrows** to scroll through blocks given the dense
  per-block info (height/time/project iconography). `[38:07]`–`[39:00]`
  `frames/0328_38-37.jpg`, `0330_38-50.jpg`.
- [ ] **F41** · BUG · MOBILE · S — **Time wrapping creates uneven tiers.**
  Wide times wrap the am/pm onto a second line so some rows show 3 tiers,
  others 1. Fix: pad to a min digit width and put am/pm on its own line —
  consistent layout. `[39:00]`–`[40:13]` `frames/0335_39-30.jpg`,
  `0337_39-50.jpg`.
- [ ] **F42** · DESIGN · MOBILE · M — **Align block internals to a grid.**
  Across project & chore blocks the bar, icon height, time value, and time
  suffix should align to one another and to a grid (consolidates F32/F41).
  `[40:44]`–`[41:15]` `frames/0345_40-44.jpg`.
- [ ] **F43** · DESIGN · MOBILE · M — **"Now" item layout is awkward**
  (border + an internal horizontal rule). Better: a heavier/darker
  primary-color left/right border on the item with the "now" text at the
  top of the item. `[41:42]`–`[42:46]` `frames/0356_42-09.jpg`,
  `0361_42-40.jpg`.
- [ ] **F44** · DESIGN · M — **Color-code block types to make the day
  scannable:** light green (lighter than the hover green) for **chore**
  blocks, blue for **project** blocks. `[42:46]`–`[43:22]`
  `frames/0364_42-57.jpg`, `0367_43-15.jpg`.

---

## Clip 2 — `2026-06-28_02-49-59` · Schedule nav, chore blocks, ordering, conflicts (≈19 min)

> Confirmed working & praised: **S127** now-FAB (jumps to next chore block /
> sunrise), now-divider above current block, overview one-row-per-block,
> **S71** drag-reorder persists + "edited" badge, **S60** man-down **Cover**
> flow on desktop (assign Jim, notify to acknowledge — "emphatic check"),
> **S18** ad-hoc chore lands in a chore block.

- [x] **F45** · BUG · FEATURE · M (batch 42.21) — **Block-focus state breaks across day
  navigation.** A block focused on one day can be carried to a day where it
  doesn't exist (blocks differ day-to-day, e.g. overnight). Wanted: when you
  navigate to a day **not visited this session, default to Whole-day**; when
  you **return** to a day you've visited, **recall** the focus you left
  (Thu→mid-morning, leave, return to Thu → mid-morning restored). `[00:30]`–
  `[02:07]` `frames/0012_01-19.jpg`, `0017_01-47.jpg`.
- [ ] **F46** · FEATURE · M — **Week (right) pane must represent the whole
  day.** It has no **project-bar** indications; project blocks should appear
  there too, and ideally conflict/booking detail, so the week view is an
  accurate full-day representation. `[02:07]`–`[02:51]`
  `frames/0021_02-15.jpg`.
- [ ] **F47** · UX · S — **"Open rounds" is buried in block detail.** Doing
  rounds is the intended way to start chores from this screen — surface
  **Open rounds at the top of the block** (e.g. where "Add a buffer" sits).
  `[04:00]`–`[05:30]` `frames/0041_04-45.jpg`.
- [ ] **F48** · DESIGN · FEATURE · L — **Implement the chore-rethinker
  workshop mock-up "exactly."** S14/S15 must/should/optional emphasis isn't
  satisfyingly implemented: no clear must-get-done indication; should-as-
  optional decoration is what he wants. He holds up the rethinker mock-up
  (e.g. "pressure wash · should · due 2 days"; "mow the lawn — optional
  task") as the target UI and wants it copied into the app on **both mobile
  and desktop** (incl. the remaining-pill / escalation pattern). `[05:30]`–
  `[08:10]`, `[14:17]`–`[14:30]` `frames/0055_06-30.jpg`, `0057_06-45.jpg`,
  `0063_07-30.jpg`. (Mock-ups in `.ignored/` chore design workshop.)
- [ ] **F49** · FEATURE · L — **Build a global, customizable chore-ordering
  system with place sub-grouping.** Place-major order is right but needs
  sub-group headings (Sunrise → **Brooders** → Brooder 1 fill waterers/
  feeders; **House** for house tasks). And the **mobile-coop sequence is
  wrong**: shown as open / fill feeders / fill waterers / move-to-fresh-grass
  / power-wash, but must run **move to fresh grass → power wash → fill
  feeders/waterers → (last) open mobile coop**. This canonical order must be
  settable globally and pulled in everywhere. `[08:15]`–`[11:22]`
  `frames/0078_09-09.jpg`, `0088_10-06.jpg`, `0090_10-20.jpg`.
- [ ] **F50** · BUG · M — **Dormant mobile-brooder chores still appear.**
  The mobile brooder is unoccupied, yet its tasks still proliferate on the
  day (CH-Dormant says a no-active-animals anchor should be absent). Verify/
  fix dormant hiding. `[09:30]`–`[09:52]` `frames/0083_09-41.jpg`.
- [ ] **F51** · FEATURE · M — **Chore rows need drill-through to context.**
  "Fill water" (sheep) gives no indication what it's for; "Mobile coop 1"
  doesn't say which animals live there or which pasture it's on. Clicking a
  row should reveal the associated animals / place / pasture / lineage.
  `[11:22]`–`[12:11]` `frames/0104_11-47.jpg`, `0107_12-00.jpg`. (Same
  drillability theme as F35.)
- [ ] **F52** · UX · S — **⋯ row menu lacks basic labels.** The move action
  isn't even titled "Move chore"; give the menu proper item labels. `[12:11]`–
  `[12:17]` `frames/0110_12-17.jpg`.
- [ ] **F53** · FEATURE · M — **Add "Defer chore" to the row menu** (push to
  the following day), honoring deferral rules — if the chore already exists
  tomorrow, silently skip today rather than duplicate. `[12:22]`–`[12:42]`
  `frames/0112_12-28.jpg`.
- [ ] **F54** · FEATURE · S — **Add "Remove from today"** (swipe-away) for a
  chore you don't need to do today. `[12:48]`–`[12:54]`
  `frames/0117_12-54.jpg`.
- [ ] **F55** · FEATURE · M — **Per-instance chore edits.** One-off edit of
  a row's title ("fill water **and add probiotics**") and its place/location
  ("sheep spent the night in the field → do it there"). Source-of-truth data
  populates, but the schedule instance must stay flexible for planning.
  `[13:00]`–`[13:30]` `frames/0119_13-06.jpg`, `0121_13-18.jpg`.
- [ ] **F56** · DESIGN · FEATURE · M — **Distinguish all-day / "ongoing"
  one-off tasks + show provenance.** No way to tell where a one-off task came
  from (timed? whole-day?) or where all-day tasks should live. Proposes a
  sub-category under the block (e.g. under Sunrise) for all-day/ongoing
  tasks. (Related to the "Anytime" rethink, F30.) `[13:30]`–`[14:17]`
  `frames/0127_13-55.jpg`, `0129_14-09.jpg`.
- [ ] **F57** · UX · S — When a row's edit sheet/text is opened from the ⋯
  button, **show an affordance** tying the open panel to that button (e.g. a
  small down-caret). `[15:10]`–`[15:30]` `frames/0139_15-20.jpg`.
- [ ] **F58** · UX · S — **Protection-confirm copy is too heavy.** "You'll
  confirm why on the next step" is over-worded; make the protected-change
  warning a subtler decoration, like an inline validation message (keep
  surfacing it). `[15:41]`–`[16:21]` `frames/0144_16-06.jpg`.
- [ ] **F59** · BUG · MOBILE · M — **Installed PWA froze/lagged hard** on
  iPhone (home-screen install) when trying to refresh/close after a conflict
  was created — "completely frozen," had to force it. May be partly the
  Mirroring emulation; flag for a real-device check. `[16:21]`–`[17:30]`
  `frames/0150_16-49.jpg`.
- [ ] **F60** · BUG · MOBILE · M — **Mobile conflict tap-to-jump doesn't
  scroll** to the conflict, and the mobile conflict UI "needs to be fixed"
  (it does surface "waterers needs cover," but the jump/scroll + layout are
  broken). `[18:00]`–`[18:24]` `frames/0154_18-00.jpg`, `0156_18-16.jpg`.

---

## Clip 3 — `2026-06-28_03-09-21` · Overnight block (≈5 min)

> The Overnight feature largely **passes**: O1/O3/O4/O5 (sundown→sunrise
> window, belongs to two days, shows in the correct spot on the neighbour
> day and is absent today), O9 (no rounds / no all-done seal), O11 (items
> tickable), O10 (only appears when scheduled), syncing-not-false-empty,
> O-B4 (count is start-day-only — "fine with that"), O6/O7 verified. He
> likes the iconography & positioning.

- [ ] **F61** · UX · S — **Ad-hoc add uses an odd inline input.** He'd
  prefer a **button that opens a picker/sheet**, not the bare inline text
  input, to add an ad-hoc task. `[00:30]`–`[00:51]` `frames/0004_00-37.jpg`,
  `0005_00-44.jpg`.
- [ ] **F62** · BUG · S — **Protection-confirm fires on a non-committed
  ad-hoc task.** Editing an ad-hoc task and changing the day ("tomorrow" /
  "following day") triggers the protected-change confirm — it shouldn't: the
  day should be a plain **date field**, and the task isn't committed (the
  day's schedule isn't even confirmed). The "committed for today" rationale
  is wrong here. `[01:12]`–`[01:52]` `frames/0011_01-30.jpg`,
  `0013_01-44.jpg`. (Related to F58.)
- [ ] **F63** · BUG · S — **Overnight item text overflows/truncates.** There's
  text (a "now" label) that's clipped and unreadable on the overnight row —
  fix the overflow. `[02:37]`–`[02:54]` `frames/0022_02-46.jpg`.
- [ ] **F64** · FEATURE · S — **Can't rename an overnight item** — only
  delete. Add edit/rename (same per-instance edit gap as F55/F64-theme).
  `[03:07]`–`[03:24]` `frames/0025_03-07.jpg`.
- [ ] **F65** · BUG · S — **Overnight block missing from the side/week
  pane.** It should also render there, not just the main pane (couldn't
  verify on phone — see F14). Ties to F46 (week pane must represent the whole
  day). `[03:16]`–`[03:24]` `frames/0026_03-16.jpg`.

---

## Clip 4 — `2026-06-28_03-14-17` · Project blocks, buffers, time off (≈6 min)

> Passing/demonstrated: P1/P3 (gaps render as Project blocks), P2 (span =
> available time), P11 (auto-pull + Swap, tagged "auto"), P13 (ad-hoc tasks
> in a project block), P14 (tick writes through to the project step — "one
> truth"), P6 (no project block in a gap when nobody's at the farm), P4/P5/P7
> (starts after buffer, shrinks around time-off, recomputes live).

- [ ] **F66** · FEATURE · M — **Project block auto-pull needs Delete +
  drill-down**, not just Swap. (Reinforces F34/F35 for the project-block
  case.) `[00:30]`–`[00:44]` `frames/0004_00-37.jpg`.
- [ ] **F67** · FEATURE · M — **Buffer UI needs arbitrary length +
  categories.** Pre-filled increments are good, but the length must be
  user-designatable to an arbitrary period, plus **All day / "reserve for
  me,"** and **categories** (break / time off / etc.). Also easy to
  accidentally add both before+after sides. (Extends F27.) `[01:08]`–`[01:42]`
  `frames/0011_01-23.jpg`, `0012_01-30.jpg`.
- [ ] **F68** · BUG · M — **"Add a project step" searches the wrong table.**
  Inside a Project block it searches **chores**, not **projects** — P12 says
  it should search the projects table (project/phase/step bound to this
  gap). `[02:30]`–`[03:00]` `frames/0019_02-45.jpg`.
- [ ] **F69** · BUG · M — **Ticking a placed project item instantly swaps it
  out.** Auto-pull overrides the just-completed item with the next incomplete
  one, so you lose sight of what you finished in the block. The completed
  item must **persist** and the next task should **append**, not replace.
  `[03:10]`–`[03:53]` `frames/0022_03-20.jpg`, `0026_03-48.jpg`.
- [ ] **F70** · UX · S — **Time-off person picker should be checkboxes, not
  radios.** He wants to select **both** James + Jim in one dialog instead of
  adding the reservation twice. `[04:42]`–`[05:21]` `frames/0033_04-56.jpg`,
  `0034_05-00.jpg`.
- [ ] **F71** · FEATURE · L — **Un-defer per-day project-time boundaries
  (P8–P10).** The band is a fixed 8a–6p with no per-day editor; the test plan
  had this as known-deferred, but **James now wants it implemented** ("I
  don't know why it's deferred"). `[05:47]`–`[06:16]` `frames/0040_05-57.jpg`.

---

## Clip 5 — `2026-06-28_03-20-35` · Search-to-add, time off, wrap (≈11 min)

> Passing/confirmed: state picker uses checkboxes (good), pull-birds worked;
> **per-instance edits & protection** (S63/S65/S70) + **history visible**
> (S74) re-confirmed working; conflicts/man-down "worked fairly well."
> **NOT tested this batch:** Week/Month/Review (§1.12), people/offline/
> reminders (§1.13), and all of §2–§12 (Chores, Rounds, Events, Processes,
> Projects, Now, Farm map, Dashboard, Metrics, Broilers, Layers).

- [ ] **F72** · UX · M — **Inconsistent action placement on the Schedule
  pane (recurring).** Add-chore / conflicts / time-off / buffer actions sit
  in different spots top & bottom — "I don't want to be looking for them top
  and bottom." Establish one consistent action region. (Recurs; see also F20/
  F21.) `[00:14]`–`[00:39]`, `[10:12]` `frames/0004_00-30.jpg`.
- [ ] **F73** · UX · BUG · M — **Narrow / place-picker is confusing.** The
  result rows carry a **checkbox that reads like a completion box** but isn't
  one — remove it. The Narrow picker should be a **multi-select** screen
  (pick several places, "All 18 places" as an option) **with a Confirm
  button**, not instant add-on-tap. `[00:49]`–`[02:00]` `frames/0009_01-16.jpg`,
  `0013_01-43.jpg`.
- [ ] **F74** · BUG · M — **S37 dedupe/warn not working.** Re-adding the same
  chore ("fill waterers · Brooder one") **duplicates** it on the day instead
  of deduping/warning; it already occurs multiple times. `[04:11]`–`[04:30]`
  `frames/0031_04-22.jpg`, `0032_04-30.jpg`.
- [ ] **F75** · UX · BUG · S — **Same-name results aren't differentiated.**
  Search shows "whole farm, whole farm" / two chores with the same name with
  nothing to tell them apart — surface differentiating info (anchor/place) in
  the result. `[02:30]`–`[02:52]` `frames/0020_02-41.jpg`.
- [ ] **F76** · BUG · MOBILE · M — **Add-chore on mobile is broken** — UI
  truncated awkwardly; "Places — pick one" copy is unnecessary. `[03:16]`–
  `[03:30]` `frames/0025_03-24.jpg`, `0026_03-30.jpg`.
- [ ] **F77** · FEATURE · M — **Chore picker must let you target the block /
  time of day** to add into (a chore that recurs across blocks needs you to
  pick which block). `[04:30]`–`[05:00]` `frames/0033_04-42.jpg`,
  `0034_04-53.jpg`.
- [ ] **F78** · BUG · M — **Overlapping time-off is allowed for one person.**
  He scheduled two overlapping breaks for himself (1:30–2:15 twice); the
  Cover flow even said "James on break until 2pm" which didn't match what was
  listed. Reservations should reject overlaps per person (you can't be off
  twice in the same slot; at most pick one kind). `[06:30]`–`[07:30]`
  `frames/0043_06-30.jpg`, `0047_07-07.jpg`.
- [ ] **F79** · FEATURE · M — **Surface breaks / time-off somewhere** (the
  way conflicts are surfaced). Strong ask: a **time-off view in the
  Calendar** ("would almost justify the calendar's existence") — add from
  Schedule, view in Calendar. `[08:20]`–`[09:11]` `frames/0057_08-42.jpg`,
  `0060_09-00.jpg`.
- [ ] **F80** · VERIFY · BUG · S — **Project block recompute around a
  partial break.** With both off 2:45–3:15, the 3–4pm project block "still
  reads 3 to 4 … should instead say 3:15 to 4" — but he then said "looks
  good," so verify whether it recomputed (clip 4 showed recompute working).
  `[09:11]`–`[09:30]` `frames/0064_09-22.jpg`.

---

## Summary (capture phase — awaiting triage)

**80 findings (F1–F80)** across 5 clips, **Schedule + app-chrome only**.

Recurring themes to triage as groups:
- **Cross-client SYNC** (F16, F17, F19): completion + confirm-state don't
  reliably propagate; some banners have no dismissed-state. Highest-impact.
- **Time off is broken** (F25, F26, F70, F78, F79): created as tasks, not
  rendered, radio-not-checkbox, overlaps allowed, no surfacing.
- **Per-instance edit / drill-through gaps** (F35, F51, F55, F64, F66): rows
  aren't drillable and one-off edits (title/place/rename) are missing.
- **The "Anytime" concept** (F30, F56): James wants it removed; everything
  bound to a block.
- **Chore must/should/optional + ordering** (F48, F49): implement the
  rethinker workshop mock-up; build a global chore-ordering system.
- **Action placement + hover affordance + banner standardization** (F7, F20,
  F21, F22, F23, F24, F72): app-wide consistency pass.
- **Mobile parity** (F2, F10, F14, F37–F44, F59, F60, F76): TopBar, Week/
  Month/Review on phone, tap targets, gradients, freezes, add-chore.
- **Color/design iteration on Schedule** (F11, F33, F36, F39, F44): a
  dedicated design pass.

What's **working/praised**: draft→confirm flow, now-FAB & now-divider,
Overnight block (nearly all stories), Project-block derivation (P1–P7,
P11–P14), man-down **Cover** flow on desktop, per-instance protection +
history, search collapse/narrow basics.

**Next QA batch:** Week/Month/Review, §1.13, and §2–§12 (Chores onward).

