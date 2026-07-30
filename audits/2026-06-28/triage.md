# Triage — 2026-06-28 audit (F1–F80)

Decisions from triage with James (2026-06-28). Dispositions are
pre-authorized: each **FIX NOW** finding (or logical group) ships as its own
`fix:` commit straight to main, no per-commit ask (standing audit-session
exception). `fix:` commits do **not** bump version. **Do not push** unless
asked. No migrations / prod pushes unattended.

## Buckets

### FIX NOW — execute this session (grouped into commit-sized chunks)

**A · Critical functional bugs (first):**
- F25 time-off created as a TASK · F26 time-off doesn't render on the day
- F70 time-off person picker → checkboxes (multi) · F78 reject overlapping
  time-off per person
- F68 "Add a project step" must search projects, not chores
- F69 ticking a placed project item must append/persist, not swap-override
- F74 S37 dedupe/warn on re-add not working
- F16 completion sync · F17 confirm-state sync · F19 carry-over banner
  dismissal must persist (investigate sync together)

**B · Schedule layout/chrome quick wins:**
- F9 duplicate "Schedule" heading (desktop) · F10 mobile full-width header
- F15 market-day not surfaced · F20 tabs shuffle position
- F22 standardize banners · F23 conflicts → count not icon
- F29 all banners dismissible · F31 whole-day hover/padding
- F32 missing timeline bars (left pane) · F45 block-focus state on day nav
- F47 surface "Open rounds" at top of block

**C · App chrome:**
- F1 mobile bell no close · F2 mobile search broken · F3 remove ⌘Enter bind
- F4 terse settings copy · F6 search → icon only · F7 hover affordance
  app-wide · F8 logo → home · F24 header-button hover

**D · Schedule/overnight/project small:**
- F52 ⋯ menu labels · F57 edited-via-button caret · F58 protection copy terser
- F61 ad-hoc add affordance · F62 protection on non-committed ad-hoc
- F63 overnight text overflow · F65 overnight in week/side pane
- F73 narrow picker (remove checkbox, multi-select + Confirm)
- F75 same-name results differentiated

**E · Mobile quick wins:**
- F38 remove mobile gradient · F39 tap targets · F41 time-wrap tiers
- F60 mobile conflict tap-to-jump scroll · F76 add-chore mobile broken

### GREENLIT BIG BUILDS — start now, own arc (Chores/Schedule display rework)
- **F30** remove the "Anytime" concept (bind everything to a block)
- **F48** implement the chore-rethinker workshop mock-up (must/should/optional
  + remaining pill), mobile + desktop
- **F49** global customizable chore-ordering system + place sub-grouping +
  correct mobile-coop sequence
- Related & pulled in by this arc: F37, F42, F43 (block display), F56
  (all-day/ongoing tasks)

### DESIGN PASS — one dedicated visual iteration (frontend-design)
F5 (pane header convention) · F11 (now-block / schedule color scheme) ·
F21 (info-vs-active header layout) · F33 (now color) · F36 (project label/
gradient) · F44 (color-code block types). [F37/F42/F43 fold into the
Chores/Schedule rework arc above.]

### FEATURE BACKLOG — not this session
F14 (Week/Month/Review on mobile) · F18-view (durable carry-over list) ·
F27/F67 (buffer rework: arbitrary length + categories + globalize) ·
F28 (navigable changes counter) · F34/F35/F51/F66 (drill-down + delete on
schedule/chore rows) · F40 (mobile paging arrows) · F46 (week pane = whole
day) · F53 (defer chore) · F54 (remove from day) · F55/F64 (per-instance
edit/rename) · F71 (per-day project-time boundaries — parked) · F77 (chore
picker block targeting) · F79 (time-off calendar view)

### VERIFY — needs repro (daytime / real device)
F13 (earlier-today distinguished) · F50 (dormant mobile-brooder chores) ·
F59 (mobile PWA freeze — maybe emulation) · F80 (project recompute to 3:15)

### NO-ACTION
F12-note/F13 (James checked off, not pursuing) · F18 row-level "new task"
decoration (James decided against; banner-level is fine).

## PROGRESS (session 1 — 2026-06-28)

All commits are `fix:` on **main**, NOT pushed. Build green at each.

**DONE (Groups A, B, C):**
- A (critical): F25, F70, F78, F68, F69, F74, F16, F17, F19 (+F18 terse)
- B (header/layout): F9, F10, F15, F20, F22, F23, F29, F45, F47
- C (app chrome): F1, F2 (partial — mobile close only), F3, F4, F6, F8, F24
- Commits: 06874a0, 15f1f01, 353ac36, 5abb5cc, 86fbaac, 05bed63,
  d1b490b, c646bc9, 5ef79e0, 613db68, 36b2529, f3d9a6b, 1c453dc,
  eb4a3f2, 4862762 (≈15 commits).

**RE-BUCKETED:** F31, F32 moved FIX NOW → DESIGN PASS (proportional/
visual; need the app on screen, alongside F11/F42/F44 which touch the
same spine/blocks). F7 (app-wide hover) also → DESIGN PASS (systemic
token decision); concrete missing hovers (F24) done.

**DONE (Group D — session 2):** F52, F58, F62 (edit sheet titled /
terser protection / no-protect-on-draft), F61 (add-task button), F63
(overnight "now" not clipped), F73 + F75 (narrow multi-select + Confirm,
remove checkbox, differentiate same names). Commits: 825b3ca, e53f886,
6ca1a4b.
- F57 (caret from ⋯) — N/A: the edit sheet is a centred modal, not a
  button-anchored popover. Left as-is.
- F65 (overnight in side pane) — already satisfied: DayRailSpine renders
  Overnight; phone week pane is the deferred F14.

**DONE (Group E — session 3, eyes-on via Playwright/Chromium):**
- F38 (remove phone day-strip gradient) — 36d5b6f
- F41 (stack time labels into even number/am-pm tiers) — d2faee7
- F76 (drop redundant "· pick one" copy; the truncated narrow step was
  already replaced by the F73/F75 multi-select rebuild) — b422792
- F60 (mobile conflict tap-to-jump now scrolls focusRef into view) —
  1f8d523
- Verified each before/after at 390x844 with a real browser.

**RE-BUCKETED:** F39 (tap targets too small) moved FIX NOW → DESIGN
PASS / strip-redesign arc. With eyes on: the strip packs 10 columns
into ~351px = 25px each; the vertical hit area is already full-height,
so the only real "enlarge" levers are F30 (remove the Anytime column)
and F40 (prev/next paging) — both deferred/big. A blind width tweak now
would fight F40's chosen paging direction and be redone by the
F40/F42/F43/F44 strip redesign. Same precedent as F31/F32/F7. Do F39
together with that redesign.

**REMAINING — GREENLIT BIG BUILDS (own arc, large):** F30 (remove
"Anytime"), F48 (chore-rethinker mock-up), F49 (global chore-ordering +
place sub-grouping). Mock-ups in the chore design workshop dir under
.ignored/.

**REMAINING — DESIGN PASS / FEATURE BACKLOG / VERIFY:** unchanged from
the buckets above (now also incl. F31, F32, F7).

## Execution order
A → B → C → D → E (FIX NOW), then scope the Chores/Schedule rework arc
(F30/F48/F49). Design pass + feature backlog + verify items are separate
follow-ups.
