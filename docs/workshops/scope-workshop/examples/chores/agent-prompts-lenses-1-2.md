description: Chores workshop — scope cutter
prompt: You are participating in a four-agent design workshop on rethinking the chores system in NFF Dashboard. Three other agents are running in parallel from different angles; you cannot see them. The user (James) will read all four pitches plus the orchestrator's synthesis and decide where to land.

YOUR LENS: aggressive scope-cutter — "You don't need as much as you think you do."

Your starting belief: chores in this app are nothing more than *recurring grouped tasks done on a schedule by multiple people who need to see what's been done.* Everything beyond that sentence is bloat unless proven otherwise. For every entity, screen, and feature in the source code AND in James's requirements dump, ask:
- Could this collapse into another thing?
- Is this solving a problem the user only THINKS they have?
- Is this duplicating something already in the app — the activity log being the most obvious candidate?
- If we deleted this entirely, what would actually break on the real farm?

Be willing to delete: chore groups, chore blocks, chore modifiers, sticky notes, the "Chore Doer" surface, even the Chores page itself if another page can absorb its job. Keep what you can defend with a concrete failure mode that would happen on the real farm.

Counter-pressure: aggressive cutting often goes too far. Defend your floor — name what you would NOT cut and why each survivor earns its keep.

PROJECT CONTEXT:
- React + Vite + Supabase (Postgres + realtime + RLS) + Tailwind v4. Mobile is critical — chores are done while walking around a small family farm.
- Two-person team: James + his dad. Real-time multi-user matters; they're literally moving around the property together.
- Repo at `/Users/james/Code/nff-dashboard`.
- "Tractor" in this codebase means **chicken tractor** (mobile bottomless pen on pasture). Use the right term in your output.
- Current state already has: Chores page with multiple tabs (Today, All chores, Activity log, Groups), chore groups (Batch 5), chore sticky notes (Batch 5), user-level prefs (Batch 5), an activity log with edit/delete (Batch 4), schedule-at-a-glance interleaving chores/events (Batch 3).

TONE: James hates marketing buzzwords. No "seamless," "intuitive," "powerful," "robust," "next-gen," etc. Plain English. Concrete examples. Lead with the model, not the pitch.

SOURCE MATERIAL TO READ (do not skip — verify reality, do not trust this summary):
1. `src/pages/Chores.jsx` — current Chores page.
2. `src/components/ChoreGroupsTab.jsx` — Batch 5 groups tab.
3. `src/lib/data/useChoreGroups.js` — data hook.
4. `src/lib/chores.js` — period/time helpers.
5. `src/pages/Overview.jsx` — how chores surface on the dashboard.
6. `src/pages/Schedule.jsx` plus any schedule-at-a-glance composer — chore/event interleaving.
7. `src/sections.jsx` — sidebar structure.
8. `src/pages/Activity.jsx` — note the activity log already has edit/delete + realtime.
9. `src/components/ChoreMessageButton.jsx` and `src/components/InboxBell.jsx` — sticky notes flow.
10. `ROADMAP.md` (repo root) — shipped + upcoming plan; pay attention to Batches 4 and 5.
11. `~/.claude/plans/i-want-to-make-cozy-kitten.md` — original 22-batch dump with rich context not in ROADMAP.md.
12. Supabase migrations under `supabase/migrations/` — schema for chore_definitions, chore_completions, chore_groups, chore_group_members, chore_messages, activity_log.

JAMES'S VERBATIM REQUIREMENTS DUMP (this is what triggered the workshop):

```
features still needed for chores:

- in-place edit of individual chores
- edit of chore completion window... maybe we need to separate the concept of a chore (a recurring task) and "chore time" (a block of time devoted to the completion of chores)? if a chore has one chore block, and a chore block is say 8 AM to 10 AM, if we want to change that window of time for all our chores we do it in one place... is that a better separation of concerns?
- chore modifiers are going to exist as a side effect of a process. for instance, the processing day event/process will specify that the broiler food is restricted by noon the day prior to processing. This will affect the chore scheduled for that afternoon at 2 PM to feed broilers. So in this case, a chore modifier will override the scheduled chore.
    - there's also an edge case where two or more chore modifiers attempt to modify the same chore instance. we may or may not need UI for this, but there definitely does need to be logic to handle it
- somewhere, there should be an indicator of what time sunset is, and/or how long until evening chores can be done. maybe it even counts down in real time
- a specific UI that you launch when you do chores, kind of like the idea I had for a "receive inventory page" with specialized UI and interactivity tailored to that specific activity. when I go out to do chores, I want to click a menu link in the sidebar that says "do chores". this should launch an action screen that I guess I'm going to call the "chore doer", designed entirely for mobile devices, that has some specific UI on it:
    - only 1 button at first: start chores. this button opens the rest of the UI and logs the start time. this time needs to be logged so we can track our start times (we need to stay better on schedule, so its important we have a system to keep ourselves accountable. in the dashboard, we need to be able to see how often we started chores on time, how often we were late, and how long it took us to do chores.
        - if chores have already been started by someone else, the "do chores" item in the menu should instead read "help with chores", the menu icon should turn green, and an elapsed time counter should be appended the link text that counts up in real time. if someone starts chores while someone else is already looking at the dashboard, they should be able to see the link text change.
      - the UI has buttons for quick actions and quick completion of the current chores. it should be easy to quickly jump from brooder to mobile coops to chicken tractors to sheep to "wash and pack". tapping one of these buttons should show different stuff, but the ability to quickly jump to the next thing should remain (don't hide these buttons after drilling down one level). buttons we certainly need are:
          - dead layer, dead broiler, chick moved to MASH
          - observation (should prompt for "observed where")
          - moved coops (then prompts for each subtask like "fences moved? feeders/waterers/grit/shell moved?" — these should be pulled from the chore list, but this screen should make it easy to deal with them all together — and there should be quick actions to mark individual things as done or an "all taken care of" button to get them all at once. also need a "moved chicken tractors" button with the same stuff.
          - mobile coop feed/water/eggs
          - brooder feed/water
          - cleaned waterers, cleaned feeders, cleaned nest boxes
      - when someone else completes a chore, the button for it should become disabled and a checkmark or something to indicate completed status gets overlaid.
      - end the chores doing session by clicking the "all done" button. you should see how long your chores took, the schedule at a glance, and some way of resuming chores if you ended them too early for some reason. if someone else had clicked "help with chores", the screen should also say "(user) is still working", and the counter in the sidebar should continue counting up until the other person has clicked all done.
      - if chores are not done and the end of the chore window arrives, the chores for that chore window should be marked as "DNF"
- when all chores in a chore window are done, there should be a web/push notification to all users that says "AM chores are done" or "DNF AM chores"
```

