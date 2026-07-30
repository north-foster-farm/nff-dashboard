# Schedule feature — draft story set (for the accept/tweak/discard loop)

**What this is:** candidate user stories for the new **Schedule** feature
(day-atomic plan of chores + projects + events, with draft→confirm).
Grounded in `verbatim-requirements.md` + the events/projects/chores
subsystems as they exist today. DRAFT — James reviews each (accept /
tweak / discard); survivors get synthesized into the **Behavior Spec**
that seeds the Scope Workshop.

**Vocabulary:** Schedule = the new day-plan feature. Calendar = the
renamed existing events surface (`Schedule.jsx`). draft → **confirm**.
"Activity" = a work entry (chore/task/project-node/event); "reservation" =
a non-work entry (day off / break / appointment / buffer); both are
"schedule entries" (parent concept — provisional, a workshop question).

`Sn` = schedule story; `BDn` = boundary story. One scenario each, in
James's or Dad's voice. (parens) flag grounding or open questions.

**Loop state:** FULLY REVIEWED 2026-06-24 — all schedule epics (S1–S129)
+ boundary set (BD1–BD44) accepted/tweaked. Curated set complete; next:
synthesize into the Behavior Spec (Stage 2 seed).

---

## Epic A — the day's schedule & draft → confirm  *(ACCEPTED)*

- **S1.** Each morning today's schedule is already populated with a
  **draft** (chores + projects + events) so I review a plan, not build one.
- **S2.** I can **confirm** the day's schedule — actively agreeing, not
  passively accepting what was generated.
- **S3.** The schedule clearly shows whether today is **draft** or
  **confirmed**.
- **S4.** For Dad, "the schedule" on his phone is *the* single place that
  says what we're doing today and in what order.
- **S5.** "Do chores" and the schedule are **married** — doing chores
  executes the chores portion of the confirmed day.
- **S6.** I can re-open and change a confirmed schedule mid-day, and it's
  clear when reality has **diverged** from what we confirmed.
- **S7.** A confirmed day is a **durable record** (what we planned)
  supporting the routine/accountability goal.
- **S8.** Confirming is **fast** — one action when I agree with the draft,
  not a form.
- **S9.** If I never confirm a day, it still functions (the draft is
  usable); confirming is the *accountability* act, not a gate to seeing
  the day.
