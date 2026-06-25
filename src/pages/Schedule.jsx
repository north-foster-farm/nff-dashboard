import { useMemo, useState, useEffect, useRef } from "react";
import {
  ChevronRight, ArrowDownToLine, ListChecks, Check, Plus, X, CloudOff,
} from "lucide-react";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useSites } from "../lib/data/useSites.js";
import { useChoreAssignmentRules } from "../lib/data/useChoreAssignmentRules.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { useScheduleDeltas } from "../lib/data/useScheduleDeltas.js";
import { deriveDay } from "../lib/schedule/deriveDay.js";
import {
  obligationPlaceIds, getAllChoreDefinitions, describeChoreAnchor,
} from "../lib/chores.js";
import SearchSelector from "../components/SearchSelector.jsx";
import ChoreCheckRow from "../components/ChoreCheckRow.jsx";
import BlockBadge from "../components/BlockBadge.jsx";
import OutboxIndicator from "../components/OutboxIndicator.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { navigate } from "../lib/router.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import { recordCapture, readCaptures } from "../lib/capture/capture.js";
import { formatMinutesOfDay } from "../lib/sunTimes.js";

// The Schedule — the phone-first, single-open accordion of the day's chore
// BLOCKS: exactly one block expanded (the one "now" is in), every other
// block a quiet one-line summary. Married to Rounds + the one completion
// truth (a chore row IS the shared ChoreCheckRow). The day's data comes
// from the S3 `deriveDay` engine; the one-tap Confirm (S5) writes a
// versioned schedule.confirmed_day capture. S6: ad-hoc one-off tasks added
// to a block are commitment deltas the engine folds in (useScheduleDeltas).

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// Local YYYY-MM-DD (not UTC) — the capture's / delta's business day.
function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Sort key: real blocks by resolved start time, the block-less "anytime"
// bucket last.
function startKey(r) {
  return r.startMin == null ? Number.MAX_SAFE_INTEGER : r.startMin;
}

// The block "now" is in: the latest real block whose start has passed;
// failing that, the first block of the day.
function pickNowBucket(orderedBlocks, nowMin) {
  let now = null;
  for (const b of orderedBlocks) {
    if (b.startMin != null && b.startMin <= nowMin) now = b.bucket;
  }
  return now ?? orderedBlocks[0]?.bucket ?? null;
}

// An ad-hoc one-off task row (S6) — a commitment delta, not a chore, so its
// done-state lives on the commitment (not chore_completions). Same look as
// ChoreCheckRow, plus a remove control.
function AdHocRow({ commitment, onToggle, onRemove }) {
  const done = commitment.state === "done";
  const queued = commitment._pending;
  return (
    <li className={
      "flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 " +
      (done ? "bg-row-active-dim" : "")
    }>
      <button
        type="button"
        onClick={() => onToggle(commitment.id, !done)}
        className={
          "shrink-0 w-7 h-7 border-2 inline-flex items-center justify-center " +
          "cursor-pointer transition-colors duration-100 " +
          (done
            ? "bg-resolved border-resolved text-on-accent"
            : "bg-bg border-line text-transparent hover:border-fg")
        }
        aria-pressed={done}
        aria-label={done ? "Mark not done" : "Mark done"}
      >
        <Check size={16} strokeWidth={3} />
      </button>
      <div className="flex-1 min-w-0">
        <div className={
          "text-[14px] flex items-center gap-2 " +
          (done ? "text-muted line-through" : "text-fg font-medium")
        }>
          <span className="truncate">
            {commitment.source_ref?.title ?? "(task)"}
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-faint border border-line px-1">
            task
          </span>
          {queued && (
            <CloudOff size={12} className="shrink-0 text-warn"
              aria-label="Saved on this device — not synced yet" />
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(commitment.id)}
        className="shrink-0 text-faint hover:text-warn"
        aria-label="Remove task"
      >
        <X size={16} />
      </button>
    </li>
  );
}

// The inline "add a one-off task" input at the foot of a block.
function AddTaskRow({ onAdd }) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
  };
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-line">
      <Plus size={15} className="shrink-0 text-faint" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="Add a one-off task…"
        className="flex-1 bg-transparent text-[14px] text-fg placeholder:text-faint outline-none py-1"
      />
      {text.trim() && (
        <button type="button" onClick={submit}
          className="shrink-0 text-[12px] font-medium text-accent">
          Add
        </button>
      )}
    </div>
  );
}

