# 42.3 round-4 feedback (2026-07-02) — work spec

James's fourth feedback round on the uncommitted 42.3 batch. Items 1–4
were FIXED in-session (see DONE); the rest was EXECUTED 2026-07-02
(session 8) — every box below is done except the FLAG-only truncation
item. See ROADMAP 42.3 'Round 4' for the full record. Files: `src/pages/Schedule.jsx` (Sch),
`src/components/ScheduleSidebars.jsx` (Side), `src/components/ui.jsx`
(ui), `src/lib/load/farmLoad.js` (farm),
`src/lib/data/useScheduleDeltas.js` / `useScheduleReflow.js` /
`src/lib/schedule/reflow*.js` (engine).

## DONE this session

1. Day-load border removed; bg-bg on BOTH surfaces (Sch wrapper, Side
   strip wrapper).
2. LoadSpine track `overflow-hidden` dropped — it clipped the
   NowEdgeLine glow dot ("now rule cut off").
3. farm `planned` = placed only — the legacy "first gap counts as
   planned when any project is active" clause deleted (painted the
   first project bar solid on unplanned days, disagreeing with the
   spine).
4. Day-load chromeless follow-ups (07-02): baseline `border-b` off the
   LoadSpine track AND the mobile strip rail row; horizontal padding
   off BOTH surfaces (desktop wrapper px-5, strip px-4s — full-width);
   the day load now closes with the page's standard hairline divider
   (`border-b border-line` on the desktop wrapper; the strip wrapper
   already had it). Strip time-axis GLYPHS removed (the sun/folder/
   clock icons above hh:mm) — kind color on time + bar carries
   identity; blockIcon/FolderKanban/ClockArrow imports dropped.
