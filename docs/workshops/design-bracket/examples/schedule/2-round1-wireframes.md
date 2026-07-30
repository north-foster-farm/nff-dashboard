# Schedule Design Bracket — Round 1 (wireframe-off) + the Gate

**Status:** Round 1 complete 2026-06-24. Four design stances produced
low-fi wireframes of the four hero screens against the shared dense day
(`design-bracket-brief.md` Part F). This file records all four + the gate
analysis. James narrows 4 → ~2 for the coded Round 2.

---

## The gate at a glance

A clean safe→bold spread. Each stance found a genuinely different answer to
the same question — *how do you show a 40-item market day on a phone in the
field?*

| Stance | Core bet | Reads the day as |
|---|---|---|
| **Convention-follower** | one block = one collapsed **Rounds row**, never calendar tiles | a Things "Today" list / GCal day view |
| **Flow-first** | **"now" is a fixed waterline**; ticking *seals* a block and lifts the next through it — completion advances the thread | a kinetic thread scrolling under a fixed focus band |
| **Minimalist** | **exactly one block open at a time**; everything else is one collapsed line | a single-open accordion the day fills |
| **Rethinker** | the day's primary form is its **load silhouette** — 5 blocks × two person-lanes as committed/open bars | a glanceable day-shape, drill only where you are |

### Scored against the Bracket criteria (playbook §11)

| Criterion | Convention | Flow-first | Minimalist | Rethinker |
|---|---|---|---|---|
| Glanceability (day-shape in one look) | med | med (shows *now*, not whole shape) | low–med (whole day hidden) | **high** (load silhouette) |
| Tap-cost (field high-freq) | low | **lowest** (next tap always same place) | low | low–med |
| State coverage (the hard states) | **high** | high | high (floor defended) | high |
| Fits design system / build cost | **high / lowest** (pure reuse) | med (custom scroll + motion) | high (mostly reuse) | **low / highest** (new load-meter + ribbon; needs durations) |
| Comprehension / Dad | **high** (familiar) | med (novel scroll) | **high** (one thing at a time) | med (must learn the bars) |
| Distinctiveness | low | high | med–high | **highest** |

### How they relate (the real shape of the field)
- **Convention-follower is the safe baseline** — maximal reuse, lowest
  build cost, lowest surprise; the floor every bolder idea is measured
  against. Its discipline (one block = one Rounds row; reuse `ChoreCheckRow`/
  `PageHeader`/`CommandPalette` verbatim) is a **backbone every direction
  should keep**, not really a competing *look*.
- **Minimalist ↔ Rethinker is the sharp structural debate** — opposite
  answers to density: *hide everything but now* vs *show the whole day's
  shape at once*. They are the most-different, most-distinctive pair, and
  between them they bracket the feature's stated purpose ("stop chores
  stringing through the day; make the shape visible") against its field
  reality ("calm, one-handed, in the sun").
- **Flow-first is a graftable interaction layer.** Its innovations — the
  tick→seal reward loop, the fixed-waterline forward-focus, jump-to-now —
  are largely *orthogonal* to the others' structures and could be grafted
  onto whichever wins. Its waterline is essentially a kinetic forward-focus
  over what is still a list.

### Orchestrator recommendation
Advance the **sharpest opposed pair to coded hi-fi: Rethinker + Minimalist**
— the two most distinctive, most-different structural bets, so the coded
round is a real test of *day-shape-glance* vs *calm-one-thing-at-a-time*
(and whether Dad parses the load bars is exactly the kind of question only
a running mockup answers). Carry two grafts into both:
- **Flow-first's** tick→seal feedback + jump-to-now motion.
- **Convention-follower's** strict component reuse (the build-cost backbone)
  + its conflict-as-Problems-panel and Sunsama-style confirm banner.

