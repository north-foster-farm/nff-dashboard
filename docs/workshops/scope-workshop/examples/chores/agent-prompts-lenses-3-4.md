Reconstructed from session 658a17fb on 2026-05-06.
The other two pitches (Cutter, Maximalist) plus the synthesis live in
chores-overhaul.txt. These two were missing from that paste.

================================================================
PITCH 2 — UI CONVENTIONS
description: Chores workshop — UI conventions
LENS: every requirement should map to a known UI pattern from a
shipped product (Process Street, Toast/Square POS, Strava, Linear,
Figma multiplayer, Apple Reminders, Sunsama, Reclaim). Don't
invent; borrow.
================================================================

## 1. The model in one paragraph

Borrow the **Process Street / Trainual SOP run** model: a chore is a
step on a checklist template; a "chore window" is a **run** of that
template on a given date; "doing chores" is opening a run and ticking
items. Three persistent objects: `chore_template` (recurring
scheduled work), `chore_window_template` (named time blocks like
"Morning chores 7–10 AM" — the schedule lives here, not on
individual chores), and `chore_run` (the instance — one per template
per date, with state `not_started | in_progress | done | dnf`, plus
`started_at / ended_at` and a `helpers` set of users who joined).
Modifiers ride alongside as `chore_modifier` rows tied to a process
or event, with a precedence rule (lower `priority` wins; a UI
surfaces conflicts only when two non-cancelling modifiers collide on
the same `(chore_template, date)`). Sticky notes (Batch 5) survive
verbatim — they are the "comment thread on a step" that every SOP
tool ships. Realtime presence on a run drives the sidebar nav-label
flip ("Do chores" ↔ "Help with chores · 14:32"), the "someone else
got this one" disabled state, and the broadcast notification when
the last item flips done.

## 2. The UI in one page

**Sidebar nav item** behaves like Linear's "in progress" issue
indicator: when no run is open, it reads "Do chores" with the
lucide `ListChecks` icon. The instant any user opens a run, all
sidebar instances flip — green icon, label becomes "Help with
chores", and an HH:MM:SS counter ticks beside it (Strava's
live-activity pattern; the counter source-of-truth is the run's
`started_at`, the client just renders elapsed). This is the
"presence on a sidebar item" idiom that Notion and Linear both use
for live cursors and active-page indicators.

**The Chore Doer screen** is the Square POS / Toast order-screen
pattern, not a checklist app. Mobile-first, big tap targets,
persistent top bar showing elapsed time and the run's window
deadline as a countdown. Cold-open state is one button: "Start
chores" (Apple Reminders' Focus-mode "Start" affordance, but the
only thing on screen). Hitting it logs `started_at` and reveals the
working surface.

The working surface is a **two-row tab bar across the top** that
never disappears: Brooder · Mobile coops · Chicken tractors · Sheep
· Wash & pack. This is exactly the Toast / Square category strip —
categories stay pinned so jumping between sections is one tap
regardless of how deep you've drilled. Tapping a category swaps the
body for that category's checklist + that category's quick-action
buttons. **Quick actions are non-checklist taps that log activity**
(the Strava "log a run" pattern, not a to-do): "Dead layer", "Dead
broiler", "Chick → MASH", "Observation". Tapping "Observation"
opens a one-question prompt ("Where?") — the **iAuditor inspection
question** pattern, dead simple, one input, submit. Each tap creates
an `activity_log` row exactly the way Batch 4 already records
completions.

**Compound chores like "Moved coops"** use the Process Street
"subtask checklist nested inside a step" pattern. Tapping "Moved
coops" opens a sheet with the related sub-chores ("Fences moved?
Feeders? Waterers? Grit? Shell?") plus a single "All taken care of"
button at the top — that's the "Mark step complete" affordance from
Trainual that bulk-resolves nested items. Same pattern for "Moved
chicken tractors". The sub-items are pulled from the existing chore
definitions in that category, not duplicated; the screen is a
different *view* over the same data.

**Multi-user state on each chore button** uses Figma's multiplayer
presence: when your dad ticks a chore on his phone, your button
greys out and gets a checkmark overlay with his initial in a small
circle (Figma cursor avatar, scaled). Optimistic on tap; realtime
confirms or rolls back. Disabled buttons stay tappable so you can
long-press to **un-do** if it was a mistake (mirrors the Batch 4
debounce-and-edit affordances).

