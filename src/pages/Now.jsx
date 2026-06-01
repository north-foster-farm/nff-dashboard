import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, CloudOff, Play } from "lucide-react";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useSites } from "../lib/data/useSites.js";
import { useChoreDefinitions } from "../lib/data/useChoreDefinitions.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { useChoreRuns, formatElapsed } from "../lib/data/useChoreRuns.js";
import { computePlaceStatus } from "../lib/placeStatus.js";
import { resolveBlockMinutes, displayBlockSide } from "../lib/sunTimes.js";
import OutboxIndicator from "../components/OutboxIndicator.jsx";
import PlaceTag from "../components/PlaceTag.jsx";

// The Now surface (Batch 17) — the phone landing. Time-anchored: the
// active-or-next round as one fat primary button, then a farm-wide
// due / overdue list derived from the place_status projection
// (lib/placeStatus.js). Every row is tagged with its place — name +
// bold parent (D1) — and deep-links into the round for that chore's
// block.
//
// D2: when a round is in progress (on any device), a loud
// "round in progress — tap to resume" bar sits at the top. This
// replaces the old quiet "rejoin from the sidebar" path as the
// canonical way back into a running round.

export default function Now({ onOpenRounds }) {
  const { blocks, loading: blocksLoading } = useChoreBlocks();
  const {
    placesById, childrenByParent, placementsByPlaceId,
    loading: sitesLoading,
  } = useSites();
  const { definitions, loading: defsLoading } = useChoreDefinitions();
  const {
    activeRun, nextBlock, loading: runsLoading,
  } = useChoreRuns({ blocks });

  const today = useMemo(() => new Date(), []);
  const completions = useChoreCompletions(today);

  // Re-derive statuses once a minute so "due" flips to "overdue" when
  // a block window ends without anyone refreshing.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const status = useMemo(() => computePlaceStatus({
    definitions,
    blocks,
    placesById,
    childrenByParent,
    placementsByPlaceId,
    isDone: completions.isDone,
    now,
  }), [
    definitions, blocks, placesById, childrenByParent,
    placementsByPlaceId, completions.isDone, now,
  ]);

  const loading =
    blocksLoading || sitesLoading || defsLoading || runsLoading ||
    completions.loading;

  // Bucket + sort: overdue first, then due (both by block start time
  // ascending so the list reads in do-it order), done at the bottom.
  const buckets = useMemo(() => {
    const startOf = (o) => {
      if (!o.block) return Infinity;
      const start = resolveBlockMinutes(
        now, o.block.startKind, o.block.startMinutes
      );
      return start ?? Infinity;
    };
    const sortByStart = (a, b) =>
      startOf(a) - startOf(b) ||
      (a.chore.title ?? "").localeCompare(b.chore.title ?? "");
    const overdue = status.obligations
      .filter(o => o.status === "overdue").sort(sortByStart);
    const due = status.obligations
      .filter(o => o.status === "due").sort(sortByStart);
    const done = status.obligations
      .filter(o => o.status === "done").sort(sortByStart);
    return { overdue, due, done };
  }, [status.obligations, now]);

  const activeBlock = activeRun
    ? blocks.find(b => b.id === activeRun.blockId) ?? null
    : null;

  return (
    <div className="max-w-[640px] mx-auto flex flex-col gap-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-[32px] font-bold -tracking-[0.02em] m-0 text-fg">
            Now
          </h2>
          <p className="text-[13px] text-dim m-0 mt-1">
            {now.toLocaleDateString(undefined, {
              weekday: "long", month: "long", day: "numeric",
            })}
          </p>
        </div>
        <OutboxIndicator className="mt-2" />
      </header>

      {loading ? (
        <div className="text-[12px] text-muted uppercase tracking-[0.16em] py-10 text-center">
          Loading…
        </div>
      ) : (
        <>
          {/* D2: round in progress — loudest thing on the page. */}
          {activeRun ? (
            <ResumeBar
              run={activeRun}
              block={activeBlock}
              onResume={() => onOpenRounds(activeRun.blockId)}
            />
          ) : nextBlock ? (
            <StartRoundCta
              candidate={nextBlock}
              onStart={() => onOpenRounds(nextBlock.block.id)}
            />
          ) : (
            <div className="bg-surface border border-line px-5 py-6 text-center">
              <div className="text-[13px] text-muted">
                {blocks.some(b => b.isActive)
                  ? "All rounds are done for today."
                  : "No time blocks configured yet — add one in Chores → Blocks."}
              </div>
            </div>
          )}

          {/* Farm-wide due / overdue list */}
          <ObligationList
            buckets={buckets}
            placesById={placesById}
            completions={completions}
            onOpenRounds={onOpenRounds}
          />
        </>
      )}
    </div>
  );
}

// ── D2 resume bar ─────────────────────────────────────────────────────
function ResumeBar({ run, block, onResume }) {
  // Live elapsed tick — this is the loudest element on the surface, so
  // it earns the per-second timer.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = run.startedAt ? nowMs - run.startedAt.getTime() : 0;

  return (
    <button
      onClick={onResume}
      className={
        "w-full flex items-center gap-4 bg-accent text-on-accent " +
        "border-0 px-5 py-5 cursor-pointer text-left font-[inherit]"
      }
    >
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full bg-on-accent opacity-60" />
        <span className="relative inline-flex h-3 w-3 bg-on-accent" />
      </span>
      <span className="flex flex-col flex-1 min-w-0 gap-0.5">
        <span className="font-ui text-[10px] uppercase tracking-[0.16em] font-semibold opacity-80">
          Round in progress
        </span>
        <span className="font-heading text-[22px] font-bold -tracking-[0.02em] leading-tight">
          {block?.name ?? "Rounds"} · {formatElapsed(elapsed)}
        </span>
      </span>
      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em]">
        Tap to resume
        <ChevronRight size={14} />
      </span>
    </button>
  );
}

