## 1. The leverage thesis in one line
The arc's real value is field-decision signal stranded on a desktop the operators never stare at — so harvest the *signals* (man-down, day-load, now, should-heat, seal) onto the phone Today glance and Rounds where James and Jim actually act, and **cut the two-lane ribbon outright** because it's desktop-only, assignment-starved, and useless one-handed.

## 2. The harvest ledger

| Addition | Verdict | Why (one line) |
|---|---|---|
| `DayRibbon.jsx` (landed two-lane ribbon) | **CUT** | `hidden lg:block` + `resolveAssignee`-null sparsity = a pretty desktop pane that's empty in production and unreadable with gloves on. |
| `buildPersonLanes` lane model (`personLoad.js`) | **TRANSFORM** | Drop the load lanes; keep only the `hole` derivation (assigned ∩ off-site) — the one assignment-driven signal that's real and decision-bearing — and feed it to a man-down alert. |
| Combined day silhouette (in DayRibbon) | **RELOCATE** | One bar/block, height=item count, is a genuine "how heavy is today" glance — belongs on the phone Today header and the Dashboard, not buried under a desktop ribbon. |
| `WeekSpines.jsx` (landed, desktop center) | **CUT** | Draws the week a second time in a second visual language next to the sidebar `WeekList` off the same `week` object — kill the duplicate. |
| Spine height-bars (the per-day silhouette idea) | **RELOCATE** | Fold a tiny inline spine into each existing `WeekList` row so the week is drawn once, in the sidebar where day-picking already lives. |
| `weekShouldHeat` (`weekView.js`) | **PROMOTE** | Real deferrable-deadline signal; keep the derivation, render it as a heat tick on the sidebar week rows (not a separate desktop strip). |
| Needs-cover card (landed in Schedule) | **RELOCATE + PROMOTE** | Man-down is a *field* event — promote it to a real `NeedsCoverCard` primitive and surface it at the top of phone Today and inside Rounds, not only on the desktop schedule. |
| `NeedsCoverCard` specimen (pool) | **PROMOTE** | Becomes the wired primitive above; the ⚠-eyebrow + single solid-amber action is the right shape for "a man is down." |
| `NowRule` / landed `NowMarker` | **PROMOTE** | Green hairline+dot+glow becomes a shared primitive; lands on the Dashboard timeline's current moment and the Rounds header — both lacked a "now." |
| `SealStamp` specimen | **RELOCATE** | The celadon ✓ seal is the natural anchor for the Rounds `WrapCard` (block done · who · time) — give it the home it doesn't have. |
| `ConfirmCard` specimen | **CUT (for now)** | No operator decision behind "confirm the day" on a 2-person farm; it's planning theater — don't build a home for it. |
| `SourceChangeStrip` specimen | **TRANSFORM** | The live source-change ribbon already exists (restyled flush); the Dashboard's existing "N changed" badge is the real equivalent — don't adopt the strip, keep the badge. |
| `EventBand` specimen + landed left-rail | **TRANSFORM** | Unify with `Overview.TimelineRow`'s existing inset-box-shadow left bar — one event-rail treatment app-wide, not two. |
| `RoundsCheckbox` specimen | **CUT** | `ChoreCheckRow` already *is* the 28px box it was modeled on; nothing to harvest. |
| `OutboxIndicator` specimen | **CUT** | Real `components/OutboxIndicator.jsx` already shipping in Rounds; the specimen is dead weight. |
| `SearchToAdd` specimen | **CUT** | Real `AddToScheduleSearch` already exists. |
| `DaySilhouette` / `LoadMeter` / `LoadTrack` / `BlockCard` specimens | **CUT** | Mockup-literal hardcoded twins of the landed (and now-cut) ribbon — they die with the ribbon. |
| Flush card chrome (border-on-bg) | **PROMOTE** | The biggest lever: replace the raised `Card`/`PlaceSection`/banner convention app-wide with one flush primitive. |
| Lora headings + Inter eyebrows | **PROMOTE** | Make `font-heading` titles + uppercase-tracking eyebrows the default on `Card` and every pane header. |
| Flush attention banners (landed) | **PROMOTE** | Border-on-bg warn banner becomes the shared banner; supersedes `ChoreCheckRow`'s raised `bg-warn/5` escalation tint. |
| `WASH_V` gradient deletion (ScheduleSidebars) | **KEEP-IN-PLACE** | Gradient already killed per directive; don't reintroduce. |
| `segStyle`/`barStyle`/`HATCH_*` helpers | **TRANSFORM** | Keep `barStyle` (token→inline-bg, JIT-dodge) + the amber `hole` hatch as shared style helpers; drop the rest. |