SHIPPED CODE IS FAIR GAME. If your pitch deletes Batch 5 entirely, that's allowed — judge on merit.

OUTPUT FORMAT (mandatory headings, no other sections):

## 1. The model in one paragraph
(Plain prose. Data model + interaction model in 5–8 sentences.)

## 2. The UI in one page
(Prose, no code. What the user sees, click by click. Mobile vs. desktop differences.)

## 3. What Batch 5 becomes
(One paragraph: chore groups, sticky notes, settings, drag-reorder. Kept? Reshaped? Deleted? Why?)

## 4. Top 3 tradeoffs
1. (1–2 sentences)
2. (1–2 sentences)
3. (1–2 sentences)

## 5. You'd hate this if...
(Five honest bullets naming when this approach is wrong.)

DO NOT include code. DO NOT include batch sequencing — that is the orchestrator's job. DO read the source files; do not bluff.
subagent_type: general-purpose

I have enough source material. Now writing the pitch.

## 1. The model in one paragraph

A **chore** is a recurring task with a title, a window (a start and a deadline, e.g. "06:00–08:00"), a frequency, and an optional default assignee. That's it. There is no chore group, no chore block, no chore modifier, no chore-doer session entity, no DNF state. A **completion** is a row in `chore_completions` (which already exists) with one new column: `started_at`, defaulting to the time the *first* completion of any chore in the same window was recorded that day. "Help with chores," the live elapsed counter, and "all done" notifications are derived: if any completion exists today in window W and not all of W's chores are checked, chores are in progress; the start time is `min(started_at)`; "all done" fires when the last checkbox in W flips. Modifiers are not their own type — they are **chore overrides**: a row that says "for date D, replace chore C's normal text/time with this." Processing day writes one. The activity log already has edit/delete/realtime; it is the audit surface, not a parallel entity.

## 2. The UI in one page

One Chores page. Top of the page is a single big card titled **Today, [date]**. Underneath the title sits one tappable strip per window — Morning, Afternoon, Evening — each with the window's clock label, a name slot for whoever started, an elapsed-time chip if active, and a vertical list of that window's chores as fat checkboxes (44px+ tap targets) sorted by the order James and his dad actually walk. Each row is: checkbox, title, override pill (red, only if a modifier is in effect today), assignee initial, deadline chip. Tap a checkbox; it commits and broadcasts. The first tap of the day in a window also stamps the window's `started_at`. When the last box in a window flips, the strip turns green, the elapsed chip freezes, and a one-line toast lands on every connected phone — "Morning chores done in 1h 12m." That's the "Chore Doer." There is no separate page; the Today card *is* the doing surface. Mobile collapses the three strips to a single auto-expanded current-window strip with the others as one-line summaries below; desktop shows all three. A second page (a tab on the same screen, **All chores**) is a flat searchable list where you can edit a chore inline — title, window, frequency, assignee — same row, no modal. A third tab, **Log**, is the activity log filtered to chore kinds. There is no Groups tab, no sidebar "Do chores" link, no inbox bell. The page is the destination; the dashboard's Schedule-at-a-glance keeps surfacing rollups.

## 3. What Batch 5 becomes

**Delete chore groups** (table, tab, accordion, drag-reorder, hook). They are a workaround for "I want to walk through these in order" — a problem solved by a single `sort_order` column on `chore_definitions` with a draggable list on the All chores tab. One concept replaces three tables. **Delete sticky notes and the inbox bell.** The activity log already has free-text edit-in-place from Batch 4; if Jim wants to leave a note, he checks (or leaves unchecked) the chore and edits the activity row's summary — same realtime, same edit/delete, no new mailbox. **Keep user preferences**, but trim it: theme follows the user across devices and that earns its keep; auto-expand-chore-groups dies with groups; density should arguably be device-local (a phone wants compact, the desktop wants comfortable) and goes back to localStorage. Net: one of three Batch 5 features survives, in reduced form.

## 4. Top 3 tradeoffs

