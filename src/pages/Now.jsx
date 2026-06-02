import { useEffect, useMemo, useState } from "react";
import {
  Check, ChevronRight, CloudOff, Play, Sparkles, Square,
} from "lucide-react";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useSites } from "../lib/data/useSites.js";
import { useChoreDefinitions } from "../lib/data/useChoreDefinitions.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { useChoreRuns, formatElapsed } from "../lib/data/useChoreRuns.js";
import { computePlaceStatus } from "../lib/placeStatus.js";
import { resolveBlockMinutes, displayBlockSide } from "../lib/sunTimes.js";
import OutboxIndicator from "../components/OutboxIndicator.jsx";
import { BlockBadgeList } from "../components/BlockBadge.jsx";
import {
  PlaceTreeNode, PlaceTreeSection, groupByPlaceTree,
} from "../components/PlaceTree.jsx";

// The Now surface (Batch 17) — the phone landing. Time-anchored: the
// active-or-next round as one fat primary button, then a farm-wide
// due / overdue list derived from the place_status projection
// (lib/placeStatus.js). Chores group by the place tree — the same
// nesting as the Chores Today tab — so the list reads place by place
// instead of as one long flat run of rows.
//
// D2: when a round is in progress (on any device), a loud
// "round in progress — tap to resume" bar sits at the top, with a
// Stop affordance beside it so a forgotten run can be killed without
// re-entering the Rounds surface.

