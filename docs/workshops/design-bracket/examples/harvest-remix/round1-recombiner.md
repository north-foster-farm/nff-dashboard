I have what I need. Here's my design as the RECOMBINER.

## 1. The leverage thesis in one line

Don't ship four refined Schedule widgets — fuse the silhouette, the should-heat, the person-lane, and the week-spines into **one `farmLoad` model and one `LoadStrip` primitive that renders at three densities** (glance / week / day), so the Dashboard, the week navigator, and the Schedule all speak a single "farm load" language — and the per-person lane becomes an *overlay that only lights up on the days it has real data*, never the base layer.

## 2. The harvest ledger

| Arc addition | Verdict | Why (one line) |
|---|---|---|
| **RethinkerKit `LoadTrack`/`LoadMeter`** (pool) | CUT | Hardcoded twin of the landed lane; dies with the gallery. |
| **`DaySilhouette`** (pool) | TRANSFORM | The seed of the unified primitive — becomes `LoadStrip density="glance"`, count-driven, not the 2-stack toy. |
| **`DayRibbon`** (landed) | TRANSFORM | Demote the person-lanes to an overlay; its silhouette footer becomes the shared `LoadStrip` base. |
| **`WeekSpines`** (landed) | TRANSFORM + RELOCATE | Becomes `LoadStrip density="week"` AND the *only* week view (eats the sidebar `WeekList`). |
| **`WeekSpines`/`DesktopRibbon`** (pool) | CUT | Mockup-literal duplicates; the checklist, not the destination. |
| **`personLoad.js`** | TRANSFORM | Folded into one `lib/load/farmLoad.js`; its honest-sparsity output drives the overlay, not the base. |
| **`weekView.js` (`weekFullness`+`weekShouldHeat`)** | TRANSFORM | Merged into `farmLoad` so count, heat, and lanes derive from one walk of the day. |
| **`weekShouldHeat` heat row** | PROMOTE | The should-escalation ramp becomes a reusable `heatColor()` token-function, used app-wide (Dashboard upcoming, Chores list). |
| **`NeedsCoverCard`** (landed, in Schedule) | PROMOTE | The single best card; promote to a real `AttentionCard` primitive (amber-hatch + ⚠ eyebrow + one solid action). |
| **`NeedsCoverCard`** (pool) | CUT | Duplicate. |
| **Amber-hatch hole treatment** | PROMOTE | Becomes the canonical "blocked/orphaned obligation" style — replaces `ChoreCheckRow`'s raised `bg-warn/5`. |
| **Flush card chrome** (Schedule banners) | PROMOTE | Replaces the raised `Card`/`PlaceSection` everywhere; the biggest app-wide lever. |
| **Lora headings + Inter eyebrows** | PROMOTE | Promote into `Card`'s header so every pane inherits it; delete per-page inline `h2`s. |
| **`NowMarker`** (landed) / `NowRule` (pool) | PROMOTE / CUT | Promote the landed one to a shared primitive; lands on the Dashboard timeline too. Pool copy cut. |
| **`SealStamp`** (pool) | RELOCATE | Move to Rounds `WrapCard` as the day/round seal — its only real home. |
| **`ConfirmCard`** (pool) | RELOCATE | Becomes the Schedule draft→confirm anchor (no landed home today). |
| **`EventBand`** (pool) | TRANSFORM | Unify with `Overview.TimelineRow`'s existing inset-left-bar into one `EventBar` — not a second pattern. |
| **`RoundsCheckbox`** (pool) | CUT | `ChoreCheckRow` already is this. |
| **`SourceChangeStrip`** (pool) | CUT | The live ribbon was already restyled flush; the strip earns nothing extra. |
| **`SearchToAdd`/`OutboxIndicator`** (pool) | CUT | Real equivalents exist (`AddToScheduleSearch`, `components/OutboxIndicator`). |
| **`BlockCard`** (pool) | CUT | Schedule's focused-block header already adopted Lora; no second card. |
| **`Eyebrow`** (pool) | CUT | Folds into the promoted `Card` header / `LABEL_CLS`. |
| **`RethinkerGallery.jsx` + `/rethinker` nav** | CUT | The checklist; deleted last (see §5). |
| **`ScheduleSidebars` gradient removal** | KEEP-IN-PLACE | Already correct (§4); nothing to harvest. |

