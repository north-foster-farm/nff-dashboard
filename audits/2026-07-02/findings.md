# NFF QA Walkthrough — Findings (2026-07-02)

Capture-phase log from the recorded-walkthrough audit. One finding per
issue; numbering restarts at F1 for this run. **No fixes/commits until
triage.** Frames relative to
`processed/2026-07-02_17-14-47/`.

## Source

- **July 2 session** — `2026-07-02_17-14-47` (379 seg, ~41 min).
  Recorded against the dev server running the **uncommitted slices 6–7
  working tree** (availability core + surfaces), then widens to a
  full-app pass: Schedule, Availability, colors, Animals (layers /
  broilers / sheep), Rounds, Processes, header/dashboard.
- Audio is garbled ~21:00–22:30, ~24:00–28:00, ~36:30–38:30; findings
  from those spans are frame-grounded and flagged (~).

> **Character:** heavy design redirection on the just-shipped
> availability surfaces (headline: **revert the HereStrip**, send the
> whole cluster to a design bracket), a handful of genuine BUGs, plus a
> new Animals/lifecycle correctness thread. James explicitly suspects
> slice 7 was cut short by usage limits — it was not (both agents
> completed), but the *design* didn't land where he wanted.

## Legend

Kind: BUG · UX · DESIGN · FEATURE · MOBILE · DATA · PERF · DECISION.
Size: S · M · L. `↔` relates findings.

---

## §0 · Read first

### §0.1 Direct hits on the UNCOMMITTED slices 6–7 work

These change the 42.6/42.7 close-out plan before anything is committed:

- **F1 — REVERT the HereStrip** (keep the engine; redesign the surface
  in a design bracket).
- **F5/F6 — availability default-assignment "No one here" is wrong /
  untraceable** — engine-level bug to chase before shipping.
- **F12–F17 — the Availability page works but is "totally reworked
  top to bottom" material**; several S-size fixes (edit time-off,
  edit exceptions, editable break names, sunrise/sunset time options)
  are worth doing now.

### §0.2 Genuine BUGs (fast picking)

> **Fixed same-day (42.7, 3148879):** F1 (HereStrip reverted) and F5
> (dayConflictCount now counts uncovered event units + the dead
> double-book term revived — the triangle no longer waits for a
> click). **F6 explained:** the 12–12:30 "No one here" was the lunch
> BREAK carving everyone out — engine correct, surface unexplained;
> the traceability UX rides the design bracket. **F7 answered:**
> slice 7 was NOT cut short; both agents completed.