**The live alternative for James:** if you'd rather A/B a bold idea against
a *safe* one (lower risk, guaranteed-shippable), swap Minimalist →
**Convention-follower** and keep Rethinker as the bold contender. Pick the
pair you actually want to see built.

---

## Round 1 — full wireframes

### Stance 1 — Convention-follower

**One line:** the Schedule is the existing Overview timeline promoted to a
full page — a Things/Todoist "Today" checklist on phone, a GCal day view on
desktop, where one chore-block is one collapsed Rounds row, the morning
Confirm is a Sunsama plan-your-day banner, and every state reuses a
component Dad has already seen in Rounds and Now.

**Phone Today (hero):**
```
┌─────────────────────────────────────────────┐
│ Today  Tue Jun 24        [✓ Confirmed 6:08a]│
│ Market day · James + Jim on                  │
├─────────────────────────────────────────────┤
│ ⚠ 1 change since you confirmed — Review ›    │
├─────────────────────────────────────────────┤
│ ☀ Morning            ✓ 7/7   Jim 6:08a  ▾   │ collapsed+dimmed (done)
├─────────────────────────────────────────────┤
│ ⛺ 8:00–9:00  Setup buffer (market)          │
│ ▌Farmers market        9:00 AM · James off  │
│═══════════════ now · 9:40 ═══════════════════│ now-line + jump-to-now
│ ◐ Midmorning   IN PROGRESS   3/9   [Run ›]   │ next block: loud, expanded
│   ☐ Tractors · Fill waterer                  │
│   ☐ Coop 2 · Collect eggs   ⊘ queued         │ CloudOff
│   ▣ Pressure wash nest boxes   [SHOULD ›]    │ accent-deep + warn pill
│     why today: last clean before processing  │
├─────────────────────────────────────────────┤
│ ⛅ Early afternoon       0/8   1:00          │
│   ⚠ Wash eggs · House — needs cover [Cover ›]│ man-down inline
│   ◆ Clearing — remove brush piles, D pasture │ project (italic)
├─────────────────────────────────────────────┤
│ 🌇 Late afternoon  0/11 4:00 ▸   🌙 End 0/9 7:00 ▸ │
│ Jim · break 12:00–12:30                      │
└─────────────────────────────────────────────┘  [ + Add to today ]
```
Past = collapsed+dimmed; next block is the only one expanded and carries
`[Run ›]` → the Rounds takeover. Desktop = GCal day view with **two
hardcoded person-lanes** (James/Jim), drag-to-rebalance, a linter-style
Conflicts panel (prev/next). Confirm = Sunsama banner. Search = the
`CommandPalette` + `PlaceSearch` dedup→place-narrow.

**Bold bet:** one block = one collapsed row, not a wall of calendar tiles —
the Schedule is a thin planning skin over Rounds.
**Borrows:** `PageHeader`, Rounds `PlaceSection`/`ChoreCheckRow`/
`row-active-dim`, `BlockBadge`, `ChoreRemainingPill`, `OutboxIndicator`,
`CommandPalette`/`PlaceSearch`, `EventScopePrompt`, Overview `TimelineRow` +
`cat-*` colors, `EmptyState`. **Breaks:** no per-chore calendar tiles; no
team grid (2 lanes); confirm is a plan gesture not "create event"; buffers/
reservations as quiet protected bands.

---

### Stance 2 — Flow-first

**One line:** the day is a single vertical thread under a fixed "now"
waterline — ticking physically advances the thread (the finished block
seals and floats up, the next thing rises into focus).

