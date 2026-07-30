# Design system, style guide & voice

How the app came to look and read the way it does: a theme layer that
predates every feature, a code-side audit that produced the first shared
kit, a design-bracket method that produced a whole visual language, and
one unfinished phase that still holds the app's oldest open design call.

Numbering note, because this chapter cites both: `batch 41` alone is the
chores rebuild; `batch 41.N` is the Schedule feature; `batch 42.N` is the
Schedule redesign that carried most of the design work. Four independent
audit rounds each number findings from F1, so every F-number below
carries its audit date — an F11 exists in all four, three of them about
colour and one about type.

## Evolutions

**2026-05-03/04 — the theme layer lands before the design system does.**
`9ce3aec` shipped dark (default) and light palettes as CSS custom
properties on `<html data-theme>`, plus the Nacelle typeface from
dotcolon.net vendored as `@font-face`; its body names the intent,
"earthy, warm color tokens", and `src/theme.js` still records the brand
anchor as a comment: `#297D5A`, deep forest green. Two structural
choices made here never changed: token values live in `index.html`, and
theme switching is an attribute flip, not a React context. The next day
`207d5e1` (batch 2) installed `@tailwindcss/vite` and pointedly chose
not to own colour: "Existing CSS custom properties in index.html stay
authoritative for theme switching — Tailwind tokens are aliased to those
vars (e.g. `bg-surface` → `var(--c-surface)`)." That is why the app
still has one colour source of truth, and why `src/styles.css`'s
`@theme` block is a thin alias table rather than a palette. Untouched
pages kept working through `src/theme.js`'s `T` object (inline
`style={{T.*}}`) — the app's second styling idiom, and the thing later
passes spent months deleting. Font tuning followed: a woff2 load fix
(`ROADMAP.md:68`) and a global 11px → 12px Nacelle bump
(`ROADMAP.md:152`).

