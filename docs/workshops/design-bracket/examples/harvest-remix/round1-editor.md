## 1. The leverage thesis in one line
Harvest exactly four cheap, data-honest patterns — the flush-card chrome, the needs-cover card, the now-marker, and the Lora/Inter heading pair — promote each to ONE app-wide primitive, and delete everything that needs assignment data the farm doesn't enter: the two-lane ribbon, both silhouettes, the week mini-spines, and the should-heat row all go, along with the entire `/rethinker` scratch.

## 2. The harvest ledger

| Addition | Verdict | Why (one line) |
|---|---|---|
| **Scratch pool — `RethinkerKit.jsx`** | | |
| `Eyebrow` | CUT | Duplicates the Inter eyebrow already baked into `Card`/`StatusPill`/`SubHeading`. |
| `LoadTrack`/`LoadMeter` (the lane) | CUT | The signature specimen — and the one with no real data; `resolveAssignee` is null for nearly every chore. |
| `NowRule` | PROMOTE | Already landed as `NowMarker`; make that the one shared now-divider. |
| `SealStamp` | RELOCATE | Earns its keep only on the Rounds `WrapCard` as the day/block seal; nowhere else. |
| `RoundsCheckbox` | CUT | `ChoreCheckRow` already IS the 28px box it was modeled on. |
| `DaySilhouette` | CUT | Height-by-item-count is a decorative restatement of a list you can already read. |
| `EventBand` | CUT (pool copy) | `Overview.TimelineRow` already draws the left-bar via `inset 2px` + `color-mix 9%`. |
| `NeedsCoverCard` | PROMOTE | The single best harvest — a real operator state (man-down) made unmissable. |
| `ConfirmCard` | TRANSFORM | Keep the draft→confirm *anchor* as a one-line bar, not a 3-paragraph card; no marketing prose. |
| `SourceChangeStrip` | CUT (pool copy) | The live ribbon was already restyled flush in place; the strip adds nothing. |
| `BlockCard` | CUT | Block chrome already exists in Schedule; a parallel shell is pure duplication. |
| `OutboxIndicator` | CUT (pool copy) | Real `components/OutboxIndicator.jsx` already ships. |
| `DesktopRibbon` | CUT | Hardcoded "market Tuesday"; the data-driven version is also cut (below). |
| `WeekSpines` (pool) | CUT | Hardcoded twin of the landed one, which is itself cut. |
| `SearchToAdd` | CUT | `AddToScheduleSearch` already exists. |
| `RethinkerGallery.jsx` + `sections.jsx`/`SectionContent.jsx` wiring | CUT | The gallery was the checklist; once harvested it's dead weight. Delete the nav item + case + both files. |
| **Landed reinterpretations** | | |
| `DayRibbon.jsx` | CUT | Its own header admits lanes are "deliberately sparse"; in prod it renders the empty-state most days. Decoration that ships blank. |
| `WeekSpines.jsx` (landed) | CUT | Draws the week a SECOND time, in a second visual language, off the same `week` object as the sidebar `WeekList`. NO-LEGACY says one must die — kill the new one. |
| `personLoad.js` (`buildPersonLanes`) | CUT | Exists only to feed the ribbon; data-gated to a near-empty result. |
| `weekShouldHeat` (in `weekView.js`) | CUT | The heat visualization is redundant — escalation already lives per-row in `ChoreCheckRow`. (`weekFullness`/`weekDays` predate the arc → KEEP.) |
| Schedule **needs-cover card** | PROMOTE | Lift out of `Schedule.jsx` into a shared `<NeedsCover>` primitive. |
| Flush attention **banners** | KEEP-IN-PLACE | Cheap, correct, already border-on-bg per §0a.3. |
| **Lora block headings** | PROMOTE | Fold into one heading convention app-wide (already half-present in Rounds/Chores). |
| `EventBand` left rail on `EventEntry` | KEEP-IN-PLACE | Unify with `TimelineRow`'s existing left-bar; same idiom, two call sites. |
| `NowMarker` component | PROMOTE | The shared now-divider for Schedule + Dashboard timeline. |
| `ScheduleSidebars` gradient deletion | KEEP-IN-PLACE | A deletion — exactly the right direction. |
| **Flush `Card` flip (implied app-wide)** | PROMOTE | One edit to `ui.jsx Card`: raised `bg-surface` → flush border-on-bg. The cheapest app-wide lever, and removing the raised interstitial IS subtraction. |