- **S10.** I can confirm a day even while parts are still uncertain
  (confirm what's settled; the rest stays open) rather than all-or-nothing.
- **S11.** I can see, at a glance, how full the day already is before I
  add anything (rough sense of committed time vs. open time).
- **S12.** Yesterday's unfinished must-items are visible when I build
  today, so nothing silently falls off the back.

## Epic B — auto-population, should vs must

- **S13.** Chores due today populate the draft, slotted into their chore
  blocks; **must** chores read as must-get-done (not optional), eligible
  **should** chores as optional-for-today. (Must-get-done ≠ immovable —
  see S73.)
- **S14.** An eligible **should** chore is surfaced **as soon as its
  window opens** (available to pull into any day in the window), and the
  UI **escalates emphasis as its hard deadline approaches** (power-wash:
  "this week, hard by Fri sunset"). When I pull one onto a day I can note
  *why today*.
- **S15.** A should chore that has become a **must** (deadline today) is
  auto-promoted and shown as non-optional.
- **S16.** Today's project work auto-populates by the **global project
  priority order** (highest-priority active projects first). (Which work;
  placement rule lives in S20.)
- **S17.** Events occurring today populate the draft at their clock time
  and duration.
- **S18.** Ad-hoc chores I add land in a chore block by default.
- **S19.** Ad-hoc tasks with no project add freely — no time or
  chore-overlap restriction.
- **S20.** Project/task entries — **whether auto-populated (S16) or added
  by hand** — are placed in free time between chores, inside the
  projects-only window. (Single placement rule, de-duped with S16.)
- **S21.** The draft is **reproducible** — clear it and it regenerates
  from the same sources (it's a view of state, not hand-built data).
- **S22.** When two chores share a block, the draft keeps the block's
  internal order (route/sequence) rather than flattening it.
- **S23.** On a day with more should-work than time, the draft shows what
  fits and what's being left for later, instead of silently overcommitting.
- **S24.** Anchored chores only populate where their animals/equipment
  actually are today (occupied tractors/coops), matching the chore engine.
- **S25.** Auto-populated project placement is a *suggestion* I can move;
  it never reorders the underlying project priority.
- **S26.** A brand-new day with nothing due (rare) still renders a
  coherent, empty-but-valid schedule rather than an error/blank.

## Epic C — search-to-add (ad-hoc additions)

- **S27.** I search and add a one-off task ("hang sign at the end of the
  driveway") that belongs to no project.
- **S28.** I search and add a specific chore on a specific day (extra feed
  today). Chore search is name-deduped, loose-matching, and occurrence-
  aware — see S33a–S33d.
- **S29.** I search and add an entire project to today **without changing
  its global priority order**.
- **S30.** I can add any level of a project — the project, a phase, a
  task, or a single bullet/checklist item.
- **S31.** Events are findable in search and addable, but adding/moving
  one **modifies the event itself** (this/all-future prompt), never an
  un-persisted schedule tweak.
- **S32.** Search results mark each kind (chore / task / project node /
  event) and apply that kind's add rule on insert.
- **S33.** Search ranks by relevance to *today/this week* (due-soon
  chores, active projects) ahead of distant or dormant items.
- **S33a.** Chore search **collapses shared names** — "Fill feeders"
  appears **once**, not four times — and matches **loosely** ("feeders" ↔
  "feeder"). I never see "fill feeders / fill feeders / fill feeder".
- **S33b.** After I pick a chore name, I **narrow to the specific one** —
  by **place** (only places where that chore is actually assigned,
  enforcing the chore's anchor/lookup rules), by **batch**, or by
  **animal type**.
- **S33c.** When a chore repeats across blocks, I **pick which
  occurrence(s) by time of day**, and can **multi-select several** to add
  at once.
- **S33d.** Search is **token-aware** — it parses each space-delimited
  token by type and combines them: chore-name words, **place** (incl.
  containing place — "pasture" narrows to anything in a pasture), animal
  **type/batch/species**, **assignee** ("James"), **kind** ("event"/
  "chore"/"task"/"project"), **block/time-of-day**, **project/phase
  name**, and **status** (must/should/overdue/due-today). So "fill water
  sheep" → "Fill waterer" at the barn, listing the times it repeats.
- **S34.** I can add the same activity to several days at once from search
  (e.g. extra feed Mon–Wed) without visiting each day.
- **S35.** Adding a project node adds **only that node** — adding a phase
  does **not** pull in its tasks; I add exactly the level I chose
  (project, phase, task, or bullet).
- **S36.** I can add a quick free-text note/marker to the day that isn't a
  task at all ("vet called — ask about X").
- **S37.** If I add something that's already on the day, it dedupes / tells
  me rather than creating a duplicate.
- **S38.** An **"anytime" chore** (no specific block) means **every block
  is valid**, not none — so it's freely placeable in any block or free
  slot, treated as flexible rather than an error case. (Separate edge:
  fixed-clock-time chores that fall outside the standard blocks — e.g.
  processing-day crate-loading at 03:00 — are placed at their clock time,
  not forced into a block. See note in review.)

## Epic D — time & availability (non-work time)

- **S39.** I reserve a **planned day off** ("away a few days") so the
  schedule knows I'm unavailable.
- **S40.** I reserve a mid-day **appointment/obligation**.
- **S41.** I reserve a **break** during the day.
- **S42.** I set **projects-only limits** — the daily start/end window
  projects may occupy — as a global setting; chores and events are exempt.
- **S43.** I override the projects-only window for one day without
  changing the global setting.
- **S44.** Non-work time is **per person** (James off-site 1–4 while Dad
  is available).
- **S45.** I can reserve non-work time that spans multiple days (a trip)
  in one action.
- **S46.** A recurring non-work block (every Sunday off, standing PT
  appointment) can be set once and repeats.
- **S47.** Reserved non-work time is visible on the day so the open work
  time is obvious, not implied.
- **S48.** When someone's off, their must-chores visibly need
  reassignment to whoever's available (not silently dropped).
- **S49.** I can mark a whole day as a farm "down day" (nobody working)
  and the schedule reflects that everything must shift or be covered.
- **S50.** Non-work time I add is itself protected from being casually
  scheduled-over (it's a real reservation, not a soft hint).

## Epic E — conflicts, alerts & buffers

- **S51.** A **man-down alert** fires when someone's non-work time
  conflicts with their assigned work ("James off-site 1–4 but has chores
  at 3").
- **S52.** A **man-down alert** fires when *no one* is available during
  something needing coverage ("no one available 2:30–8 but feed delivery
  is all day").
- **S53.** Certain activities **auto-reserve buffer time** around them (a
  market needs a 1-hour buffer beforehand).
- **S54.** I can assign a buffer to **all occurrences** of a chore /
  event / project / task.
- **S55.** I can assign a buffer to a **single instance**.
- **S56.** Alerts are **context-specific** — they explain the specific
  situation and surface **at the conflict** on the schedule (not as a
  vague generic notification).
- **S56a.** I can see **all current conflicts in one list** (today and
  across the horizon).
- **S56b.** From the list I **jump straight to a conflict** on the
  schedule to see it in context, and **jump right back** to the list.
- **S56c.** I can **step from one conflict to the next** (next/previous)
  without returning to the list each time.
- **S57.** A buffer can be **before, after, or both** (markets need before
  for setup; processing might need after for cleanup).
- **S58.** Overlapping work for the *same* person at the same time is
  flagged (double-booked), distinct from a man-down.
- **S59.** An alert tells me *what to do*, not just that something's wrong
  (suggests the reassignment or the time to leave by).
- **S60.** **Resolving** a man-down is not a casual dismiss — it
  **assigns the available person to cover** the work and requires **that
  covering person's explicit acknowledgment**. A conflict can't be quietly
  cleared like an informational alert (and never by the *un*available
  person).
- **S60a.** The acknowledgment must come from **whoever will actually do
  the work** — the unavailable person can't acknowledge on their behalf.
- **S60b.** If the unavailability (or the surrounding schedule) is
  **edited after acknowledgment**, the acknowledgment is **invalidated and
  re-requested**, and the UI **surfaces what changed** since the original
  acknowledgment.
- **S61.** A buffer never silently deletes or moves the thing it buffers —
  it only reserves adjacent time and surfaces the squeeze.
- **S62.** Conflicts are recomputed live as I drag/add things, so I see
  the squeeze the moment I create it.

## Epic F — editing, overrides & protection

- **S63.** I can customize any entry's date/time on the schedule,
  overriding its default placement.
- **S64.** Instance edits **persist only within the schedule** — stretch
  one chore block an hour today and the global block durations are
  unchanged.
- **S65.** Activities are **protected by default**: a risky edit (move the
  first feed/water of the day to the afternoon) triggers a double-confirm.
- **S66.** Protection covers event-auto-scheduled chores (pull feed at
  noon the day before processing) — double-confirm on edit.
- **S67.** Editing an event's time/date uses this-event / all-future
  (EventScopePrompt), not a schedule-local override.
- **S68.** Removing or deferring a should-chore from today is allowed and
  tracked — it stays due per its own window.
- **S69.** *(Nice-to-have — deferred.)* Mark an individual activity as
  *not* protected for today without changing its default. Low value
  against the UI-density cost of yet another per-item control (see BD43).
- **S70.** The double-confirm explains *why* it's protected (this is the
  first feed; animals depend on it) rather than a generic "are you sure."
- **S71.** I can reorder activities within a block by dragging, and the
  order persists for the day.
- **S72.** I can split a chore block for one day (feed now, finish the
  rest after the appointment) without changing the block globally.
- **S73.** **Any** activity — **even a must-chore** — can be moved to
  another day or time, **including outside its deadline window**. The
  system hard-warns (double-confirm) but **never blocks**. Events are the
  exception: they reschedule via this/all-future (S67), not ad-hoc moves.
- **S74.** Every scheduled instance carries a viewable **modification
  history** — what changed and when — so user error is diagnosable from a
  written record. (Session-level undo and rollback-to-an-arbitrary-point
  are nice-to-haves on top; the history itself is the requirement.)

## Epic G — today, week & month views

**Today (the primary view)**

- **S122.** Opening the schedule lands on **today** by default — it's the
  home view; week and month are a tap away.
- **S123.** The today view shows the **whole integrated day** on one
  surface — chore blocks, events at their clock times, project work in the
  projects window, reservations and buffers — so the day's shape is
  visible at a glance.
- **S124.** A **"now" marker** shows where we are in the day; I can see
  what's happening **now** and what's **next**.
- **S125.** Today's status is **glanceable** — done / remaining / overdue
  / running-over — without drilling into each item.
- **S126.** The view distinguishes **earlier today** (done or missed) from
  the rest of the day — nothing earlier is silently forgotten, but the
  focus is forward.
- **S127.** A quick **"jump to now"** when I've scrolled around the day or
  week.

**Week & month**

- **S75.** I see the **week** as a rollup of daily schedules.
- **S76.** I see the **month** at a glance.
- **S77.** I **pre-commit a future day** (plan ahead: "we power-wash
  Thursday").
- **S78.** Looking ahead, I see where should-chores are bunching or
  deadlines loom, so I can distribute the work across the week.
- **S79.** I can move **any schedule entry** (not just project tasks)
  from one day to another in the week view to rebalance, within the usual
  protection rules (events via this/all-future; musts hard-warn but move).
- **S80.** The week view shows each person's reserved non-work time so I
  plan coverage around it.
- **S81.** A future market/delivery/processing day is visible far enough
  ahead that its prep work can be planned backward from it.
- **S82.** Confirming a future day is possible but distinct from "today" —
  a plan, revisited closer to the date.
- **S83.** The month view surfaces the rhythm (which days are heavy/light)
  so we can spot routine drift.
- **S84.** I can see a single project's planned work spread across the
  horizon (when are we actually doing "clearing"?).

## Epic H — people, routine & accountability

- **S85.** Whoever's available does the work — assignment is **not** a
  50/50 split, and the day shows who's doing what **without** per-person
  leaderboards.
- **S86.** The schedule helps build a **stable routine** — chores at about
  the same time each day, taking about the same time.
- **S87.** I see **start time and overrun** against the planned blocks
  (accountability = time, not who-did-more).
- **S88.** The schedule's point is to stop chores **stringing through the
  whole day** — it makes the day's shape visible up front.
- **S89.** I can reassign an activity from one person to the other for the
  day (Dad takes the afternoon coop round).
- **S90.** Some activities are unassigned ("whoever gets to it") and that's
  valid — not everything needs an owner.
- **S91.** End of day, I can see plan-vs-actual at a glance (did the shape
  hold?) to learn where the routine breaks.
- **S92.** The day reflects that effort is distributed across far more than
  chores (projects, errands) so "who did more chores" is never the frame.
- **S93.** A solo day (Dad alone) still produces a sane plan — it doesn't
  assume two people.
- **S94.** Hand-off mid-day (James leaves, Dad continues) is supported —
  the remaining plan is clear to whoever's left.
- **S128.** By default **both James and Jim are assumed available** each
  day; a person is "off" only when explicitly marked unavailable (Epic D).
  Auto-population, coverage, and man-down detection all assume two-up
  unless told otherwise.
- **S129.** Both the **today and week views prominently show each
  person's start time** — "Jim start time: ___  /  James start time: ___"
  — so when each of us began the day's work is front-and-center (routine /
  accountability goal). *(Open: auto-captured from the first started/
  completed item, or manually recorded?)*

## Epic I — source changes, lifecycle & propagation

- **S95.** A still-unconfirmed **draft** reflects current sources (it's a
  live view, not a stale snapshot). But once a day is **confirmed**, a
  source change that would alter it is **flagged** — the UI surfaces
  exactly what changed and **prompts to regenerate/accept**; it never
  silently rewrites a confirmed plan. (See BD44.)
- **S96.** If an event I placed gets cancelled/skipped, its slot (and any
  buffer) clears from the day, and dependent prep is flagged.
- **S97.** If a project task I scheduled is completed elsewhere, it shows
  done on the day rather than lingering as undone.
- **S98.** Deleting a project/phase/task removes it from future drafts but
  doesn't corrupt a past confirmed day that referenced it (history holds).
- **S99.** Moving an event (this/all-future) reflects on every affected
  day's schedule consistently.
- **S100.** A confirmed day records *what we committed to*; later source
  edits don't silently rewrite the historical record of that day.
- **S101.** If I scheduled "the project" and its tasks change, the day
  reflects the current task list (reference, not copy).
- **S102.** An automation/process that spawns a chore or event (reorder →
  delivery) lands it on the right day's draft automatically.
- **S103.** Completing a chore from the schedule writes the same
  completion as doing it from Now/Rounds (one completion truth).

## Epic J — mobile, offline & field execution

- **S104.** Dad uses the schedule one-handed on his phone in the field;
  the day's shape is legible without zooming.
- **S105.** I can tick a scheduled chore done from the phone and it syncs
  like the existing offline outbox.
- **S106.** The schedule is usable offline (read the plan, tick items);
  edits queue and reconcile when signal returns.
- **S107.** The phone defaults to *today*, with the rest of the week a
  swipe/tap away (not buried).
- **S108.** A confirmed plan is glanceable as a checklist while working,
  not just an editor.
- **S109.** Quick-logging (eggs, mortality, notes) from the field stays
  available alongside the schedule, not gated behind it.

## Epic K — reminders & the daily ritual

- **S110.** I get a nudge to **build/confirm the day** at a consistent
  time (supports routine), not a barrage.
- **S111.** A man-down or hard-deadline risk can push a notification when
  it matters ("feed delivery today, no one available 2:30–8").
- **S112.** Reminders respect non-work time (don't ping me about chores on
  my day off — ping whoever's covering).
- **S113.** The ritual is lightweight: most days, glance → confirm → go.
- **S114.** A standing "tomorrow looks heavy" heads-up the evening before,
  so a packed day isn't a morning surprise.
- **S115.** Notifications are shared/role-agnostic where chores are (the
  existing generic-stamp model), not per-user guilt.

## Epic L — looking back / history / routine drift

- **S116.** I can look back at past days to see plan-vs-actual.
- **S117.** I can see whether chores are creeping later over time (routine
  drift) — the thing we're trying to fix.
- **S118.** I can see how often should-chores slipped to their hard
  deadline (are we always doing power-wash at the last minute?).
- **S119.** A confirmed day is the unit of the record — "what did we agree
  to and how did it go," not raw event logs.
- **S120.** History is for learning the routine, not for grading a person
  (no per-person scorecards).
- **S121.** I can spot recurring conflicts (every market day runs into
  evening chores) worth fixing structurally.

---

## Boundary stories (what it is NOT / where each piece fits)

**vs Chores**
- **BD1.** The schedule is a **thin junction** — references chores; never
  redefines them. Editing a chore's recurrence still happens in Chores.
- **BD2.** Chores **stop owning** scheduling, prioritization, and "is this
  happening today / why" — those move to the schedule.
- **BD3.** Chores shrink to recurrence + windows + anchors + emitting
  candidates; no scheduling fields get added to chore_definitions.
- **BD4.** **Should→must escalation** is a chore-window property; the
  schedule reads it, doesn't own it.
- **BD5.** Chore *completion* truth stays one thing — schedule, Now, and
  Rounds all write the same completion, not parallel records.

**vs Calendar / events**
- **BD6.** The **Calendar** (renamed events surface) earns its place for
  clock-anchored externalities — markets, deliveries, processing,
  appointments — not recurrence chores.
- **BD7.** **Events are externalities**: never added ad-hoc to a single
  day; pulling one in = editing the event (this/all-future).
- **BD8.** The schedule never invents a second recurrence/event model — it
  uses event_series/occurrences as-is.
- **BD9.** **Calendar vs Schedule consolidation** — open: one surface or
  two (Calendar = browse/manage events over time; Schedule = compose/
  confirm a day)? Name where each justifies itself. (Workshop + Bracket.)
- **BD10.** The schedule doesn't duplicate the Calendar's month-grid
  browsing for events; if both exist, they share one event source.

**vs Projects**
- **BD11.** Scheduling a lower-priority project today **never changes** the
  global project priority order (`sort_order`).
- **BD12.** The schedule does **not** replace Projects' detail/Gantt
  planning — it references project nodes; planning stays in Projects.
- **BD13.** The schedule doesn't own project dependencies/date-cascade —
  that math lives in Projects; the schedule reflects the result.

**vs Now / Overview**
- **BD14.** **Now / do-chores stays execution**; the schedule is planning
  + the day's composition. Married, not merged.
- **BD15.** Overview's existing day-timeline (`buildTimelineItems`) — the
  schedule should **replace or absorb** it, not run a second competing
  day-timeline (per no-legacy).
- **BD16.** Rounds remains the block-execution surface; the schedule feeds
  it, it doesn't reimplement rounds.

**Thin-junction / data**
- **BD17.** The schedule stores only **reference + placement + commitment
  + reason + protection flag** — never a copy of source content.
- **BD18.** The draft is **regenerable**, never authored data that can be
  lost; confirming records agreement + deltas, not a frozen copy.
- **BD19.** Instance overrides are scoped to the schedule and never leak
  back into the source's global definition (block durations, etc.).
- **BD20.** No silent mutation of sources — the only writes-back are the
  explicit event this/all-future and chore completion.

**Parent-concept taxonomy**
- **BD21.** A **reservation** (non-work) is not an **activity** (work);
  man-down is exactly the activity-vs-reservation conflict.
- **BD22.** A **buffer** is a reservation bound to an activity — not a
  property the activity's source subsystem should carry.
- **BD23.** **Where buffer config lives** is left **open for the Design
  Bracket to propose** — not settled here. James's naive lean: a reusable
  **buffer-config component** plus a **"bufferable" interface** that any
  bufferable object (chore/event/project/task) exposes, with that
  component included wherever those render. Tension to hold: that's a
  cross-cutting capability, not a field on any one source — keep it from
  re-bloating chores (BD3). (James reserving further comment pending the
  Bracket.)
- **BD24.** The parent-concept word is **unsettled**. "Activity" currently
  collides with the existing **`activity_log`** — but `activity_log` is
  itself **poorly named** (it's really the observations/notes feed) and is
  **slated for an eventual rename** to something more descriptive; once
  renamed, "activity" may be freed for the parent concept. Don't hard-code
  the word yet.

**Tool-flags-human-decides**
- **BD25.** Conflicts **flag**; the system never *silently* reschedules or
  reassigns. But **resolving** a man-down is a human-initiated action that
  assigns the available person to cover and requires that person's
  acknowledgment (S60) — resolution is coverage, not dismissal.
- **BD26.** No **resource-leveling solver** or per-person hour-budget math
  beyond availability + conflict flags.
- **BD27.** The schedule proposes placements (opinionated defaults) but the
  human always overrides; defaults are never hard rules — even hard
  deadlines warn rather than forbid.
- **BD28.** Protection nudges are confirmations, never locks — James can
  always proceed, **including moving a must past its hard deadline**
  (hard-warned, not forbidden). Events are the only special case: they
  reschedule via this/all-future, not ad-hoc.

**People**
- **BD29.** Assignees stay the hardcoded **James/Dad** pair — no users/
  roles/permissions system.
- **BD30.** No per-person performance comparison anywhere — accountability
  is time/routine, not headcount of completed chores.

**Out of v1 (named so scope creep dies here)**
- **BD31.** Out: **two-way Google Calendar sync** (push-only stays as is).
- **BD32.** Out: **weather-aware** scheduling/auto-reschedule.
- **BD33.** Out: **travel-time / "leave-by"** routing alerts.
- **BD34.** Out: **season-template libraries** ("drop a broiler lifecycle
  on a date").
- **BD35.** Out: a **visual automation/rule builder** (automations stay
  code-seeded).
- **BD36.** Out: **customer-facing** event pages / RSVP.
- **BD37.** Out: **voice/NL** schedule entry.

**What the schedule must never become**
- **BD38.** Not a generic project manager, CRM, or to-do app — it's the
  day's composition of the farm's existing activities.
- **BD39.** Not a place to define *new* recurring obligations — those are
  chores; the schedule only places what exists.
- **BD40.** Not a notification firehose — reminders are few and ritual-
  supporting (BD per Epic K).
- **BD41.** Not a second source of truth for completion, dates, or
  priority — it's a lens + a thin commitment layer over the real sources.
- **BD42.** Not mandatory to use the rest of the app — chores/projects/
  events still work standalone; the schedule is the layer that *links*
  them, and its absence degrades gracefully.

**UI restraint**
- **BD43.** **UI-density restraint.** The schedule already concentrates a
  lot of surface; resist per-item always-on controls that don't earn
  their space — prefer on-demand inspectors / history over persistent
  toggles. (A live tension for the Design Bracket: flow-first vs
  minimalist; the reason S69 is deferred.)
- **BD44.** **No implicit / side-effect changes (global preference).**
  Committed data never mutates as a side effect of a refresh or new
  session, and a source change affecting a **confirmed** schedule is
  surfaced + prompted, never auto-applied. Implicit behavior is reserved
  for narrow, called-out cases (e.g. editing an event from the schedule).
  NB: showing genuinely updated *live* data on refresh (74°→75°) is not a
  side effect; an unconfirmed draft defined as a live view is also fine.
  Governs S95, S96, S99, S102.