**2026-06-03 — batch 39.1: the first shared kit.** Roadmap restructure
`60c10c8` (06-02) had created Batch 39 "design audit (code-side)" beside
Batch 40, framing design issues as triaged exactly like functionality
bugs — one backlog (`ROADMAP.md:3365`). `0efc7b5` then ran four parallel
read-only sweeps of `src/` (class-string duplication, inline-style
idiom, duplicate structural components, colour/token bypasses) into
`audits/2026-06-03/design-audit.md` and executed the safe slice
(`ROADMAP.md:2704`). Out came `src/components/ui.jsx`: `LABEL_CLS` /
`INPUT_CLS` / `INPUT_SURFACE_CLS` / `BTN_ACCENT` / `BTN_GHOST` /
`BTN_GHOST_WARN`, plus `Card`, `StatusPill`, `StatTile`. Four
near-identical Card copies (Overview, Metrics, BatchMetrics, BatchPage)
collapsed to one import; the inline-style `primitives.jsx` was found
effectively dead — one live import — and **deleted**; five token
bypasses became `text-warn`. What it did *not* do is the point: the
regression-prone half (`ConfirmDialog` for 27 bare `window.confirm`
calls, segmented-control unification, broad constant adoption, a
`--c-warn-subtle` token) was booked as **39.2** and has never run
(m4 open thread #17).

**2026-06-04 — the walkthrough audit names colour as a theme.** The
138-finding audit surfaced a cluster its HANDOFF called "colour system
on the type, cascaded" — F11/F103/F128/F130 (06-04 audit) — plus a
gray-as-disabled cluster F46/F52/F63/F83/F104/F131 (m4 §1d). F11 (06-04
audit) is "done vs to-do zone colors aren't distinct enough"
(`audits/2026-06-04/findings.md:177`): the first appearance of a
question still open today.

**2026-06-24 → 06-26 — method before pixels.** Design stopped being ad
hoc when the two playbooks were written (now `docs/workshops/`): a
**Scope Workshop** deciding *what to build* while deliberately leaving
look-and-feel open, feeding a **Design Bracket** that decides what it
looks like as an elimination funnel — four blind stances produce cheap
wireframes, a gate narrows to ~two, only those get built as clickable
coded mockups, one wins (`docs/workshops/README.md`). Every visual
decision from here is a bracket output, which is why they are traceable
at all. Batch 41.15's focused Design Bracket 2 (2026-06-25) picked
**Rethinker master-detail** for the Schedule — `ROADMAP.md:3619`, the
*only* occurrence of "rethinker" in the 5,208-line roadmap, which is why
the arc that followed is so thinly recorded in tracked files. Mockup at
`docs/workshops/design-bracket/examples/schedule/mockups/rethinker.html`.

**2026-06-28 — the rethinker arc, and James's correction.** The pivotal
week, and its plan survives *only* in session transcripts (m5 "Bonus
finding"). James's directive: the rethinker mockup is "exactly what I
want for the basis of our schedule's look and feel"; build its
components as reusable app-wide patterns; and — the standing rule —
**where my earlier per-finding style requests contradict the rethinker's
system, defer to the system** (m5 §2b, T1). The derived plan was six
phases: 0 primitives → 1 per-person load model → 2 phone spine → 3
desktop ribbon → **4 reconcile deferred findings** → 5 propagate
app-wide.

Execution began wrong and was corrected the same day. `35f58a1` ported
the mockup's `LoadMeter` in as a specimen; after James's second video
that day (`.ignored/audit-v2/audits/2026-06-28/processed/
2026-06-28_12-28-45/`) `3bc3a13` removed it. The correction is the arc's
central idea: a ported mockup component is the right way to *introduce*
an architecture but not the destination — **extract the mockup's styles
and patterns and reinterpret them into our existing components**. So
`3b532ca` and `6e10001` built the whole mockup component pool *beside*
the real components (`RethinkerKit` + a gallery at `/rethinker`), to be
mapped onto the Schedule and then deleted.

Same day, the lesson that matters most for the future. `afa484a` did a
piecemeal per-finding colour pass — amber "now" plus green/blue block
tints — and `58d3942` reverted it wholesale hours later. `58d3942` is a
bare `git revert` with no rationale; the reason exists only in T1: "My
first piecemeal pass … CONTRADICTED the rethinker → REVERTED." The
colour work was not wrong on its merits; the *shape* of the work was
superseded by a whole system. The per-finding colour backlog (F5, F11,
F21, F33, F36, F44, F31, F32, F7, F39 — 06-28 audit) was folded into
Phase 4, "reconcile deferred" (m5 §2b).

The reinterpretation passes then shipped in order, needs-cover first
because it was James's headline example: `e3d264b` (needs-cover card),
`9ed91d3` (flush banners — flatten raised `surface-alt` to
border-defined-on-bg), `3487783` (Lora block headings), `9a2b85e`
(EventBand rail), `52eb4d8` + `842eaea` (NowRule). Three further
experiments — `75e94b0` (two-lane DayRibbon), `84dcf24` (silhouette +
week spines), `3fcb016` (should-heat rows) — were built and then
**deleted** two days later in `aa37e6e`: the honest record of an arc
that iterated in public.

**2026-06-29 — harvest-remix, and the system becomes a document.** A
second Design Bracket ran on the arc's own output, on the premise that
"the arc components were added as RAW MATERIAL to be harvested +
remixed into the real app, not finished components to keep as-is"
(`docs/workshops/design-bracket/examples/harvest-remix/DESIGN.md`). Four
blind harvesting strategies → two survivors: **Systematizer** (one
promoted primitive vocabulary, cheapest-first migration) and
**Operator** (re-home the harvested signals to where decisions happen —
phone Today glance, live Rounds). The verdict was the hybrid: Operator
decides where the value lives, Systematizer how to build it.
Recombiner's `farmLoad` data collapse was grafted in; its god-component
`LoadStrip` was dropped.

Then `4fe2c86` — not a batch, no version bump — captured all of it as
`public/style-guide/`: nine ranked principles, foundations, a bounded
component library with a consolidation backlog, page-level patterns, a
tone-and-voice page, and `DESIGN-SYSTEM.md` as the machine reference
"Claude reads while building". Every entry carries a **Stable /
Converging / Proposed** tag because the app was mid-migration, and the
docs site is built in the system it documents. The **voice guide** landed
here too, deliberately two-layered: brand voice for customer-facing
copy, product-UI voice (principle 9) for dashboard microcopy. Its brand
half is descriptive, not invented — drawn from 28 versions of the real
homepage update copy, May 2024 – Feb 2026.

**2026-06-30 — round 3: identity tokens, then the vocabulary, then the
app.** `ad39cd3` landed the model and token layer: `farmLoad.js` folds
one day-load model over the existing walks, and identity tokens arrive —
`--c-chore` teal, `--c-project` slate-blue, `--c-event` periwinkle.
Chore identity was recoloured **amber-glow → teal** because amber
collided with `warn`, and chores were denied `accent` green because
green stays a state colour. The same commit **deleted** rather than
kept: `weekShouldHeat` / `choreHeat` / `HEAT_RUNWAY` (the continuous
should-heat gradient, superseded by a binary warning) and
`personLoad.js` / `buildPersonLanes` (the two-lane "who's on what"
overlay — it leaned on per-chore assignment the farm does not commit
to). `630aeaa` promoted the vocabulary into `ui.jsx` (Pane, LoadSpine,
WeekStrip, KindBadge, CheckTarget, AttentionCard, FinishStamp, EventRow,
WindowBar, AlertStrip); `aa37e6e` wired the pages and deleted
`/rethinker`, `RethinkerKit`, DayRibbon and WeekSpines — the pool served
its purpose and left, exactly as planned.

Phase 5 followed the same day: "flush, not raised" went app-wide across
~20 page surfaces in six commits, `9290268` (Chores) → `df245d9`
(Processes) → `6dd8fb3` (Projects) → `19fe487` (five management pages) →
`ea4b234` (ten more) → `897e1ce` (Now + Orders), recorded in `cbfea96`.
The sweep was five mechanical moves (raised in-page sections → flush;
hand-rolled buttons → `BTN_*`; status chips → `StatusPill`; eyebrow
sections → `Pane`; Chores' whole inline-`T.*` idiom → token classes)
with a bounded **don't-touch** set: `bg-surface` row fills inside
`gap-px bg-line` hairline grids, form-control surfaces, floating
overlays, dynamic per-entity colours, odd buttons. Its declared holdouts
closed immediately after: `95a7a6b` retired `ChoreFieldsEditor`'s
`editInputStyle` (→ `EDIT_INPUT_CLS`), `9a59748` flushed the Rounds
takeover, and `de92adf` swept the component layer, taking `PlaceTree`
and `LoginGate` off `T.*` — the last two `T` importers in the app.

**2026-07-01 — principle 10, and a colour lesson learned twice.** Batch
42.1 (`e983910`) installed the affordance standard as **principle 10**:
interactive elements must LOOK interactive, never instructional text — a
rest-state "key" fill where hover can't carry the signal, hover as a
*background* tint (never text-colour-only), plus a real `Tooltip`
primitive replacing native `title`. The same day `99c9375` minted a
dedicated `now` colour token and `776a39a` deleted it again, this time
with the reasoning in the commit body: "a dedicated bright token was the
wrong tool — accent is the active-state color, and green-on-teal has no
hue contrast anyway." The replacement is an inset `accent-deep` ring
with a 1px background-coloured separation gap, and the durable rule:
**contrast on coloured fills is solved with luminance separation, not by
minting a new hue** (m5 §2a). The `--inv-zoom` convention came from the
same fix, so 2px rings rasterize at true device pixels under the density
zoom.

**2026-07-02 — one F11 closes, another opens.** Batch 42.3 settled the
type side: row titles are SANS at one size and one weight for active and
inactive; the Lora reading of "title font" was built first and reversed,
and Lora stays a header treatment that does not reach list rows
(`ROADMAP.md:4063`; F11, 07-01 audit). Batch 42.5 made
`ChoreRemainingPill` binary (F21, 07-01 audit). Then the 07-02
walkthrough filed **F11 (07-02 audit): "Category color identity has
failed"** — teal, periwinkle and slate-blue indistinguishable at 6px
blocks 3px apart, teal reading as the primary green, and "the
style-guide hue grid itself looks broken (swatches missing/duplicated/
gray)". Direction: deeply configure the Tailwind palette so the full
range (info / alert / warning / danger + category hues) is actually
represented, *then* reassign category identity. Flagged
**time-sensitive**: "Jim is starting to use the app; late color changes
will fight learned habits"
(`.ignored/audit-v2/audits/2026-07-02/findings.md:179`).

**2026-07-25 → 07-29 — the palette leaves the screen.** The style guide
got a token refresh (`components.html` + `DESIGN-SYSTEM.md`, both dated
2026-07-25) as the print/branding arc began.
`docs/specs/theme-color-handoff-brief.md` (2026-07-26) is a model
decision record: the business-card mark needs 3.2–3.5:1 on turf-green
800, no palette value lands in that window at hue ~155, so add
**turf-green 550 = `#37ad7c`** — the arithmetic midpoint of the ramp's
own HSV construction, measured 3.44:1 — exposed as
`--c-brandmark-inverse`. It records rejected alternatives explicitly "so
they are not re-litigated", locks three print-proof colours, and notes
in passing that three ramps are byte-identical duplicates. `b19b4e1`
then added `scripts/export-pixelmator-palette.py`, which parses the
*real* sources (`index.html` semantic tokens + `src/styles.css`
decorative scales) and emits a Pixelmator Pro `.colorpalette` with
deterministic uuid5 swatch IDs so re-exports stay byte-identical and
diffable. Batch 42.22 (`f230327`) is the house rule in miniature: a new
`Chicken` glyph shipped with "Design library updated in both faces
(components.html + DESIGN-SYSTEM.md)".

Two standing house rules bind all future work here: **every new
component or variant is documented in both faces of the library** — the
visual style guide page *and* `DESIGN-SYSTEM.md` — unprompted; and **UI
copy follows the voice guide**, brand voice for anything a customer
reads, product-UI voice (principle 9) for dashboard microcopy.

## Current state

**Three faces of one system**, all under `public/style-guide/`:
`index.html` (principles), `foundations.html`, `components.html`,
`patterns.html`, `voice.html` + `voice-guide.md`, and the 753-line
`DESIGN-SYSTEM.md` machine reference; shared chrome in `assets/ds.css` +
`ds.js`. Status tags (Stable / Converging / Proposed) are live
throughout.

**Ten ranked principles** (earlier wins a conflict): flush not raised ·
colour is functional never decorative · sharp corners · three type roles
no fourth · tokens only · field reality decides ties · a bounded list of
options · fold-the-old-in-then-delete (NO-LEGACY) · words are design
material · interactive elements look interactive.

**Token layer.** Values in `index.html` under `html[data-theme="dark"]`
(also `:root`) and `html[data-theme="light"]`, aliased into Tailwind by
`src/styles.css`'s `@theme`. Surfaces `bg`/`surface`/`surface-alt`/
`line`; a four-step text ramp `fg`/`dim`/`muted`/`faint`; state
`accent`/`accent-deep`/`warn`/`resolved`; on-fill `on-accent`/`on-cat`
(no `white` token); three row tints; nine `cat-*` category hues; and the
block-identity trio `chore` (teal `#2bb6a2`/`#0c7e6e`, letter **C**) /
`project` (slate-blue, **P**) / `event` (periwinkle, **E**), each with a
16% same-hue wash. Decorative ramps actually authored in `src/styles.css`
(50→950) number twelve: sky-aqua, celadon, turf-green, tea-green,
amber-glow, honey-bronze, hot-fuchsia, slate-blue, periwinkle,
frozen-lake, grapefruit-pink, **emerald**.

**Typography.** `--font-body` Nacelle (16 vendored woff2 in
`public/fonts/`), `--font-heading` Lora and `--font-ui` Inter, both from
the Google Fonts CDN (`index.html:18`). Sizes are authored in fixed px
then scaled by `body { zoom }` (1.20 comfortable / 1.35 / 1.50); data
always gets `tabular-nums` in a fixed-width container.

**Component kit.** `src/components/ui.jsx`, 1,225 lines, 25 exports:
`Pane`, `KindBadge`, `NowRule`/`NowTag`/`NowEdgeLine`, `Tooltip`,
`BadgeHint`, `CheckTarget`, `AttentionCard`, `FinishStamp`,
`WarmingBadge`, `CoveredBadge`, `LoadSpine`, `EventRow`, `WindowBar`,
`AlertStrip`, `WeekStrip`, `StatusPill`, `StatTile`, the `BTN_*` /
`*_CLS` constants, and the hatch/tint helpers. The in-app entry is
`sections.jsx:139` — a `style_guide` section in the Other group with
`external: "/style-guide/index.html"`, opening the docs in a tab.

Six places where the code disagrees with a document, verified
2026-07-29:

- **`src/theme.js` is dead code.** It exports only `T`, and nothing in
  `src/` imports it — `de92adf` removed the last two consumers and left
  the file. `DESIGN-SYSTEM.md`'s "Canonical source files" still lists it
  beside `index.html` and `src/styles.css`. A NO-LEGACY violation of the
  system's own principle 8.
- **The iframe embed no longer exists.** `DESIGN-SYSTEM.md`'s Hosting
  section and `public/style-guide/README.md` both describe an in-app
  embed "via `src/pages/StyleGuide.jsx` (iframe `?embed=1`,
  theme-synced)". That file was **deleted** in batch 42.5 (`81fdc89`,
  `ROADMAP.md:4404`) for the external nav link, explicitly NO-LEGACY.
- **Three documented ramps do not exist as tokens.**
  `foundations.html:337-339` renders **teal**, **mulberry** and
  **terracotta** as hardcoded hex arrays and `DESIGN-SYSTEM.md` lists
  them among the decorative ramps, but `src/styles.css` has no
  `--color-teal-*`, `--color-mulberry-*` or `--color-terracotta-*`
  scale. `ad39cd3`'s body claims it added "mulberry + terracotta ramps";
  the diff added exactly two single aliases. `--c-chore`'s comments say
  "teal-400"/"teal-600", pointing at a ramp never authored.
- **An undocumented ramp exists — and it is the brand green.**
  `src/styles.css:169-179` defines a full `emerald` 50→950 scale that
  appears in no style-guide page, yet the locked print-proof front-ink
  colour `#1e7b54` *is* emerald 700
  (`docs/specs/theme-color-handoff-brief.md`). The palette export
  script's output and the visual docs therefore disagree in both
  directions.
- **The consolidation backlog's "remaining holdouts" are closed.**
  `DESIGN-SYSTEM.md` still names `Rounds` and `ChoreFieldsEditor`'s
  `editInputStyle`; both were finished the same day by `9a59748` and
  `95a7a6b` — *after* the docs commit `cbfea96`.
- **Dead `.ignored` paths in the docs.**
  `public/style-guide/README.md:27` and `DESIGN-SYSTEM.md`'s
  consolidation backlog both cite `.ignored/playbooks/…` for the
  harvest-remix rationale; that tree was promoted to
  `docs/workshops/design-bracket/` during H1.

One dossier claim to correct: m1 §1.10 credits `0efc7b5` with
introducing `Card`. True historically, but `Card` no longer exists — it
was folded into flush `Pane` and deleted, and `DESIGN-SYSTEM.md`
documents that correctly.

## Unresolved threads

- **The colour bracket must be scoped as a design-system pass, not a
  list of per-finding fixes.** This is the chapter's load-bearing
  lesson. The per-finding shape was tried exactly once — `afa484a`,
  amber-now plus green/blue block tints — and reverted wholesale by
  `58d3942` the same day under the standing rule "where my earlier
  per-finding style requests contradict the rethinker's system, defer to
  the system" (m5 §2b). Roadmap v2 should book **one** item whose
  deliverable is a reconfigured Tailwind palette covering the full
  functional range (info / alert / warning / danger) *plus* reassigned
  category identity, per F11 (07-02 audit), and should explicitly refuse
  a per-finding colour checklist. It is **time-sensitive**: Jim is
  already learning the current colours.
- **Phase 4 of the rethinker arc never ran.** Phases 0–3 and 5
  substantially shipped (m5, status-verified against code and git);
  "reconcile deferred findings" did not. Its contents are the folded-in
  per-finding colour backlog — F5, F11, F21, F33, F36, F44, F31, F32,
  F7, F39, all 06-28 audit — of which F11 and F32 are the live ones.
  Roadmap v2 must name this phase; it is recorded nowhere tracked.
- **F32 (06-28 audit) — proportional left-pane timeline bars — is an
  unmade decision, not a bug.** Re-bucketed FIX NOW → DESIGN PASS the
  day it was filed, and left open in `0650fa4` (batch 42.21) with the
  reason: "it contradicts the current deliberate equal-height-rows
  design, so it's a design call, not a quick fix." Needs a James
  decision: proportional bars, or the equal-height row grid.
- **Batch 39.2 has never run**: `ConfirmDialog` for the bare
  `window.confirm` calls, broad `BTN_*` / input-constant adoption,
  segmented-control unification, `SummaryStrip` / `ToggleChip`
  extraction, the `--c-warn-subtle` token —
  `audits/2026-06-03/design-audit.md` §4. `de92adf` closed that list's
  `LoginGate` / `PlaceTree` items; the rest stand. The "27
  `window.confirm` calls" figure is the 2026-06-03 count; re-measure
  before scoping.
- **Ramp reconciliation** — the mechanical work behind the colour
  bracket, worth doing first: author teal / mulberry / terracotta as
  real ramps or delete them from the docs; document or retire `emerald`;
  alias-or-delete the three byte-identical duplicates
  (`frozen-lake`=`sky-aqua`, `honey-bronze`=`amber-glow`,
  `grapefruit-pink`=`hot-fuchsia`) before they drift. The export script
  collapses duplicates at export time, which hides this rather than
  fixing it.
- **The turf-green 550 handoff is unimplemented.**
  `docs/specs/theme-color-handoff-brief.md` prescribes turf-green 550
  `#37ad7c` as `--c-brandmark-inverse` with a verification recipe;
  grepping `index.html`, `src/styles.css` and `assets/ds.css` for
  `brandmark` or `37ad7c` returns zero hits. Also open there: which ramp
  is canonical for brand use (the card straddles emerald, turf-green and
  celadon), and whether the pale footer field moves from celadon 100 to
  turf-green 100 to put the card on one hue.
- **Doc drift now needs enforcement, not just a fix.** All six
  contradictions above come from hand-maintained documents; the standing
  both-faces rule works for additions and fails for deletions. A lint
  asserting that every ramp named in `foundations.html` exists in
  `src/styles.css`, and that every path cited in the design docs
  resolves, would catch every instance.
- **Component-layer surfaces never got the flush pass**: `SitesAdmin`,
  `PricingGrid`, `CalendarViews`, the sheets/editors. Deferred by name
  in `de92adf`: `CoverSheet`'s large primary button (wants a sized `BTN`
  variant — a design-library decision, not a blind swap) and the
  `CalendarViews` wrappers. Converging components still awaiting
  unification: `Eyebrow`, `Heading` (three impls), `Button` (`BTN_*`
  plus three inline impls), `StatTile` and `PlaceSection` (still
  raised).
