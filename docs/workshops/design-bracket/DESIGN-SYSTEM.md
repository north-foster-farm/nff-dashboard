# NFF Schedule design system — derived from the Rethinker

_Source of truth: `examples/schedule/mockups/rethinker.html` ("the
load-silhouette spine"). James, 2026-06-28: "the look and feel of this
page is exactly what I want for the basis of our schedule's look and
feel… think of these components as the foundation of patterns we will
adopt and reuse across the app, starting with the schedule." Where any
earlier styling request contradicts this system, the system wins (his
explicit instruction)._

## 0a. James's correction (video audit, 2026-06-28_12-28-45)

**Extract patterns, don't transplant the component.** Porting the
LoadMeter as a literal component on the page was the right move *to
introduce the component architecture* — but it is NOT the destination.
The goal is to **analyze the mockup's styles/patterns and reinterpret
them into OUR existing components.** Same visual language, our behavior.
("Blend the styling and design language from this mockup and reinterpret
it into our own components.") The standalone LoadMeter + specimen were
therefore removed; what we keep is the *vocabulary* below, applied to
real schedule UI.

Concrete directives from the video:
1. **The "hole / needs cover" pattern** (amber border + 45° hatch) is a
   keeper — adopt it for REAL holes in our schedule. Our live
   "Fill waterers needs cover — James off-site till 3:15" row (today a
   janky text line + a "COVER" outline button) should become the
   mockup's **Needs-cover card**: ⚠ "Needs cover" eyebrow, the work
   ("Wash eggs · House"), "Who can cover?", and a single amber solid
   **"JIM COVERS — I'VE GOT IT"** button; the hole itself drawn with the
   amber-hatch treatment. (The horizontal load-bar around it is NOT
   needed — just the hole + card.)
2. **Card language to adopt everywhere it fits:** hairline border, Lora
   heading, Inter eyebrow, the generous padding / margin / negative-space
   proportions, the border + button styles. "Looks the same, doesn't
   necessarily behave the same."
3. **Flush, not raised.** The mockup's cards sit **on the page
   background, defined by their border** — they are NOT raised-surface
   interstitials with a different bg. Our "N changes since you
   confirmed" / "Yesterday — N must-dos" / confirm banners read as raised
   `surface-alt` panes; flatten them toward border-defined-on-bg. "I want
   to start from there."
4. **Kill the gradient.** The `WASH_V` dawn→night wash on the DayRailSpine
   (`div.absolute.inset-0` linear-gradient) — "it's gotta go." (Done.)
5. **Process:** walk the *entire* schedule, map each mockup concept to
   our component, and apply the styling — this is the systematic pass.

## 0. The big realization

The mockup is **built on the app's existing tokens and fonts** — it says
so in its own header ("Tokens + fonts pulled from src/styles.css /
index.html"). So the gap between today's Schedule and the Rethinker is
**NOT** the palette or the typefaces — those already match. The gap is:

1. **Information architecture** — the day is read as a *load silhouette*
   split **per person** (Jim vs James), not as a block-name list.
2. **The component vocabulary** — a small set of distinctive primitives
   (the load-meter lane above all) that don't exist in the app yet.
3. **Aesthetic execution** — sharp bordered cards, hairline rules, Lora
   used prominently for headings, Inter eyebrows, dense data rows.

So this is a **structural refactor**, not a recolor. (My earlier
afa484a "amber now + green/blue block tints" pass was reverted — it
contradicted the system below: the Rethinker's now-marker is a green
hairline, and it codes load by *person lane*, not block-type tint.)

## 1. Foundations (already in the app — reuse, don't reinvent)

- **Color tokens** (`index.html` per-theme + `src/styles.css` @theme):
  `bg / surface / surface-alt / line / fg / dim / muted / faint /
  accent / accent-deep / warn / resolved / project / on-accent` + the
  `cat-*` event hues. The Rethinker uses ONLY these — no new colors.
- **Type roles** (`--font-heading` Lora, `--font-body` Nacelle,
  `--font-ui` Inter). All three already load.
- **Sharp corners**: the app already avoids `rounded-*` on cards
  (styles.css note). The Rethinker is 100% sharp — keep it.

## 2. Aesthetic principles (what makes it read as "the Rethinker")

1. **Hairline everything.** 1px `border-line` frames; the now-marker is
   a 1.5px rule, not a fill. Borders do the work that shadows/tints did.
2. **Lora for headings, used big and confidently.** "Today" / block
   names / section titles in Lora bold, tight tracking (`-0.02em`). This
   is the single biggest "feel" lever and it's nearly free.
3. **Inter eyebrows everywhere.** Uppercase, 10–11px, `tracking-[0.14em]`,
   `font-semibold`, in `faint`/`muted` or an accent. Labels like
   `DAY LOAD`, `NOW · 9:40A — FORWARD FOCUS`, `READING THE LOAD BAR`,
   `CHICKEN TRACTORS · ON PASTURE`. They structure the page.
4. **Tabular numerals for all data** (`[font-variant-numeric:tabular-nums]`,
   the `.ow` class). Times, counts, ratios.
5. **Color is functional, not decorative.** Green = ours/done, amber =
   attention (hole/man-down/queued), celadon `cat-fm` = an event owning
   time, red `cat-processing` = the heavy/critical day. A reader decodes
   state by hue; nothing is colored "for looks."
6. **Restraint.** Mostly greens + neutrals on near-black; the warm/amber
   and celadon accents are spent sparingly, which is what makes them pop.

## 3. The component vocabulary (build these as reusable primitives)

### 3.1 Load-meter lane — THE signature
A person's slice of a block as a fill on a fixed-capacity track. Read
length = "how heavy"; stack two lanes (Jim/James) = "who's slammed."
```
.lane        flex row: [42px name] [flex track] [meta]
.lane-name   Inter 11px 600 uppercase tracking .04em, muted
.lane-track  h≈13px, bg surface-alt, inset 1px ring, overflow hidden
.seg         a width-% fill, 320ms width transition
  seg-done       solid resolved (#4cba85 / light #297d5a)
  seg-committed  solid accent-deep        (locked work)
  seg-open       45° hatch of accent      (discretionary / a "should")
  seg-event      45° hatch of cat-fm      (an event reservation)
  seg-hole       amber inset ring + faint amber hatch (assigned but off-site)
.lane-meta   Inter 11px 600 dim, right-aligned ("7/7", "mkt", "hole")
```
→ React: `<LoadMeter lanes={[{name,segments:[{kind,pct}],meta}]} />`.
This is the primitive to build first; it's reused on the spine, the day
silhouette, the desktop ribbon, and the week mini-spines.

### 3.2 Day-load silhouette
A compact row of per-block two-stacks (top = Jim, bottom = James), height
= load. The "whole day in 9px-tall bars" overview. Same color language as
the lane segments. Drives the phone day-bar and the desktop combined
strip.

### 3.3 Block card
Bordered card (`border-line`, sharp). States:
- **collapsed / past** — name (Lora) + two load lanes; dimmed
  (`opacity-70`) if past; a **seal stamp** if sealed
  ("✓ Sealed · Jim 6:08–8:10 · 7/7", celadon, stamp-in animation).
- **now / open** — expands into the Rounds checklist (28px `.cbox`
  checkboxes ported from ChoreCheckRow) under a `NOW · 9:40A` eyebrow.
- **draft** — the day auto-populated, musts locked, a single
  `CONFIRM THE DAY` accent button (Sunsama one-tap).

### 3.4 Now-marker — green hairline
`.now-rule`: a 1.5px `resolved` top-border with a 7px dot + soft glow
ring; on the desktop ribbon a vertical `.now-vline` with an Inter
`NOW 9:40` label. **Green, minimal, never a colored block.** (Supersedes
the amber-now idea.)

### 3.5 Event band
A left **color bar** (`w-1 bg-cat-fm`) + bordered card for an event that
owns time ("Farmers market 9:00a · setup buffer reserved · James off-site
→ 1:00p"). The left-bar-color = the event-kind hue.

### 3.6 Man-down / needs-cover card
Amber-framed card: `⚠ Needs cover`, the orphaned work, and a single
amber action button (`JIM COVERS — I'VE GOT IT`). Acknowledgment is the
record.

### 3.7 Legend
A small "READING THE LOAD BAR" key (done / committed / open / event /
hole) — because the load-meter encodes a lot, the key earns its place.

## 4. Information-architecture shift (current → Rethinker)

| Today | Rethinker |
|---|---|
| Left **180px load-gauge rail** of block names; click → center detail | Blocks are **full-width cards in a vertical spine**; the now-block is open inline, others collapse to their load lanes |
| Load shown as a single stacked **gauge bar** per block | Load shown as **per-person lanes** (Jim/James), segmented by state |
| Now = ring on a gauge + "· now" text | Now = **green hairline rule** with a forward-focus eyebrow |
| Week pane = bar-per-day list | Week = **mini load-spines + a should-heat row** |
| Desktop = spine + one center block + week | Desktop = **horizontal two-lane time ribbon** (6a–8p) + combined silhouette + week spines |

This needs a **per-person load model** the current Schedule doesn't fully
compute yet (who owns / has done / is open on each block, plus event
"holes" when someone's off-site). That model is the gating work item.

## 5. Phased refactor plan (each phase its own commit + QA)

0. **Primitives.** Build `<LoadMeter>` (+ segment kinds) and the
   eyebrow/seal/now-rule as small components in `src/components/schedule/`.
   Storybook-free: drop them on a scratch route or the existing Schedule
   behind a flag to eyeball. Pure presentational; no data model yet.
1. **Per-person load model.** Extend the Schedule derive to produce, per
   block, each person's segments (done/committed/open/event-hole). This
   is the real engine; everything visual hangs off it.
2. **Phone spine.** Replace the block list with the Rethinker spine:
   bordered block cards, load lanes when collapsed, the now-block open
   into the existing Rounds checklist, the green hairline now-marker, the
   day-load silhouette + confirm anchor in the header.
3. **Desktop ribbon.** The horizontal two-lane time ribbon + combined
   silhouette + week mini-spines.
4. **Reconcile deferred items** against the system (F36 project label,
   F21/F31/F32 structure, F5/F7/F39 app-wide) — most are absorbed or
   restyled by the new vocabulary.
5. **Propagate** the primitives (LoadMeter, eyebrow, sealed card, hairline
   markers) to the rest of the app — Now, Rounds, Dashboard — so the
   Schedule's language becomes the app's.

## 6. Reuse-across-app guidance

- The **load-meter** generalizes anywhere "how much / by whom / what
  state" matters: Rounds progress, Dashboard day-at-a-glance, place
  occupancy.
- The **eyebrow + Lora-heading + hairline-card** trio is the universal
  section frame — adopt it as the default card/pane chrome (this also
  resolves F5's "inconsistent pane header convention").
- Keep **color functional**: reach for a `cat-*` hue only when it encodes
  a real kind/state, never to decorate.

## 7. Open questions for James
- **Dark vs light:** the mockup is dark; the app currently defaults to
  light for you. Adopt the system in **both** themes (tokens already
  exist for both), or move the Schedule (or the app) to dark?
- **Per-person model scope:** the load-meter's power needs per-person
  block ownership + event "holes." How much of that data is real today
  vs. needs new tracking?
- **Start surface:** phone spine first (the Rethinker's "Hero 1, the
  screen that decides it"), or build the `<LoadMeter>` primitive + a
  side-by-side on the live Schedule for you to react to first?
