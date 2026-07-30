# Round 2 brief — coded hi-fi mockup-off

The bracket gated 4 harvesting strategies down to **2 survivors** that go to
coded mockups: **Systematizer** and **Operator**. This brief is binding for
Round 2.

## The premise (unchanged)

James added the Rethinker arc components as RAW MATERIAL to be HARVESTED and
remixed into the existing app — not finished components to keep as-is. The
question your mockup answers, made concrete and clickable: *"How do we best
leverage what's been added?"*

## The two surviving directions

- **Systematizer** — "one component vocabulary, applied app-wide." Distill the
  arc into a few flush/type primitives + tokens, promote them once, and repoint
  every surface so Dashboard / Chores / Rounds / Schedule read as one typeface
  of components. Lead tier: **desktop** (the workbench where consistency shows).
- **Operator** — "re-home the signals to where the decisions happen." The arc's
  value is field signal stranded on a desktop nobody stares at; relocate
  man-down / now / seal / day-load to the **phone Today glance** and inside the
  live **Rounds** run. Lead tier: **phone (390px)**.

Build YOUR direction only. The other is built in parallel by another agent;
James will open both side by side. Commit hard to your thesis — do not converge
toward the middle.

## The settled shared floor (BAKE INTO BOTH MOCKUPS)

Every Round-1 designer independently agreed on these. They are not in
contention — render them as the baseline both directions share, each in your
idiom:

1. **Flush, not raised.** Panes are `border` on `--c-bg`, never raised
   `--c-surface`. Attention fills are `color-mix(in srgb, var(--c-warn) N%,
   var(--c-bg))`. (Floating overlays/sheets/modals MAY stay raised — figure
   over scrim needs it.)
2. **One `AttentionCard`** primitive = the needs-cover card (amber-hatch hole
   treatment + ⚠ Inter eyebrow + work/place + prose reason + ONE solid-amber
   "{coverer} covers — I've got it" action). It also backs overdue + escalation.
   It supersedes `ChoreCheckRow`'s raised `border-l-2 border-warn bg-warn/5`.
3. **One `NowRule`** primitive (green 1.5px hairline + 7px resolved dot + glow +
   "Now · {time}" eyebrow), today-views only.
4. **Lora headings + Inter eyebrows** fold into the card header (font-heading
   `-tracking-[0.01em]` titles; uppercase `tracking-[0.12–0.16em]` Inter labels).
5. **One week view.** Delete the duplicate center `WeekSpines`; the wired
   sidebar `WeekList` survives and absorbs the week silhouette.
6. **`SealStamp`** (celadon ✓ "Sealed · who · window · 7/7") anchors the Rounds
   wrap card.
7. **Demote/cut the sparse two-lane person ribbon** — `resolveAssignee` is null
   for nearly every chore, so lanes render empty in production. Cut
   `personLoad.js` (the man-down hole already derives from `manDown.js`).
8. **Promote-then-delete** the `/rethinker` scratch (RethinkerKit +
   RethinkerGallery + the 2 nav lines) IN-BATCH, no soak (NO-LEGACY).

## Grafts carried in from the eliminated strategies (apply to both)

- From **Recombiner**: collapse `weekFullness` + `weekShouldHeat` +
  `personLoad` into ONE `farmLoad` data-walk + a shared `heatColor()` token
  function — the data collapse WITHOUT its risky 3-density god-component
  `LoadStrip`. Keep semantically-distinct quantities (completion fraction vs
  item-count load) visually kin but NOT the same widget. Person-lane survives
  only as a **conditional overlay** that lights on days with real
  reservation/hole data.
- From **Editor**: cost discipline — show the *cheapest-first* path (the lone
  `Card` flush-flip as step 1) and treat the full Overview/StatTile/PlaceSection
  migration as a deferrable follow-up, not all-at-once. The day-confirm is a
  one-line bar, not a marketing-prose card. Defend the four floor states
  (man-down, draft/confirmed, overdue, offline) — never hide them.

## Real tokens — inline these exact values (both themes must work)

Hand-write CSS keyed off `html[data-theme]`. Sharp corners (no border-radius on
cards). Tabular numerals for data. Functional color only — never decorative.
Load **Lora** + **Inter** from Google Fonts; body falls back to system-ui
(Nacelle is vendored, unavailable via CDN — system-ui is acceptable for a mockup).

```
DARK  (html[data-theme="dark"])
--c-bg #101614  --c-surface #151a15  --c-surface-alt #1d231e  --c-border #3e473d
--c-text #f2efe4  --c-text-dim #c4bfad  --c-text-muted #8e8877  --c-text-faint #6a6658
--c-accent #adc8ad  --c-accent-deep #297d5a  --c-warn #e6b85a  --c-resolved #4cba85
--c-project #7d9ec9  --c-on-accent #0d1410
--c-cat-processing #ff3347  --c-cat-fm #5dd585  --c-cat-egg #68d5fd  --c-cat-pickups #65cda2

LIGHT (html[data-theme="light"])  — the app's DEFAULT for James
--c-bg #f6f6f6  --c-surface #ffffff  --c-surface-alt #ececec  --c-border #d6d6d6
--c-text #14180f  --c-text-dim #2f3329  --c-text-muted #4d4a3e  --c-text-faint #6f6b5d
--c-accent #297d5a  --c-accent-deep #1d5a40  --c-warn #a06d10  --c-resolved #297d5a
--c-project #3f6da3  --c-on-accent #ffffff
--c-cat-processing #99000f  --c-cat-fm #2aa252  --c-cat-egg #0295ca  --c-cat-pickups #21ab4f
```

## What to render — the SAME comparable surface set in both mockups

One self-contained `index.html` at `mockups/<direction>/index.html`. A top
control bar with: a **theme toggle** (light default ↔ dark) and a **state
toggle** (Normal / Man-down / Overdue / Offline / Dense / Sparse-quiet-day) that
visibly changes the surfaces. Then these surfaces, each rendered in YOUR
direction's idiom (lead with your tier; show the other tier smaller):

1. **Dashboard "schedule at a glance"** pane (flush, with the day-load read +
   NowRule + the live counts / needs-cover trigger).
2. **Schedule day view** — show how the ribbon/spine/week resolves under your
   thesis (Systematizer: a system `LoadSpine` primitive + sidebar `WeekStrip`;
   Operator: ribbon gone, week folded into the sidebar list, desktop
   de-emphasized).
3. **Rounds run** (the doing surface) — flush `PlaceSection`, the in-run
   `AttentionCard` for man-down, the `SealStamp` wrap on completion.
4. **Chores list** — the escalation row treatment (flush/hatch, not raised).
5. **The week view** — your single resolved week (no duplicate).

Use REAL content: blocks Morning/Midmorning/Early-afternoon/Late-afternoon/
Evening; chores like "Fill waterers", "Collect eggs", "Pressure-wash nest
boxes", "Wash eggs"; places Coops / Chicken tractor 1 / House / Egg room /
Mobile Brooder; the two operators James + Jim; man-down example = "Wash eggs ·
Egg room — James off-site at market til 1:00p" with Jim as coverer.

Render the hard states for real via the state toggle — don't describe them in a
comment. End with an honest self-critique: where the mockup is weak / faked /
what it'd cost to ship.
