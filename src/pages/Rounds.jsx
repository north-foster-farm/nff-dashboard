import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Check, ChevronLeft, CloudOff,
} from "lucide-react";
import pluralize from "pluralize";
import { useChoreBlocks, formatMinutesOfDay } from "../lib/data/useChoreBlocks.js";
import { useSites } from "../lib/data/useSites.js";
import { descendantIds, placePath } from "../lib/places.js";
import { useChoreDefinitions } from "../lib/data/useChoreDefinitions.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { obligationPlaceIds } from "../lib/chores.js";
import { useChoreRuns, formatElapsed } from "../lib/data/useChoreRuns.js";
import { useRunEvents } from "../lib/data/useRunEvents.js";
import { resolveBlockMinutes, displayBlockSide } from "../lib/sunTimes.js";
import QuickActionsTray from "../components/QuickActionsTray.jsx";
import ChoreRemainingPill from "../components/ChoreRemainingPill.jsx";
import OutboxIndicator from "../components/OutboxIndicator.jsx";
import PlaceTag from "../components/PlaceTag.jsx";

// Full-screen takeover for actually doing chores. Bypasses the
// normal layout (no TopBar, no Sidebar, no SectionHeader).
//
// Three states:
//   - cold:      no run for the active block today → show Start rounds
//   - active:    run.state === 'in_progress' → show the doing surface
//   - done:      run.state === 'done'        → show the wrap card
//
// 8.1 ships the lifecycle, the Site Switcher (kind → location), and
// per-task checkboxes that read/write chore_completions with
// realtime contention. Quick actions tray + Run Events land in 8.2.
// Batch 17 hardens the surface: the run lifecycle goes through the
// outbox (works offline), the place switcher gains a group-by-place /
// group-by-kind toggle, and `initialBlockId` lets the Now surface
// deep-link straight to a specific block's cold open.