export default function Now({ onOpenRounds }) {
  const { blocks, loading: blocksLoading } = useChoreBlocks();
  const {
    roots, childrenByParent, choreCtx,
    loading: sitesLoading,
  } = useSites();
  const { definitions, loading: defsLoading } = useChoreDefinitions();
  const {
    activeRun, nextBlock, loading: runsLoading, cancelRun,
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
    choreCtx,
    isDone: completions.isDone,
    now,
  }), [definitions, blocks, choreCtx, completions.isDone, now]);

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
    // Consolidate overdue rows: the same chore title at the same place
    // missed in more than one block ("Fill feeders" exists as separate
    // Morning / Afternoon definitions) collapses into one row carrying
    // every missed block. The row's block badges then read as "missed
    // N times". The first (earliest) obligation stays the row's
    // identity, so tapping it opens the earliest missed block.
    const overdueRaw = status.obligations
      .filter(o => o.status === "overdue").sort(sortByStart);
    const byKey = new Map();
    for (const o of overdueRaw) {
      const key =
        `${(o.chore.title ?? "").trim().toLowerCase()}|${o.placeId ?? ""}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...o, blocks: o.block ? [o.block] : [] });
      } else if (o.block) {
        existing.blocks.push(o.block);
      }
    }
    const overdue = [...byKey.values()];
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
              onStop={async () => {
                const ok = window.confirm(
                  "Stop this round? Ticked chores stay ticked; the run " +
                  "is marked canceled instead of done."
                );
                if (!ok) return;
                await cancelRun(activeRun.id);
              }}
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

          {/* Farm-wide due / overdue list, grouped by place */}
          <ObligationList
            buckets={buckets}
            roots={roots}
            childrenByParent={childrenByParent}
            completions={completions}
            onOpenRounds={onOpenRounds}
          />
        </>
      )}
    </div>
  );
}

// ── D2 resume bar (+ stop) ────────────────────────────────────────────
function ResumeBar({ run, block, onResume, onStop }) {
  // Live elapsed tick — this is the loudest element on the surface, so
  // it earns the per-second timer.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = run.startedAt ? nowMs - run.startedAt.getTime() : 0;

  return (
    <div className="flex items-stretch gap-2">
      <button
        onClick={onResume}
        className={
          "flex-1 min-w-0 flex items-center gap-4 bg-accent text-on-accent " +
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
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-90 inline-flex items-center gap-1">
            Tap to resume
            <ChevronRight size={12} />
          </span>
        </span>
      </button>
      <button
        onClick={onStop}
        title="Stop this round"
        aria-label="Stop this round"
        className={
          "shrink-0 flex flex-col items-center justify-center gap-1.5 " +
          "bg-surface border border-warn text-warn px-4 cursor-pointer " +
          "font-[inherit]"
        }
      >
        <Square size={18} fill="currentColor" />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
          Stop
        </span>
      </button>
    </div>
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
  buckets, roots, childrenByParent, completions, onOpenRounds,
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
          roots={roots}
          childrenByParent={childrenByParent}
          completions={completions}
          onOpenRounds={onOpenRounds}
        />
      )}
      {due.length > 0 && (
        <ObligationGroup
          title="To do"
          obligations={due}
          roots={roots}
          childrenByParent={childrenByParent}
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
              roots={roots}
              childrenByParent={childrenByParent}
              completions={completions}
              onOpenRounds={onOpenRounds}
            />
          )}
        </div>
      )}
    </div>
  );
}

// One status bucket (Overdue / To do / Done), with its obligations
// grouped by the place tree — the same nesting as the Chores Today
// tab. Places with nothing in this bucket don't render at all.
function ObligationGroup({
  title, tone, obligations, roots, childrenByParent,
  completions, onOpenRounds,
}) {
  const grouped = useMemo(() => groupByPlaceTree({
    entries: obligations,
    getPlaceId: (o) => o.placeId,
    roots,
    childrenByParent,
    sortEntries: (a, b) =>
      (a.chore.title ?? "").localeCompare(b.chore.title ?? ""),
  }), [obligations, roots, childrenByParent]);

  const renderEntry = (o) => (
    <ObligationRow
      obligation={o}
      completions={completions}
      onOpenRounds={onOpenRounds}
    />
  );
  const keyOf = (o) => `${o.chore.id}|${o.placeId ?? "farm"}`;

  return (
    <section className="flex flex-col gap-1">
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
      <div
        className={
          "flex flex-col gap-0.5 border-l-2 pl-3 " +
          (tone === "warn" ? "border-warn" : "border-line")
        }
      >
        {grouped.topLevel.map(place => (
          <PlaceTreeNode
            key={place.id}
            place={place}
            depth={0}
            childrenByParent={childrenByParent}
            entriesByPlace={grouped.entriesByPlace}
            subtreeCounts={grouped.subtreeCounts}
            renderEntry={renderEntry}
            keyOf={keyOf}
            hideEmpty
          />
        ))}
        {grouped.farmEntries.length > 0 && (
          <PlaceTreeSection
            title="Whole farm"
            subtitle="Not tied to any one place"
            entries={grouped.farmEntries}
            renderEntry={renderEntry}
            keyOf={keyOf}
          />
        )}
      </div>
    </section>
  );
}

// One (chore, place) obligation. Tapping it deep-links into Rounds for
// the chore's block — the doing surface is where ticking happens; Now
// is the read-and-go list. The place is carried by the tree header
// above, so the row stays lean for phone widths: checkbox, title,
// block badge(s), chevron. The block reads as an icon-only badge
// (BlockBadge) instead of its name; consolidated overdue rows carry
// one badge per missed block.
function ObligationRow({ obligation: o, completions, onOpenRounds }) {
  const queued = completions.isQueued?.(o.chore.id, o.placeId) ?? false;
  const blocks = o.blocks ?? (o.block ? [o.block] : []);

  // Layout note: the title cell is a single inline-flow box and the
  // block badges / status icons live INSIDE it, flowing right after
  // the last word of the title. That makes overlap impossible when a
  // long title wraps on phone widths — Safari miscalculates flex item
  // widths under the body `zoom` used for text density, which used to
  // push wrapped title text underneath separately-positioned badges.
  return (
    <button
      onClick={() => onOpenRounds(o.chore.blockId ?? null)}
      className={
        "w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center " +
        "gap-3 px-3 py-3 bg-surface " +
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
      <span className="min-w-0 text-[14px] leading-snug break-words">
        <span
          className={
            o.done ? "text-muted line-through" : "text-fg font-medium"
          }
        >
          {o.chore.title}
        </span>
        {o.chore.automationEmissionId && (
          <Sparkles
            size={12}
            className="inline ml-1.5 align-middle text-accent-deep"
            aria-label="Created by an automation"
          />
        )}
        {queued && (
          <CloudOff
            size={12}
            className="inline ml-1.5 align-middle text-warn"
            aria-label="Saved on this device — not synced yet"
          />
        )}
        <BlockBadgeList
          blocks={blocks}
          tone={o.status === "overdue" ? "warn" : "default"}
          className="ml-2 align-middle"
        />
      </span>
      <ChevronRight size={14} className="shrink-0 text-muted" />
    </button>
  );
}
