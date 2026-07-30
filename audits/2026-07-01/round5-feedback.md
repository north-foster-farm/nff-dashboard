# Round 5 feedback — 2026-07-02 (source: /next-prompt.md, all HIGH)

Mockup: `.ignored/event-day-load-mockup.png` (event rail in day load;
elements in `audits/raw/Screenshot 2026-07-02 at 4.05*.png`).
Confirmed by James: mobile horizontal scroll IS fixed (no task).

## Decisions

- [x] **R5.1 · F66 = OPTION C** — drop the gutter left of chore rows
  (rows go full width). Annotate findings.md F66 as decided-C.
  Revisit only if slice 8's order work needs an indicator.

## Small fixes

- [x] **R5.2** Day-load wrapper div: remove its margin.
- [x] **R5.3** "0 conflicts" chip never renders at zero (desktop —
  phone already conditional).
- [x] **R5.4** Desktop confirm/+ Add row matches mobile pattern:
  same button widths, `space-between` alignment.
- [x] **R5.5** Tooltips show BOTH start and end time (block/row time
  tooltips).
- [x] **R5.6** Subheader date: full month name, never abbreviated.
- [x] **R5.7** Clock-alert icon in day-load stat row gets hover-me
  dots.
- [x] **R5.8** Day-load now rule cut off on mobile — fix.
- [x] **R5.9** Mobile: confirm/+ Add row moves BELOW the day load
  (match desktop order).
- [x] **R5.10** Chore name wraps instead of truncating.
- [x] **R5.11** Overnight icon hover lists the overnight block's
  scheduled tasks.
- [x] **R5.12** Right sidebar: prev/next WEEK advance buttons.

## Chore-row information

- [x] **R5.13** Chore rows ALWAYS show where the chore happens —
  place, else animal fallback; a place lookup must always be
  possible.
- [x] **R5.14** Imminent-deadline rework: kill the "FRI JUL 3 · 1 DAY
  LEFT" + "optional today" text. In-row, right of the location
  text: `· ` + a dropdown (EditedTag pattern) reading "N DAYS
  LEFT"; expanded shows due date + time. The edited-history
  dropdown relocates to this same position.

## Projects: auto-seed OFF, quick-add next

- [x] **R5.15** Auto-seeding the day with project steps is REMOVED
  (James: "auto seeding is actually not the right thing" — the
  current not-seeding state becomes the contract). NO-LEGACY:
  delete the auto-place path, keep dedupe/heal + tombstones.
- [x] **R5.16** Project rows get a quick "add next task" button that
  grabs the next highest-priority item; the + Add "project step"
  flow defaults the same way.
- [x] **R5.17** Project tasks can MOVE — reorder within a block and
  from one block to another.

## Needs cover — block-level rework

- [x] **R5.18** Needs-cover applies to the whole BLOCK(s) overlapped
  by the time off, never a single chore. The misaligned in-chore-row
  UI moves out of the chore row to ABOVE the block header row (below
  the confirm/+ Add row).
- [x] **R5.19** ONE needs-cover card per scheduled time off, covering
  every overlapped block:
  * Title = block name; all-day → "All day • Fri, Jul 3".
  * Body: "[person] is [type] [from X to Y|after X|until X|all
    day]."
  * "N chores" EditedTag-style dropdown; all-day version groups
    items under per-block mini-headings; names only.
  * Button label: "[person] covers".
  * A second time off the same day = a second card.
- [x] **R5.20** All-day time off = ONE confirmation; before cover,
  every block that day wears the conflict icon in the left sidebar
  but the conflict COUNT stays 1. Accepting cover resolves all of
  them into covered icons: lucide `circle-alert`, muted color,
  hover-me dots, tooltip says what was covered (+ who accepted &
  when). Right sidebar: conflict icon → circle-alert when covered;
  BOTH icons if same-day covered + unresolved conflicts coexist.
- [x] **R5.21** Day-load stat row grows a conflicts icon with "xN"
  (like clock alerts), hover-me dots; hover lists who is off and
  when.

## Events (mockup build)

- [x] **R5.22** This Week: Saturday's event must show its E badge
  (bug); E badge hover gives event detail (name, time).
- [x] **R5.23** Events reach the LEFT sidebar: an event block row
  directly before the first block it overlaps.
- [x] **R5.24** Day-load event rail (per mockup):
  * Horizontal rail BELOW the chore/project bars; left edge aligns
    with the first overlapped block's left edge, right edge with the
    last overlapped block's right edge.
  * Contains the E badge (hover-me dots) + the NowRule adapted into
    a start—end timeline ("1:15 PM ——— 5:00 PM").
  * Overlapped blocks = 1 conflict (event puts us a man down): warn
    diagonal stripes + warn border on those bars; stat row shows the
    conflict icon (with hover-me dots) and "1 event".
  * Cover accepted → stripes + warn border disappear; conflict icon
    → muted circle-alert, tooltip = who accepted + when.
  * Left-sidebar blocks needing cover use the open-project diagonal
    stripe pattern in the WARN color.
  * Buffers ignore events for now.

## Confirmed fixed (no task)

- Mobile unwanted horizontal scroll — James confirms fixed.

## R5.25 (added mid-round, James)

- [x] **R5.25** Mobile: project (and event) strip bars use the standard
  offset inset focus/now rings — the ring-recolor didn't read as the
  active marker.

## Execution notes (2026-07-02, batch 42.4 built)

- ALL items executed; build passes; Playwright-verified desktop 1280 +
  mobile 402 (light). Extra bugs found + fixed: deriveDay's zero-width
  event range (timed events never reached the DAY page) and farmLoad's
  week range ending at Sat 00:00 (the Saturday E badge bug's root).
- Verified live: the Saturday market event → spine row + day-load rail +
  warn-striped bars + "1 conflict" chip + NeedsCoverCard; accepting
  cover resolved everything to the CoveredBadge (test override written
  to prod and exact-ID deleted after).
- NOT visually exercised (code-path verified only): the DaysLeftTag
  (no chore with runway existed on the viewed days — "Fill minerals"
  wasn't on the day), the time-off unit card (only the event unit was
  live), R5.17's gap-to-gap move sheet, and R5.8's clip fix on a real
  iOS device.
- F66 → option C annotated in findings.md (today's flush row IS C).