**Ending the run** is an "All done" button pinned to the bottom of
the screen (Sunsama's "Wrap up day" button). Tapping it logs
`ended_at` and flips to a wrap card: total time,
schedule-at-a-glance for the rest of the day, and a "Resume" link
if you ended too early. If a helper is still active, the wrap card
swaps the headline to "Jim is still working" with a live counter,
and the sidebar counter keeps ticking until the last person closes
out (Slack huddle's "you can leave; the room stays open" idiom).

**Sundown countdown** — Apple Weather / Garmin Connect's "X hours
of daylight remaining" widget. Render it inline inside the existing
Schedule-at-a-glance card right beside the "Evening chores"
rollup, plus a copy on the Chore Doer top bar when an evening run
is open ("Sundown in 2h 14m" ticking down by minute). Don't
introduce a new widget; reuse the slot the unified timeline
already gave us in Batch 3.

**End-of-window DNF** is the Reclaim auto-roll pattern: a single
Postgres job at the deadline (computed from
`chore_window_template.end_time`) marks any open run row `dnf`,
marks unchecked steps `dnf`, and emits the "DNF AM chores" push.

**Push notifications** on completion / DNF use the Strava
activity-feed pattern: web push (PWA + service worker — already on
the Batch 21 plan) with two payloads, "AM chores done — 1h 12m"
and "AM chores DNF". The Activity log gets a row at the same time,
so the in-app surface and the push stay symmetric.

**Modifiers** use Process Street's "conditional logic" + Reclaim's
"smart 1:1" override styling: when a modifier applies to a chore
for a given date, the Today tab's row gets a small amber strip
down its left edge with a one-line override summary ("Restricted
feed today — processing tomorrow"). The override **replaces** the
normal description and deadline; the schedule timeline shows the
same strip on the rollup. **Conflict UI**: when two non-cancelling
modifiers collide, the row gets an amber warning chip with a
popover that lists both modifiers and a "use this one" picker —
the Linear "duplicate issue" merge dialog, transposed.

**Desktop** keeps the existing Today tab as-is (it's already a
working two-column newspaper layout with chore-group accordions).
The Chore Doer is a phone-first screen; on desktop it renders
centered at iPhone width inside a max-width container, the
Things 3 desktop-mode-mirrors-mobile pattern. **In-place edit of a
single chore** is the Apple Reminders / Things 3 long-press →
expand-to-detail pattern on mobile, hover-pencil on desktop —
exactly what the All chores tab already stubs at lines 605–608,
just wired up for real. **Editing a window** goes to a separate
"Chore times" settings card (Sunsama's "set my work hours"
pattern), one place to drag the AM block from "8–10" to "7–9" and
have every member chore inherit.

## 3. What Batch 5 becomes

**Kept verbatim:** sticky notes + InboxBell (every SOP tool —
Process Street, Asana, Trainual — ships exactly this; no convention
beats it), and user preferences (auto-expand chore groups, theme,
density). **Reshaped:** chore groups become the **categories** in
the Chore Doer's persistent top tab bar — same rows in the DB,
same drag-reorder UI, same one-to-one membership; what changes is
that "group" is no longer just a Today-tab accordion, it is the
primary axis the Doer screen organizes around. The Groups tab in
the Chores page stays as the curation surface (you still go there
to add a new chore to the "Mobile coops" category).
**Drag-reorder kept** — categories appear in tab-bar order, members
inside a category drive the in-Doer checklist order. Nothing in
Batch 5 gets deleted; it earns a second job.

## 4. Top 3 tradeoffs

1. **Run-based model vs. window-based model.** I'm picking
   "run = template + date" (SOP-tool style) over "window = literal
   time block on a calendar" (Sunsama / Reclaim style). The SOP
   model fits the multi-person, "did we start late, did we finish
   in time" telemetry James actually wants; the calendar-block
   model would fit "drag this chore to a different time" better
   but he didn't ask for that, he asked for a chore-window editor.
   Cost: rescheduling a single chore inside a window is two clicks
   (edit → change start time) rather than a drag.
2. **Category tab bar vs. linear scroll.** Toast/Square's
   persistent category strip wins over a single long scrollable
   list (Apple Reminders) because James explicitly said "don't
   hide these buttons after drilling down one level". Cost: less
   screen real estate for the active category's content, and a
   fixed taxonomy (you can't have 12 categories without a
   horizontal scroll on the strip).
3. **Quick-action buttons as activity events vs. as chore
   completions.** Strava's "log a run" pattern (no checkbox, just
   a tap that creates an activity row) wins for "Dead layer",
   "Observation", etc. — they aren't chores, they're
   things-that-happened. Cost: two adjacent UI affordances on the
   same screen do similar-looking things differently (a tap on a
   chore toggles a checkbox; a tap on a quick action immediately
   writes a log entry); a new user has to learn that distinction
   once.

## 5. You'd hate this if...

- You wanted the chore window to be a **draggable block on a
  calendar grid** that snaps in 15-minute increments. This pitch
  puts window editing in a settings card; it does not give you
  Sunsama-style drag-on-a-day-grid.
- Your two-person team grows to **eight people across three
  sites** and you need per-site runs. The "one run per date"
  assumption breaks; you'd want Linear's project-scoped runs,
  which this model doesn't have.
- You expect **modifiers to compose** rather than override (e.g.
  "feed restricted by noon" plus "double the water" both apply,
  not one wins). The "lower priority wins" rule here is borrowed
  from CSS specificity, not from a rules engine, and it bottoms
  out fast.
- You want **the Chore Doer to be the only chores surface** and
  the Today tab / All chores tab / Groups tab to disappear into
  it. This pitch keeps three planning surfaces (Today, All
  chores, Groups) plus a fourth doing surface (the Doer), which
  is one more concept than a strict mobile-first rewrite would
  carry.
- You want **the sidebar item to be more than a presence
  indicator** — e.g. a mini-readout of which categories are done,
  or a per-helper avatar stack. The Linear/Strava convention I'm
  borrowing keeps the sidebar item to one label + one counter;
  richer sidebar telemetry would push toward Notion's page-tree
  presence dots, which is busier than this codebase's sidebar
  wants to be.


================================================================
PITCH 3 — REFRAMER (Sessions × Stops)
description: Chores workshop — reframer
LENS: change the unit of analysis. The seed data shows chores
cluster around physical locations; reframe the ontology.
================================================================

I have everything I need. The seed data confirms my reading:
today's chores are tightly clustered around physical stops on the
farm (mobile coops, chicken tractors, brooders, sheep), and most
"chores" are just the same five obligations at each stop (dump
feed, fill feed, dump water, fill water, log observations). The
category field is already doing 80% of the work of a location
field. That's the reframe.

Now I'll think through the alternatives, then commit to one and
walk through every requirement.

**Ontology candidates considered:**

1. **Animal/location** ("brooder #2 needs feed/water today").
   Strong fit because category already maps to location class.
   Modifiers attach to the location naturally ("brooder #2 has
   fasting in effect"). DNF is awkward — locations don't have a
   window.

2. **Session** (the morning round is the unit). Fits the
   start-time/end-time/elapsed/DNF/notify story perfectly. But
   chores still need to exist outside sessions for "what does
   Tuesday look like in three weeks" — and groups become weird.

3. **Route × Stop** matrix. The chore-doer screen *is* a route
   through stops; at each stop you handle the cluster of
   obligations. Strong fit for the mobile flow. But it complicates
   the schedule view.

4. **Window** (8–10 AM block owns its chores). Fits the
   editing-the-window requirement, fits DNF, fits notification,
   fits accountability. Closest to today's mental model.

The strongest is a **hybrid: Sessions × Stops**. The session is
the temporal unit (start, elapsed, DNF, notify, accountability).
The stop is the spatial unit (location, modifiers, the cluster of
obligations done together). Tasks are derivative — they're
{stop, kind} pairs that exist *inside* a session. This unifies the
chore-doer flow, the modifier story, the DNF/notify story, the
editing-the-window story, AND the schedule-at-a-glance story,
because a session is a calendar item.

I'll commit to that and write the pitch.

## 1. The model in one paragraph

The unit is the **session** (a planned, dated block of farm work
like "Morning chores, Tue May 5") and inside each session the unit
is the **stop** (a physical place on the farm — a specific
brooder, the layer mobile coops, the chicken tractors, the sheep
paddock, wash-and-pack). Tasks are derivative: every stop has a
small fixed set of obligations for its kind ("dump feed / fill
feed / dump water / fill water / log observations / collect
eggs"), and a session-stop materializes those obligations as
checkboxes only when the session actually exists for that day.
This is the right ontology because the seed data already tells
you so — every existing chore is a (stop, obligation-kind) pair
clustered at one of three time blocks, and James's two hardest
requirements ("edit the window in one place" and "modifiers
override one chore today") only become clean when the window is
a real object that owns its tasks and the modifier is an
annotation on a stop. Sessions are first-class records with a
planned start, an actual start, an actual end, participants, and
a DNF flag; stops are first-class records with a name, a kind,
and any active modifiers; templates are how recurring sessions
and recurring stop-checklists get authored without daily data
entry. Real-time multi-user falls out for free because the
session row is the lock — the moment one person flips
actual_start, everyone else's sidebar pivots to "help with
chores." Modifiers from processes (Batch 8) attach to a stop for
a date range; when a session materializes that day, the stop's
checklist incorporates the modifier instead of fighting the
schedule. The dashboard, the chore-doer, the activity log, and
the schedule-at-a-glance all read the same session/stop tables —
no parallel "chore definition / chore completion / chore group"
model.

## 2. The UI in one page

The sidebar gets a **single first-class entry: "Chores"**. Its
label is dynamic. When no session is in progress today, it reads
"Do morning chores · 7m" with the start-time of the next session
in the right-side hint. When a session starts, the icon turns
green, the label flips to "Help with chores · 14:23" with a
live-counting counter, and any other client viewing the dashboard
sees that swap inside a second through the realtime channel. When
the day's last session ends, the link goes back to gray with the
next session's start time.

Tap "Do morning chores." The Chore-Doer screen comes up with one
button: **Start chores**. Tapping it stamps `actual_start` on the
session row. The page now becomes a vertical column of **stop
cards** — Brooders, Mobile coops, Chicken tractors, Sheep, Wash
and pack — in the order James walks the farm. Each card is the
size of a thumb-tap zone, no expand-to-drill-down: every checkbox
is on the surface. A stop card shows its name, its open-checkbox
count ("4 of 6"), and a row of round checkboxes for each
obligation, plus a single right-edge button "Mark all done." If
a stop has an active modifier ("Broilers fasting until processing
day · skip feeders"), that line sits at the top of the card in
amber, and the affected obligation is rendered crossed-out and
pre-checked, so you can see at a glance what's overridden and
why. Two-modifier conflicts on the same task render the override
stack ("fasting overrides scheduled feed; vet hold overrides
fasting"), with the winning rule applied — no settings UI needed
yet, just a deterministic priority on the row.

A **floating jump-bar** along the bottom (mobile) or left
(desktop) keeps the five stop names always visible and tappable
— no drilling required, you can be deep inside Brooders and tap
"Sheep" directly. Above the stop cards sits a **quick-actions
tray**: Dead layer, Dead broiler, Chick to MASH, Observation
(asks "where?" — a small picker of the day's stops), Moved
coops, Moved tractors. Tapping "Moved coops" opens a sub-card
with that stop's full move checklist (fences, feeders, waterers,
grit, shell) and an "all taken care of" sweep button — same
control as a normal stop card, just summoned on demand. These
quick actions are not a separate model — they are
obligation-kinds tagged as "ad-hoc" on the relevant stop and they
show up in the activity log identically to scheduled obligations.

When the second person taps "Help with chores," they get the
same screen with an extra avatar bubble at the top showing James
is here too. Realtime keeps the checkboxes in sync: when James
checks "fill feeders" at the brooder, the box shows a small "JB"
stamp on the other person's screen and is unclickable for them.
The "Mark all done" affordance is allowed for both users — the
lock is per-task, not per-stop. The sidebar's elapsed counter
ticks for whoever is participating; if either user is still
active, the session is still open.

Tap **All done**. The screen flips to a session-summary card:
total elapsed, who participated, what got skipped, the
schedule-at-a-glance for the rest of today. A "Resume" button
reopens the session if you ended early. If both users have hit
"All done" the session is closed; a web/push notification fires
to all users saying "Morning chores done · 1h 12m · James + Jim."
If the session window's deadline arrives and the session is not
closed, the unchecked tasks get a DNF stamp and a different
notification fires: "DNF morning chores · 4 tasks left."

The **desktop Chores page** at `/chores` is unchanged in shape
but rebuilt over the new model. Tabs become **Today / This week
/ Templates / Activity**. The Today tab is the read-only twin of
the chore-doer (so you can glance at progress from a laptop
without launching the mobile UI). This week shows a calendar
strip of sessions (planned and past). The **Templates tab** is
where you do all editing. A template has: name ("Morning
chores"), one start-time and one deadline (this is the "edit the
window in one place" requirement — change 7-to-9 AM to 8-to-10
AM and every future session inherits it), recurrence, default
participants, and an ordered list of stops with an ordered list
of obligation-kinds inside each stop. Drag-reorder stops;
drag-reorder obligations within a stop; rename anything inline.
The **Stops** sub-tab inside the same screen is where you author
the physical places themselves (Brooder #1, Brooder #2, …) and
pin a default obligation-checklist to each stop kind (so
"Brooder" everywhere starts with the same five obligations).

The **dashboard** keeps Schedule-at-a-glance, but it reads
sessions instead of chore-period rollups. A session row now
shows planned-start, the session title, the assigned participant
if different from the default, and a state pill: "scheduled,"
"in progress · 14:23 · JB+Jim," "done · 1h 12m," or "DNF · 4
tasks left." Sundown is shown as an ambient row in the timeline
with a live "until evening chores: 47m" countdown when within
an hour of the evening session's start.

The **inline edit of an individual chore** from James's dump
becomes "edit one obligation on one stop" inside the template
editor; in-the-moment session edits ("don't fill water at
brooder #2 today, the well's off") are a session-scoped task
strikethrough plus a one-line note that lands in the activity
feed and is visible in the template's history.

The **sticky-note thread** stays per-obligation but is now
reachable two ways: from inside the chore-doer at the stop card
(a tiny note glyph next to each obligation row), and from the
InboxBell which now also surfaces "modifiers expiring today"
and "DNF reasons unlogged" alongside unaddressed notes. The
Activity log tab now has a session-filter and a stop-filter, so
"show me everything that happened in the brooders this week" is
one click.

## 3. What Batch 5 becomes

Chore groups are **deleted as a separate concept** — the
(session, stop) pair is the group, and the schema drop-in is the
same shape (a parent record + ordered members) just owned by a
more useful entity. Drag-reorder lives unchanged inside the new
template editor where it actually pays off (re-ordering the
walking route through stops, re-ordering obligations inside a
stop). Sticky notes are **kept whole** — the model already
attaches messages to a chore_id, and the migration is a column
rename plus a foreign-key flip from `chore_id` to
`stop_obligation_id`, with a back-fill that maps the old
chore-ids onto their new (stop, obligation-kind) pairs. The
InboxBell stays. User preferences are **kept whole** but the
auto-expand-chore-groups toggle becomes auto-expand-stop-cards,
plus a new toggle for default chore-doer view (compact/full).
The casualty is real: a few hours of Batch 5 wiring (the dnd kit
reorder of groups, the group-accordion render path on the Today
tab) gets thrown away — but the underlying realtime + RLS +
row-level patterns survive intact, so the demolition is mostly
UI.

## 4. Top 3 tradeoffs

1. **Templates become the only real authoring surface.**
   "Quick-add a chore in two clicks from the Today screen" stops
   working — you have to go to the template, find the right
   stop, and add an obligation there. For ad-hoc one-off work
   this is friction; mitigation is the quick-actions tray on the
   chore-doer, but it is not a substitute for casual chore
   creation.
2. **Stops have to be modeled and seeded before anything else
   moves.** The current code has no first-class location entity;
   every screen that touches chores has to migrate. This is a
   bigger one-time bill than reshaping Batch 5 — Overview,
   Schedule-at-a-glance, Activity log filters, and the Chores
   page all change in the same wave or the schema lives in two
   worlds.
3. **A chore that genuinely doesn't belong to a place loses a
   home.** Wash-and-pack is fine ("wash and pack" is a stop),
   but admin chores like "reconcile orders" or "answer customer
   email" do not have a stop. Either you create a synthetic
   "Office" stop or you allow stop-less obligations as a small
   carve-out, and that carve-out is exactly the back-door that
   drags the old chore-as-the-unit model back in.

## 5. You'd hate this if...

- You want to add or rename one chore on the way out the door —
  the round-trip through Templates → Stops → Obligation is too
  many taps for a one-off.
- You think of "Tuesday afternoon, fill the brooder waterers" as
  one atomic thing that lives on a list, not as a position
  inside a session that lives inside a template that lives
  inside a stop. Some people genuinely do; the new model makes
  them name three things they did not want to name.
- You care more about per-chore analytics (how often was *this
  exact obligation* completed late?) than per-session analytics
  (how often did we start morning chores on time?). The
  per-obligation question is still answerable but it is now two
  joins away.
- You expect the sidebar's "Help with chores" affordance to
  handle three or more concurrent helpers. The pitch handles
  two cleanly; with three or more the avatar cluster gets noisy
  and the per-task lock turns into a contention game.
- You want chores to be schedulable independent of a session —
  "do this once next Thursday at 4 PM" — without authoring a
  one-shot session-template for it. Possible, but always
  uncomfortable, because the whole model assumes sessions own
  tasks.