**Phone Today (hero):** `Now` is pinned ~⅓ down; the day slides *under* it.
```
┌──────────────────────────────────┐
│ Today · Tue Jun 24      ⌕    +    │
│ ✓ Confirmed 6:08a  Jim → James    │ confirm anchor strip (start times)
│ ⚠ 1 change since you confirmed  → │
│ ⚑ 1 needs cover — Wash eggs     → │
│            ↑ earlier today        │ ABOVE waterline: dim, sealed
│  ▸ Morning        done 6:08–8:10  │
│  ▸ Market 9:00a   James off → 1:00│
│═══ NOW · 9:40 ═══════ [⊙ jump] ═══│ ◀ FIXED waterline (day scrolls under)
│  ┌ Midmorning            4 / 9 ──┐│ THE LIVE BLOCK: loud, progress bar
│  │ ▓▓▓▓▓░░░░░░░  (animates)      ││
│  │ ☐ Tractors  fill waterer     ││
│  │ ☐ Coop 2    collect eggs  ☁  ││ CloudOff queued
│  │ ‼ Pressure-wash nest boxes   ││ should, escalating
│  │   why today: last clean ...   ││
│  │  [   Open rounds  →   ]       ││ → Rounds takeover
│  └───────────────────────────────┘│
│  ▸ Early afternoon       1:00p    │ BELOW: future, quiet
│     ⚑ Wash eggs · James → cover   │
│     ▦ Clearing brush, D pasture   │
└──────────────────────────────────┘
```
The signature is the **tick→seal transition**: box fills `bg-resolved`
instantly (optimistic, outbox-backed), count + bar animate; the last tick
seals the block (collapses up, stamps its worked window) and the next block
rises through the waterline and lights up. "You can see the day get shorter
above you." Reduced-motion fallback = plain scroll, instant state. Desktop =
two-person columns with the now-line across both + week rail (bar height =
fullness). Confirm = a top→bottom sweep settling draft→agreed.

**Bold bet:** "now" is a fixed waterline and ticking advances the thread —
forward-focus as *motion*, not just dimming.
**Borrows:** Rounds wholesale (28px checkbox, `bg-resolved`, `h-1.5`
progress bar), `OutboxIndicator`/`CloudOff`, `QuickActionsTray`,
`CommandPalette`/`PlaceSearch`, `EventScopePrompt`. **Breaks:** the document
scroll (live band pinned, day moves under); suppresses non-live progress
bars; keeps tick/offline/source-change deliberately boring (local-state
only) so motion never costs a tick.

---

### Stance 3 — Minimalist

**One line:** one screen shows only the block you're in and the next thing
after it; everything else is a single collapsed line you tap to open, so the
dense day reads as four lines, not forty rows.

**Phone Today (hero):**
```
┌────────────────────────────────┐
│ Today · Wed Jun 24      ✓ 7:12a│
│ ░░░ 1 change — review ░░░░░░░░░│ ribbon (only if any)
│ ▸ Morning            done 6:08a│ collapsed past: ONE line, dimmed
│ ▸ Market setup       James off │
│ ● MIDMORNING        now 9:40a  │ the ONLY open block, loud
│   Jim · started 9:04a          │
│   ☐ Tractors — fill waterer    │
│   ☐ Coops — collect eggs       │
│   ☑ Coop 2 — collect eggs  ⛅off│
│   ☐ House — clean egg washer   │
│   ┌──────────────────────────┐ │
│   │ ! Pressure-wash nest box │ │ the ONE boxed row (border thickens
│   │   before processing Thu  │ │  toward deadline)
│   └──────────────────────────┘ │
│   3 of 9 done                  │
│ ▸ Next: Early afternoon  1:00p │ collapsed future: ONE line
│   ⚠ Wash eggs needs cover      │ man-down leaks ONE line up
│ ▸ Late afternoon         4:00p │
│ ▸ End of day             7:00p │
└────────────────────────────────┘  [⌄ jump to now]  [+]
```
**Accordion: exactly one block open at a time, "now" decides which.** The
40-row day = 4 region lines + ~9 actionable rows. Only three things break
the collapse: the source-change ribbon, the should→must box, and a one-line
man-down leak. Desktop = the phone screen + a thin persistent day-rail spine
+ a drag grip; week = a **vertical day-list with fullness bars + flag
glyphs**, not a 7-col grid. Confirm = one bottom bar naming the deal →
collapses to a header timestamp.

