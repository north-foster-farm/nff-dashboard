# Example — the events + schedule overhaul workshop (2026-05-06)

The second four-lens run, held the same day as the chores workshop
(`../chores/`). It produced the events overhaul inserted as batches
11–14 in `9aff149` and shipped as 13.1–14.2 (`4426f79` … `371db5f`):
the RFC 5545 series/occurrence model, `event_links`, and the calendar
views.

Promoted out of `.ignored/` on 2026-07-30 during the housekeeping arc.

## What's here

- `workshop-prompt.md` — the whole workshop in one document: James's
  verbatim requirements dump first, then the shared context, then
  `LENSES (each agent gets one)` at the end.

This is the **compact assembly style**. The chores run written five
hours earlier used the opposite approach — one complete prompt per
agent, context repeated in full. Both are legitimate; the difference is
worth knowing before you write your own.

## Why the verbatim dump matters here

It is the clearest surviving statement of *why* the Google Calendar
integration was ever scoped, in James's own words: push-only, because
the point is getting farm events onto his phone, and two-way editing
"opens us up to weird conflicts or side effects". That decision explains
a piece of roadmap archaeology that otherwise looks like drift — GCal
push was deferred at `fd1cd2d` and never built (the never-shipped
batch 31), and `gcal_pushes` is still an empty table.

The same dump is where the calendar view earns its keep as distinct
from the sync ("the ability to manage events in a calendar-like UI"),
and where the clickable month/year header and the week/day views were
asked for — all of which shipped in 14.1.

For what became of all this, see `docs/history/schedule-and-events.md`
and, for the abandoned GCal half, `docs/history/parked-and-abandoned.md`.
