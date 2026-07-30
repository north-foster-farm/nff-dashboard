# Schedule Feature — Design Bracket Brief (Round 1 input package)

**What this is:** the input package for the **Design Bracket** on the
Schedule feature (per `../design-workshops/design-bracket-playbook.md`).
Round 1 = the **wireframe-off**: four design stances each produce low-fi
wireframes of the hero screens + hard states. Scope is **settled** — this
Bracket designs the surface, not the model.

**Identical across all four agents.** The only intended variable is the
stance.

---

## PART A — Bracket framing

You are one of **four designers** in a Design Bracket on the new
**Schedule** feature for NFF Dashboard. The three others run in parallel
and blind; you cannot see them. James will view all four wireframes side
by side and narrow the field to ~two before anyone writes polished code.
**Commit hard to your stance** — do not hedge toward a safe middle; the
other stances supply the balance.

This is **Round 1 (wireframes)**: low-fidelity, structure-and-hierarchy
only. **No color systems, no polish, no pixel-pushing.** We are comparing
*bones*, not skins. An entry that secretly hi-fis Round 1 has broken the
funnel. The strong wireframes advance to a coded hi-fi Round 2.

---

## PART B — SCOPE: BINDING, DO NOT REOPEN

The model is settled (full detail in `scope-document.md` — read it). The
design questions are yours; the scope questions are **closed**. The binding
model:

- **One `commitments` timeline.** The unit is a *commitment* — a claim on a
  block of someone's time (a chore-block, an event, a project node, an
  ad-hoc task/note, a reservation/buffer). Day/week/month are **zooms of one
  timeline**; "Calendar" is that timeline filtered to events (the wide
  zoom) — there is **one surface, one door**, not a separate Calendar app.
- **Store deltas, derive the draft.** The day auto-populates as a **draft**
  recomputed every load from chores + projects + events; only *departures*
  (pulled should-chores, overrides, ad-hoc adds, reservations) are stored.
  Clearing them regenerates the pure draft.
- **Whole-day, one-tap confirm.** Each morning the day is a draft; one tap
  **confirms** it. Musts render as non-negotiable; confirming is agreeing
  the discretionary work + dropping the accountability anchor. A confirmed
  day is a durable record.
- **No user-facing parent-concept word.** The UI shows one flat notion
  ("what's on the day"); never surface "activity/commitment/entry" as a
  label Dad has to learn.
- **One completion truth.** Ticking a chore here is the same write as in
  Rounds/Now (offline-safe via the outbox). Tapping a chore *block* opens
  the existing **Rounds** takeover to execute it.
- **Accountability = time, never leaderboards.** Show each person's **start
  time** and overrun; never a per-person who-did-more scorecard.
- Events reschedule only via a this/all-future prompt — never an ad-hoc
  schedule-local tweak.

You may **not** redesign the model. If a screen forces a scope question,
**flag it** for James — don't solve it by changing scope.

---

## PART C — HERO SCREENS (design these four)

You cannot mock the whole feature. Design the **four surfaces where the
interaction model lives or dies**:

1. **Phone — Today view (THE field tier, highest value).** Dad's
   one-handed, in-the-field day: the integrated day (chore blocks, events,
   project work, reservations) as a glanceable, tickable plan, with the
   now-marker and forward focus. This is the screen most likely to decide
   the winner.
2. **Desktop — the timeline + week workbench.** The one-timeline render
   with day/week/month **zooms**; where James composes — drags to
   rebalance, adds via search, sets the projects-only window.
3. **The confirm + man-down moment.** How the day reads as a **draft** vs
   **confirmed** and the one-tap confirm; and how a **man-down** conflict
   surfaces and gets resolved (the covering person acknowledges).