## 3. Wireframes of the remix

**A. Schedule desktop, after the cut — back to three honest columns (no ribbon, no spines)**
```
┌ left rail ──┐┌ center: the day ─────────────────┐┌ right: week ──┐
│ Morning   ✓ ││  ── Now · 9:40 ───────●──────────  ││ Sun 22   3    │
│ Midmorning  ││  Midmorning            2/8        ││ Mon 23   6    │
│ ‹you are    ││  ┌────────────────────────────┐  ││ Tue 24 ▸ 9 ●  │
│  here›      ││  │⚠ NEEDS COVER               │  ││ Wed 25   7    │
│ E. afternoon││  │ Wash eggs · House          │  ││ Thu 26   8 ⌁  │
│ L. afternoon││  │ James off-site til 1:00p.  │  ││ Fri 27   4    │
│             ││  │ Window 1:00–4:00.          │  ││ Sat 28   6    │
│ (the spine, ││  │ [ Jim covers — I've got it]│  ││               │
│  no wash    ││  └────────────────────────────┘  ││ ONE week, one │
│  gradient)  ││  □ Fill waterer   · 5 places     ││ language. The │
│             ││  ▣ Collect eggs                  ││ ⌁ = a should  │
└─────────────┘└──────────────────────────────────┘│  due that day │
                                                    └───────────────┘
```
The ribbon's whole horizontal band is gone. The week is drawn ONCE, in the sidebar `WeekList`, with a single `⌁` glyph on a day where a should comes due — the entire payoff of the should-heat row, reduced to one mark on a list that already exists.

**B. The one promoted `<NeedsCover>` primitive (mobile + desktop, identical)**
```
┌──────────────────────────────┐   flush: border + color-mix(warn 6%,
│ ⚠ NEEDS COVER                │   bg). NOT a raised surface-alt pane.
│ Wash eggs · House            │   Replaces ChoreCheckRow's raised
│ James off-site til 1:00p.    │   border-l-2/bg-warn/5 escalation tint
│ [ Jim covers — I've got it ] │   AND the old leakLine everywhere a
└──────────────────────────────┘   hole exists: Schedule, Dashboard, Rounds.
```

**C. Dashboard `Card` goes flush; now-marker lands on the timeline**
```
BEFORE (raised)            AFTER (flush)
┌─ bg-surface ───┐         ─ TODAY ──────────────  ← border-on-bg
│ ▦ TODAY        │         ▎Feed delivery   2:00p   ← TimelineRow left-bar
│  raised pane   │         ── Now · 9:40 ──●──────  ← shared NowMarker
│  on bg         │         ▎Collect eggs    3:00p
└────────────────┘         (no surface-alt lift)
```

**D. Rounds — `SealStamp` is the only relocated specimen**
```
┌─ WrapCard ─────────────────────────┐
│        7 / 7  done                  │  font-heading hero (already there)
│  ✓ Sealed · Jim 6:08–8:10 · 7/7    │  ← SealStamp, the one new thing
└────────────────────────────────────┘
```