## 3. Wireframes of the remix

The three surfaces my strategy most changes: **phone Today glance**, **Rounds**, and the **unified week (sidebar)**. The desktop Schedule loses the ribbon and the duplicate spine; it is no longer the centerpiece.

### A. Phone "Today" — the operator glance (NEW lead surface, mobile)
This is where the harvested signals re-home. One-handed, top-to-bottom in tap-priority order.
```
┌─────────────────────────────────┐
│ FRIDAY · JUN 29        ⛅ 58°    │  Inter eyebrow + conditions
│                                 │
│ ── NOW · 9:40a ───────●╶╶╶╶╶╶╶  │  NowRule primitive (hairline+dot)
│                                 │
│ ⚠ NEEDS COVER                   │  NeedsCoverCard — ONLY when man-down.
│ Wash eggs · Egg room            │  Jumps to top; amber border-on-bg.
│ James is off-site at market     │
│ til 1p — eggs uncovered.        │
│ [ Jim covers — I've got it ]    │  one solid-amber action, fat tap
│                                 │
│ DAY LOAD                        │  relocated combined silhouette,
│ ▁▃█▆▂  ▂▅█▃        ███ man-down │  one row, height=item count;
│ morn mid  aft  eve   ^over-cap  │  the over-capacity block burns warn
│                                 │
│ MORNING  ✓ sealed 7/7  ·  Jim   │  block group; SealStamp when done
│ MIDMORNING        2/8           │
│   ☐ Fill waterers · 3 coops 0/3 │  ChoreCheckRow (unchanged engine)
│   ☐ Pressure-wash nest boxes    │
│       optional today            │  should = italic, NOT raised tint
│ ⤓ open Rounds for Midmorning →  │  deep-link to the doing surface
└─────────────────────────────────┘
```

### B. Rounds — flush chrome + cover + seal (mobile, the real doing surface)
```
┌─────────────────────────────────┐
│ MIDMORNING        ☁ 1 queued    │  OutboxIndicator (already loud here)
│ 2 / 8 done            0:14  ✕   │  hero count (kept); now-aware header
│ ▓▓▓░░░░░░░░░░░░░░░░░             │  progress bar (kept)
│ ── NOW · 9:54a ──●╶╶╶╶╶╶╶╶╶╶╶   │  NowRule promoted into the run header
│                                 │
│ [ Everywhere ][ Coops ][ Past ] │  PlaceSwitcher (unchanged)
│                                 │
│ ⚠ NEEDS COVER                   │  cover card surfaces IN the run too,
│ Wash eggs — James off-site      │  not just on schedule
│ [ Jim covers ]                  │
│                                 │
│ COOPS                  2/5 done │  PlaceSection — FLUSH (border-on-bg),
│   ☑ Fill feeder · CT1           │  was raised bg-surface
│   ☐ Fill waterer · CT1          │
│   ☐ Collect eggs · CT2          │
│   [ Mark all done ]             │
└─────────────────────────────────┘
        … run finishes …
┌─────────────────────────────────┐
│         ✓ MIDMORNING SEALED     │  SealStamp anchors the WrapCard
│            0:41 · Jim · 8/8     │  (its first real home)
└─────────────────────────────────┘
```

### C. Unified week — sidebar only (desktop). The duplicate dies.
The center-column `WeekSpines` is deleted. The spine + should-heat fold *into* the existing sidebar `WeekList` rows, so the week is drawn **once**.
```
DESKTOP right sidebar (the only week):
┌──────────────────────────┐
│ THIS WEEK                │
│ Sun 22   3   ▁▂▁         │  inline mini-spine per row
│ Mon 23   8   ▃▄▂         │  (height = block item counts)
│ Tue 24 ● 14  █▆▃ ▄▂  ◀   │  ● today, selected = framed
│ Wed 25   9   ▃▄▂  ░      │  should-heat = a single tick cell
│ Thu 26   12  ▆█▃  ▓ proc │  warming → deadline burns cat-proc
│ Fri 27   5   ▂▃▁         │
│ Sat 28   7   ▄█▂         │
└──────────────────────────┘
```