1. **No Chore Doer page, no DNF.** James loses the ritual of "I am now Doing Chores" as a UI mode. Counter: the ritual is checking the first box; making that the start signal is honest about what's actually happening, and avoids a phantom "session" entity that desyncs from completions when the app reloads or someone opens a second tab.
2. **No sticky notes means no place to say "broiler waterer leaking."** That observation either becomes an activity-log entry on the relevant chore (free-text edit), or it's a *real* observation — which belongs in a future Observations log, not bolted onto the chore. Either way, a parallel inbox is overkill for two people who are usually within shouting distance.
3. **Modifiers as overrides, not a system.** The processing-day flow writes a `chore_overrides` row for "feed broilers, 2 PM, May 12" that the schedule expander reads first. Conflict resolution is "last write wins" with both rows shown if more than one targets the same chore-day. Simpler than a precedence ladder, but two events that both override the same chore on the same day will need a manual resolution — the only place a modal earns its keep.

## 5. You'd hate this if...

- You actually use the start/finish timer for accountability and need it independent of any specific chore being checked first — you wanted to literally clock in before walking out the door.
- You and your dad have meaningfully separate roles where Jim's "moved coops" and James's "fed brooder" need to live in distinct visual buckets that aren't just window-based — the group concept was carrying that.
- The notes-on-chores pattern is genuinely how the two of you communicate ("Dad, the layer feeder hopper is cracked"), and routing it through the activity log feels like reading email through a search box.
- You expect the app to *prevent* DNF by changing color, vibrating, or escalating as the deadline approaches — passive checkbox UI lets a window quietly run out and you find out at dinner.
- The chicken-tractor / mobile-coop / brooder quick-action tree from the dump is something you mentally rely on while moving — a flat per-window list under-serves the "I'm at the brooder, what do I do here" mental model that subroutes give you.

**Floor — what I will not cut and why:**
- `chore_completions` table + realtime. This is the truth of the day. Without it nobody knows what's done.
- The Chores page itself. The dashboard's rollup is read-only by design; you need a place to *do* the work, with checkboxes sized for a thumb in work gloves.
- Per-window grouping (morning/afternoon/evening). It is how the day is actually shaped on a farm with chickens and sunset; it's not a feature, it's the calendar.
- Edit-in-place chore definitions. Without this, "fix the 7 AM start time" is a code change.
- Activity log with edit/delete (Batch 4). It is the audit trail, the notes channel, and the "what happened yesterday" memory. Triple-duty earns its keep.
- Override rows for processing-day-style schedule changes. Without this, automation-driven schedule shifts have no home and end up as ad-hoc edits to chore definitions.
agentId: a8ca524eb2e4f4203 (use SendMessage with to: 'a8ca524eb2e4f4203' to continue this agent)
<usage>total_tokens: 103971
tool_uses: 17
duration_ms: 96047</usage>

description: Chores workshop — maximalist
prompt: You are participating in a four-agent design workshop on rethinking the chores system in NFF Dashboard. Three other agents are running in parallel from different angles; you cannot see them. The user (James) will read all four pitches plus the orchestrator's synthesis and decide where to land.

YOUR LENS: maximalist — "What if we do all that plus..."

James's specs are a floor, not a ceiling. Your job: take every requirement and ask "what's the next move?" Extrapolate every spec into more features and behavior that tie into what was asked, and take it to the next level.

Examples of the kind of extrapolation expected:
- On-time analytics → trend charts → predictive prompts ("you're 80% likely to be late if you don't start by 7:50 AM") → coaching nudges → seasonal pattern detection.
- Sundown countdown → astronomical / weather-aware scheduling → "evening chores delayed 12m due to forecast precip starting 6:30" → daylight-shift auto-adjustments through the year.
- Chore Doer multi-user → handoff messaging, voice notes between players, Slack-style "James is at the brooders" presence, ad-hoc "I'll get the brooder, you get the chicken tractors" splits.
- Modifiers from processes → cascading modifiers across days, conditional modifiers ("if temp <40°F overnight, add this chore"), ML-suggested modifiers from past behavior.
- Real-time collab → spectator mode for a third person, live activity ticker for absent family members, after-action recap auto-shared to a household chat.
- DNF / window-completion → root-cause prompt ("why did AM chores DNF?"), automatic surfacing of repeated DNF causes ("brooder feed has been DNF 4 of last 14 days"), suggestion to redesign that chore.
- "Help with chores" sidebar counter → leaderboard, weekly contribution shares, gentle guilt-trip for the lazy partner.

But: be willing to be wrong. The point is to expand the option space, not commit to anything. Tier-2 ideas that are obviously moonshot get explicitly flagged as moonshots — separate them from the natural extensions you actually believe in.

You're allowed to introduce concepts adjacent to chores that James didn't ask about IF they emerge naturally from the requirements (e.g. an "observation log" surface that ties into the observation button, a "mortality dashboard" that ties into dead-layer/dead-broiler buttons, or a "MASH ward" tracker that ties into chick-moved-to-MASH).

Counter-pressure: you have to defend tier-1 features as worth building. Anything that costs more than it returns gets cut. If everything ends up tier-2, you've failed the assignment.

PROJECT CONTEXT:
- React + Vite + Supabase (Postgres + realtime + RLS) + Tailwind v4. Mobile is critical — chores are done while walking around a small family farm.
- Two-person team: James + his dad.
- Repo at `/Users/james/Code/nff-dashboard`.
- "Tractor" in this codebase means **chicken tractor** (mobile bottomless pen on pasture). Use the right term in your output.
- Current state has: Chores page with multiple tabs (Today, All chores, Activity log, Groups), chore groups (Batch 5), chore sticky notes (Batch 5), user-level prefs (Batch 5), activity log with edit/delete (Batch 4), schedule-at-a-glance interleaving chores/events (Batch 3).

TONE: James hates marketing buzzwords. No "seamless," "intuitive," "powerful," "robust," "next-gen," etc. Plain English. Concrete examples. Lead with the model, not the pitch.

