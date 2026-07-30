# The Design — Overnight + Project blocks

**Status:** SETTLED 2026-06-26. Output of the Design Bracket (4 wireframe
stances → gate → 3 coded mockups → Dad reserve lens → James's final call).
**Winner: Direction 1 — Convention ("the new blocks ARE blocks"), de-hatched**,
plus James's tweaks + the grafted hinge + both-free emphasis. This is the
build reference for implementation.

**Visual source of truth:** `mockups/ovnp-convention/index.html` (the winning
coded mockup) — apply the four amendments in §2 before/while building.
**Reads with:** `overnight-project-blocks-scope.md` (binding scope/DoD),
`overnight-project-blocks-bracket-round1.md` (the four wireframes + gate),
`overnight-project-blocks-bracket-round2-brief.md` (the three directions).

---

## 1. Why Convention won

The Bracket's deciding axis was **Dad's field comprehension at 4 a.m.**, and
the Dad reserve lens was decisive on the running mockups:
- **Convention reads fastest** — project gaps are their own labeled bars on
  the day-strip ("11–1 · Jim free", "2:30–4 · both free"); open time + who's
  around is legible without reading.
- **Minimalist's seams hid project time so well Dad "would never know it
  existed"** (durable confusion, not first-use friction), and its two-page
  end-cap risked reading as **"do the heat-lamp check twice."**
- **Flow's strip rungs were too subtle** — he'd ignore the strip and lean on
  the list; its traveling-marker animation is also real build cost.

Convention also has the **lowest build cost** (reuse the gauge tier, the
overview row, the block-detail panel, the ring/fill marker) and the smallest
diff to the shipped surface — which fits the scope's "v1 = zero migration,
light" intent. It honors James's Q4 (empty block = passive note, no confirm
gate) while keeping project time **visible**, which is where Minimalist's
restraint went too far for *this* feature.

---

## 2. James's four amendments to the winning mockup

These modify `ovnp-convention/index.html`'s treatment; everything else in
that mockup stands.

### 2.1 De-hatch the project gauges (Dad's fix)
The mockup drew project gaps as **crosshatched** bars. Crosshatch reads as
"blocked / no signal / off" — it fights the "this is free time" meaning. Ship
instead a **soft, plainly-different solid fill** (the project base color,
§2.2) with the label **on/under the bar**, keeping the **coarse-duration
sizing** (taller/longer = a longer gap). The gauge says "open time, this
long," not "unavailable."

### 2.2 Project blocks get a distinct base color (NOT the primary green)
Project/open time must not share the chore green. **The real constraint James
named: the app's palette is thin and its semantic + category color slots are
mostly assigned** (accent green = chores/primary; sky-aqua = egg;
honey-bronze = deliveries; fuchsia = processing/farm-visits; celadon/turf/tea
= other categories). So this is twofold:
- **RESOLVED 2026-06-26: slate-blue.** After a 5-candidate swatch pass in both
  themes (`mockups/ovnp-swatches/index.html` + `…-swatches-light/index.html`),
  James picked **A — slate-blue** (calm, clearly not-green, no category/warn
  collision in either theme). Shipped as a real token:
  - **`--c-project`** in `index.html` — dark `#7d9ec9` (slate-blue-400), light
    `#3f6da3` (slate-blue-600); **`--color-project: var(--c-project)`** mapping
    in `src/styles.css` `@theme` (so `bg-project` / `text-project` /
    `border-project` work).
  - New **`slate-blue` 50–950 decorative ramp** in `styles.css`.
  - James also asked to add **`periwinkle` 50–950** to the palette ahead of a
    use ("I'm sure it will find a use") — added as a ramp, no semantic mapping
    yet (the app's first violet ramp).
  - `npm run build` green after the additions. (Working-tree changes:
    `index.html`, `src/styles.css`; not yet committed.)
- **Project gauge fill** uses the project color as a soft solid/gradient;
  empty-but-available uses an outlined/tinted project-color treatment (per
  §2.1 de-hatch). De-hatched, never crosshatch.

### 2.3 Overnight segment icons encode the two-day direction
Replace the moon glyph on the Overnight segment with a **clock-with-arrow**
that shows which way the shift points:
- **Start day** (Overnight is the LAST segment, continues into tomorrow):
  **`ClockArrowRight`**.
- **End day** (Overnight is the FIRST segment, continued from last night):
  **`ClockArrowLeft`**.
- **RESOLVED 2026-06-26:** `lucide-react` was updated **0.462.0 → 1.21.0**
  (James: "I live without fear of my dependencies"). The major bump is
  **non-breaking for this app** — all **122** icons in use still exist, and
  `npm run build` is green (2284 modules, no errors; only the pre-existing
  chunk-size warning). `ClockArrowRight` / `ClockArrowLeft` **now exist**, so
  James's original right/left choice ships as-is. (Working-tree change:
  `package.json` + `package-lock.json`; not yet committed.)

### 2.4 Name project blocks by KIND + state, not by time-of-day
The mockup mislabeled gaps "Late morning / Midday / Early evening." That's
wrong: **chore blocks are globally user-defined so they have stable
time-of-day names; project blocks shift into whatever gap exists**, so a
time-of-day name is unreliable. James offered three options (project name on
spine / "Project" + busy-free subtitle / "Free"-or-"Busy"). Resolution:

- **Block kind label = "Project"** in the agenda row + detail header, with the
  **time range retained** (e.g. "Project · 11:00–1:00"). The range is reliable
  and already shown.