## 4. How it handles the hard states
- **Empty/sparse:** the default, not an exception — because I cut every surface that needed dense assignment data to look alive (ribbon/lanes/silhouette). A quiet day reads as a short list, which is the truth.
- **Overdue:** stays per-row in `ChoreCheckRow`, but its raised `bg-warn/5` tint flips to the flush warn treatment so overdue reads the same everywhere; an overran must can escalate into the shared `<NeedsCover>` card.
- **Draft → confirmed:** the trimmed `ConfirmCard` becomes a one-line confirm bar at the day's head; once confirmed it collapses to the `SealStamp`. Never hidden.
- **Man-down/needs-cover:** the promoted `<NeedsCover>` primitive — the floor I most refuse to remove; it appears identically on Schedule, Dashboard, and Rounds.
- **Offline/unsynced:** untouched — `OutboxIndicator` + the per-row `CloudOff` queued glyph stay; both are real and on the must-see floor.
- **Dense day:** a long flat list, ordered by block, with the now-marker as the only divider — legible at 50 items precisely because nothing competes with it.

## 5. The duplicate-week-views resolution + /rethinker retirement plan
**Week views:** the sidebar `WeekList` (in `ScheduleSidebars.jsx`, fed by `weekFullness`) wins — it predates the arc and is wired into navigation. Delete `WeekSpines.jsx` and its render at `Schedule.jsx:2231`, plus the `shouldHeat`/`personLanes`/`daySilhouette` useMemos and the `<DayRibbon>` render. The should-escalation signal survives as a single `⌁` glyph appended to a `WeekList` row when `choreDaysRemaining` for that day is `today`/`overran` — computed inline from data the list already rolls up, so `weekShouldHeat` is deleted too.

**`/rethinker` retirement — exact steps (all in one batch, NO-LEGACY):**
1. Promote first, so nothing is lost: lift the needs-cover JSX out of `Schedule.jsx` into `src/components/NeedsCover.jsx`; confirm `NowMarker` is already shared; add `SealStamp` to the Rounds `WrapCard`; flip `ui.jsx Card` to flush.
2. Repoint `ChoreCheckRow`'s escalation tint to the flush warn treatment (delete the raised `border-l-2 border-warn bg-warn/5` branch).
3. Delete the cut files: `RethinkerKit.jsx`, `RethinkerGallery.jsx`, `schedule/DayRibbon.jsx`, `schedule/WeekSpines.jsx`, `lib/schedule/personLoad.js`, and `weekShouldHeat` from `weekView.js`.
4. Delete the two nav lines: `sections.jsx:127` and the `case "rethinker"` at `SectionContent.jsx:145`.
5. Delete `pasture-expanded.png` if it's stray arc scratch; grep for dangling imports of the removed modules and remove them; build green.

Nothing soaks; the gallery was the checklist and it dies in the same commit the patterns land.

## 6. The one bold bet
I delete the entire per-person two-lane ribbon AND the lane data model — the arc's marquee feature, the thing the other three designers will most want to "fix" or feed with better data. My bet is the opposite: the ribbon isn't under-fed, it's the wrong artifact for a 2-person farm where assignment is mostly implicit. No "close the data gap" project, no graceful-degrade lane — the file is gone. The per-person question is answered by the one card that matters, `<NeedsCover>`, which only ever appears when there's an actual hole to cover.

## 7. What it borrows / what it breaks
**Reuses:** `Overview.TimelineRow`'s existing `inset`-shadow left-bar (the EventBand was reinventing it); `ChoreCheckRow`'s 28px box (the `RoundsCheckbox` twin); the real `OutboxIndicator` and `AddToScheduleSearch`; `weekFullness`/`weekDays` and the sidebar `WeekList`; Rounds' `WrapCard`, hero `font-heading`, and `h-1.5` progress bar.
**Breaks (deliberately):** the raised `Card`/`PlaceSection` convention flips to flush in one `ui.jsx` edit (§0a.3 — and raised surfaces are the decoration I'm subtracting); `ChoreCheckRow`'s raised escalation tint is replaced by the flush warn treatment so escalation reads identically app-wide; and the entire ribbon/spine/silhouette/lane family is removed rather than maintained. The break I refuse to make: nothing that hides man-down, draft/confirmed, overdue, or offline — those four are the floor, and every one of them comes out of this with a *stronger*, single, shared representation, not a weaker one.