SOURCE MATERIAL TO READ (do not skip):
1. `src/pages/Chores.jsx` — current Chores page.
2. `src/components/ChoreGroupsTab.jsx` — Batch 5 groups tab.
3. `src/lib/data/useChoreGroups.js` — data hook.
4. `src/lib/chores.js` — period/time helpers.
5. `src/pages/Overview.jsx` — how chores surface on the dashboard.
6. `src/pages/Schedule.jsx` plus schedule-at-a-glance composer — chore/event interleaving.
7. `src/sections.jsx` — sidebar structure.
8. `src/pages/Activity.jsx` — activity log with edit/delete + realtime.
9. `src/components/ChoreMessageButton.jsx` and `src/components/InboxBell.jsx` — sticky notes flow.
10. `ROADMAP.md` (repo root) — shipped + upcoming plan; pay attention to Batches 4 and 5, plus future Batches 8 (Processes) and 11 (broiler tracker) for the natural extension surfaces.
11. `~/.claude/plans/i-want-to-make-cozy-kitten.md` — original 22-batch dump with rich context not in ROADMAP.md.
12. Supabase migrations under `supabase/migrations/` — schema.

JAMES'S VERBATIM REQUIREMENTS DUMP (this is what triggered the workshop):

```
features still needed for chores:

- in-place edit of individual chores
- edit of chore completion window... maybe we need to separate the concept of a chore (a recurring task) and "chore time" (a block of time devoted to the completion of chores)? if a chore has one chore block, and a chore block is say 8 AM to 10 AM, if we want to change that window of time for all our chores we do it in one place... is that a better separation of concerns?
- chore modifiers are going to exist as a side effect of a process. for instance, the processing day event/process will specify that the broiler food is restricted by noon the day prior to processing. This will affect the chore scheduled for that afternoon at 2 PM to feed broilers. So in this case, a chore modifier will override the scheduled chore.
    - there's also an edge case where two or more chore modifiers attempt to modify the same chore instance. we may or may not need UI for this, but there definitely does need to be logic to handle it
- somewhere, there should be an indicator of what time sunset is, and/or how long until evening chores can be done. maybe it even counts down in real time
- a specific UI that you launch when you do chores, kind of like the idea I had for a "receive inventory page" with specialized UI and interactivity tailored to that specific activity. when I go out to do chores, I want to click a menu link in the sidebar that says "do chores". this should launch an action screen that I guess I'm going to call the "chore doer", designed entirely for mobile devices, that has some specific UI on it:
    - only 1 button at first: start chores. this button opens the rest of the UI and logs the start time. this time needs to be logged so we can track our start times (we need to stay better on schedule, so its important we have a system to keep ourselves accountable. in the dashboard, we need to be able to see how often we started chores on time, how often we were late, and how long it took us to do chores.
        - if chores have already been started by someone else, the "do chores" item in the menu should instead read "help with chores", the menu icon should turn green, and an elapsed time counter should be appended the link text that counts up in real time. if someone starts chores while someone else is already looking at the dashboard, they should be able to see the link text change.
      - the UI has buttons for quick actions and quick completion of the current chores. it should be easy to quickly jump from brooder to mobile coops to chicken tractors to sheep to "wash and pack". tapping one of these buttons should show different stuff, but the ability to quickly jump to the next thing should remain (don't hide these buttons after drilling down one level). buttons we certainly need are:
          - dead layer, dead broiler, chick moved to MASH
          - observation (should prompt for "observed where")
          - moved coops (then prompts for each subtask like "fences moved? feeders/waterers/grit/shell moved?" — these should be pulled from the chore list, but this screen should make it easy to deal with them all together — and there should be quick actions to mark individual things as done or an "all taken care of" button to get them all at once. also need a "moved chicken tractors" button with the same stuff.
          - mobile coop feed/water/eggs
          - brooder feed/water
          - cleaned waterers, cleaned feeders, cleaned nest boxes
      - when someone else completes a chore, the button for it should become disabled and a checkmark or something to indicate completed status gets overlaid.
      - end the chores doing session by clicking the "all done" button. you should see how long your chores took, the schedule at a glance, and some way of resuming chores if you ended them too early for some reason. if someone else had clicked "help with chores", the screen should also say "(user) is still working", and the counter in the sidebar should continue counting up until the other person has clicked all done.
      - if chores are not done and the end of the chore window arrives, the chores for that chore window should be marked as "DNF"
- when all chores in a chore window are done, there should be a web/push notification to all users that says "AM chores are done" or "DNF AM chores"
```

SHIPPED CODE IS FAIR GAME. If your pitch deletes Batch 5 entirely, that's allowed — judge on merit.

OUTPUT FORMAT (mandatory headings, no other sections):

## 1. The model in one paragraph
(Plain prose. Data model + interaction model in 5–8 sentences.)

## 2. The UI in one page
(Prose, no code. What the user sees, click by click. Mobile vs. desktop differences. Bring in the tier-1 extensions naturally.)

## 3. What Batch 5 becomes
(One paragraph.)

## 4. Top 3 tradeoffs
1. (1–2 sentences)
2. (1–2 sentences)
3. (1–2 sentences)

## 5. You'd hate this if...
(Five honest bullets naming when this approach is wrong.)

## 6. Tier-2 moonshots (separate, brief)
(Bullet list. 6–10 wild ideas, one line each, flagged for what they need.)

DO NOT include code. DO NOT include batch sequencing. DO read the source files; do not bluff.
subagent_type: general-purpose