## 4. How it handles the hard states
- **Empty/sparse:** no lanes to look empty — the day-load strip degrades to a flat low bar and reads "light day"; needs-cover and seal simply don't render. (This is the whole reason the ribbon is cut: sparsity was *its* failure mode, not the glance's.)
- **Overdue:** an overdue must surfaces in the block group with the flush warn banner treatment (border-on-bg), not the old raised `bg-warn/5`; Rounds' live-overrun `+Nm` stays.
- **Draft → confirmed:** dropped — no confirm anchor on a 2-person farm; a block is "sealed" only by completion (SealStamp), which is the real state operators recognize.
- **Man-down / needs-cover:** the headline state — `NeedsCoverCard` jumps to the top of phone Today *and* into the live Rounds run, with one solid-amber "{coverer} covers" action; the day-load strip burns that block warn.
- **Offline / unsynced:** `OutboxIndicator` keeps its loud Rounds placement and gains a slot in the Today header; cover/seal/load are pure display, so they render identically offline.
- **Dense day:** the day-load strip shows tall bars across all blocks (the at-a-glance "today is heavy" read); block groups scroll; the strip is the triage tool that the desktop ribbon pretended to be but couldn't, because it works on the phone.

## 5. The duplicate-week-views resolution + /rethinker retirement plan
**Duplicate week:** delete `src/components/schedule/WeekSpines.jsx` and its render at `Schedule.jsx:2231`. The sidebar `WeekList` (`ScheduleSidebars.jsx:432`) becomes the single week. Fold the harvested patterns *into* its rows: a per-row inline mini-spine (height = `weekFullness` block counts) and a single should-heat tick cell (from `weekShouldHeat`). `weekShouldHeat` and `weekFullness` survive; the standalone desktop strip does not. One week, one visual language, NO-LEGACY.

**`/rethinker` retirement — order matters (patterns must live in real components first):**
1. Promote the flush card chrome + Lora/Inter into `ui.jsx` `Card` (and apply to `Overview`, `Rounds` `PlaceSection`, `Chores`).
2. Add a real `NowRule` primitive; wire it into `TodayScheduleCard` and the Rounds header.
3. Promote `NeedsCoverCard` to a wired primitive (fed by the `hole`/man-down derivation kept from `personLoad.js`); render on phone Today + in Rounds.
4. Add the day-load strip (relocated `daySilhouette`) to phone Today + Dashboard `Schedule at a glance`.
5. Put `SealStamp` on the Rounds `WrapCard`.
6. Fold spine + heat into `WeekList`; **delete `WeekSpines.jsx`** + its Schedule render.
7. **Delete `DayRibbon.jsx`**, the `personLanes`/`daySilhouette`-as-ribbon memos in `Schedule.jsx`, and trim `personLoad.js` to the hole derivation only.
8. Now the gallery checklist is fully re-homed → **delete `RethinkerKit.jsx` + `RethinkerGallery.jsx`**, and remove the two wiring lines (`sections.jsx:127`, `SectionContent.jsx:145` `case "rethinker"`).

## 6. The one bold bet
**Kill the two-lane person ribbon entirely** — the arc's signature specimen (#13) and the thing the other three designers will almost certainly try to rescue or "make data-rich." I'm betting the opposite: per-person lanes are a planner's fantasy on a farm where `resolveAssignee` is null for nearly every chore, and a desktop-only one at that. The only honest, decision-bearing thing it ever rendered was the man-down hole — so I extract *that one signal* into a phone-first NeedsCoverCard and throw the rest of the ribbon away. No "fix the assignment data so the lanes fill" detour; cut first, harvest the one real signal, ship it where a man-down is actually seen.

## 7. What it borrows / what it breaks
**Borrows (reuses as-is):** `ChoreCheckRow` (the completion engine is untouched — the remix only restyles its container and moves escalation to the flush banner), `Overview.TimelineRow`'s inset-box-shadow event rail (becomes the one EventBand treatment), the existing `components/OutboxIndicator.jsx` and `AddToScheduleSearch` (so their specimens are cut), `weekFullness`/`weekShouldHeat` (kept, re-pointed at the sidebar), the Rounds `WrapCard`/`PlaceSection`/`AllDoneButton` structure, and `barStyle`/the amber `hole` hatch as shared style helpers.

**Breaks (departs, on purpose):** the raised `Card`/`PlaceSection`/banner convention → flush border-on-bg everywhere (the directive's "start from there"); the desktop Schedule as the load centerpiece → phone Today becomes the glance, the desktop ribbon and duplicate week are deleted; `ChoreCheckRow`'s raised `border-l-2 border-warn bg-warn/5` escalation → flush warn banner; "confirm the day" → dropped (no operator decision behind it). Theme: every harvested piece is built on the shared tokens with functional-only color and sharp corners, so it reads in James's default **light** as well as the mockup's dark — the silhouette/heat carry meaning by height and warn-alpha ramp, not by a dark-only fill.