5. (Earlier rounds' work — see ROADMAP 42.3 entry.)

## TODO — desktop

- [x] **Hatch text contrast** (light mode): unplanned project rows'
  12px text sits on the 16-strength diagonals and is hard to read.
  Options: drop row-hatch strength (16→10) + raise the rail as the
  free signal; or knock the hatch out behind the text (a solid bg-bg
  plate under the title/time spans); or hatch only the row's right
  half. Pick by eye, update the planned-vs-unplanned pattern docs.
- [x] **Page header rearchitecture**: "Schedule" (Lora h1 + the
  underline/hairline decoration other pages use — see PageHeader)
  moves ABOVE the left sidebar spine, with Day/Week/Month/Review in
  the SAME row; the date ("Thursday, Jul 2") stays in the center
  column and becomes the h2. Touches the Sch layout shell (the tabs
  currently sit top-right above the workbench flex; the PageHeader
  currently renders inside the center column).
- [x] **This Week alignment** (RE-OPEN, "described in my most recent
  video"): date, rails, and badge columns still misaligned. Consult
  the 2026-06-30/07-01 transcripts (F37 baseline alignment is the
  slice-4 item; James says the fix isn't right yet). Likely: day
  label baseline vs bar bottoms vs symbol column — align all three to
  one baseline grid.

## TODO — mobile

- [ ] **Project header truncation** (FLAGGED only, as specced): "Project · 3 PM–4 PM" truncates
  because of the "both free" chip. FLAG ONLY for now — the chip gets
  refactored away in the availability slices (6–7). Cheap interim if
  trivial: let the chip drop on narrow widths.
- [x] **Whole-page horizontal scroll on mobile** (BUG, added 07-02):
  the page scrolls sideways — find the overflowing element (suspects:
  the strip pager track/animation transform, the fixed Now button,
  the full-width day load after the px removal, a min-w on flex
  children). Kill it (overflow-x-hidden is the bandage; find the real
  overflower first).
- [x] **Check the strip's full-width look post-padding-removal**: the
  DAY LOAD header + counts now sit flush at the viewport edge while
  the rest of the page content is inset — if it reads broken, keep
  the BARS full-bleed but restore px on the two header lines.

## TODO — both/other

- [x] **Add menu grows**: "Add buffer" + "Add a project step" move
  INTO the "+ Add" menu (Add chore · Add task · Add project step ·
  Add buffer · Time off); remove "Add a project step" from the bottom
  of the project block and "Add buffer" from the block card. Note:
  buffer/step adds are context-anchored (buffer needs an activity
  anchor; step needs a project+gap) — the menu entries must open the
  same pickers with a target selector, or default to the open block.
  Applies to the DESKTOP toolbar too? James said "the add button" —
  the desktop toolbar has separate text buttons; probably fold
  buffer/step there as well (ask or mirror: desktop gains "Add step"
  / "Add buffer" text buttons OR the desktop also gets the menu —
  James's line "the 'add buffer' action should be included in the
  'add' button" suggests wherever the Add button exists, i.e. mobile
  menu; keep desktop toolbar with added entries to match).
- [x] **Add button + menu hover states**: James reports no hover on
  the + Add button and menu items. Code HAS hover:bg-row-hover —
  verify why it doesn't read (row-hover at 0.09 alpha on white may be
  imperceptible; buttons may need the ghost-button treatment
  BTN_GHOST uses). Make it visibly obvious.
- [x] **Confirm button sizing + un-confirm**: Confirm button same
  height/proportion as the adjacent + Add button (one row, equal
  height); the Confirmed label it becomes must occupy the same box;
  ADD un-confirm (tap the Confirmed chip → revert to draft — needs a
  delete/void of the schedule.confirmed_day capture; check
  confirmDay/confirmedDoc plumbing in Sch ~line 1480+).
- [x] **Duplicate project steps in blocks** (BUG, root-cause): "Get
  Dad's time off" appears twice in the 8 AM block. Suspects: two
  engine instances (Sch + Projects both mount useScheduleReflow →
  each with its own deltas hook instance; double syncNow on the same
  staleness window can insert twice — placementKey diff runs per
  instance against possibly stale committedAuto), or outbox overlay
  timing (insert pending + realtime row both counted with different
  ids). Reproduce, then likely fixes: only ONE mounted engine
  auto-syncs (e.g. gate autoReflow to the Schedule mount), or make
  reconcile idempotent against BOTH pending and server rows, or
  dedupe placements by (step,gap) at insert time.
- [x] **Autosync-after-removal still fights** (follow-up to the
  tombstone): engine now places a DIFFERENT step into the freed gap.
  James implies removal should free the GAP for the day. Extend the
  tombstone: a removed AUTO placement also excludes its GAP (record
  gapStartMin on the tombstone; reflowPlan skips gaps with a
  tombstone for that day — thread an excludeGapStarts set through
  useScheduleReflow → reflowPlan).
- [x] **Project header row: P badge** replaces the FolderKanban icon
  in the center-pane project block header ("Project · 3 PM–4 PM").
  No hover/tooltip on it there (center pane ≠ sidebar).
- [x] **Drop the gray "PROJECT" chip** on project step rows (AdHocRow
  renders it for source_type project_node — remove; keep chips only
  for one-off tasks and edited rows).
- [x] **One-off tasks placeable into project blocks**: AddTaskBar's
  block selector (oneOffTargets, Sch ~1119) currently lists chore
  blocks only (blockRows.filter(b => b.block)); add the day's project
  gaps (label "Project · <time>"), exclude overnight. Adding to a gap
  = clockTime routing (addTask already takes clockTime; pass the
  gap's startMin as HH:MM).
- [x] **Sidebar glyph affordance**: ClockAlert (WarmingBadge),
  conflict AlertTriangle, overnight Moon, and C/P/E KindBadges — IN
  SIDEBARS ONLY (day-spine + This Week) — all get: Tooltip + the
  dotted hover-cue underline (BadgeHint) + cursor-pointer.
  (WarmingBadge already has Tooltip; add the dotted cue + cursor.
  Moon/conflict in spine rows + WeekStrip symbols need wiring.)
- [x] **Eliminate Split block** UI + functionality entirely
  (NO-LEGACY): the per-block "Split block" action + splitBlock
  plumbing + any related copy/docs. (Ties to F53's "revisit dropping
  split-block" — James has now decided: drop it.)
- [x] **Overnight Moon in This Week only on overnight days** (BUG):
  the Moon currently shows only when an overnight day is SELECTED
  (check weekOvernightISOs derivation in Sch — likely derived from
  the viewed day's overnight entries instead of per-day scan).
- [x] **Moved-chore row treatment** (the "edited" affordance
  redesign):
  * Keep the edited badge + time on rescheduled chores; style the
    time+label like the spine project rows' time · "both free" line
    (10px tabular faint + colored semibold tag).
  * Edited badge: text vertically centered; hover/active background
    tint; a small right-pointing chevron at the end that rotates to
    point down when the history is open (140ms ease, matches app
    motion).
  * Time in 12-hour form (currently 24h HH:MM from clock_time).
  * History copy: kill the word "Split". A moved chore reads
    "Rescheduled from X to Y" + datetime + user, first name
    capitalized. (EditedHistory.jsx + wherever history entries are
    written — entry.kind currently includes "split"?)
- [x] **Day-load current-bar ring**: the inset now-ring reads on
  chore bars but NOT project bars (solid slate ≈ ring hue?). Ring is
  accent-deep + bg separation — verify on project fill; maybe the
  ring needs the offset-separation variant tuned or the project bar's
  planned fill lightened under the ring. ("should have an inset
  style, works for chores but not projects".)
- [x] **Now button vs Confirm overlap** (mobile): the floating Now
  button and the Confirm button are the same green with no boundary
  when overlapping — give the floating Now a bg separation ring
  (shadow / 2px bg outline) or reposition.

## Notes / open decisions for James

- F66 gutter pick still open (A recommended).
- "both free" chip refactor = availability slices 6–7 (flagged).
- Desktop Add actions: mirror the menu additions as toolbar entries
  or convert desktop to the same + Add menu? (spec assumes toolbar
  gains the two entries; confirm.)