I have enough to write a proper maximalist pitch. The codebase has chore definitions, groups, sticky notes, activity log, schedule-at-a-glance, and a roadmap that already names Processes (Batch 8) and broiler tracker (Batch 11). Now the pitch.

---

## 1. The model in one paragraph

Three primitive entities replace today's flat chore list: **Chore Definition** (the recurring task — what), **Chore Block** (a named time window like "AM" 6:00–10:00 — when), and **Run** (one materialized day-and-block instance — actual work, with start/finish timestamps, participants, completions, and outcomes). A Chore Definition belongs to one Chore Block and is tagged with one **Site** (brooder, mobile coops, chicken tractors, sheep paddock, wash-and-pack). **Modifiers** are first-class records owned by a Process or by a manual override; they target (chore_id, date) tuples with a verb (skip, replace_with, restrict_until, add) and a priority — when two collide, highest priority wins and the loser becomes a stacked badge on the chore. A **Run** opens when the first person taps "Start chores," continues across handoffs (every participant has their own start_at/end_at row), and closes when the last person taps "All done"; if the block window expires first, the Run auto-closes and any open chore in it gets a `dnf` outcome with a required reason prompt the next time you load the page. Sticky notes, observations, dead-bird reports, and MASH transfers are all just typed **Run Events** logged against an open Run, which doubles the activity log's value because it now answers "what happened during AM chores yesterday" not just "what got checked."

## 2. The UI in one page

The sidebar gets one new item at the top of the Planning group: **Do chores**. When no Run is open it reads "Do chores." When a Run is open it flips to **"Help with chores"**, the icon glows green, and a live counter ticks beside the label — `0:14:22` — driven by the same realtime channel that already powers chore_completions. If the active Run has a participant who isn't you, an avatar dot appears on the icon. This works on both desktop and mobile sidebars, and on mobile the same affordance lives in the top bar so it's reachable one-thumbed. Click it from any device.

The Chore Doer is a full-screen takeover, no sidebar, no header. The top is a fat status bar — block name (AM), elapsed time, sundown countdown if you're in the evening block, weather strip ("44°F, light rain"), and the participant chips ("James + Jim, joined 3m ago"). Below that is the **Site Switcher**: five always-visible big tap targets — Brooder, Mobile coops, Chicken tractors, Sheep, Wash & pack — each showing a "3/6 done" pip and a faint colored band that fills as you complete its chores. They never disappear when you drill into one — they reflow into a horizontal scroll strip on phones, a vertical rail on tablets/desktop. Tap a site to open its chore stack; the stack shows checkboxes for every member chore with quick-action verbs above ("Move all," "All taken care of," "Fences moved," "Feeders moved," "Waterers moved," "Grit moved," "Shell moved" — pulled from the Move-coops chore-group composition), so you can clear the whole site in one tap or itemize it. As soon as you tick something, your name flies into the row and a realtime echo disables the same row on Jim's screen with a check overlay. If Jim is mid-tap and you both hit the same chore, last-write-wins with a tiny "Jim got there first" toast — non-blocking.

Three persistent buttons sit above the site rail no matter where you've drilled: **Observation** (opens a sheet asking "observed where?" with the five sites preselected as chips, plus a free-text field and a voice-record button), **Dead bird** (Layer / Broiler radio, paddock dropdown, tap-to-photo, optional cause), **Chick → MASH** (count, source brooder, reason, severity 1–3). Each one writes a typed Run Event and surfaces in the day's activity feed with the same edit/delete affordances Batch 4 shipped. The dead-bird and MASH buttons feed straight into per-batch tallies on the broiler tracker (Batch 11) and into a new lightweight **MASH Ward** card on the Animals/Broilers page that lists chicks currently isolated, their day count, and a discharge button.

The Chore Doer also surfaces inbound modifiers as a yellow strip at the top of any affected site. "Broiler feed restricted until noon — processing day tomorrow." If two modifiers collide, the strip stacks two ribbons with the winning one solid and the loser ghosted; tap to expand a tiny conflict explainer ("processing-day modifier overrode James's manual restrict at 10:14 AM"). The sundown countdown ("evening chores can start in 2h 41m") sits as a small live-ticking pill on the dashboard's Schedule at a Glance card and reappears in the Chore Doer status bar; the underlying engine (already in `useCurrentWeather`) plus the new astronomical-twilight wrinkle gives us a forecast-aware "actual sundown ~6:42 PM, working dusk ~7:14 PM" pair when overcast skies are rolling in.

When you tap **All done**, you get a recap screen: total time, your contribution share vs. Jim's, a checkmarked list of what got done, anything still incomplete, the Run Events you logged, and three buttons — "Resume" (re-opens the same Run if you ended too early), "Close" (commits the Run), "Close + send recap" (fires the push notification "AM chores done · 1h 14m · 3 obs · 1 mortality"). If Jim is still working, the screen shows "Jim is still working — Wash & pack 2/4" and your sidebar counter stays green until he closes too.

When the block window expires with anything still open, the chore auto-marks DNF and the next person to load any chores surface gets a soft-modal: "AM chores closed with 3 incomplete. Why?" — three preset chips (ran out of time / interrupted / equipment problem) plus free text. The reason rides on the activity log entry, and a small **DNF analyzer** tile on the Chores page Today tab tracks repeat offenders ("Brooder feed: 4 DNFs in last 14 days — wants a redesign?").