- **Visual QA of the design system's own output was never done** for the
  batch 42 sweep or the whole overnight/project-blocks arc (m4 open
  thread #13); `PlaceTree` and `LoginGate` shipped "built clean but not
  yet eyeballed in-app" (`de92adf`).
- **The gray-as-disabled cluster** (F46/F52/F63/F83/F104/F131, 06-04
  audit) was one token decision at capture and was never explicitly
  resolved; m4 §1d flags it "partially addressed by Rethinker remix?
  VERIFY". Verify, then close it or fold it into the colour bracket.
- **Voice enforcement is specified but unbuilt.** `voice-guide.md` §"For
  the eventual CI backend" splits the traits into mechanically lintable
  (smart quotes, `pasture-raised` hyphenation, `non-GMO` casing,
  seasonal-title pattern, standing footer, a gratitude line near the
  close) versus editorial judgment — the spec for a content checker
  nobody has written.
- **Google Fonts is an external runtime dependency** for Lora and Inter
  (`index.html:18`) while Nacelle is self-hosted, so two of three type
  roles fail on a cold offline load — awkward beside principle 6
  ("field reality decides ties … offline").

## E-commerce relevance

Real, and mostly a sequencing constraint rather than a feature.

- **Do not build customer-facing surfaces before the colour bracket
  runs.** F11 (07-02 audit) says category colour identity has failed and
  prescribes reconfiguring the palette *first*, then reassigning
  identity. A storefront built on today's hues gets restyled twice.
  This is the most important line in this chapter for the next arc.
- **A storefront inherits a real vocabulary and should not invent one.**
  Phase 5 already landed, so `DESIGN-SYSTEM.md` plus
  `src/components/ui.jsx` are a working system with a bounded component
  list, ten ranked principles and a token layer that flips light/dark.
  The honest divergence question is narrow: the dashboard's principles
  are tuned for an *operator in a field* (density zoom, gloves,
  one-handed, must-see states loud) while a storefront optimizes for a
  first-time visitor. Expect to keep tokens, typography and voice;
  expect to diverge on density, affordance loudness (principle 10 exists
  for dense touch strips) and the flush/raised call.
- **The voice guide is already a customer-facing asset.** Its brand half
  was derived from 28 versions of the real homepage update copy — the
  "employees" running joke, seasonal titles, gratitude close, radical
  honesty about price increases with exact figures and rationale,
  `pasture-raised` / `non-GMO` spelled exactly. Product descriptions,
  market posts and order emails should be written from it, and its
  lintable/editorial split is ready-made for a publish gate. Keep the
  layering explicit: the brand gag never goes on a checkout button.
- **Brand assets are decided but partly unimplemented.** The print proof
  locks brand green `#1e7b54` (emerald 700), dark green `#194d37`
  (turf-green 800) and pale field `#d6f5e0` (celadon 100); the
  `--c-brandmark-inverse` step for a tonal mark on dark green is
  specified and absent from the code. A storefront needs these as web
  tokens, not just print values, and needs "which ramp is canonical for
  brand use" answered.
- **Nacelle is freeware from dotcolon.net**, vendored as 16 woff2 in
  `public/fonts/` with the `.otf` originals kept only in
  `.ignored/nacelle/` for print work. A public site reusing the
  dashboard's look needs those files, and needs the licence terms
  checked for commercial use — nobody has verified that.