## 3. Wireframes of the remix

**The one primitive — `LoadStrip`** (one component, `density` prop, one `farmLoad` model):

**A. Dashboard — `density="glance"`** (replaces the body of `TodayScheduleCard`)

Mobile:
```
┌ FARM LOAD · TODAY ───────────── Tue Jun 24 ┐   <- Card header (Lora+Inter)
│ 6a    9a    12p   3p    6p                  │
│ ▆▆ ▅ │███████████│ ▃ ███ ▄▄  ●NOW 9:40      │   <- one bar, blocks as
│ ▔▔heat: "Pressure-wash" warming → Thu ▔▔▔▔  │      segments, height=count
│ 42 items · 6 musts · 1 needs cover ⚠        │   <- live counts, tap→Schedule
└─────────────────────────────────────────────┘
```
Desktop: same bar, wider, hour ticks labelled; the "needs cover" count is a tappable `AttentionCard` trigger.

**B. The unified week view — `density="week"`** (the ONLY week view; sidebar `WeekList` deleted)
```
┌ THIS WEEK ──────────────────────────────────────────────┐
│ Sun  Mon  Tue·   Wed  Thu·proc  Fri  Sat                 │
│  ▃    ▅   ███     ▅    ▆▆▆       ▄    ▅      <- spines    │
│  3    9   24      14   26        10   18     (tabular)    │
│ ░░   ▒▒   ▓▓      ▒▒   ██▓       ░░   ░░      <- heat row  │
│ "Pressure-wash nest boxes" warming toward Thu processing │
└──────────────────────────────────────────────────────────┘
  click a day → that day loads in the center (was WeekList's job)
```
A spine click *is* the navigation the sidebar list used to provide. Each spine expands its block list inline on tap-and-hold / right-side caret for the "what's in it" the list gave — but the list pane is gone.

**C. Schedule day — `density="day"`, person-lane as OVERLAY**
```
┌ DAY LOAD ─────────────────── [ Load | +People ] toggle ┐
│ 6a   8a   10a   12p   2p   4p   6p                       │
│ BASE: ▆▆ ▅▅ │███████│ ▃ ███ ▄▄ ▄        ●NOW            │  <- always on
│ ······· (toggle People only when reservations/holes) ··· │
│ Jim   [Morning✓7/7][Midmorn 2/8 ]  [break][E.aft]        │  <- overlay
│ James [Prep✓][▨market 9–1 off-site][▨wash⚠cover][L.aft]  │     lanes
└──────────────────────────────────────────────────────────┘
```
Default view is the count-driven BASE (always populated). The person overlay auto-expands **only on days that carry reservations or man-down holes** (market day, day-off, sickness) — otherwise it stays collapsed behind a "+People" affordance so a normal sparse day never shows two empty lanes.

**D. Rounds — same `LoadStrip density="glance"` as the progress header** (recombination into Rounds)
```
┌ MIDMORNING · ROUNDS ─────────────────────────┐
│  2 / 8  done                                  │  <- Lora hero (existing)
│  ▆▆▆▆▆▆ ░░░░░░░░░░  <- LoadStrip = progress    │  <- SAME primitive,
│  segments fill green as you tick                  fed by completions
│  ✓ Sealed · Jim 6:08–8:10 · 7/7  (on wrap)    │  <- harvested SealStamp
└────────────────────────────────────────────────┘
```
Rounds' thin `h-1.5 bg-line` progress bar is replaced by the same `LoadStrip` — the bar you glance at on the Dashboard is literally the bar you fill in Rounds.

## 4. How it handles the hard states