- [ ] F3 event badge click crashes
- [x] F5 conflict icon missing until day is clicked (regression, "the
  bug is back") — FIXED in 42.7
- [x] F6 "No one here" shown when both people should be available /
  cover accepted — engine was right (the lunch break); surface
  removed with F1, breadcrumbs to design bracket
- [ ] F9 cover tooltip shows Jim acknowledging at the same minute as
  James (invalid data)
- [ ] F13 time off can't be edited after creation
- [ ] F16 working-hours exception can't be edited after creation
- [ ] F17 break name not editable
- [ ] F22 broiler processing date uneditable once filled; "4.7 weeks
  remaining" wrong; batch created 12–1 a.m.
- [ ] F28 Rounds header shows stray "SUNSET 0/13 done" sliver

---

## §1 · Schedule + availability surfaces (slices 6–7)

- [ ] **F1 · DESIGN · L — Revert the "Who's here" HereStrip.**
  [00:09–02:36] Not a bad first attempt, but: no hover on phone (tap
  does nothing but flash), and it "layers more UI on top of more UI."
  Recommendation: **revert the bar**, keep the goal — surface who's on
  the farm *without* extra bars/text/tooltips. Sketch directions:
  avatars in the day-load / date-stats area; presence revealed on
  hover of existing elements. **Kick to a design bracket; this
  transcript is the seed doc.** `frames/0005_00-19.jpg`,
  `frames/0013_01-04.jpg`. ↔ F6, F8.
- [ ] **F2 · MOBILE · praise — Day pager + date picker on phone
  landed.** [02:42] "We've been needing that for quite a while."
- [ ] **F3 · BUG · M — Event badge: hover tooltip works, click
  crashes.** [02:55–03:49] Root cause per James: events have no
  read-only view component — only the editor fly-out. Need *some*
  presentation view (simple is fine) for inspecting an event on a
  day. `frames/0034_03-00.jpg`.
- [ ] **F4 · DESIGN · M — Needs-cover card too heavy.** [04:00–06:15]
  Integration itself is good ("pretty well woven in"). But the
  surface is a "gigantic card with big header, very wide button";
  keep the chore list + core info, make it much lighter. No
  established pattern → design bracket. `frames/0061_05-46.jpg`.
- [ ] **F5 · BUG · M — Conflict icon missing until the day is
  clicked.** [06:21–06:53] Sunday Jun 28: no conflict icon; clicking
  the day materializes three conflicts. Also on Saturday. "The bug is
  back" — a regression. And a 12 PM "no one here" doesn't show in the
  sidebar. `frames/0070_06-30.jpg`, `frames/0071_06-37.jpg`.
- [ ] **F6 · BUG/UX · M — "No one here" is wrong and unexplained.**
  [06:37–07:45] July 4 shows "No one here 12 PM–12:30 PM" though
  cover was accepted and no known reason for Jim to be out. Two
  parts: (a) verify `defaultAssignees`/segment math against real
  working-hours + time-off rows; (b) the UI needs breadcrumbs —
  *why* is no one here? Fine-tooth-comb the implementation.
  `frames/0071_06-37.jpg`, `frames/0073_06-53.jpg`. ↔ F1.
- [ ] **F7 · DECISION — "Was slice 7 cut short?"** [04:30–04:57,
  07:34] Answer from the build side: **no** — both agents completed
  and the suite is green; what shipped is the full intended slice.
  The dissatisfaction is design-level, handled by F1/F4/F6/F12.
- [ ] **F8 · DESIGN · M — Time-off surfaces are duplicated and
  scattered.** [07:45–09:24] "James out · All day" spine banner (the
  old rudimentary one) + "James seeing James Taylor" + week symbols =
  "covered too much," unclear which element owns the message. Fold
  the old banner into the availability presentation; prefer
  lightweight iconography (faces/avatars per day). Best case: the
  redesign makes the banner redundant → remove it.
  `frames/0092_08-35.jpg`.
- [ ] **F9 · BUG + UX · S/M — Cover acknowledgment: language and
  data.** [09:24–10:57] "Jim covers" phrasing is weak ("wish there's
  a better way to phrase it"); the "Acknowledged" button label came
  from a weird prompt — use something conventional. Tooltip:
  acknowledgment *time* (5:24 PM) is noise — drop it; must say
  coverage + who + which block. **BUG:** Jim shown acknowledging at
  the exact same minute as James — invalid data being displayed.
  `frames/0111_10-20.jpg`.
- [ ] **F10 · UX · S — Needs-cover copy + tooltip typography.**
  [11:00–12:16] "Needs cover from 9 AM to 1 PM Sunday June 28" too
  verbose — reuse an existing compact time representation. The
  full-width "Open rounds" button adds weight. Wants a small success
  cue on the cover-accepted icon. Tooltip line-wrapping needs
  hierarchy: hanging indent or tighter line-height inside a wrapped
  line vs. true new lines. `frames/0124_11-30.jpg`.
- [ ] **F18 · UX · S (~garbled) — Coverage icon/tooltip language
  unclear.** [21:00–21:38] The repeated coverage icon + its tooltip
  don't clearly say what they represent; language needs updating.
  `frames/0219_21-10.jpg`.
- [ ] **F19 · DESIGN · M (~garbled) — Week view lacks projects +
  events context; month view = visualization.** [21:38–22:25] Week
  view is "off to a good start" but missing project/event context.
  Month view should be about visualization (load trend, who's away)
  not data entry — day view is where work happens. To designers.
  `frames/0224_21-53.jpg`.

## §2 · Availability page (slice 6 editor)

- [ ] **F12 · DESIGN · L — Whole page to a design bracket.**
  [15:06–15:45] Availability *is* the right top-level page (he
  considered calendar-subpage and took it back); maybe a tab view.
  Composition of all three editors is "the most naive implementation
  possible" — total rework, but functioning as a v1.
- [ ] **F13 · BUG/UX · S — Time off: no edit after create; wants
  per-person filtering.** [15:45–17:05] Chronological insert-order is
  right. Also **unify the two time-off concepts**: availability
  time_off vs. the Schedule's older time-off (used for appointments)
  — same thing? Needs one model. `frames/0172_16-19.jpg`.
- [ ] **F14 · UX · S — Working hours: too much text; "Default" label
  confusing.** [17:10–17:58] The word "Default" appears beside every
  9–5 row and silently disappears if you set 9–5 manually — purpose
  unclear. Cleaner pattern wanted. `frames/0184_17-30.jpg`.
- [ ] **F15 · FEATURE · M — Sunrise/sunset as first-class time
  options.** [18:00–18:26] Any of these time fields (working hours,
  breaks) must accept sunrise/sunset — farm work is anchored to
  them. ↔ F17.
- [ ] **F16 · UX · M — Exceptions: wrong entry point + not editable.**
  [18:30–19:45] Exceptions will accrue into an unbounded backlog
  list. Primary entry point should be **the schedule day itself**
  ("modify Saturday's hours *on* Saturday"); the Availability page
  view is fine as the parity/overview side (pick a date → see its
  exceptions). Also can't edit an exception once created.
- [ ] **F17 · UX · S — Breaks: keep the concept (unrequested but
  fine); name must be editable; sunrise/sunset options.**
  [19:45–20:29] `frames/0213_20-06.jpg`.

## §3 · Color system

- [ ] **F11 · DESIGN · L — Category color identity has failed.**
  [12:30–15:00] Teal (chore) vs periwinkle (event) vs slate-blue
  (project) indistinguishable at 6-px-tall blocks 3 px apart; teal
  reads as the primary green. The style-guide hue grid itself looks
  broken (swatches missing/duplicated/gray). Direction: deeply
  configure the Tailwind palette so the full range (info / alert /
  warning / danger + category hues) is actually represented, then
  reassign category identity. **Time-sensitive:** Jim is starting to
  use the app; late color changes will fight learned habits.
  `frames/0139_13-18.jpg`, `frames/0149_14-10.jpg`.

## §4 · Animals (layers / broilers / sheep)

- [ ] **F20 · UX/DATA · M (~partly garbled) — Layers page.**
  [23:00–28:00] Four layer groups + age/count/arrived: good, mobile
  good. Bottom legend text ("orange bands are on farm…") → flat
  card. Group renaming wanted (deferred in-session); counts are
  arbitrary integers for now. **Lifecycle rules → processes:**
  pasture-move day ≈ 20 days post-arrival (calculated); processing
  day comes from a calendar (manual input); brooder clean-out must
  happen within ~a week of the birds leaving the brooder — these
  should populate the schedule via the existing process machinery.
  Egg data must average across batches cohabiting a coop.
- [ ] **F21 · DATA · L — A broiler batch spans many places over its
  life.** [28:10–30:30] Up to two brooders + five-plus tractors per
  batch (current: batch 5, single brooder). Need multi-place
  association per batch; per-bird tracking is impossible —
  generalization accepted.
- [ ] **F22 · BUG/UX · M — Broiler batch detail issues.**
  [30:30–32:25] (a) processing date, once filled, can't be edited by
  clicking — bizarre; (b) "7 chore changes scheduled around this"
  badge: verify it actually works ("very little faith"); (c) batch
  link should be implicit — the event can't exist without a batch;
  (d) cut sizes = a file upload attached to the processing-day page,
  not plain text; (e) final count + packing crates + notes: keep;
  (f) "4.7 weeks remaining" is incorrect; (g) batch created "12 to
  1 a.m." — creation rules need fixing.
- [ ] **F25 · UX · S — Chores duplicated on animal pages.**
  [34:06–34:30] "Chores should really just live in chores" — drop
  the per-animal chore lists (he may have asked for them; retract).
- [ ] **F26 · DECISION/QA · M — Verify broiler automations
  (processes) end-to-end.** [34:30–35:11] Rename "Automations" →
  process language. "Super super suspicious that this actually
  works" — needs a real verification pass. ↔ F29.
- [ ] **F24 · FEATURE · deferred — Feed schedule is being phased
  out.** [33:54–34:06] Replacement TBD; slot in later.
- [ ] **F27 · UX/DATA · M — Sheep page.** [35:11–36:07] Sheep are
  pets — no lifecycle stage. Place hierarchy: barn → sheep stall →
  sheep. Wrong icons (bird icon; paw wrong for sheep). Name, count,
  age, arrived — none editable; **all animal data must be user
  editable.** Page gets a later dedicated pass.

## §5 · Rounds / Processes

- [ ] **F28 · BUG · S (~garbled) — Rounds header sliver.**
  [36:21–37:00] Top of Rounds shows a stray "SUNSET — 0/13 done"
  fragment ("tricky to see", "why is that over there").
  `frames/0336_36-28.jpg`. Also (garbled): "flocks" is the wrong
  unit; and when closing rounds, the close button should perform the
  mark-as-done/finish action automatically instead of requiring a
  separate step.
- [ ] **F29 · QA · M — Processes: each of the seven steps must
  produce a bespoke chore; review correctness.** [38:51–39:04]
  Triage in a verification session ("may take some time"). ↔ F26.

## §6 · App shell / performance

- [ ] **F23 · PERF/ARCH · L — Local caching + state management.**
  [32:30–33:54] Flash of stale/deleted content on navigation;
  Schedule chores take ~5 s to recompute on every visit. Wants a
  proper cache layer with invalidation (react-query-style) so it
  feels like a modern app; keep the freshness-first model.
- [ ] **F30 · DESIGN · M — Current conditions into the header;
  Dashboard likely dies.** [39:45–41:13] Weather icon (just the
  icon) in the top toolbar; click → conditions card expands. Capture
  the "0 of 2 fold-out" pattern in the design system — don't lose
  that data-list. Broiler mini-tracker needs a home eventually.
  Dashboard has been superseded and will probably go away. Farm map
  + metrics: on hold. Now screen: good as-is.

## §7 · Overall

- [ ] **F31 · praise/direction.** [39:04–39:40] "Really moving in the
  right direction… once the schedule renders accurately and
  consistently with who's available, this is going to be a super
  valuable resource." Next focus: revisions to Schedule,
  Availability, layers, broilers, sheep.