export default function Rounds({ data, initialBlockId, onClose }) {
  const { blocks, loading: blocksLoading } = useChoreBlocks();
  const {
    places, placesById, childrenByParent, placementsByPlaceId,
    loading: sitesLoading,
  } = useSites();
  const {
    logRunEvent, logMortality, recentConditionsByPlace, repeatWindowDays,
  } = useRunEvents();
  const {
    definitions, loading: defsLoading,
  } = useChoreDefinitions();
  const {
    activeRun, nextBlock, runByBlockId, historicalRuns, runs: todayRuns,
    loading: runsLoading,
    startRun, endRun, resumeRun, cancelRun,
  } = useChoreRuns({ blocks });

  // The block this Rounds session is targeting. Active run wins over
  // everything (you can't run two blocks at once); a deep-linked
  // initialBlockId (from the Now surface) wins over the inferred next
  // block.
  const targetBlock = useMemo(() => {
    if (activeRun) {
      return blocks.find(b => b.id === activeRun.blockId) ?? null;
    }
    if (initialBlockId) {
      const linked = blocks.find(b => b.id === initialBlockId);
      if (linked) return linked;
    }
    return nextBlock?.block ?? null;
  }, [activeRun, nextBlock, blocks, initialBlockId]);

  const today = useMemo(() => new Date(), []);
  const completions = useChoreCompletions(today);

  // Selected place for the Switcher. selectedPlaceId is a top-level
  // place (a "zone" chip); selectedChildId drills to one place inside
  // its subtree. Null = "show everything" for this block, grouped by
  // top-level place.
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [selectedChildId, setSelectedChildId] = useState(null);
  // Switcher grouping axis (Batch 17, decision 4): geography ("place",
  // the default — Dad moves by place) or kind_tag ("kind" — sweep all
  // coops at once). Each mode keeps its own selection.
  const [groupMode, setGroupMode] = useState("place");
  const [selectedKindTag, setSelectedKindTag] = useState(null);

  // The switcher operates at the top-level (depth-1: a child of the
  // farm root). Map any place to its top-level ancestor so a chore deep
  // in the tree still lands under the right chip.
  const switcherIdOf = useMemo(() => (placeId) => {
    if (!placeId) return null;
    const path = placePath(placeId, placesById); // [root, …, place]
    if (path.length === 0) return null;
    return path.length === 1 ? path[0].id : path[1].id;
  }, [placesById]);

  // Top-level places whose subtree has a chore in this block — the only
  // Switcher chips worth rendering.
  const relevantSwitcherIds = useMemo(() => {
    if (!targetBlock) return new Set();
    const ids = new Set();
    for (const def of definitions) {
      if (def.blockId !== targetBlock.id) continue;
      const sid = switcherIdOf(def.placeId);
      if (sid) ids.add(sid);
    }
    return ids;
  }, [definitions, switcherIdOf, targetBlock]);

  const switcherPlaces = useMemo(
    () => (places ?? [])
      .filter(p => p.isActive !== false && relevantSwitcherIds.has(p.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [places, relevantSwitcherIds]
  );

  // Loading guard. Show a skeleton until enough data is ready to
  // make sensible decisions.
  if (blocksLoading || sitesLoading || defsLoading || runsLoading) {
    return (
      <div className="bg-bg text-fg h-screen flex items-center justify-center font-body">
        <div className="text-[12px] text-muted uppercase tracking-[0.16em]">
          Loading rounds…
        </div>
      </div>
    );
  }

  // Wrap card when the run is in the 'done' state. Auto-derive
  // flips state from the completion count, so reaching this surface
  // means every chore in the block is checked. If the user un-checks
  // a chore (from Today / Upcoming / wherever), the run flips back
  // and Rounds will re-render the doing surface.
  const targetRun = targetBlock ? runByBlockId.get(targetBlock.id) : null;
  if (targetRun?.state === "done") {
    return (
      <WrapCard
        block={targetBlock}
        run={targetRun}
        onClose={onClose}
      />
    );
  }

  // Cold open: no active run for the next block yet.
  if (!activeRun) {
    return (
      <ColdOpen
        block={targetBlock}
        blocks={blocks}
        todayRuns={todayRuns}
        historicalRuns={historicalRuns}
        runByBlockId={runByBlockId}
        onStart={async () => {
          if (!targetBlock) return;
          await startRun(targetBlock.id);
        }}
        onStartBlock={async (blockId) => {
          if (!blockId) return;
          await startRun(blockId);
        }}
        onResumeRun={async (runId) => {
          await resumeRun(runId);
        }}
        onClose={onClose}
      />
    );
  }

  // Active run — the main doing surface. The run state derives from
  // completions: when every chore in the block is checked, we
  // auto-flip chore_runs.state to 'done'; un-checking flips it back.
  return (
    <DoingSurface
      data={data}
      run={activeRun}
      block={targetBlock}
      blocks={blocks}
      places={places}
      placesById={placesById}
      childrenByParent={childrenByParent}
      switcherPlaces={switcherPlaces}
      switcherIdOf={switcherIdOf}
      placementsByPlaceId={placementsByPlaceId}
      definitions={definitions}
      completions={completions}
      logRunEvent={logRunEvent}
      logMortality={logMortality}
      onCancelRun={async () => {
        if (!activeRun) return;
        await cancelRun(activeRun.id);
      }}
      recentConditionsByPlace={recentConditionsByPlace}
      repeatWindowDays={repeatWindowDays}
      selectedPlaceId={selectedPlaceId}
      onSelectPlace={(id) => {
        setSelectedPlaceId(id);
        setSelectedChildId(null);
      }}
      selectedChildId={selectedChildId}
      onSelectChild={setSelectedChildId}
      groupMode={groupMode}
      onChangeGroupMode={(mode) => {
        setGroupMode(mode);
        setSelectedPlaceId(null);
        setSelectedChildId(null);
        setSelectedKindTag(null);
      }}
      selectedKindTag={selectedKindTag}
      onSelectKindTag={setSelectedKindTag}
      onAutoDone={async () => {
        if (!activeRun) return;
        await endRun(activeRun.id);
      }}
      onAutoUndone={async () => {
        if (!activeRun) return;
        await resumeRun(activeRun.id);
      }}
      onClose={onClose}
    />
  );
}

// ── Cold open ─────────────────────────────────────────────────────────
function ColdOpen({
  block, blocks, todayRuns, historicalRuns, runByBlockId,
  onStart, onStartBlock, onResumeRun, onClose,
}) {
  // Other blocks the user can launch out of natural sequence —
  // everything other than the suggested "next" block, ordered by
  // today's resolved start time.
  const otherBlocks = useMemo(() => {
    const today = new Date();
    return (blocks ?? [])
      .filter(b => b.isActive && b.id !== block?.id)
      .map(b => ({
        block: b,
        start: resolveBlockMinutes(today, b.startKind, b.startMinutes),
      }))
      .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  }, [blocks, block]);

  // History: today's done/canceled runs, then yesterday-and-back.
  const todayHistory = (todayRuns ?? [])
    .filter(r => r.state === "done" || r.state === "canceled");
  const recentHistory = [...todayHistory, ...(historicalRuns ?? [])]
    .slice(0, 8);

  return (
    <div className="bg-bg text-fg min-h-screen flex flex-col font-body relative overflow-y-auto">
      <CloseButton onClose={onClose} />
      {/* Queued / not-synced indicator (Batch 16.2) */}
      <div className="absolute top-5 left-4 sm:left-6">
        <OutboxIndicator />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 pt-16 max-w-[480px] mx-auto w-full">
        <div className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
          Rounds
        </div>
        <h1 className="font-heading text-[36px] font-bold -tracking-[0.02em] m-0 text-center">
          {block ? `${block.name} rounds` : "No block scheduled"}
        </h1>
        {block && (
          <p className="text-[14px] text-dim m-0 leading-relaxed text-center">
            {displayBlockSide(block.startKind, block.startMinutes)}
            {" · "}
            {formatBlockDuration(block.durationMinutes)}
          </p>
        )}
        {block ? (
          <button
            onClick={onStart}
            className="mt-2 inline-flex items-center justify-center gap-2 bg-accent text-on-accent border-0 font-[inherit] text-[14px] font-bold uppercase tracking-[0.12em] px-8 py-4 cursor-pointer w-full"
          >
            Start rounds
          </button>
        ) : (
          <p className="text-[12px] text-faint m-0 text-center">
            Add at least one time block in Chores → Blocks before
            you can start a run.
          </p>
        )}

        {otherBlocks.length > 0 && (
          <div className="w-full flex flex-col gap-2 mt-2">
            <div className="text-[10px] text-muted uppercase tracking-[0.16em] font-semibold text-center">
              Or pick a different block
            </div>
            <div className="flex flex-col gap-1.5">
              {otherBlocks.map(({ block: b }) => {
                const r = runByBlockId.get(b.id);
                const stateLabel = r?.state === "done"
                  ? "done today"
                  : r?.state === "canceled"
                    ? "canceled today"
                    : null;
                return (
                  <button
                    key={b.id}
                    onClick={() => onStartBlock(b.id)}
                    className={
                      "flex items-center gap-3 w-full px-3 py-2.5 " +
                      "bg-surface border border-line cursor-pointer " +
                      "text-left hover:border-fg transition-colors duration-100"
                    }
                  >
                    <span className="text-[13px] font-semibold text-fg flex-1">
                      {b.name}
                    </span>
                    <span className="text-[11px] text-dim">
                      {displayBlockSide(b.startKind, b.startMinutes)}
                      {" · "}
                      {formatBlockDuration(b.durationMinutes)}
                    </span>
                    {stateLabel && (
                      <span className="text-[10px] text-faint uppercase tracking-[0.12em] font-semibold">
                        {stateLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {recentHistory.length > 0 && (
          <RecentRuns
            runs={recentHistory}
            blocks={blocks}
            onResumeRun={onResumeRun}
          />
        )}
      </div>
    </div>
  );
}

function RecentRuns({ runs, blocks, onResumeRun }) {
  const blockById = useMemo(() => {
    const m = new Map();
    for (const b of blocks ?? []) m.set(b.id, b);
    return m;
  }, [blocks]);
  return (
    <div className="w-full flex flex-col gap-2 mt-2">
      <div className="text-[10px] text-muted uppercase tracking-[0.16em] font-semibold text-center">
        Recent rounds
      </div>
      <ul className="flex flex-col gap-1 list-none m-0 p-0">
        {runs.map(r => {
          const b = blockById.get(r.blockId);
          const elapsed = r.startedAt && r.endedAt
            ? r.endedAt.getTime() - r.startedAt.getTime()
            : 0;
          return (
            <li
              key={r.id}
              className="flex items-center gap-2 px-3 py-2 bg-surface border border-line"
            >
              <span className="text-[12px] font-semibold text-fg flex-1">
                {b?.name ?? "Block"}
              </span>
              <span className="text-[10px] text-faint uppercase tracking-[0.12em]">
                {r.runDate}
              </span>
              <span className="text-[11px] text-dim">
                {r.state === "canceled"
                  ? "canceled"
                  : formatElapsed(elapsed)}
              </span>
              {r.state === "done" && (
                <button
                  onClick={() => onResumeRun(r.id)}
                  className="text-[10px] text-dim hover:text-fg uppercase tracking-[0.12em] font-semibold border-0 bg-transparent cursor-pointer"
                >
                  Resume
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Wrap card ─────────────────────────────────────────────────────────
function WrapCard({ block, run, onClose }) {
  const elapsed = (run.endedAt && run.startedAt)
    ? run.endedAt.getTime() - run.startedAt.getTime()
    : 0;
  const overran = isOverran(block, run);
  return (
    <div className="bg-bg text-fg h-screen flex flex-col items-center justify-center font-body p-6 relative">
      <CloseButton onClose={onClose} />
      <div className="flex flex-col items-center gap-5 max-w-[420px] text-center">
        <div className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
          {block?.name ?? "Rounds"} done
        </div>
        <h1 className="font-heading text-[44px] font-bold -tracking-[0.02em] m-0 text-fg">
          {formatElapsed(elapsed)}
        </h1>
        {overran && (
          <div className="text-[13px] text-warn">
            Ran {overran} past the window.
          </div>
        )}
        <p className="text-[12px] text-muted m-0 leading-relaxed">
          Un-checking any chore in this block will reopen the run.
        </p>
        <button
          onClick={onClose}
          className="mt-4 inline-flex items-center gap-1.5 bg-accent text-on-accent border-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-4 py-2 cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function isOverran(block, run) {
  if (!block || !run?.endedAt || !run?.startedAt) return null;
  const startMin = resolveBlockMinutes(run.endedAt, block.startKind, block.startMinutes);
  if (startMin === null) return null;
  const endMin = startMin + (block.durationMinutes ?? 0);
  const endedMin = run.endedAt.getHours() * 60 + run.endedAt.getMinutes();
  if (endedMin <= endMin) return null;
  const overMin = endedMin - endMin;
  if (overMin < 60) return `${overMin}m`;
  const h = Math.floor(overMin / 60);
  const m = overMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatBlockDuration(minutes) {
  if (typeof minutes !== "number" || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Doing surface (active run) ────────────────────────────────────────
function DoingSurface({
  run, block, blocks, places, placesById, childrenByParent,
  switcherPlaces, switcherIdOf, placementsByPlaceId,
  definitions, completions,
  logRunEvent, logMortality, onCancelRun,
  recentConditionsByPlace, repeatWindowDays,
  selectedPlaceId, onSelectPlace,
  selectedChildId, onSelectChild,
  groupMode, onChangeGroupMode,
  selectedKindTag, onSelectKindTag,
  onAutoDone, onAutoUndone, onClose,
}) {
  // Live elapsed time tick.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = run.startedAt ? now - run.startedAt.getTime() : 0;

  // Filter chores to this run's block.
  const blockChores = useMemo(
    () => definitions.filter(d => d.blockId === block?.id),
    [definitions, block]
  );

  // Fan each chore into per-place obligations (Batch 16.1). A chore
  // scoped to a parent place produces one independently completable
  // { chore, placeId } entry per occupied descendant place. Within a
  // chore, obligations sort by place sortOrder then name so render
  // order is stable.
  const blockObligations = useMemo(() => {
    const out = [];
    for (const chore of blockChores) {
      const placeIds = obligationPlaceIds(
        chore, childrenByParent, placementsByPlaceId
      );
      const sorted = [...placeIds].sort((a, b) => {
        const pa = a ? placesById.get(a) : null;
        const pb = b ? placesById.get(b) : null;
        return (
          (pa?.sortOrder ?? 0) - (pb?.sortOrder ?? 0) ||
          (pa?.name ?? "").localeCompare(pb?.name ?? "")
        );
      });
      for (const placeId of sorted) out.push({ chore, placeId });
    }
    return out;
  }, [blockChores, childrenByParent, placementsByPlaceId, placesById]);

  // Auto-derive run completion: every obligation checked → done; any
  // un-checked while done → resume. Guard against the trivial 0/0
  // case (no chores in the block) — never auto-flip then.
  // useRef ensures we don't fire writes during the same render that
  // saw the transition (would double-flip). Only fires on local
  // edits; remote echoes go through the same path harmlessly thanks
  // to the no-op guard.
  //
  // Since Batch 17 the run lifecycle goes through the outbox too, so
  // the auto-flip applies locally even with no signal — the old
  // "blocked until connectivity returns" guard is gone.
  const writingRef = useRef(false);
  useEffect(() => {
    if (writingRef.current) return;
    if (!run) return;
    if (blockObligations.length === 0) return;
    if (completions.loading) return;
    const completed = blockObligations.filter(o =>
      completions.isDone(o.chore.id, o.placeId)
    ).length;
    const allDone = completed === blockObligations.length;
    if (allDone && run.state === "in_progress") {
      writingRef.current = true;
      Promise.resolve(onAutoDone())
        .catch(() => {})
        .finally(() => {
          writingRef.current = false;
        });
    } else if (!allDone && run.state === "done") {
      writingRef.current = true;
      Promise.resolve(onAutoUndone())
        .catch(() => {})
        .finally(() => {
          writingRef.current = false;
        });
    }
  }, [
    blockObligations, completions.isDone, completions.loading, run,
    onAutoDone, onAutoUndone,
  ]);

  // Group obligations by their top-level place for the all-places
  // view. Each obligation lands under the switcher place its own
  // place rolls up to (a Pasture-A chore fanned into CT1 lands under
  // Pastures); obligations with no place go into a "general" bucket.
  const obligationsBySwitcher = useMemo(() => {
    const out = new Map();
    const general = [];
    for (const o of blockObligations) {
      const sid = switcherIdOf(o.placeId ?? o.chore.placeId);
      if (sid) {
        if (!out.has(sid)) out.set(sid, []);
        out.get(sid).push(o);
      } else {
        general.push(o);
      }
    }
    return { out, general };
  }, [blockObligations, switcherIdOf]);

  // Within the selected top-level place, group obligations by their
  // actual place (subtree). Obligations sitting exactly at the
  // selected place land in the "anywhere in X" bucket.
  const groupedForSelected = useMemo(() => {
    if (!selectedPlaceId) return null;
    const subtree = descendantIds(selectedPlaceId, childrenByParent);
    const groups = new Map(); // placeId → obligations[]
    const anywhere = [];
    for (const o of blockObligations) {
      if (!o.placeId || !subtree.has(o.placeId)) continue;
      if (o.placeId === selectedPlaceId) {
        anywhere.push(o);
      } else {
        if (!groups.has(o.placeId)) groups.set(o.placeId, []);
        groups.get(o.placeId).push(o);
      }
    }
    return { groups, anywhere };
  }, [selectedPlaceId, blockObligations, childrenByParent]);

  // Group obligations by their place's kind_tag (Batch 17, decision 4)
  // — the "sweep all coops" axis. Places without a kind_tag (and
  // placeless obligations) land under "other".
  const obligationsByKind = useMemo(() => {
    const out = new Map();
    for (const o of blockObligations) {
      const place = o.placeId ? placesById.get(o.placeId) : null;
      const tag = place?.kindTag || "other";
      if (!out.has(tag)) out.set(tag, []);
      out.get(tag).push(o);
    }
    return out;
  }, [blockObligations, placesById]);

  return (
    <div className="bg-bg text-fg h-screen flex flex-col font-body">
      {/* Status bar */}
      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-line bg-surface">
        <div className="flex flex-col">
          <div className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
            {block?.name ?? "Rounds"}
          </div>
          <div className="font-heading text-[20px] font-bold -tracking-[0.02em] text-fg leading-tight">
            {formatElapsed(elapsed)}
          </div>
        </div>
        {/* Queued / not-synced indicator (Batch 16.2) — the field
            surface is exactly where offline capture happens, so it
            gets the loudest placement. */}
        <OutboxIndicator />
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={async () => {
              const ok = window.confirm(
                "Cancel this run? Chores stay as ticked but the run is " +
                "marked canceled instead of done."
              );
              if (!ok) return;
              await onCancelRun();
            }}
            className="text-muted hover:text-warn p-2 cursor-pointer bg-transparent border-0 text-[10px] uppercase tracking-[0.12em] font-semibold"
            title="Cancel this run"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="text-muted hover:text-fg p-2 cursor-pointer bg-transparent border-0"
            title="Exit (run keeps going — resume from Now)"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Place Switcher */}
      <PlaceSwitcher
        places={switcherPlaces}
        selectedPlaceId={selectedPlaceId}
        onSelect={onSelectPlace}
        groupMode={groupMode}
        onChangeGroupMode={onChangeGroupMode}
        kindTags={[...obligationsByKind.keys()].sort()}
        selectedKindTag={selectedKindTag}
        onSelectKindTag={onSelectKindTag}
      />

      {/* Body */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {groupMode === "kind" ? (
          <KindView
            obligationsByKind={obligationsByKind}
            placesById={placesById}
            blocks={blocks}
            completions={completions}
            selectedKindTag={selectedKindTag}
            onSelectKindTag={onSelectKindTag}
          />
        ) : !selectedPlaceId ? (
          <AllPlacesView
            switcherPlaces={switcherPlaces}
            obligations={blockObligations}
            obligationsBySwitcher={obligationsBySwitcher}
            placesById={placesById}
            blocks={blocks}
            completions={completions}
            onSelectPlace={onSelectPlace}
          />
        ) : (
          <SelectedPlaceView
            place={placesById.get(selectedPlaceId)}
            grouped={groupedForSelected}
            placesById={placesById}
            blocks={blocks}
            completions={completions}
            selectedChildId={selectedChildId}
            onSelectChild={onSelectChild}
          />
        )}
      </main>

      {/* Quick actions tray (Run Events) */}
      <QuickActionsTray
        runId={run.id}
        selectedPlaceId={selectedChildId ?? selectedPlaceId}
        places={places}
        placesById={placesById}
        childrenByParent={childrenByParent}
        placementsByPlaceId={placementsByPlaceId}
        recentConditionsByPlace={recentConditionsByPlace}
        repeatWindowDays={repeatWindowDays}
        onLogRunEvent={logRunEvent}
        onLogMortality={logMortality}
      />
    </div>
  );
}

// ── Place Switcher ────────────────────────────────────────────────────
// Two grouping axes (Batch 17, decision 4): geography (top-level place
// chips — the default) or kind_tag ("sweep all coops"). The toggle on
// the right flips between them; each axis keeps its own selection.
function PlaceSwitcher({
  places, selectedPlaceId, onSelect,
  groupMode, onChangeGroupMode,
  kindTags, selectedKindTag, onSelectKindTag,
}) {
  return (
    <nav className="flex items-center gap-1 px-4 sm:px-6 py-2 border-b border-line bg-surface-alt overflow-x-auto no-scrollbar">
      {groupMode === "kind" ? (
        <>
          <SwitcherChip
            active={selectedKindTag === null}
            onClick={() => onSelectKindTag(null)}
          >
            All kinds
          </SwitcherChip>
          {kindTags.map(tag => (
            <SwitcherChip
              key={tag}
              active={selectedKindTag === tag}
              onClick={() => onSelectKindTag(tag)}
            >
              {kindTagLabel(tag)}
            </SwitcherChip>
          ))}
        </>
      ) : (
        <>
          <SwitcherChip
            active={selectedPlaceId === null}
            onClick={() => onSelect(null)}
          >
            Everywhere
          </SwitcherChip>
          {places.map(p => (
            <SwitcherChip
              key={p.id}
              active={selectedPlaceId === p.id}
              onClick={() => onSelect(p.id)}
            >
              {p.name}
            </SwitcherChip>
          ))}
        </>
      )}
      <div className="ml-auto flex items-center pl-3 shrink-0 gap-0">
        <GroupModeButton
          active={groupMode === "place"}
          onClick={() => onChangeGroupMode("place")}
        >
          Place
        </GroupModeButton>
        <GroupModeButton
          active={groupMode === "kind"}
          onClick={() => onChangeGroupMode("kind")}
        >
          Kind
        </GroupModeButton>
      </div>
    </nav>
  );
}

// Display label for a kind_tag chip: "coop" → "Coops".
function kindTagLabel(tag) {
  if (!tag || tag === "other") return "Other";
  const cap = tag.charAt(0).toUpperCase() + tag.slice(1);
  return pluralize(cap);
}

function GroupModeButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center font-[inherit] text-[10px] " +
        "font-semibold uppercase tracking-[0.12em] px-2.5 py-1.5 " +
        "cursor-pointer border leading-none transition-colors " +
        "duration-100 shrink-0 -ml-px first:ml-0 " +
        (active
          ? "bg-row-active border-fg text-fg"
          : "bg-transparent border-line text-muted hover:text-fg")
      }
    >
      {children}
    </button>
  );
}

function SwitcherChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 font-[inherit] text-[11px] " +
        "font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer " +
        "border leading-none transition-colors duration-100 shrink-0 " +
        (active
          ? "bg-row-active border-line text-fg"
          : "bg-transparent border-line text-dim hover:bg-row-hover hover:text-fg")
      }
    >
      {children}
    </button>
  );
}

// ── All-places view ───────────────────────────────────────────────────
function AllPlacesView({
  switcherPlaces, obligations, obligationsBySwitcher, placesById, blocks,
  completions, onSelectPlace,
}) {
  if (obligations.length === 0) {
    return (
      <div className="bg-surface border border-line py-10 px-6 text-center max-w-[520px] mx-auto">
        <div className="text-[13px] text-muted font-medium mb-1">
          No chores in this block
        </div>
        <div className="text-[12px] text-faint leading-relaxed max-w-[420px] mx-auto">
          Assign chores to this block in Chores → All chores or
          add new ones.
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 max-w-[680px] mx-auto">
      {switcherPlaces
        .filter(p => obligationsBySwitcher.out.has(p.id))
        .map(p => (
          <PlaceSection
            key={p.id}
            place={p}
            obligations={obligationsBySwitcher.out.get(p.id)}
            placesById={placesById}
            blocks={blocks}
            completions={completions}
            onTitleClick={() => onSelectPlace(p.id)}
          />
        ))}
      {obligationsBySwitcher.general.length > 0 && (
        <PlaceSection
          place={{ id: null, name: "Other" }}
          obligations={obligationsBySwitcher.general}
          placesById={placesById}
          blocks={blocks}
          completions={completions}
        />
      )}
    </div>
  );
}

function PlaceSection({
  place, obligations, placesById, blocks, completions, onTitleClick,
}) {
  const completed = obligations.filter(o =>
    completions.isDone(o.chore.id, o.placeId)
  ).length;
  return (
    <section className="bg-surface border border-line">
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-line">
        {onTitleClick ? (
          <button
            onClick={onTitleClick}
            className="text-[14px] font-semibold text-fg border-0 bg-transparent cursor-pointer hover:underline"
          >
            {place.name}
          </button>
        ) : (
          <span className="text-[14px] font-semibold text-fg">{place.name}</span>
        )}
        <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted font-semibold">
          {completed}/{obligations.length} done
        </span>
        <AllDoneButton obligations={obligations} completions={completions} />
      </header>
      <ul className="m-0 p-0 list-none">
        {obligations.map(o => {
          // Show the obligation's specific place under the title when
          // it's deeper than this section's top-level place — D1
          // disambiguated (name + bold parent).
          const op = o.placeId ? placesById.get(o.placeId) : null;
          const subLabel = op && op.id !== place.id
            ? <PlaceTag place={op} placesById={placesById} />
            : null;
          return (
            <ChoreCheckRow
              key={`${o.chore.id}|${o.placeId ?? ""}`}
              chore={o.chore}
              placeId={o.placeId}
              placeLabel={subLabel}
              blocks={blocks}
              completions={completions}
            />
          );
        })}
      </ul>
    </section>
  );
}

// ── Kind view (group-by-kind_tag mode) ───────────────────────────────
// "Sweep all coops": one section per kind_tag when nothing is
// selected; selecting a kind drills to one section per specific place
// of that kind. Reuses PlaceSection so progress chips + the bulk
// "All taken care of" affordance work identically on both axes.
function KindView({
  obligationsByKind, placesById, blocks, completions,
  selectedKindTag, onSelectKindTag,
}) {
  const tags = [...obligationsByKind.keys()].sort();
  if (tags.length === 0) {
    return (
      <div className="bg-surface border border-line py-10 px-6 text-center max-w-[520px] mx-auto">
        <div className="text-[13px] text-muted font-medium mb-1">
          No chores in this block
        </div>
        <div className="text-[12px] text-faint leading-relaxed max-w-[420px] mx-auto">
          Assign chores to this block in Chores → All chores or
          add new ones.
        </div>
      </div>
    );
  }

  if (selectedKindTag === null) {
    return (
      <div className="flex flex-col gap-4 max-w-[680px] mx-auto">
        {tags.map(tag => (
          <PlaceSection
            key={tag}
            place={{ id: null, name: kindTagLabel(tag) }}
            obligations={obligationsByKind.get(tag)}
            placesById={placesById}
            blocks={blocks}
            completions={completions}
            onTitleClick={() => onSelectKindTag(tag)}
          />
        ))}
      </div>
    );
  }

  // Selected kind → one section per specific place of that kind.
  const obligations = obligationsByKind.get(selectedKindTag) ?? [];
  const byPlace = new Map();
  for (const o of obligations) {
    const key = o.placeId ?? null;
    if (!byPlace.has(key)) byPlace.set(key, []);
    byPlace.get(key).push(o);
  }
  const placeIds = [...byPlace.keys()].sort((a, b) => {
    const pa = a ? placesById.get(a) : null;
    const pb = b ? placesById.get(b) : null;
    return (
      (pa?.sortOrder ?? 0) - (pb?.sortOrder ?? 0) ||
      (pa?.name ?? "").localeCompare(pb?.name ?? "")
    );
  });
  return (
    <div className="flex flex-col gap-4 max-w-[680px] mx-auto">
      <button
        onClick={() => onSelectKindTag(null)}
        className="self-start inline-flex items-center gap-1 text-[11px] text-dim hover:text-fg uppercase tracking-[0.12em] font-semibold border-0 bg-transparent cursor-pointer"
      >
        <ChevronLeft size={12} className="shrink-0" />
        {kindTagLabel(selectedKindTag)}
      </button>
      {placeIds.map(pid => (
        <PlaceSection
          key={pid ?? "other"}
          place={pid ? placesById.get(pid) : { id: null, name: "Other" }}
          obligations={byPlace.get(pid)}
          placesById={placesById}
          blocks={blocks}
          completions={completions}
        />
      ))}
    </div>
  );
}

// Bulk-tick affordance for a section. Folds in what the old Sweep
// quick-action did: per-site "all taken care of" → mark every
// obligation in this section done in one tap. Batched per chore (one
// INSERT per chore covering all its remaining places) instead of one
// round-trip per row. Disabled while a tick is in flight so
// back-to-back taps don't double-fire on contention.
function AllDoneButton({ obligations, completions }) {
  const [pending, setPending] = useState(false);
  const undone = obligations.filter(o =>
    !completions.isDone(o.chore.id, o.placeId)
  );
  if (undone.length === 0 || obligations.length === 0) return null;
  const onClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      // Group remaining obligations by chore → one batched insert per
      // chore.
      const byChore = new Map();
      for (const o of undone) {
        if (!byChore.has(o.chore.id)) byChore.set(o.chore.id, []);
        byChore.get(o.chore.id).push(o.placeId);
      }
      for (const [choreId, placeIds] of byChore) {
        // eslint-disable-next-line no-await-in-loop
        await completions.toggleMany(choreId, placeIds, true);
      }
    } finally {
      setPending(false);
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={
        "inline-flex items-center font-[inherit] text-[10px] " +
        "font-semibold uppercase tracking-[0.12em] px-2 py-1 cursor-pointer " +
        "border border-line bg-transparent text-dim leading-none " +
        "hover:border-fg hover:text-fg transition-colors duration-100 " +
        "disabled:opacity-50 disabled:cursor-not-allowed"
      }
      title="Mark every chore in this group done"
    >
      All taken care of
    </button>
  );
}

// ── Selected-place view (with optional drill to a child place) ───────
function SelectedPlaceView({
  place, grouped, placesById, blocks, completions,
  selectedChildId, onSelectChild,
}) {
  // The child places (within the selected subtree) that actually have
  // chores — these drive the drill-down strip and the per-place sections.
  const childPlaces = [...(grouped?.groups?.keys() ?? [])]
    .map(id => placesById.get(id))
    .filter(Boolean)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const showChildStrip = childPlaces.length > 1;

  return (
    <div className="flex flex-col gap-4 max-w-[680px] mx-auto">
      {/* Back to "everywhere" affordance */}
      <button
        onClick={() => onSelectChild(null)}
        className="self-start inline-flex items-center gap-1 text-[11px] text-dim hover:text-fg uppercase tracking-[0.12em] font-semibold border-0 bg-transparent cursor-pointer"
      >
        <ChevronLeft size={12} className="shrink-0" />
        {place?.name ?? "Place"}
      </button>

      {showChildStrip && (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <SwitcherChip
            active={selectedChildId === null}
            onClick={() => onSelectChild(null)}
          >
            All
          </SwitcherChip>
          {childPlaces.map(c => (
            <SwitcherChip
              key={c.id}
              active={selectedChildId === c.id}
              onClick={() => onSelectChild(c.id)}
            >
              {c.name}
            </SwitcherChip>
          ))}
        </div>
      )}

      {grouped?.anywhere?.length > 0 && selectedChildId === null && (
        <section className="bg-surface border border-line">
          <header className="flex items-center gap-3 px-4 py-2.5 border-b border-line">
            <span className="text-[12px] font-semibold text-fg uppercase tracking-[0.12em]">
              Anywhere in {place?.name?.toLowerCase()}
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted font-semibold">
              {grouped.anywhere.filter(o =>
                completions.isDone(o.chore.id, o.placeId)
              ).length}
              /
              {grouped.anywhere.length} done
            </span>
            <AllDoneButton
              obligations={grouped.anywhere}
              completions={completions}
            />
          </header>
          <ul className="m-0 p-0 list-none">
            {grouped.anywhere.map(o => (
              <ChoreCheckRow
                key={`${o.chore.id}|${o.placeId ?? ""}`}
                chore={o.chore}
                placeId={o.placeId}
                blocks={blocks}
                completions={completions}
              />
            ))}
          </ul>
        </section>
      )}

      {childPlaces
        .filter(c => selectedChildId === null || selectedChildId === c.id)
        .map(c => {
          const obligations = grouped?.groups?.get(c.id) ?? [];
          const completed = obligations.filter(o =>
            completions.isDone(o.chore.id, o.placeId)
          ).length;
          return (
            <section key={c.id} className="bg-surface border border-line">
              <header className="flex items-center gap-3 px-4 py-2.5 border-b border-line">
                <span className="text-[14px] font-semibold text-fg">{c.name}</span>
                <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted font-semibold">
                  {completed}/{obligations.length} done
                </span>
                <AllDoneButton
                  obligations={obligations}
                  completions={completions}
                />
              </header>
              <ul className="m-0 p-0 list-none">
                {obligations.map(o => (
                  <ChoreCheckRow
                    key={`${o.chore.id}|${o.placeId ?? ""}`}
                    chore={o.chore}
                    placeId={o.placeId}
                    blocks={blocks}
                    completions={completions}
                  />
                ))}
              </ul>
            </section>
          );
        })}
    </div>
  );
}

// ── Chore checkbox row ────────────────────────────────────────────────
// One row per (chore, place) obligation. Wraps the chore_completions
// toggle with fat tap targets and the realtime-contention "✓ +
// disabled" treatment. Completion state updates from the realtime
// channel within ~80ms of any other user's click; that flips the
// disabled state automatically.
function ChoreCheckRow({ chore, placeId, placeLabel, blocks, completions }) {
  const done = completions.isDone(chore.id, placeId);
  // Batch 16.2 — true while this row's tick is sitting in the
  // device-local outbox waiting for connectivity.
  const queued = completions.isQueued?.(chore.id, placeId) ?? false;
  const [pending, setPending] = useState(false);

  const onToggle = async () => {
    if (pending) return;
    setPending(true);
    try {
      await completions.toggle(chore.id, placeId, done);
    } finally {
      setPending(false);
    }
  };

  return (
    <li
      className={
        "flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 " +
        (done ? "bg-row-active-dim" : "bg-transparent")
      }
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
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
          <span className="truncate">{chore.title}</span>
          <ChoreRemainingPill chore={chore} blocks={blocks} />
          {queued && (
            <CloudOff
              size={12}
              className="shrink-0 text-warn"
              aria-label="Saved on this device — not synced yet"
            />
          )}
        </div>
        {placeLabel && (
          <div className="text-[11px] text-faint mt-0.5">{placeLabel}</div>
        )}
      </div>
    </li>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────
function CloseButton({ onClose }) {
  return (
    <button
      onClick={onClose}
      className="absolute top-4 right-4 text-muted hover:text-fg bg-transparent border-0 p-2 cursor-pointer"
      title="Close"
    >
      <X size={18} />
    </button>
  );
}