// ── Fat start button ──────────────────────────────────────────────────
function StartRoundCta({ candidate, onStart }) {
  const { block } = candidate;
  return (
    <button
      onClick={onStart}
      className={
        "w-full flex items-center gap-4 bg-accent text-on-accent " +
        "border-0 px-5 py-5 cursor-pointer text-left font-[inherit]"
      }
    >
      <Play size={28} className="shrink-0" strokeWidth={2.5} />
      <span className="flex flex-col flex-1 min-w-0 gap-0.5">
        <span className="font-ui text-[10px] uppercase tracking-[0.16em] font-semibold opacity-80">
          Up next
        </span>
        <span className="font-heading text-[22px] font-bold -tracking-[0.02em] leading-tight">
          Start {block.name.toLowerCase()} rounds
        </span>
        <span className="text-[12px] opacity-80">
          {displayBlockSide(block.startKind, block.startMinutes)}
          {" · "}
          {formatBlockDuration(block.durationMinutes)}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0" />
    </button>
  );
}

function formatBlockDuration(minutes) {
  if (typeof minutes !== "number" || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Due / overdue / done list ─────────────────────────────────────────
function ObligationList({
  buckets, placesById, completions, onOpenRounds,
}) {
  const { overdue, due, done } = buckets;
  const [showDone, setShowDone] = useState(false);

  if (overdue.length === 0 && due.length === 0 && done.length === 0) {
    return (
      <div className="bg-surface border border-line px-5 py-8 text-center">
        <div className="text-[13px] text-muted">
          Nothing on the list today.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {overdue.length > 0 && (
        <ObligationGroup
          title="Overdue"
          tone="warn"
          obligations={overdue}
          placesById={placesById}
          completions={completions}
          onOpenRounds={onOpenRounds}
        />
      )}
      {due.length > 0 && (
        <ObligationGroup
          title="To do"
          obligations={due}
          placesById={placesById}
          completions={completions}
          onOpenRounds={onOpenRounds}
        />
      )}
      {done.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowDone(s => !s)}
            className={
              "self-start inline-flex items-center gap-1.5 text-[10px] " +
              "uppercase tracking-[0.16em] font-semibold text-muted " +
              "hover:text-fg bg-transparent border-0 cursor-pointer p-0"
            }
          >
            <Check size={12} className="shrink-0" />
            {done.length} done today
            <ChevronRight
              size={12}
              className={
                "shrink-0 transition-transform " +
                (showDone ? "rotate-90" : "")
              }
            />
          </button>
          {showDone && (
            <ObligationGroup
              obligations={done}
              placesById={placesById}
              completions={completions}
              onOpenRounds={onOpenRounds}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ObligationGroup({
  title, tone, obligations, placesById, completions, onOpenRounds,
}) {
  return (
    <section className="flex flex-col gap-2">
      {title && (
        <div
          className={
            "font-ui text-[10px] uppercase tracking-[0.16em] font-semibold " +
            (tone === "warn" ? "text-warn" : "text-muted")
          }
        >
          {title}
          {" · "}
          {obligations.length}
        </div>
      )}
      <ul
        className={
          "m-0 p-0 list-none bg-surface border " +
          (tone === "warn" ? "border-warn" : "border-line")
        }
      >
        {obligations.map(o => (
          <ObligationRow
            key={`${o.chore.id}|${o.placeId ?? ""}`}
            obligation={o}
            placesById={placesById}
            completions={completions}
            onOpenRounds={onOpenRounds}
          />
        ))}
      </ul>
    </section>
  );
}

// One (chore, place) obligation. Tapping it deep-links into Rounds for
// the chore's block — the doing surface is where ticking happens; Now
// is the read-and-go list.
function ObligationRow({
  obligation: o, placesById, completions, onOpenRounds,
}) {
  const place = o.placeId ? placesById.get(o.placeId) : null;
  const queued = completions.isQueued?.(o.chore.id, o.placeId) ?? false;
  const block = o.block;

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        onClick={() => onOpenRounds(o.chore.blockId ?? null)}
        className={
          "w-full flex items-center gap-3 px-4 py-3 bg-transparent " +
          "border-0 cursor-pointer text-left font-[inherit] " +
          "hover:bg-row-hover transition-colors duration-100 " +
          (o.done ? "opacity-60" : "")
        }
      >
        <span
          className={
            "shrink-0 w-5 h-5 border-2 inline-flex items-center " +
            "justify-center " +
            (o.done
              ? "bg-resolved border-resolved text-on-accent"
              : o.status === "overdue"
                ? "border-warn text-transparent"
                : "border-line text-transparent")
          }
          aria-hidden
        >
          <Check size={12} strokeWidth={3} />
        </span>
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span
            className={
              "text-[14px] flex items-center gap-2 " +
              (o.done ? "text-muted line-through" : "text-fg font-medium")
            }
          >
            <span className="truncate">{o.chore.title}</span>
            {queued && (
              <CloudOff
                size={12}
                className="shrink-0 text-warn"
                aria-label="Saved on this device — not synced yet"
              />
            )}
          </span>
          {place && (
            <PlaceTag
              place={place}
              placesById={placesById}
              className="text-[11px] text-faint"
            />
          )}
        </span>
        {o.status === "overdue" && (
          <span className="shrink-0 inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 leading-none border bg-surface-alt border-warn text-warn">
            Overdue
          </span>
        )}
        {block && (
          <span className="shrink-0 text-[11px] text-dim">
            {block.name}
          </span>
        )}
        <ChevronRight size={14} className="shrink-0 text-muted" />
      </button>
    </li>
  );
}
