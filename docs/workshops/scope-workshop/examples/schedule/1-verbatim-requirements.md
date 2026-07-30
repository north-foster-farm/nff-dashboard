# Schedule feature — verbatim requirements dump

**What this is:** James's raw, unedited brain-dump that triggered the
Schedule feature design. Preserved verbatim per the design-workshop
playbook ("paste it verbatim — do not clean it up or summarize; the
messiness is signal"). This is the seed material for the story phase and
the Scope Workshop. Do NOT edit James's words below; analysis/synthesis
lives in separate documents.

Working vocabulary settled 2026-06-24 (see the response that captured
this): the new feature is **the Schedule** (a day's schedule, day-atomic
with week/month views); the OLD events surface formerly called "schedule"
is renamed **Calendar**; the draft→agreed transition verb is **confirm**
(a day's schedule is a draft until confirmed), replacing the unusual
"ratify"; the provisional parent concept for chore/task/project/event/
ad-hoc is **activity** (under review — see the parent-concept note).

---

## Part 0 — The breakthrough (purpose / what's missing)

> What I realized: there is a missing concept between our "chores" (i.e.
> the stuff we have to do daily to keep the farm running) and our
> "schedule" (i.e. a list of planned events/activities, arranged
> according to time and duration of each event/activity).
>
> [For a single day:] The thing we're missing is an opportunity for us to
> look at the chores for the day, the projects for the day, and the time
> we have available that day, and ratify the resulting schedule. ["game
> plan" / "approved schedule" / "itinerary" / "docket" were floated as
> names.]
>
> Why this is needed: there are a lot of things that *must* happen on the
> farm without exception (like feeding our animals). There are also a lot
> of things that *should* happen (like power washing waterers after
> moving a mobile coop). This "should" chore will become a "must" chore
> if not completed — power washing chores are defined as having a range
> like "do this week as soon as possible, and must be done by the end of
> the week by sunset".
>
> For our own accountability, visibility into our true schedule and
> priorities, and our goal to develop a stable routine, we need to take
> an active role in establishing, "yes, the mobile coop chores need to be
> done today, *and also* today is the day we're power washing, for
> reasons x, y, z..."
>
> Having our "Do chores" page on our phones is great, but it must be
> married to a "today's schedule" page that gives us the picture of the
> day/week/month as it has been agreed on by us.
>
> [Boundary goals James called out:] find where the "schedule" part of
> the app justifies itself; stop "chores" from getting any bigger (feels
> like a classic law-of-Demeter violator); make the UX simpler; this
> feature should create a fundamental LINK between concepts without being
> a leaky abstraction that poorly wraps several complex domain objects.

(Related prior context:
`docs/history/records/workshop-follow-up.txt` — accountability
is about time-management/routine, not per-person completion; chores
"strung through the whole day" is the core pain.)

---

## Part 1 — Detailed requirements (2026-06-24)

**Naming gymnastics:** James's dad will think of this new feature as "the
schedule." So the new feature takes the name **Schedule**, and the old
"schedule" (events) becomes the **Calendar**. James hopes the Design
Bracket identifies the overlap between Calendar (formerly schedule) and
the new Schedule and consolidates them.

**Granularity:** day-atomic with week/month views (confirmed).

**Sources / population:**
- The day's unconfirmed ("draft") schedule should be AUTO-POPULATED from
  chores, projects, and events.
- Ad-hoc additions should be possible via SEARCH. Additions can include:
  - chores (e.g. give extra feed on a specific day),
  - ad-hoc and/or one-off tasks (e.g. "hang sign at the end of the
    driveway"),
  - any project (work a lower-priority project on a given day without
    changing the established project priority order),
  - any level or sub-level of a project: the project ("clearing"), a
    phase ("remove brush piles from D pasture"), a specific task ("remove
    brush piles adjacent to road from D pasture"), or a specific bullet
    point ("check brush cutter blade sharpness").
- **Events are a notable EXCEPTION — not added ad-hoc.** Events represent
  externalities. If an event needs to be pulled into the schedule outside
  its expected date/time, the EVENT ITSELF should be modified, rather
  than represented in the schedule with un-persisted modifications.
  Mechanically: events are findable in search, addable to the schedule,
  and when the schedule is saved with the modified event, the user is
  prompted to save the change for either THIS EVENT ONLY or ALL FUTURE
  EVENTS. (Don't try to explain this distinction to the user — just the
  this/all-future prompt.)

**Add rules (opinionated defaults):**
- ad-hoc chores → placed into a chore block.
- ad-hoc tasks (no associated project) → addable freely, no restrictions
  on time or chore overlap.
- projects/tasks → placed into available free time between chores, and
  within the projects-only limits (below).

**Non-work time (must ship as part of this feature):** designated time
reserved for NOT working — planned days off ("I'm going away for a few
days"), appointments/obligations mid-day, breaks during the day. Special
cases:
- **Projects-only limits:** ability to define the start and end time for
  PROJECTS during the day. Global setting, overridable on any given day.
  Chores and events do NOT follow these limits.
- **Man-down alerts:** when someone reserves non-work time, any conflicts
  with something on the schedule are highlighted/flagged in the UI.
  Context-specific, e.g. "James is off-site from 1–4 PM, but has assigned
  chores today at 3 PM" or "no one is available from 2:30–8 PM, but feed
  delivery is scheduled for all day today."
- **Buffer time (chore/event/project/task-specific):** certain activities
  auto-reserve non-work time around them, creating a buffer (e.g. markets
  or pop-ups need a 1-hour buffer beforehand). Buffer is assignable to
  ALL occurrences of a given chore/event/project/task, AND to a single
  instance.

**Side note — the parent concept:** "we really need to identify the
parent concept of a chore/event/project/task/ad-hoc task/etc. All of
these things are activities of some kind, and they can all end up on our
schedule. What is the generic/parent concept... all of those activities
are specializations of what? Is the word 'activities' specific and
descriptive enough?"

**Instance-specific modifications:** the add rules are opinionated
DEFAULTS. Anything on the schedule can have its date/time customized.
Instance-specific modifications persist within the context of the
schedule (e.g. making one chore block an hour longer on one day must NOT
change the global chore-block durations).

**Protected activities ("don't mess with this"):** all "activities" need
a boolean "you really shouldn't mess with this thing's date or time."
There must be a way to prompt the user for confirmation when certain
edits are attempted (e.g. moving the first feed/water chore of the day to
the afternoon → double-confirm warning; same for modifying a chore
auto-scheduled by an event, like pulling feed at noon the day before a
processing day). DEFAULT = true (activities are opted IN to this
protection). EXCEPTION: events — editing the time/date of an event is
made either for the individual event, or for it and all future events
(the this/all-future prompt again).