The on-time analytics live on a new **Performance** sub-tab next to Today / All / Groups / Activity, with three rows of micro-charts: start-time histogram per block (your last 30 days, a horizontal scatter with a vertical line at the block's nominal start), duration trend (median + spread), and DNF frequency by chore. Clicking any chore drills into its single-chore history. A subtle **predictive prompt** rides on the dashboard before each block: at 7:50 AM "you're likely to be late if you haven't started by 8:05 — last 14 mornings avg start was 8:11" — but only when the model's confidence interval is tight enough; otherwise it stays quiet.

The sticky-note inbox bell from Batch 5 grows a sibling tab: **Run inbox**. Notes that came in *during* an open Run sort to the top of the bell so they get seen at the moment they're most relevant; notes that came in mid-Run from the partner ("the brooder waterer is leaking — left a note") fire a soft chime in the Chore Doer.

Mobile vs. desktop: the Doer is mobile-first — single column, fat tap targets, sticky bottom action bar with the three universal buttons (Observation / Dead bird / MASH). Desktop reuses the same components but lays out two columns (site rail left, drill-in right) and shows the Performance charts inline rather than tucking them behind a tab. Pull-to-refresh is wired to a "refresh peers" call so you always see your partner's last action.

## 3. What Batch 5 becomes

Batch 5 stays — but it's rewired. **Chore Groups** become the static composition layer of the new model; each group is precisely the chore-list rendering for one (site, block) combination, so groups are no longer a separate organizational concept users have to maintain — they're auto-generated from chore.site + chore.block and renamable. The Mark-all button transplants directly to the Site card in the Doer. **Sticky notes** keep their schema and bell; the bell gets the Run-aware sort I described, and notes posted during an open Run automatically reference the run_id so the activity recap can attribute them. **User preferences** gains four new toggles (push enabled, voice obs enabled, predictive nudges enabled, default Site Switcher density), but the Settings page itself is unchanged. Net effect: nothing shipped in Batch 5 gets deleted, but groups become an implementation detail of (site × block) instead of a user-curated taxonomy, and a one-time migration auto-creates groups from existing chore tags.

## 4. Top 3 tradeoffs

1. **Run as a first-class entity is a real new table with handoffs and timeouts** — tractable, but it's the first stateful "session" object in the codebase, and that's a category of bug surface (zombie Runs, duplicate Runs from a bad reconnect, clock skew between James's phone and Jim's). Expect to spend real time on Run lifecycle tests.
2. **Modifier conflict resolution surfaces UI even when "we may or may not need UI"** — Batch 8 (Processes) hasn't landed yet, so building the conflict explainer means scaffolding a Modifier API and a Process stub before there's a real Process to test against. Worth it because you'd otherwise build the chore overrides twice; risky because the schema sets the shape of Processes downstream.
3. **The Site Switcher hardcodes five sites today** — that maps to your real farm, but it cements a domain assumption that bites if you ever add a sixth site (pigs, orchard, hoop house). Keeping sites data-driven from a `chore_sites` lookup costs ~100 lines and avoids a rip-and-replace later.

## 5. You'd hate this if...

- The Run lifecycle gets in your way on a normal weekday — e.g. you start chores, get interrupted by a phone call, forget to "All done," and the system DNFs perfectly-completed chores at the block boundary.
- Predictive prompts ("you're likely to be late") feel like an app nagging you instead of a tool — your dad in particular reads coaching nudges as guilt.
- The Chore Doer's full-screen takeover hides the rest of the dashboard you actually wanted to glance at while the brooders refill (e.g. "what's tomorrow's processing day prep").
- Run Events crowd the activity feed so chore completions stop being the dominant signal — a verbose dad logs four observations per chore and the feed becomes noise.
- DNF reason prompts pile up because real life means chores legitimately don't finish in winter — you bounce off a guilt-prompt every morning and disable the feature within a week.

## 6. Tier-2 moonshots (separate, brief)

- **Voice-driven Doer** — "log obs in mobile coop two, hen acting lethargic" → typed observation, no taps. Needs Batch 23 voice infra.
- **NFC tags on each site** — tap phone to a brooder fence post to auto-open that site's chore stack. Needs hardware + Web NFC (Android only).
- **Per-batch broiler weight inference from feed-eaten + age** — Run Events for "feed dumped" already record amounts; cross-reference age and infer weight curve. Needs Batch 11 broiler tracker.
- **Spectator mode** — your sister-in-law watching the kids gets a read-only Doer URL that ticks live so she knows when chores are done. Needs auth-lite share tokens.
- **Auto-detected site from GPS** — phone knows you're standing in the broiler paddock, opens that site's chores by default. Needs geolocation + paddock polygons (Batch 22 simulator overlap).
- **Weather-driven chore reshuffle** — forecast says rain at 6 PM, evening chores auto-bump 30 min earlier with a one-tap accept. Needs forecast-aware planner.
- **Lessons-feed surfacing inside the Doer** — "Last spring you noted the brooder waterer freezes when overnight low < 28°F" pops into the brooder site card the morning a freeze is forecast. Needs Lessons module.
- **Auto-recap to a household chat** — close-the-Run pushes a paragraph into a Telegram or iMessage group thread. Needs an outbound webhook + per-channel token.
- **Photographic chore proof** — the "Cleaned waterers" button optionally requires a quick photo before unlocking. Needs Supabase Storage + a "proof required" chore flag, only worth it for adversarial tasks.
- **Cross-farm benchmarking** — anonymous comparison of your AM chore duration vs. similar-size farms. Needs an opt-in network of similar tools and an export schema. Pure moonshot.

Files I leaned on most: `/Users/james/Code/nff-dashboard/src/pages/Chores.jsx`, `/Users/james/Code/nff-dashboard/src/pages/Overview.jsx` (schedule-at-a-glance composer), `/Users/james/Code/nff-dashboard/src/lib/chores.js` (period engine), `/Users/james/Code/nff-dashboard/src/components/ChoreGroupsTab.jsx` + `/Users/james/Code/nff-dashboard/src/lib/data/useChoreGroups.js`, `/Users/james/Code/nff-dashboard/src/components/InboxBell.jsx`, `/Users/james/Code/nff-dashboard/supabase/migrations/0008_user_prefs_chore_groups_messages.sql`, `/Users/james/Code/nff-dashboard/ROADMAP.md`, `/Users/james/Code/nff-dashboard/src/data/choreSeeds.js`, `/Users/james/Code/nff-dashboard/src/sections.jsx`.
agentId: a2a0704ee4e422659 (use SendMessage with to: 'a2a0704ee4e422659' to continue this agent)
<usage>total_tokens: 104557
tool_uses: 16
duration_ms: 127020</usage>

All four returned. Pitches are above; here's the synthesis.

# Synthesis: a unified chores model

## What each agent contributed

- **Cutter** — argued the Chore Doer page is a phantom; the Today view IS the doing surface; chore overrides replace modifiers; sticky notes die.
- **Conventions** — mapped every requirement to a known pattern: SOP-tool runs (Process Street), POS persistent category strip (Toast/Square), Strava log-a-run for quick actions, Figma multiplayer for multi-user state, Linear merge dialog for modifier conflicts.
- **Reframer** — proposed swapping the unit to **Session × Stop**. Stops are first-class locations; chores are derivative. Heaviest semantic payoff, biggest migration cost.
- **Maximalist** — Definition + Block + Run + Site + Modifier with per-participant run rows, a Performance sub-tab, predictive nudges (defer), DNF-cause tracking, run-aware sticky-note inbox, plus a tier-2 moonshot list.

## Where they disagreed — and where I came down

| Question | Cutter | Conv. | Reframer | Max. | My pick |
|---|---|---|---|---|---|
| Chore Doer = separate page? | no | yes | yes | yes | **Yes (3-1)** |
| Quick actions = completions or events? | either | events | events | events | **Events (3-1)** |
| Site/Stop as a real entity? | no | repurposed groups | yes (per-instance) | yes (lookup of kinds) | **Lookup of kinds** |
| Run as a first-class table? | no | yes | yes | yes | **Yes (3-1)** |
| Per-participant rows? | n/a | one row + helpers | yes | yes | **Per-participant** |
| Sticky notes survive? | delete | keep | keep, retarget | keep + run-aware | **Keep + run-aware** |
| Chore groups survive as concept? | delete | repurpose | delete | auto-derive | **Auto-derive** |
| Sidebar dynamic label? | no | yes | yes | yes | **Yes (3-1)** |
| DNF reason prompt? | n/a | n/a | n/a | yes | **Threshold-gated only** |
| Performance analytics surface? | n/a | n/a | n/a | sub-tab | **Sub-tab** |

## The unified pitch

### Model

Five tables join the existing `chore_definitions` / `chore_completions` / `activity_log`:

1. **`chore_sites`** — kinds of places. Seeded with five rows: Brooder, Mobile coops, Chicken tractors, Sheep, Wash & pack. Editable.
2. **`chore_blocks`** — named windows. Seeded with Morning / Afternoon / Evening. Each has a global start and end (Evening's end can be sundown-relative). Edit the AM window from 7-10 to 8-10 and every chore in it inherits.
3. **`chore_modifiers`** — date-bound overrides. Schema: `(chore_id, occurs_on, action: skip|replace|prepend, source_process_step_id, priority, replacement_text)`. Highest priority wins; loser stacks as a tappable badge with a one-line "why."
4. **`chore_runs`** — one row per (block, date) with `started_at`, `ended_at`, `state ∈ {scheduled, in_progress, done, dnf}`.
5. **`chore_run_participants`** — one row per person who joined a run, each with their own `started_at` and `ended_at`. This is what gives you "Jim was 12m late, James was on time" telemetry.

`chore_definitions` gains `site_id`, `block_id`, `sort_order` (within site within block). The existing chore-groups data migrates: each group is either absorbed into a Site or becomes a (Site × Block) bucket; the dnd reorder hooks reattach to `sort_order`. Sticky notes keep their schema; the bell gains run-awareness.

### Interaction model

- **Sidebar entry, dynamic label.** No run open → "Do morning chores · starts 47m." Run open, you're not in it → "Help with chores · 14:23 · James" with green icon and live counter. Run open, you're in it → "Doing chores · 14:23." Realtime channel pushes the swap to all clients within ~1s.
- **Chore Doer = full-screen takeover, mobile-first.** Always-visible Site Switcher (top strip on phone, vertical rail on desktop) with a progress pip on each site. Tap a site → its checklist + its quick-actions. The Switcher never disappears; jumping is one tap from any depth.
- **Inside a site** — fat checkboxes for every obligation (the Cutter is right that 44px+ tap targets matter). Quick actions above: Observation (asks "where?" with site chips), Dead layer, Dead broiler, Chick→MASH, Moved coops (opens nested checklist with "all taken care of"), Moved chicken tractors (same). Quick actions write Run Events (typed activity entries on the same `activity_log` table, with a `run_id` FK), not chore completions.
- **Multi-user** — per-task optimistic check with realtime echo. When Jim checks "fill feeders" first, your row gets a "JB" stamp and disables. First-write-wins with a non-blocking toast on contention.
- **"All done"** wrap card — total elapsed, contribution split, Run Events logged, schedule rest of day. **Resume** button if you ended too early. If the other person is still active, label changes to "Jim is still working — Wash & pack 2/4" and your sidebar counter keeps ticking until everyone closes.
- **DNF** — deadline cron flips state to `dnf` and stamps unfinished tasks. Push notification fires: "AM chores done · 1h 12m" or "DNF AM chores · 4 tasks left." Reason prompt only when a chore has DNF'd more than 3 times in 14 days (don't nag).
- **Sundown countdown** — small live pill in Schedule-at-a-glance ("evening chores can start in 2h 14m") and on the Doer top bar when the evening run is open.
- **In-place chore edit** — pencil affordance on the All chores tab opens the row inline; same affordance long-pressing a row in the Doer.
- **Performance sub-tab** — start-time histogram per block (last 30 days, vertical line at nominal start), median + spread of duration, DNF frequency by chore with the "4-of-14" flag.

### What Batch 5 becomes

| Batch 5 piece | Fate |
|---|---|
| Chore Groups (table, hook, dnd) | Eliminated as a user-curated concept. Data shape survives, owned by Sites + sort_order. The Groups tab becomes a "Sites & windows" admin tab. |
| Sticky notes + InboxBell | Kept whole. Bell gains run-aware sort — notes posted during an open run jump to the top. |
| User preferences | Trimmed. `auto_expand_chore_groups` becomes `auto_expand_site_cards`. Theme + density stay. |

The dnd-kit reorder work currently uncommitted in your tree migrates cleanly to the new sort_order; nothing wasted.

## Risks (the honest part)

1. **Run lifecycle is the first stateful "session" object in this codebase.** Zombie runs, clock skew between two phones, duplicate-run guards on reconnect — real bug surface. Mitigation: unique constraint on `(block_id, date)`, plus a "force close" admin affordance.
2. **Sites are an enum-ish lookup, not a per-instance hierarchy.** If you ever genuinely need "Brooder #1 vs. Brooder #2" telemetry, that's a future refactor with cost. Reframer's full version is the right destination eventually; not v1.
3. **Quick-actions vs. checkboxes look similar, write to different tables.** A new user has to learn that distinction once. Worth it because conflating them poisons the activity log.
4. **The Doer takeover hides the rest of the dashboard.** No "peek mode." A glance back is two taps (Esc / back).
5. **Groups deletion-as-concept is a real loss** for whoever liked curating ordering as its own thing. Drag-reorder still lives, just under Sites & windows.

## Things I'm explicitly NOT pulling forward

- **Predictive nudges** ("you're 80% likely to be late") — Cutter's nag-fatigue concern wins; defer to v2 once a season of data exists.
- **DNF reason soft-modal at next page load** — only fire when threshold crossed for a specific chore.
- **MASH Ward / Mortality Tracker / Observation Log as new pages** — the buttons feed those future surfaces, but they're separate batches (MASH + mortality belong with Batch 11 broiler tracker; an Observation Log is its own roadmap item I'll propose to add).
- **NFC tags, GPS-based site detection, voice-driven Doer, photo-proof, household-chat recap** — Maximalist's tier-2 moonshots, all real but later.

