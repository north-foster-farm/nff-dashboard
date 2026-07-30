## 1. The leverage thesis in one line

The arc's value is not the ribbon — it's a **ten-piece primitive + two-rule token vocabulary** that already exists three-times-duplicated across the pool, the landed Schedule, and the prior app; promote it once into `ui.jsx`, repoint every surface to it, delete the copies, and the leverage is that Dashboard, Chores, Rounds and Schedule become one typeface of components instead of four dialects.

## 2. The harvest ledger

The two binding rules I extract first (everything else is built on them):

- **Rule FLUSH** — panes are `border border-line` on `var(--c-bg)`, never raised `bg-surface`. Attention fills are `color-mix(in srgb, var(--c-{token}) N%, var(--c-bg))`. One helper `flush(token, n)`.
- **Rule TYPE** — Lora `font-heading -tracking-[0.01em]` for any pane/section/block title; Inter `uppercase tracking-[0.12–0.16em]` for every eyebrow/label. No third option.

| Addition | Verdict | Why (one line) |
|---|---|---|
| `Eyebrow` (pool) | **PROMOTE** → `ui.jsx` | Canonical Inter label; replaces the ad-hoc uppercase spans in `Card`/`SubHeading`/`LABEL_CLS`/Rounds. |
| `LoadTrack`/`LoadMeter` (pool) | **CUT** | Hardcoded per-person twin of `DayRibbon`; dies with the scratch. |
| `NowRule` (pool) + `NowMarker` (landed) | **PROMOTE** → one `NowRule` | Two copies of the same hairline+dot+glow; collapse to one, gated by `viewingToday`. |
| `SealStamp` (pool) | **PROMOTE** → `ui.jsx` | The day/block "sealed · who · window · 7/7" anchor; Rounds `WrapCard` is its home. |
| `RoundsCheckbox` (pool) | **CUT** | `ChoreCheckRow`'s 28px button already IS this; factor that button out as `CheckTarget`, delete the pool copy. |
| `DaySilhouette` (pool) + landed `silhouette` | **PROMOTE** → `LoadSpine` | Height-encoded bars; one data-driven primitive, kills both copies. |
| `EventBand` (pool) | **TRANSFORM** → merge with `Overview.TimelineRow` | Overview already does the inset-shadow left-bar (`Overview.jsx:491`); converge the two into one `EventRow`. |
| `NeedsCoverCard` (pool) + landed Schedule card | **PROMOTE** → `Hole`/`CoverCard` | The amber-hatch flush obligation; supersedes `ChoreCheckRow`'s raised escalation tint app-wide. |
| `ConfirmCard` (pool) | **RELOCATE** → day-confirm anchor (no landed home yet) | The draft→confirmed affordance; belongs at the top of the day surface, not the gallery. |
| `SourceChangeStrip` (pool) | **TRANSFORM** → `AlertStrip` primitive | Generalize the "N changes since you confirmed" strip into the one flush warn-strip (also backs yesterday's-musts). |
| `BlockCard` (pool) | **TRANSFORM** → states fold into `Pane` | sealed/now/default are just `Pane` variants; don't keep a separate component. |
| `OutboxIndicator` (pool) | **CUT** | `components/OutboxIndicator.jsx` already real. |
| `DesktopRibbon` (pool) | **CUT** | Hardcoded literal of landed `DayRibbon`. |
| `WeekSpines` (pool) | **CUT** | Hardcoded literal of landed `WeekSpines`. |
| `SearchToAdd` (pool) | **CUT** | `AddToScheduleSearch` already real. |
| `segStyle`/`barStyle`/`HATCH_*` (pool) | **PROMOTE** → `lib/schedule/loadFill.js` | The token→inline-bg resolver every spine/heat bar needs; one home, JIT-safe. |
| `DayRibbon.jsx` (landed) | **TRANSFORM** → demote two-lane to single `LoadSpine` | Per-person lanes are data-gated vapor (see §6); keep the combined silhouette, make the split an overlay only when assignment exists. |
| `WeekSpines.jsx` (landed) | **TRANSFORM** → `WeekStrip` (one week view) | Becomes the single canonical week; absorbs `WeekList` (see §5). |
| `personLoad.js` (landed) | **KEEP-IN-PLACE** (scope-narrowed) | Honest lane builder; keep it, but it feeds the *overlay*, not the default spine. |
| `weekView.weekShouldHeat` (landed) | **KEEP-IN-PLACE** + promote ramp util | Real heat data; the warn→cat-processing ramp becomes a shared token function. |
| Schedule flush banners / Lora headings / gradient kill (landed) | **PROMOTE** | These are the FLUSH/TYPE rules already applied once — generalize them, don't leave them Schedule-only. |
| `RethinkerGallery.jsx` + nav wiring | **CUT** | Checklist, not destination; delete after promotion (§5). |

## 3. Wireframes of the remix

### A. Dashboard "Schedule at a glance" — flush Pane + LoadSpine + NowRule (the surface most changed)

Today it's a raised `Card`. After: flush pane, a `LoadSpine` strip giving the day's shape at a glance, `NowRule` threaded into the timeline.

```
DESKTOP                                            MOBILE
┌─ (no fill; border-line on bg) ───────────────┐  ┌────────────────────┐
│ SCHEDULE AT A GLANCE        ·eyebrow·  Tue 24 │  │ SCHEDULE AT A GLANCE│
│ ░▁▃█▅▂ ▁▃▇█ ▂  ← LoadSpine (block item count) │  │ ░▁▃█▅▂▁▃▇█▂  spine   │
│───────────────────────────────────────────────│  │────────────────────│
│ ▌ Farmers market   9:00–1:00  off-site (Jim)   │  │ ▌ Farmers market    │
│ ▌ Wash eggs        ⚠ needs cover  ← Hole strip │  │ ▌ Wash eggs ⚠ cover │
│ ── NOW · 9:40 ●━━━━━━━━━━━━━━━━━━━━  NowRule ──│  │ ─ NOW·9:40 ●━━━━━━ │
│ ▌ Midmorning round  2/8                         │  │ ▌ Midmorning 2/8    │
└────────────────────────────────────────────────┘  └────────────────────┘
```
`▌` = `EventRow` left-bar (the converged TimelineRow/EventBand). No `bg-surface`. The event rows keep their color-mix tint because that IS a flush fill.

### B. Flush chore row + Hole — Chores & Rounds (replaces the raised escalation tint)

```
BEFORE (ChoreCheckRow, raised)        AFTER (flush)
┌ border-l-2 bg-warn/5 ──────┐        ┌ flush(warn,6) + inset 1.5px warn + hatch ┐
│ ☐ Pressure-wash nest boxes │   →    │ ⚠ Pressure-wash nest boxes   overran      │
│   (raised amber pane)      │        │   ▦▦ Coop · should→must · Jim             │
└────────────────────────────┘        └───────────────────────────────────────────┘
normal rows: ☐  text, border-b border-line, NO bg-surface — sit on page
```
Same `CheckTarget` (28px) button factored out of `ChoreCheckRow`; the escalation state is now the shared `Hole` treatment, identical in Chores, Rounds, Dashboard, Schedule.

### C. The one unified WeekStrip (replaces WeekSpines center + WeekList sidebar)

```
DESKTOP (right sidebar navigator)         MOBILE (collapsible header)
┌ THIS WEEK ──────────────────────┐       ┌ THIS WEEK  Tue 24 ▾ ───────┐
│ Sun Mon Tue Wed Thu Fri Sat     │       │ S  M [T] W  Th  F  Sa       │
│  ▃   ▅  [█]  ▆   ▇   ▄   ▅  spine│       │ ▃  ▅ [█] ▆  ▇   ▄  ▅  spine │
│  ·   ·   ·   ·  proc  ·   ·      │       │ should-heat ▁▂▃▅█▁▁         │
│ heat ▁  ▂  ▃  ▅  █(Thu) ▁  ▁     │       └────────────────────────────┘
│ ── Tue 24 · today ────────────  │
│ 42 items · 5 blocks · 6 musts   │  ← the WeekList counts, folded in as
│ ✓ Confirmed · Jim                │    the selected-day footer (no 2nd panel)
└──────────────────────────────────┘
```

### D. Day-confirm anchor (ConfirmCard relocated, draft vs confirmed)

```
DRAFT                                  CONFIRMED
┌ flush(accent-deep,12) border ─┐      ✓ Sealed · James · 6:08–8:10 · planned
│ Ready to plan Tuesday?        │  →   (SealStamp, inline, no pane)
│ 42 items · 6 musts non-neg.   │
│ [ CONFIRM THE DAY ]           │
└────────────────────────────────┘
```

## 4. How it handles the hard states

- **Empty/sparse:** `LoadSpine` always populates from block item counts (real everywhere), so it never looks dead the way the assignee-gated two-lane does; per-person overlay simply doesn't draw.
- **Overdue:** the `Hole`/escalation treatment is one flush amber-hatch, identical token ramp in every list — overdue reads the same in Chores, Rounds and Dashboard.
- **Draft → confirmed:** the relocated `ConfirmCard` (flush accent-deep) is the draft state; confirming swaps it for the inline `SealStamp` — one anchor, two states, no separate widgets.
- **Man-down/needs-cover:** one `CoverCard` primitive (flush warn, one solid-amber action, "acknowledgment is the record") used by Schedule and surfaced on Dashboard; the hole closes green in the spine.
- **Offline:** the single real `OutboxIndicator` + `CheckTarget`'s `queued` `CloudOff` glyph; no second copy, identical on every surface that writes.
- **Dense day:** `LoadSpine` height saturates and the heat row carries the should-pressure; the demoted ribbon shows reservations + holes rather than fabricating per-person fullness it can't substantiate.

## 5. The duplicate-week-views resolution + /rethinker retirement plan

**Week views → one `WeekStrip`.** `WeekSpines` (center, silhouette language) and `WeekList` (sidebar, list language) read the *same* `week` object in two idioms — a textbook no-legacy violation. Collapse: build `WeekStrip` (spine + always-present heat row + clickable days) and fold `WeekList`'s text payload (item/block/must counts, confirm state) into its **selected-day footer**. It lives in the **right sidebar** slot only; remove the center-column `WeekSpines` render at `Schedule.jsx:2231`. Delete `WeekList` from `ScheduleSidebars.jsx:432`. One week, one place, one language.

**/rethinker retirement — exact order (promote, then delete; never delete first):**
1. Add primitives to `ui.jsx`: `Pane` (flush, replaces `Card`), `Eyebrow`, `Heading`, `NowRule`, `LoadSpine`, `EventRow`, `Hole`/`CoverCard`, `ConfirmCard`, `SealStamp`, `CheckTarget`, `WeekStrip`. Add `lib/schedule/loadFill.js` (`segStyle`/`barStyle`/`HATCH_*`/`flush()`/heat-ramp).
2. Repoint landed code to the primitives: `DayRibbon` (demoted to `LoadSpine` + reservation/hole overlay), `WeekSpines`→`WeekStrip`, Schedule's NeedsCoverCard→`CoverCard`, `NowMarker`→`NowRule`, banners→`AlertStrip`. Factor `ChoreCheckRow`'s button into `CheckTarget`.
3. Migrate the app-wide surfaces in the same pass (this is the leverage, not optional): swap `Card`→`Pane` and `StatTile`→flush in `Overview.jsx`; converge `TimelineRow`→`EventRow`; swap `ChoreCheckRow` escalation tint→`Hole`; Rounds `WrapCard`→`SealStamp`, `PlaceSection` `bg-surface`→`Pane`.
4. **Delete** `src/components/rethinker/RethinkerKit.jsx` and `src/pages/RethinkerGallery.jsx`.
5. **Delete** the nav item `src/sections.jsx:127` and `case "rethinker"` in `src/components/SectionContent.jsx:145`.
6. Grep for `bg-surface` on in-page panes to confirm nothing raised survived the FLUSH rule.

Nothing is kept "to be safe" — the gallery was the checklist; once §2's verdicts land, it's dead weight.

## 6. The one bold bet

**I kill the per-person two-lane as an app-wide ambition — the most photogenic landed artifact, demoted on purpose.** `DayRibbon` + `personLoad` lean on `resolveAssignee`, which is `null` for nearly every un-ruled chore, so the lanes are sparse-to-empty in production and would look broken if I spread them to Dashboard or Chores. The other three designers, running blind, will almost certainly lean *into* the ribbon or try to close the assignment-data gap to feed it. My systematizer call is the opposite: the reusable, always-true primitive is the **single combined `LoadSpine`** (block item count — real on every surface), with the per-person split kept only as an *overlay that draws when assignment data actually exists*. The lane is a Schedule-only luxury, never a system primitive. I am naming the place a pattern does **not** belong rather than cargo-culting it for the screenshot.

## 7. What it borrows / what it breaks

**Borrows (reuses, doesn't reinvent):** `ChoreCheckRow`'s 28px `w-7 h-7 border-2` button (→ `CheckTarget`); `Overview.TimelineRow`'s inset-shadow + color-mix left-bar (`Overview.jsx:491` — it's already half the EventBand, so the two converge into `EventRow`); Rounds' `font-heading` hero numbers, `h-1.5 bg-line` progress, and real `OutboxIndicator`; the `weekFullness`/`weekShouldHeat` data layer untouched; all existing tokens and both fonts (the brief confirms palette/typeface are already shared — the gap is vocabulary, not color).

**Breaks (departs, on purpose):**
- The raised `Card` (`ui.jsx:42`, `bg-surface`) → flush `Pane` on `var(--c-bg)`. This is the largest single change and touches every Dashboard pane, `StatTile`, and `PlaceSection`. Justified by FLUSH (§0a.3) — figure-ground now comes from borders, not interstitial surfaces.
- `ChoreCheckRow`'s raised `border-l-2 bg-warn/5` escalation → flush `Hole`. Same data, the system's amber, not a bespoke tint.
- `WeekList` deleted; `WeekSpines` center render deleted → one `WeekStrip`.
- `DayRibbon` two-lane → single `LoadSpine` + conditional overlay.

**Where I deliberately do NOT apply the patterns (anti-cargo-cult):** FLUSH is for in-page panes only — **floating overlays keep a raised surface** (Rounds `DoingSurface`, sheets, modals at `Rounds.jsx:427/914`) because a figure over a scrim needs figure-ground that a borderless flush card can't give. `NowRule` draws only on today-views (`viewingToday`). The should-**heat** row belongs on planning surfaces (Schedule week, Chores "all") and **not** on Rounds, which is execution, not planning. And per-person lanes, per §6, belong nowhere but Schedule until the assignment data is real.

Key files for implementation: `src/components/ui.jsx`, new `src/lib/schedule/loadFill.js`, `src/components/ChoreCheckRow.jsx`, `src/pages/Overview.jsx`, `src/pages/Rounds.jsx`, `src/pages/Chores.jsx`, `src/components/schedule/DayRibbon.jsx`, `src/components/schedule/WeekSpines.jsx`, `src/components/ScheduleSidebars.jsx`, `src/pages/Schedule.jsx`; delete `src/components/rethinker/RethinkerKit.jsx`, `src/pages/RethinkerGallery.jsx`, `src/sections.jsx:127`, `src/components/SectionContent.jsx:145`.