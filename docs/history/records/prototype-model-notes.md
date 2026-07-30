# Prototype-era model notes (from nff-data.json)

Promoted verbatim during H3 (2026-07-30) from `src/data/nff-data.json`,
where these `modelNotes` arrays had lived since the prototype as
documentation-in-a-data-file. No component ever rendered them; the keys
were deleted in the same H3 commit that created this record. They are
the earliest written statements of several domain rules that still
hold, so they are preserved as history rather than lost.

## chores

- A chore definition describes a recurring activity. Each occurrence
  is an instance, and a completion is a ChoreCompletionLog entry.
- Edit scopes adopt the Google Calendar pattern: this instance / this
  and following / all instances. Past completions are immutable.
- Recurrence model supports specific times, ranges, multiple
  times/ranges, sunrise/sunset anchors, and conditional state-based
  recurrence.

## events

- 'Event' in NFF's domain language means a bounded farm occasion —
  sales events (markets, pop-ups, egg drops, deliveries, pick-ups),
  processing days, and farm visits. Reserved word; never used for log
  entries.
- Recurring instances carry a recurrence pattern; single instances
  carry an explicit date.
- Event kinds can carry kind-specific payloads on each instance
  (e.g. processing.batchSize, processing.cratesPacked,
  processing.resourcesRequired). Generic fields (date/time/location)
  are always present; kind-specific fields live under a kind-named
  sub-object.

## schedule

- Aggregator over chores, scheduled projects, and event instances —
  anything date-bound.
- Sync to Google Calendar is push-only.
- Prototype scope: month-grid calendar, chronological timeline, filter
  chips, click-to-detail. Drag-and-drop, in-place editing, GCal API
  call deferred.

## logging

- Polymorphic discriminated union with `type` field. Base: { type, id,
  logTime, actor, subjects }.
- Subtypes: ChoreCompletionLog, TemperatureLog, FeedLog, MortalityLog,
  EggCollectionLog, WeightLog.
- 'Event' must NOT appear in log type names. Storage architecture
  open — see thread_log_storage.

## inventory

- Egg lots are FIFO by collectionDate; eggs sit in the fridge in
  cartons.
- Chicken lots are FIFO by processingDate within each (productKindId,
  sizeBracketId); each lot lives in a freezer.
- Egg inventory is currently created by counting cartons just before
  going to a market — see thread_egg_inventory_model.
- Chicken inventory is created on broiler-processing day as a final
  step of that process.

(The `thread_*` references point at entries in `nff-data.json`'s
`threads` array, which remains live.)