- **Empty/sparse:** BASE is count-driven so it's *never* empty on a real farm day; person-overlay stays collapsed with "Quiet day — no time-off or cover needed," not two blank lanes.
- **Overdue:** the should-heat row burns `cat-processing` on the deadline day; an overran must promotes to an `AttentionCard` (amber-hatch), replacing `ChoreCheckRow`'s raised tint.
- **Draft → confirmed:** the `ConfirmCard` anchors the day; pre-confirm the `LoadStrip` segments render hollow/hatched-open, sealing solid on confirm — one visual state change, no second component.
- **Man-down/needs-cover:** the day-overlay auto-expands, the hole renders amber-hatch in the assignee's lane, and the promoted `AttentionCard` carries the one solid "{coverer} covers" action; on cover the hole closes green in the coverer's lane.
- **Offline:** `OutboxIndicator` sits in the `Card` header; queued segments carry the `CloudOff` mark; `LoadStrip` shows committed-but-unsynced as a hatched-edge segment, never silently mutates.
- **Dense day:** segments min-width clamp + tabular count badges; the silhouette compresses gracefully because height encodes count, so a 96-item block is a tall bar, not an overflow.

## 5. The duplicate-week-views resolution + /rethinker retirement plan

**Week views:** there is exactly one week view after this — `LoadStrip density="week"`, living where `WeekSpines` is now (top of center column). The right-sidebar `WeekList` (`ScheduleSidebars.jsx:432`) is **deleted**, not soaked: its only unique affordance was "click a day to navigate + see its block list," which the spine already does (click) plus an inline caret for the list. Per NO-LEGACY, `WeekList` and its imports go in the same commit that lands `LoadStrip`. The `week` object that fed both now feeds one component. The right sidebar reclaims that space for the `AttentionCard` stack (cover/source-change/overdue) — the things that actually need a persistent rail.

**`/rethinker` retirement — exact order (each step folds-in-and-deletes):**
1. Land `lib/load/farmLoad.js` (merges `personLoad.js` + `weekView.js` heat/fullness into one model); delete the two old lib files' now-dead exports.
2. Land `LoadStrip` (the 3-density primitive) + `AttentionCard` + `EventBar` + promoted `NowMarker`/`SealStamp` as real components in `components/`.
3. Repoint Schedule to `LoadStrip density="day|week"`; delete `DayRibbon.jsx`, landed `WeekSpines.jsx`, and the sidebar `WeekList`.
4. Repoint Dashboard `TodayScheduleCard` and Rounds progress to `LoadStrip`; promote flush-chrome + Lora/eyebrow into `Card`; delete `ChoreCheckRow`'s raised escalation tint in favor of `AttentionCard`.
5. **Last:** delete `src/components/rethinker/RethinkerKit.jsx`, `src/pages/RethinkerGallery.jsx`, and the two nav lines (`sections.jsx:127`, `SectionContent.jsx:145`). The gallery only retires once every `mapsTo` note has a real home — which steps 1-4 guarantee.

## 6. The one bold bet

**One model, one primitive, three densities — and the per-person lane is never the base layer.** The other three will almost certainly keep the silhouette, the spines, and the ribbon as *separate* polished components and argue about where each lands. I'm betting the leverage isn't in the components at all — it's in collapsing `weekFullness` + `weekShouldHeat` + `personLoad` into a single `farmLoad` walk and a single `LoadStrip` you see on the Dashboard, fill in Rounds, and scrub on the Schedule. The corollary bet, forced by the *real* sparse assignment data: the seductive two-lane ribbon is demoted to a conditional overlay, because a person-lane base layer would render empty on most production days and lose on glanceability the moment Jim reads it cold.

## 7. What it borrows / what it breaks

**Borrows (reuses):** `Overview.TimelineRow`'s existing inset-left-bar + `color-mix` tint (the de-facto EventBar — I unify into it, not alongside it); `ChoreCheckRow`'s 28px checkbox and `completions.toggle` outbox path (untouched); `Card`/`StatTile`/`StatusPill` shells (I upgrade `Card`'s header, keep its API); Rounds' Lora hero + `OutboxIndicator`; the existing tokens and `heatColor` ramp.

**Breaks (departs):** the raised `bg-surface` `Card` convention goes flush border-on-bg app-wide (§0a.3) — every pane shifts at once, no dual-source; `ChoreCheckRow`'s raised `border-l-2 bg-warn/5` escalation is replaced by the amber-hatch `AttentionCard`; the sidebar `WeekList` is deleted outright; the standalone `DayRibbon`/`WeekSpines` components are dissolved into `LoadStrip`. The departure is justified because keeping them separate is exactly the "transplant components" failure the brief's §0a forbids — the destination is *our* surfaces wearing one harvested vocabulary, not the mockup's widgets re-housed.