- **The project NAME lives in the ITEM row, not the block title** (it already
  does in the mockup — "Clearing — remove brush piles"). This dodges the
  long-name-on-the-spine problem entirely and supports a block holding several
  items.
- **Empty vs occupied is conveyed by content,** not a "busy/free" word: an
  occupied block shows its items; an **empty** block shows the passive note
  ("free — nothing planned"). **Avoid titling the block "Free"/"Busy"** —
  "Free" collides with the **who's-free** badge (work-planned-state vs
  person-availability are different axes; two "free"s in one row is the
  durable confusion to avoid).
- **Spine segment** = a distinct **project glyph + start-time label** (like
  chore segments, which rely on glyph + time, not a full name) in the §2.2
  project color.
- **CONFIRMED 2026-06-26:** James went with this recommendation ("Project ·
  <range>" + project name in the item row + empty passive note; not
  "Free"/"Busy" title).

---

## 3. The decision spec (the full build reference)

**Navigator (spine/strip — `ScheduleSidebars.jsx`).**
- Chore blocks: **unchanged** — count-sized load gauge, sun glyph, start-time,
  done-fill, ring=now / fill=focus. (Honors the deferred proportional rewrite.)
- Project blocks: a segment in the gap, **coarse-duration-sized** soft-fill bar
  in the **project color** (§2.2), distinct project glyph + start-time +
  on-bar "FREE · Jim / · both" label. Empty-but-available still renders
  (chore blocks hide when empty; project blocks do not). A **nobody-home** gap
  is **absent** (no segment).
- Overnight: one segment drawn at **both strip ends** — last on the start day,
  first on the end day — with the **clock-arrow icon** (§2.3) and the now-ring
  landing on it before sunrise (the **hinge**: `pickNowBucket` wrap +
  `startKey` pinning it first on the end day — both already in the scope's
  "done"). The standalone "walk the night" teaching rail in the mockup is
  **NOT shipped**; the real hinge is the placement + the now-ring on both day
  pages.

**Center (overview agenda + detail — `Schedule.jsx`).**
- Overview agenda: chore rows unchanged; **Project rows** = "Project · range"
  + who's-free badge + items (or the empty passive note); **Overnight section**
  = last on the start day / first on the end day, same items, the clock-arrow
  icon, "counts tonight" shown (start-day-only count).
- Project block detail: the **auto-pulled top-project step as a swappable
  default occupant** (display-only, writes nothing on open; first project
  block only); **"+ Add"** (project step / ad-hoc) **auto-routes by time**;
  completing an item **updates the underlying project step**; **NO done/seal
  pill, NO "Open rounds."**
- Overnight detail: items tickable (each by its kind), **NO rounds, NO seal,
  exempt from man-down/double-book/squeeze chrome**; a tick toggles the **one
  shared row** (done on both day pages at once); offline shows the `CloudOff`
  glyph; cold cache shows **"syncing…", never a false-empty**.

**Who's-free.** Quiet badge for one person ("Jim free"); the **both-free
window is the loud one** (the scarce two-hand-job resource). Underlying data
stays **structured `{freeCount, who}`** so "both free" is a branch, not a
parsed string (Maximalist's graft).

**Empty block.** Shows emphasized with a passive "free — nothing planned"
note; **never gates confirm** (James's Q4). Distinct from a nobody-home gap
(absent).

---

## 4. Grafts pulled in (named, not silently absorbed)

- **The hinge** (from Flow-first) — the two-day Overnight as one shared
  segment the now-ring crosses at midnight; the best-in-field answer to "one
  shift, not a duplicate." Applied to Convention via the clock-arrow icons +
  the now-ring on both day pages.
- **Both-free emphasis + who's-free restraint** (from Minimalist/Flow) — loud
  only for the both-free window; quiet otherwise.
- **Structured availability `{freeCount, who}`** (from the Scope Workshop's
  Maximalist reserve note) — kept under the badge.

## 5. Not pulled forward

- **Minimalist's seam** (project time too quiet — Dad would miss it) and its
  two-page end-cap (duplicate-overnight risk). Its *who's-free restraint* IS
  grafted; its *demotion of project time* is rejected.
- **Flow's strip rungs** (too subtle) and its **literal traveling-marker
  animation along the strip** (build cost; the hinge ships as placement +
  now-ring, not a continuous DOM animation).
- **Convention's own "walk the night" teaching rail** (the agent's honest
  note: a teaching device, not the product).
- **Crosshatch fill** for project gauges (reads "blocked" — replaced by a
  soft solid fill, §2.1).

## 6. Open items before/at build — ALL RESOLVED

1. ~~Project hue~~ — **RESOLVED: slate-blue** (§2.2). `--c-project` +
   slate-blue & periwinkle ramps added; build green.
2. ~~Overnight icon~~ — RESOLVED (lucide → 1.21.0; `ClockArrowRight`/`Left`).
3. ~~Project naming~~ — RESOLVED ("Project · <range>", name in the item row).

**The Design is fully settled. Next stage: implementation** — follows the
scope doc's definition of done + its §7/§8 risks; the load-bearing
engineering is the `rollupChoresForDay` **sparse→total** rewrite +
neighbor-day reads + `segmentForStart`, none of which the mockups exercised.

**Uncommitted working-tree changes already made (this design phase):**
`package.json` + `package-lock.json` (lucide 0.462→1.21), `index.html` +
`src/styles.css` (the `--c-project` token + slate-blue/periwinkle ramps).
Build is green; nothing committed.

**Next stage: implementation** (per the scope doc's completion criteria).