export default function Schedule({ data }) {
  const today = useMemo(() => new Date(), []);
  const { blocks, loading: blocksLoading } = useChoreBlocks();
  const { choreCtx, loading: sitesLoading } = useSites();
  const { rulesByChoreId, rulesByBlockId } = useChoreAssignmentRules();
  const ruleOpts = useMemo(
    () => ({ rulesByChoreId, rulesByBlockId, blocks }),
    [rulesByChoreId, rulesByBlockId, blocks],
  );
  const completions = useChoreCompletions(today);
  const dateISO = useMemo(() => ymdLocal(today), [today]);
  const dayUTC = useMemo(
    () => new Date(Date.UTC(
      today.getFullYear(), today.getMonth(), today.getDate())),
    [today]);
  const { deltas, addTask, addChore, removeDelta, setDone } =
    useScheduleDeltas(dateISO);

  // Chore search-to-add: the chore set as searchable items + a resolver.
  const choreById = useMemo(() => {
    const m = new Map();
    for (const c of getAllChoreDefinitions(data)) m.set(c.id, c);
    return m;
  }, [data]);
  const choreItems = useMemo(() => getAllChoreDefinitions(data).map((c) => ({
    id: c.id, label: c.title,
    sublabel: describeChoreAnchor(c, choreCtx ?? {}) || null,
  })), [data, choreCtx]);
  const [picking, setPicking] = useState(false);
  // Pull the picked chore onto the day at every place it's anchored to.
  const addChoreToDay = (choreId) => {
    const c = choreById.get(choreId);
    if (!c) return;
    const places = obligationPlaceIds(c, choreCtx ?? {});
    for (const pid of (places.length ? places : [null])) {
      addChore(c.id, pid, c.blockId ?? null);
    }
    setPicking(false);
  };

  // Re-pick the "now" block once a minute as block windows pass.
  const [nowMin, setNowMin] = useState(() => minutesNow());
  useEffect(() => {
    const id = setInterval(() => setNowMin(minutesNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  // The day's blocks (rollups carry .items = chores, .extras = ad-hoc
  // deltas), ordered. deriveDay folds the deltas in.
  const orderedBlocks = useMemo(() => {
    const { choreRollups } = deriveDay({
      data, dayDate: today, dayUTC, dayISO: dateISO, ruleOpts, deltas,
    });
    return [...choreRollups].sort((a, b) => startKey(a) - startKey(b));
  }, [data, today, dayUTC, dateISO, ruleOpts, deltas]);

  // Expand each block into typed rows: chores fan out to (chore, place)
  // rows (the completion grain); ad-hoc deltas are their own rows.
  const blockRows = useMemo(() => orderedBlocks.map((r) => {
    const rows = [];
    const seen = new Set();
    for (const inst of r.items) {
      const placeIds = obligationPlaceIds(inst.chore, choreCtx ?? {});
      const multi = placeIds.length > 1;
      for (const pid of placeIds) {
        seen.add(inst.chore.id + "|" + (pid ?? ""));
        rows.push({
          kind: "chore",
          key: "c|" + inst.chore.id + "|" + (pid ?? ""),
          chore: inst.chore,
          placeId: pid,
          placeLabel: multi ? choreCtx?.placesById?.get(pid)?.name ?? null : null,
        });
      }
    }
    for (const ex of (r.extras ?? [])) {
      if (ex.source_type === "chore") {
        const chore = choreById.get(ex.source_ref?.chore_id);
        if (!chore) continue; // orphan: chore no longer exists
        const pid = ex.source_ref?.place_id ?? null;
        const k = chore.id + "|" + (pid ?? "");
        if (seen.has(k)) continue; // already due today (dedupe, S37)
        seen.add(k);
        rows.push({
          kind: "chore", key: "cd|" + ex.id, chore, placeId: pid,
          placeLabel: choreCtx?.placesById?.get(pid)?.name ?? null,
          deltaId: ex.id,
        });
      } else {
        rows.push({ kind: "adhoc", key: "a|" + ex.id, commitment: ex });
      }
    }
    return { bucket: r.bucket, block: r.block, rows };
  }), [orderedBlocks, choreCtx, choreById]);

  // done / total per block, across chores (completions) + ad-hoc (state).
  const counts = useMemo(() => blockRows.map((b) => {
    let done = 0;
    for (const row of b.rows) {
      if (row.kind === "chore"
        ? completions.isDone(row.chore.id, row.placeId)
        : row.commitment.state === "done") done++;
    }
    return { done, total: b.rows.length };
  }), [blockRows, completions]);

  const nowBucket = useMemo(
    () => pickNowBucket(orderedBlocks, nowMin),
    [orderedBlocks, nowMin],
  );

  // Single-open accordion. `openBucket` is the user's explicit pick;
  // until they tap, the open block follows "now".
  const [openBucket, setOpenBucket] = useState(null);
  const open = openBucket ?? nowBucket;
  const openRef = useRef(null);

  // tick -> seal: when the open block flips to fully done, advance to the
  // next not-yet-done block (forward focus). Fires only on the transition,
  // so manually reopening a finished block doesn't bounce away.
  const sealRef = useRef(null);
  useEffect(() => {
    const i = blockRows.findIndex((b) => b.bucket === open);
    if (i < 0) { sealRef.current = null; return; }
    const c = counts[i];
    const isComplete = c.total > 0 && c.done === c.total;
    const wasComplete = sealRef.current?.bucket === open && sealRef.current.complete;
    if (isComplete && !wasComplete) {
      const next = blockRows.findIndex(
        (b, j) => j > i && counts[j].total > counts[j].done,
      );
      if (next >= 0) setOpenBucket(blockRows[next].bucket);
    }
    sealRef.current = { bucket: open, complete: isComplete };
  }, [counts, open, blockRows]);

  const jumpToNow = () => {
    setOpenBucket(nowBucket);
    openRef.current?.scrollIntoView({
      behavior: REDUCED_MOTION ? "auto" : "smooth",
      block: "center",
    });
  };

  // ── Confirm (S5) — the day's commitment, written as a versioned
  // schedule.confirmed_day capture (the S2 substrate). ───────────────
  const email = useCurrentUserEmail();

  // The confirmed snapshot for today, if any. null = a draft.
  const [confirmedDoc, setConfirmedDoc] = useState(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    let cancelled = false;
    readCaptures("schedule.confirmed_day", {
      subjectType: "schedule_day", subjectId: dateISO,
    }).then((rows) => {
      if (!cancelled && rows.length) setConfirmedDoc(rows[0].doc);
    }).catch(() => { /* offline / unauth — stays a draft */ });
    return () => { cancelled = true; };
  }, [dateISO]);

  const totalRows = useMemo(
    () => counts.reduce((s, c) => s + c.total, 0), [counts]);

  // The frozen planned shape (schedule.confirmed_day v1). Reference +
  // labels only — never a copy of source content.
  const buildConfirmedDoc = () => ({
    date: dateISO,
    confirmed_by: email ?? "unknown",
    confirmed_at: new Date().toISOString(),
    blocks: orderedBlocks.filter((b) => b.block).map((b) => ({
      block_id: b.bucket,
      label: b.block.name,
      planned_start: b.startMin != null ? formatMinutesOfDay(b.startMin) : null,
      planned_end: null,
    })),
    entries: blockRows.flatMap((b) => b.rows.map((row) => row.kind === "chore"
      ? ({
        source_type: "chore",
        label: row.chore.title,
        block_id: b.block ? b.bucket : null,
        clock_time: null,
        assignee: null,
        source_ref: { chore_id: row.chore.id, place_id: row.placeId ?? null },
      })
      : ({
        source_type: "ad_hoc",
        label: row.commitment.source_ref?.title ?? "task",
        block_id: b.block ? b.bucket : null,
        clock_time: null,
        assignee: row.commitment.assignee ?? null,
        source_ref: { commitment_id: row.commitment.id },
      }))),
  });

  const confirmDay = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      const doc = buildConfirmedDoc();
      // Validates client-side (ajv) + server-side (pg_jsonschema), rides
      // the outbox. Throws on an invalid doc.
      recordCapture("schedule.confirmed_day", doc, {
        capturedOn: dateISO, subjectType: "schedule_day", subjectId: dateISO,
      });
      setConfirmedDoc(doc);
    } catch (e) {
      console.error("[schedule] confirm failed", e);
    } finally {
      setConfirming(false);
    }
  };

  // Source-changed-after-confirm: today's items vs the confirmed snapshot.
  // Surfaced, never auto-applied.
  const changes = useMemo(() => {
    if (!confirmedDoc) return null;
    const entryKey = (e) => e.source_ref?.commitment_id
      ? `a|${e.source_ref.commitment_id}`
      : `c|${e.source_ref?.chore_id ?? ""}|${e.source_ref?.place_id ?? ""}`;
    const rowKey = (row) => row.kind === "chore"
      ? `c|${row.chore.id}|${row.placeId ?? ""}`
      : `a|${row.commitment.id}`;
    const rowLabel = (row) => row.kind === "chore"
      ? row.chore.title : (row.commitment.source_ref?.title ?? "task");
    const confirmedKeys = new Set((confirmedDoc.entries ?? []).map(entryKey));
    const currentKeys = new Set();
    const added = [];
    for (const b of blockRows) {
      for (const row of b.rows) {
        const k = rowKey(row);
        currentKeys.add(k);
        if (!confirmedKeys.has(k)) added.push(rowLabel(row));
      }
    }
    const removed = (confirmedDoc.entries ?? [])
      .filter((e) => !currentKeys.has(entryKey(e)))
      .map((e) => e.label);
    const total = added.length + removed.length;
    return total ? { total, added, removed } : null;
  }, [confirmedDoc, blockRows]);

  const loading = blocksLoading || sitesLoading || completions.loading;

  const dateLabel = today.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <PageHeader title="Schedule" subtitle={dateLabel} />

      {/* Source-changed-after-confirm ribbon — informs, never auto-applies. */}
      {changes && (
        <div className="px-3 py-2 mb-3 border border-warn text-[12px] text-warn">
          <span className="font-semibold">
            {changes.total} change{changes.total === 1 ? "" : "s"} since you confirmed
          </span>
          <span className="text-dim ml-2">
            {[
              ...changes.added.map((t) => "+ " + t),
              ...changes.removed.map((t) => "− " + t),
            ].slice(0, 4).join(" · ")}
          </span>
        </div>
      )}

      <div className="px-1 mb-3 flex items-center gap-2">
        {confirmedDoc ? (
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-resolved border border-resolved px-2 py-0.5 inline-flex items-center gap-1">
            <Check size={12} strokeWidth={3} /> Confirmed
          </span>
        ) : (
          <button
            type="button"
            onClick={confirmDay}
            disabled={confirming || loading || blockRows.length === 0}
            className="text-[12px] font-medium px-3 py-1 bg-accent text-on-accent disabled:opacity-50"
          >
            Confirm today
            {totalRows > 0 && (
              <span className="opacity-80">
                {" "}· {orderedBlocks.filter((b) => b.block).length} blocks · {totalRows} items
              </span>
            )}
          </button>
        )}
        <OutboxIndicator />
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="ml-auto text-[12px] font-medium text-accent inline-flex items-center gap-1"
        >
          <Plus size={14} /> Add chore
        </button>
      </div>

      {loading ? (
        <div className="px-4 py-10 text-center text-dim text-sm">Loading the day…</div>
      ) : blockRows.length === 0 ? (
        <div className="border border-dashed border-line">
          <div className="px-4 py-8 text-center text-dim text-sm">
            Nothing on the schedule today.
          </div>
          <AddTaskRow onAdd={(title) => addTask(title, null)} />
        </div>
      ) : (
        <ol className="border border-line divide-y divide-line">
          {blockRows.map((b, i) => {
            const isOpen = b.bucket === open;
            const { done, total } = counts[i];
            const allDone = total > 0 && done === total;
            // Forward focus: a collapsed, fully-done block recedes.
            const dimmed = !isOpen && allDone;
            return (
              <li key={b.bucket} ref={isOpen ? openRef : null}>
                {/* Block header — always visible, the collapse/expand toggle. */}
                <button
                  type="button"
                  onClick={() => setOpenBucket(b.bucket)}
                  className={
                    "w-full flex items-center gap-3 px-4 py-3 text-left " +
                    (isOpen ? "bg-row-active" : "hover:bg-row-hover") +
                    (dimmed ? " opacity-60" : "")
                  }
                  aria-expanded={isOpen}
                >
                  {b.block && <BlockBadge block={b.block} />}
                  <span className={
                    "flex-1 min-w-0 truncate text-[14px] " +
                    (isOpen ? "font-semibold text-fg" : "text-fg")
                  }>
                    {b.block?.name ?? "Anytime"}
                  </span>
                  <span className="shrink-0 text-[12px] [font-variant-numeric:tabular-nums] text-dim">
                    {allDone ? "done" : `${done}/${total}`}
                  </span>
                  <ChevronRight
                    size={16}
                    className={
                      "shrink-0 text-faint transition-transform " +
                      (isOpen ? "rotate-90" : "")
                    }
                  />
                </button>

                {/* The one open block: its checklist + add + the Rounds entry. */}
                {isOpen && (
                  <div className="bg-surface">
                    <ul>
                      {b.rows.map((row) => row.kind === "chore" ? (
                        <ChoreCheckRow
                          key={row.key}
                          chore={row.chore}
                          placeId={row.placeId}
                          placeLabel={row.placeLabel}
                          blocks={blocks}
                          completions={completions}
                          onRemove={row.deltaId
                            ? () => removeDelta(row.deltaId) : undefined}
                        />
                      ) : (
                        <AdHocRow
                          key={row.key}
                          commitment={row.commitment}
                          onToggle={setDone}
                          onRemove={removeDelta}
                        />
                      ))}
                    </ul>
                    <AddTaskRow
                      onAdd={(title) => addTask(title, b.block ? b.bucket : null)}
                    />
                    {b.block && (
                      <button
                        type="button"
                        onClick={() => navigate(`/rounds/${b.bucket}`)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-accent hover:bg-row-hover border-t border-line"
                      >
                        <ListChecks size={15} />
                        Open rounds
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {picking && (
        <SearchSelector
          items={choreItems}
          placeholder="Search chores to add…"
          onSelect={(it) => addChoreToDay(it.id)}
          onClose={() => setPicking(false)}
        />
      )}

      {/* Jump-to-now: re-open the current block and scroll it into view. */}
      <button
        type="button"
        onClick={jumpToNow}
        className="fixed bottom-5 right-5 z-10 flex items-center gap-1.5 px-3 py-2 bg-accent text-on-accent text-[12px] font-medium shadow-lg"
      >
        <ArrowDownToLine size={14} />
        Now
      </button>
    </div>
  );
}