## Open questions for you (please answer before I draft roadmap entries)

1. **Site list — confirm the five.** Brooder, Mobile coops, Chicken tractors, Sheep, Wash & pack. Do non-place chores ("reconcile orders," "answer a customer email") need a synthetic "Office" site, or are those not chores at all?
2. **Block list.** Three seeded (Morning, Afternoon, Evening) with editable windows, or do you want arbitrary user-defined blocks (Mid-day, Late evening) too?
3. **Sticky notes — keep or kill?** Cutter's case is real (a lot of "notes" are observations, which deserve a real Observation Log). My lean: keep them, plus add an Observation Log as a separate roadmap item later.
4. **Per-participant rows confirmed?** Gives you per-person on-time analytics. Slightly more complex than one row + a helpers set.
5. **Modifier conflict UI.** Stacked badge with the winner solid and loser ghosted, tap-to-explain — enough for v1? Or do you want a manual resolver from the start?
6. **Wash & pack as a stop.** Constant-presence in the Switcher even when nothing's scheduled there, or hide when empty?

## Proposed batch sequencing

This is roughly 3–4 batches:

- **Batch A — Foundation.** Sites + Blocks lookups, modifier table, schema changes to `chore_definitions`, migration from groups, in-place edit of individual chores. Today tab keeps working from new model. No Doer yet. **Ships value:** edit windows globally; chore overrides land for Batch 8 to use.
- **Batch B — The Chore Doer.** Full-screen takeover, Site Switcher, Run + Run-Participants, sidebar state machine, realtime per-task locks, Start/All-done lifecycle, sundown countdown, Resume. Possibly split B1 (lifecycle + Site Switcher) and B2 (realtime + quick actions + Run Events). **Ships value:** the entire mobile execution flow.
- **Batch C — DNF + notifications + Performance.** Deadline cron, web-push notifications (depends on PWA scaffolding from Batch 20 — may need to pull that earlier), Performance sub-tab. **Ships value:** the accountability loop you said matters most.
- **Batch D — Modifier UI.** When Batch 8 (Processes) lands, wire the modifier emitter and the conflict-stack UI. **Ships value:** processing-day-style schedule changes propagate automatically.

The whole arc is probably 4-6 weeks of batches given your batch cadence.

---

**Push back on anything.** Especially: (a) the six open questions above, (b) the Sites-as-lookup-of-kinds compromise (the Reframer's full per-instance model is a real alternative if you'd rather pay that cost up front), and (c) whether sticky notes should genuinely die in favor of an Observation Log.