4. **Search-to-add.** Adding a one-off task / a specific chore / a project
   node / an event — including chore-name **dedup + narrowing** ("Fill
   waterer" appears once, then pick the place).

---

## PART D — STATES TO DESIGN (the hard ones, not the happy path)

Every hero screen that can show these must show them. **Designing the real
states is the highest-leverage thing you do here.**

- **Draft vs confirmed** — the day before and after the one-tap confirm.
- **Now-marker + forward focus** — where we are in the day; earlier-today
  (done/missed) dimmed-but-present; next is loudest.
- **Done / in-progress / remaining** — a block partly ticked.
- **Should→must escalation** — a should-chore pulled onto today with a
  "why today" reason and emphasis rising toward its hard deadline.
- **Man-down / conflict** — a person off-site with an assigned chore in
  that window; the covering-person acknowledgment.
- **Event + buffer** — a market at a clock time with a 1-hour setup buffer
  reserved before it.
- **Offline / unsynced** — a tick queued but not yet synced (`CloudOff`).
- **Source-changed-after-confirm** — "1 change since you confirmed —
  review" (surfaced, never auto-applied).
- **Dense, overflowing day** (use the real day in Part F — it's full) and
  the rare **empty-but-valid** day.

---

## PART E — DESIGN SYSTEM TO USE (read these; match THIS app)

Do not invent a component library or use a generic dashboard kit. Read and
match:

- **Tokens / theme:** `src/styles.css` — Tailwind v4 `@theme` with semantic
  colors (`bg`, `surface`, `surface-alt`, `line`, `fg`, `dim`, `muted`,
  `faint`, `accent`, `accent-deep`, `warn`, `resolved`), category colors
  (`cat-chore`, `cat-egg`, `cat-deliveries`, `cat-processing`, …), fonts
  (**Nacelle** body, **Lora** headings, **Inter** UI), and the sky-aqua +
  celadon palettes.
- **Components** (`src/components/`): `PageHeader`, `CommandPalette` &
  `PlaceSearch` (the search-to-add precedent), `QuickActionsTray` (the
  field quick-log tray), `BlockBadge`, `ChoreRemainingPill`,
  `BatchStatePill`, `ModifierBadge`, `PlaceTag`/`PlaceTree`,
  `OutboxIndicator` (the offline glyph), `CalendarViews` (the event surface
  being absorbed), `EmptyState`.
- **Neighbors to match** (`src/pages/`): `Rounds.jsx` (the field execution
  takeover the Schedule feeds — match its row/checkbox/feel),
  `Overview.jsx` (`buildTimelineItems` — the day-timeline being replaced).
- **Prior mockup form:** `.ignored/calendar-rail-mockup.html` (standalone
  HTML is the proven low-friction mockup format here, for Round 2).
- Icons: `lucide-react`.

---

## PART F — REAL CONTENT (populate with THIS; identical across stances)

**Today is a busy market day. Both James and Jim are on. Now ≈ 9:40 AM —
the midmorning block is in progress. The day is already CONFIRMED, but one
source change just arrived (a feed delivery moved to today).**

The farm's day runs in **5 blocks**: **Morning** (sunrise ~6:00),
**Midmorning** (~9:00), **Early afternoon** (~1:00), **Late afternoon**
(~4:00), **End of day** (~7:00). Real owners/places: **Brooder 1**,
**Mobile Brooder**; **Chicken Tractors** (broilers, on pasture, 3
occupied); **Mobile Coops 1 & 2** (layers); the **sheep** (at the barn);
the **house** (egg work); **cold storage**.

- **Morning — DONE.** Jim started **6:08a**. Brooders & tractors: *Fill
  waterer*, *Fill feeder*; *Move chicken tractor to fresh grass*; Mobile
  coops: *Open mobile coop*, *Fill feeders*, *Fill waterers*; sheep: *Fill
  waterer*. All ticked.
- **Midmorning — IN PROGRESS (now-marker here).** Brooders: *Fill
  waterers/feeders* ✓. **Remaining:** Tractors *Fill waterer/feeder*;
  Coops *Fill waterers*, *Fill feeders*, **Collect eggs**; house *Clean egg
  washer*. **[SHOULD, escalating]** *Pressure wash nest boxes and coop
  interior* — pulled onto today, **why today: "last clean before
  processing Thu"**, emphasis rising. One tick (*Collect eggs, Coop 2*) is
  **queued offline / unsynced**.
- **Event — Farmers market, 9:00 AM**, with a **1-hour buffer 8:00–9:00**
  (setup). The chore *Load farmers market equipment into vehicle* (tent,
  crates, tables, cash box, coolers — a real checklist) auto-scheduled
  before it. **James is assigned the market, off-site 8:00–1:00.**
- **Early afternoon.** Brooders & coops: water/feed. **House: *Wash eggs* —
  assigned to James → MAN-DOWN** (James is at the market until 1:00; needs
  Jim to cover + acknowledge). **Project (projects-only window): *Clearing
  — remove brush piles from D pasture*, Jim, ~1.5h.**
- **Late afternoon.** Brooders/coops water/feed; coops *Collect eggs*,
  *Raise perches*, *Fill grit*, *Fill oyster shell*; tractors *Fill
  feeder*; house *Wash eggs*.
- **End of day.** Coops *Close mobile coop*, *Lower perches*, water/feed;
  tractors *Fill waterer/feeder*; house *Pack eggs into cartons*, *Add
  cartons to inventory*; cold storage *Refrigerate eggs*.
- **Reservations:** Jim — **break 12:00–12:30** (lunch). James — **off-site
  8:00–1:00** (market).
- **Source change since confirm:** *feed delivery* moved to today → "**1
  change since you confirmed — review**."

Use the real operators' names (**James**, **Jim**) and these real chore
titles. No lorem ipsum.

---

## PART G — Device tiers

- **Phone = field-first.** One-handed, gloves, sun, **offline**. Dad's
  comprehension is usually the axis that picks the winner. Glanceable,
  tickable, the next thing obvious.
- **Desktop = the planning workbench.** Week/month composition, search-to-
  add, drag-to-rebalance, the projects-only window, the conflict list.

---

## PART H — Tone, output format, bans

**Tone:** no buzzwords ("seamless/intuitive/clean/modern/polished") — show
it, don't claim it. Real content, real density (design the *full* day in
Part F, not three tidy rows). Get the domain nouns right (chicken tractor,
mobile coop, brooder, broiler/layer).

**Output format — emit EXACTLY these headings (Round 1 wireframe):**

```
## 1. The design in one line
(Your stance's core bet for this feature, one sentence.)

## 2. Wireframes
(Per hero screen: a labelled ASCII/box layout — mobile AND desktop where it
spans tiers. LOW-FI: structure, hierarchy, regions only. Annotate what each
region is and how it behaves.)

## 3. The key interaction moments
(The 3–5 taps/transitions that define the feel; what happens, briefly.)

## 4. How it handles the hard states
(One line each: draft→confirmed, now-marker/forward-focus, should→must
escalation, man-down + ack, event+buffer, offline/unsynced,
source-changed-after-confirm, dense day, empty day.)

## 5. The one bold bet
(The single thing your design commits to that the others probably won't.)

## 6. What it borrows / what it breaks
(Which existing components/patterns you reuse; where you depart and why.)
```

**Universal bans:** no scope changes (flag, don't redesign the model); no
lorem ipsum (use Part F); no inventing components not in Part E; no
bluffing (read the real files); **no happy-path-only** (design Part D's
states). Your final message IS the wireframe — no preamble.