**Bold bet:** refuse to render rows you can't act on yet; the desktop
workbench is emphatically *less* than a calendar app (BD43's champion).
**Borrows:** Rounds row/checkbox + block-header→takeover, `BlockBadge`,
`ChoreRemainingPill`, `OutboxIndicator`/`CloudOff`, `PlaceSearch`,
`EmptyState`. **Breaks:** the timeline metaphor (no time gutter/grid); week
is a day-list not a grid; accepts that seeing the whole day at once takes
deliberate taps.

---

### Stance 4 — Rethinker

**One line:** the day is a vertical spine of the farm's 5 blocks, each a
two-person load-meter (committed vs open time); the now-block opens into a
Rounds checklist while the other four stay collapsed to their load bars — so
you read the day's *shape and who's-slammed-when* in one glance.

**Phone Today (hero):**
```
┌──────────────────────────────────┐
│ Tue Jun 24 · market day       ⚓  │
│ DAY  ▓▓▓▓▓▓▓░░░  CONFIRMED        │ DAY BAR = whole-day load + confirm
│ Jim ▷6:08a · James ▷— · 5 blocks │
│ ⚠ 1 change since confirm — review│
│ ☀ MORNING                  DONE ▽│ collapsed station, past, dimmed
│   Jim ▓▓▓▓▓ · James ▓▓(mkt)  7/7✓ │ split load bar
│ ◐ MIDMORNING            ◀ NOW  △ │ OPEN station, loud
│   Jim ▓▓▓░ · James ▓▓▓▓ off-site │
│ ───────────────────── now 9:40 ──│
│   Chicken Tractors               │
│   □ Fill waterer / □ Fill feeder │ tap row → Rounds takeover
│   Mobile Coops                   │
│   ✓ Collect eggs · Coop 2  ☁off │
│  ┌──────────────────────────────┐│
│  │▲ Pressure wash nest boxes    ││ should, escalating, boxed
│  │  why today: ... · due 2d ▲▲  ││
│  └──────────────────────────────┘│
│   — James · off-site (market) ───│ lane divider in-block
│   ▣ Farmers market        9:00 🚩│ + buffer 8–9 reserved
│ ☀ EARLY AFTERNOON               ▽│ collapsed future
│   Jim ▓▓▓▓▓ · James ▒hole← cover │ MAN-DOWN = a HOLE in James's lane
│   ⚠ Wash eggs needs cover  →ack  │
│ ☀ LATE AFTERNOON ▽  🌙 END OF DAY ▽ │
└──────────────────────────────────┘  [＋ add]  jump↧
```
Desktop = a **horizontal two-lane ribbon**: the market is a long segment
eating James's Midmorning→Early-afternoon, and the man-down is a **visible
hole** in his lane with a `↘cover` arrow into Jim's; a bottom LOAD strip is
the day's silhouette. Week = mini-spines per day + a **should-escalation
heat row** glowing toward Thu processing.

**Bold bet:** the day's primary representation is its *load silhouette*, not
its line items — wins on glanceable day-shape + person-load comprehension.
**Honest costs:** worse at per-item scan (rows hidden until opened); fill is
an *estimate*; the phone lane is too narrow for a true two-lane ribbon (one
split bar instead). **SCOPE FLAG (not solved):** load-bar fill needs a
**per-commitment time estimate**; if chore definitions lack durations, fill
falls back to item-count — a data dependency for James to confirm.
**Borrows:** `BlockBadge`, Rounds row feel + `initialBlockId` deep-link,
`OutboxIndicator`/`CloudOff`, `CommandPalette`/`PlaceSearch`, `EmptyState`,
`ChoreRemainingPill`. **Breaks:** the vertical agenda metaphor; introduces a
**new load-meter component** + the two-lane ribbon (the kit lacks both).
