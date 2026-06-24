import { useMemo, useState, useEffect, useRef } from "react";
import { ChevronRight, ArrowDownToLine, ListChecks, Check } from "lucide-react";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useSites } from "../lib/data/useSites.js";
import { useChoreAssignmentRules } from "../lib/data/useChoreAssignmentRules.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { rollupChoresForDay } from "../lib/schedule/deriveDay.js";
import { obligationPlaceIds } from "../lib/chores.js";
import ChoreCheckRow from "../components/ChoreCheckRow.jsx";
import BlockBadge from "../components/BlockBadge.jsx";
import OutboxIndicator from "../components/OutboxIndicator.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { navigate } from "../lib/router.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import { recordCapture, readCaptures } from "../lib/capture/capture.js";
import { formatMinutesOfDay } from "../lib/sunTimes.js";

// The Schedule — S4 of the Schedule feature. The phone-first, single-open
// accordion of the day's chore BLOCKS: exactly one block expanded (the one
// "now" is in), every other block a quiet one-line summary, so a 40-item
// day reads as a few lines + the block in your hand. Draft-only for now —
// the one-tap Confirm + the source-change ribbon arrive in S5.
//
// Married to Rounds + the one completion truth: a chore row IS the shared
// `ChoreCheckRow` (tick -> chore_completions via the outbox, offline-safe,
// CloudOff while queued); tapping a block's "Open rounds" deep-links into
// the Rounds takeover for that block. The day's data comes from the S3
// `deriveDay` engine (regenerable, computed client-side).

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// Local YYYY-MM-DD (not UTC) — the capture's business day.
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

  // Re-pick the "now" block once a minute as block windows pass.
  const [nowMin, setNowMin] = useState(() => minutesNow());
  useEffect(() => {
    const id = setInterval(() => setNowMin(minutesNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  // The day's blocks (rollups carry .items = chore instances), ordered.
  const orderedBlocks = useMemo(() => {
    const rollups = rollupChoresForDay(data, today, ruleOpts);
    return [...rollups].sort((a, b) => startKey(a) - startKey(b));
  }, [data, today, ruleOpts]);

  // Expand each block's chores into (chore, place) rows — the completion
  // grain. A chore fans out to every place it's anchored to today.
  const blockRows = useMemo(() => orderedBlocks.map((r) => {
    const rows = [];
    for (const inst of r.items) {
      const placeIds = obligationPlaceIds(inst.chore, choreCtx ?? {});
      const multi = placeIds.length > 1;
      for (const pid of placeIds) {
        rows.push({
          chore: inst.chore,
          placeId: pid,
          placeLabel: multi ? choreCtx?.placesById?.get(pid)?.name ?? null : null,
        });
      }
    }
    return { bucket: r.bucket, block: r.block, rows };
  }), [orderedBlocks, choreCtx]);

  // done / total per block, from the live completions.
  const counts = useMemo(() => blockRows.map((b) => {
    let done = 0;
    for (const row of b.rows) {
      if (completions.isDone(row.chore.id, row.placeId)) done++;
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
  const dateISO = useMemo(() => ymdLocal(today), [today]);

  // The confirmed snapshot for today, if any. null = a draft. A
  // just-confirmed day sets this optimistically; cross-device truth
  // arrives from the captures read on load.
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

  const totalChores = useMemo(
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
    entries: blockRows.flatMap((b) => b.rows.map((row) => ({
      source_type: "chore",
      label: row.chore.title,
      block_id: b.block ? b.bucket : null,
      clock_time: null,
      assignee: null,
      source_ref: { chore_id: row.chore.id, place_id: row.placeId ?? null },
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

  // Source-changed-after-confirm: today's chores vs the confirmed
  // snapshot. Surfaced, never auto-applied.
  const changes = useMemo(() => {
    if (!confirmedDoc) return null;
    const keyOf = (sr) => `${sr?.chore_id ?? ""}|${sr?.place_id ?? ""}`;
    const confirmedKeys = new Set(
      (confirmedDoc.entries ?? []).map((e) => keyOf(e.source_ref)));
    const currentKeys = new Set();
    const added = [];
    for (const b of blockRows) {
      for (const row of b.rows) {
        const k = `${row.chore.id}|${row.placeId ?? ""}`;
        currentKeys.add(k);
        if (!confirmedKeys.has(k)) added.push(row.chore.title);
      }
    }
    const removed = (confirmedDoc.entries ?? [])
      .filter((e) => !currentKeys.has(keyOf(e.source_ref)))
      .map((e) => e.label);
    const total = added.length + removed.length;
    return total ? { total, added, removed } : null;
  }, [confirmedDoc, blockRows]);

  const loading =
    blocksLoading || sitesLoading || completions.loading;

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
            {totalChores > 0 && (
              <span className="opacity-80">
                {" "}· {orderedBlocks.filter((b) => b.block).length} blocks · {totalChores} chores
              </span>
            )}
          </button>
        )}
        <OutboxIndicator />
      </div>

      {loading ? (
        <div className="px-4 py-10 text-center text-dim text-sm">Loading the day…</div>
      ) : blockRows.length === 0 ? (
        <div className="px-4 py-10 text-center text-dim text-sm border border-dashed border-line">
          Nothing on the schedule today.
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

                {/* The one open block: its checklist + the Rounds entry. */}
                {isOpen && (
                  <div className="bg-surface">
                    <ul>
                      {b.rows.map((row) => (
                        <ChoreCheckRow
                          key={row.chore.id + "|" + (row.placeId ?? "")}
                          chore={row.chore}
                          placeId={row.placeId}
                          placeLabel={row.placeLabel}
                          blocks={blocks}
                          completions={completions}
                        />
                      ))}
                      {b.rows.length === 0 && (
                        <li className="px-4 py-3 text-[13px] text-dim">
                          No chores in this block today.
                        </li>
                      )}
                    </ul>
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
