import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Check, ChevronLeft,
} from "lucide-react";
import { useChoreBlocks, formatMinutesOfDay } from "../lib/data/useChoreBlocks.js";
import { useSites } from "../lib/data/useSites.js";
import { useChoreDefinitions } from "../lib/data/useChoreDefinitions.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { useChoreRuns, formatElapsed } from "../lib/data/useChoreRuns.js";
import { useRunEvents } from "../lib/data/useRunEvents.js";
import { resolveBlockMinutes, displayBlockSide } from "../lib/sunTimes.js";
import QuickActionsTray from "../components/QuickActionsTray.jsx";

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

export default function Rounds({ data, onClose }) {
  const { blocks, loading: blocksLoading } = useChoreBlocks();
  const {
    sites, locations, locationsBySiteId, residents,
    moveOutResident,
    loading: sitesLoading,
  } = useSites();
  const {
    logRunEvent, recentConditionsByLocation, repeatWindowDays,
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
  // the inferred next block, so reopening Rounds while a run is going
  // always lands on that run's block.
  const targetBlock = useMemo(() => {
    if (activeRun) {
      return blocks.find(b => b.id === activeRun.blockId) ?? null;
    }
    return nextBlock?.block ?? null;
  }, [activeRun, nextBlock, blocks]);

  const today = useMemo(() => new Date(), []);
  const completions = useChoreCompletions(today);

  // Selected site / location for the Switcher. Null = "show everything"
  // for this block, grouped by site.
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);

  // Derive sites that have chores in this block (parent site-scoped
  // or any location-scoped under them). We render Switcher buttons
  // only for sites that are actually relevant.
  const relevantSiteIds = useMemo(() => {
    if (!targetBlock) return new Set();
    const ids = new Set();
    for (const def of definitions) {
      if (def.blockId !== targetBlock.id) continue;
      if (def.siteId) ids.add(def.siteId);
      if (def.locationId) {
        const loc = locations.find(l => l.id === def.locationId);
        if (loc) ids.add(loc.siteId);
      }
    }
    return ids;
  }, [definitions, locations, targetBlock]);

  const switcherSites = useMemo(
    () => sites.filter(s => s.isActive && relevantSiteIds.has(s.id)),
    [sites, relevantSiteIds]
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
      sites={sites}
      switcherSites={switcherSites}
      locations={locations}
      locationsBySiteId={locationsBySiteId}
      residents={residents}
      definitions={definitions}
      completions={completions}
      logRunEvent={logRunEvent}
      onCancelRun={async () => {
        if (!activeRun) return;
        await cancelRun(activeRun.id);
      }}
      moveOutResident={moveOutResident}
      recentConditionsByLocation={recentConditionsByLocation}
      repeatWindowDays={repeatWindowDays}
      selectedSiteId={selectedSiteId}
      onSelectSite={(id) => {
        setSelectedSiteId(id);
        setSelectedLocationId(null);
      }}
      selectedLocationId={selectedLocationId}
      onSelectLocation={setSelectedLocationId}
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
  run, block, sites, switcherSites, locations, locationsBySiteId,
  residents, definitions, completions,
  logRunEvent, moveOutResident, onCancelRun,
  recentConditionsByLocation, repeatWindowDays,
  selectedSiteId, onSelectSite,
  selectedLocationId, onSelectLocation,
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

  // Auto-derive run completion: every chore checked → done; any
  // un-checked while done → resume. Guard against the trivial 0/0
  // case (no chores in the block) — never auto-flip then.
  // useRef ensures we don't fire writes during the same render that
  // saw the transition (would double-flip). Only fires on local
  // edits; remote echoes go through the same path harmlessly thanks
  // to the no-op guard.
  const writingRef = useRef(false);
  useEffect(() => {
    if (writingRef.current) return;
    if (!run) return;
    if (blockChores.length === 0) return;
    if (!completions.completedSet) return;
    const completed = blockChores.filter(c =>
      completions.completedSet.has(c.id)
    ).length;
    const allDone = completed === blockChores.length;
    if (allDone && run.state === "in_progress") {
      writingRef.current = true;
      Promise.resolve(onAutoDone()).finally(() => {
        writingRef.current = false;
      });
    } else if (!allDone && run.state === "done") {
      writingRef.current = true;
      Promise.resolve(onAutoUndone()).finally(() => {
        writingRef.current = false;
      });
    }
  }, [
    blockChores, completions.completedSet, run, onAutoDone, onAutoUndone,
  ]);

  // Group chores by site for rendering. site_id chores group under
  // that site; location_id chores group under their location's site.
  // Chores with neither go into a "general" bucket.
  const choresBySiteId = useMemo(() => {
    const out = new Map();
    const general = [];
    for (const def of blockChores) {
      let siteId = def.siteId;
      if (!siteId && def.locationId) {
        const loc = locations.find(l => l.id === def.locationId);
        siteId = loc?.siteId ?? null;
      }
      if (siteId) {
        if (!out.has(siteId)) out.set(siteId, []);
        out.get(siteId).push(def);
      } else {
        general.push(def);
      }
    }
    return { out, general };
  }, [blockChores, locations]);

  // Visible chores = either the selected site's, or all if no site
  // is selected.
  const visibleChores = selectedSiteId
    ? (choresBySiteId.out.get(selectedSiteId) ?? [])
    : blockChores;

  // Within selected site, group by location for clarity.
  const groupedForSelected = useMemo(() => {
    if (!selectedSiteId) return null;
    const groups = new Map(); // locationId|null → chores[]
    const siteScopedAll = [];
    for (const def of choresBySiteId.out.get(selectedSiteId) ?? []) {
      if (def.locationId) {
        if (!groups.has(def.locationId)) groups.set(def.locationId, []);
        groups.get(def.locationId).push(def);
      } else {
        siteScopedAll.push(def);
      }
    }
    return { groups, siteScopedAll };
  }, [selectedSiteId, choresBySiteId]);

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
            title="Exit (run keeps going — rejoin from the sidebar)"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Site Switcher */}
      <SiteSwitcher
        sites={switcherSites}
        selectedSiteId={selectedSiteId}
        onSelect={onSelectSite}
      />

      {/* Body */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {!selectedSiteId ? (
          <AllSitesView
            sites={sites}
            chores={blockChores}
            choresBySiteId={choresBySiteId}
            locations={locations}
            completions={completions}
            onSelectSite={onSelectSite}
          />
        ) : (
          <SelectedSiteView
            site={sites.find(s => s.id === selectedSiteId)}
            grouped={groupedForSelected}
            locationsBySiteId={locationsBySiteId}
            completions={completions}
            selectedLocationId={selectedLocationId}
            onSelectLocation={onSelectLocation}
          />
        )}
      </main>

      {/* Quick actions tray (Run Events) */}
      <QuickActionsTray
        runId={run.id}
        selectedSiteId={selectedSiteId}
        selectedLocationId={selectedLocationId}
        sites={sites}
        locations={locations}
        residents={residents}
        recentConditionsByLocation={recentConditionsByLocation}
        repeatWindowDays={repeatWindowDays}
        onLogRunEvent={logRunEvent}
        onMoveOutResident={moveOutResident}
      />
    </div>
  );
}

// ── Site Switcher ─────────────────────────────────────────────────────
function SiteSwitcher({ sites, selectedSiteId, onSelect }) {
  return (
    <nav className="flex items-center gap-1 px-4 sm:px-6 py-2 border-b border-line bg-surface-alt overflow-x-auto no-scrollbar">
      <SwitcherChip
        active={selectedSiteId === null}
        onClick={() => onSelect(null)}
      >
        All sites
      </SwitcherChip>
      {sites.map(s => (
        <SwitcherChip
          key={s.id}
          active={selectedSiteId === s.id}
          onClick={() => onSelect(s.id)}
        >
          {s.name}
        </SwitcherChip>
      ))}
    </nav>
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

// ── All-sites view ────────────────────────────────────────────────────
function AllSitesView({
  sites, chores, choresBySiteId, locations, completions, onSelectSite,
}) {
  if (chores.length === 0) {
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
      {sites
        .filter(s => choresBySiteId.out.has(s.id) && s.isActive)
        .map(s => (
          <SiteSection
            key={s.id}
            site={s}
            chores={choresBySiteId.out.get(s.id)}
            locations={locations}
            completions={completions}
            onTitleClick={() => onSelectSite(s.id)}
          />
        ))}
      {choresBySiteId.general.length > 0 && (
        <SiteSection
          site={{ id: null, name: "Other" }}
          chores={choresBySiteId.general}
          locations={locations}
          completions={completions}
        />
      )}
    </div>
  );
}

function SiteSection({ site, chores, locations, completions, onTitleClick }) {
  const completed = chores.filter(c => completions.completedSet?.has(c.id)).length;
  return (
    <section className="bg-surface border border-line">
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-line">
        {onTitleClick ? (
          <button
            onClick={onTitleClick}
            className="text-[14px] font-semibold text-fg border-0 bg-transparent cursor-pointer hover:underline"
          >
            {site.name}
          </button>
        ) : (
          <span className="text-[14px] font-semibold text-fg">{site.name}</span>
        )}
        <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted font-semibold">
          {completed}/{chores.length} done
        </span>
        <AllDoneButton chores={chores} completions={completions} />
      </header>
      <ul className="m-0 p-0 list-none">
        {chores.map(c => (
          <ChoreCheckRow
            key={c.id}
            chore={c}
            location={c.locationId ? locations.find(l => l.id === c.locationId) : null}
            completions={completions}
          />
        ))}
      </ul>
    </section>
  );
}

// Bulk-tick affordance for a section. Folds in what the old Sweep
// quick-action did: per-site "all taken care of" → mark every chore
// in this section done in one tap. Disabled while a tick is in
// flight so back-to-back taps don't double-fire on contention.
function AllDoneButton({ chores, completions }) {
  const [pending, setPending] = useState(false);
  const undone = chores.filter(c => !completions.completedSet?.has(c.id));
  if (undone.length === 0 || chores.length === 0) return null;
  const onClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      // toggle takes the current done state; pass false because every
      // chore in `undone` is currently not-done.
      for (const c of undone) {
        // eslint-disable-next-line no-await-in-loop
        await completions.toggle(c.id, false);
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

// ── Selected-site view (with optional location drill) ────────────────
function SelectedSiteView({
  site, grouped, locationsBySiteId, completions,
  selectedLocationId, onSelectLocation,
}) {
  const siteLocations = (locationsBySiteId.get(site?.id) ?? []).filter(l => l.isActive);
  const showLocationStrip = siteLocations.length > 1;

  return (
    <div className="flex flex-col gap-4 max-w-[680px] mx-auto">
      {/* Back to "all sites" affordance */}
      <button
        onClick={() => onSelectLocation(null)}
        className="self-start inline-flex items-center gap-1 text-[11px] text-dim hover:text-fg uppercase tracking-[0.12em] font-semibold border-0 bg-transparent cursor-pointer"
      >
        <ChevronLeft size={12} className="shrink-0" />
        {site?.name ?? "Site"}
      </button>

      {showLocationStrip && (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <SwitcherChip
            active={selectedLocationId === null}
            onClick={() => onSelectLocation(null)}
          >
            All locations
          </SwitcherChip>
          {siteLocations.map(l => (
            <SwitcherChip
              key={l.id}
              active={selectedLocationId === l.id}
              onClick={() => onSelectLocation(l.id)}
            >
              {l.name}
            </SwitcherChip>
          ))}
        </div>
      )}

      {grouped?.siteScopedAll?.length > 0 && (
        <section className="bg-surface border border-line">
          <header className="flex items-center gap-3 px-4 py-2.5 border-b border-line">
            <span className="text-[12px] font-semibold text-fg uppercase tracking-[0.12em]">
              Anywhere in {site?.name?.toLowerCase()}
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted font-semibold">
              {grouped.siteScopedAll.filter(c => completions.completedSet?.has(c.id)).length}
              /
              {grouped.siteScopedAll.length} done
            </span>
            <AllDoneButton chores={grouped.siteScopedAll} completions={completions} />
          </header>
          <ul className="m-0 p-0 list-none">
            {grouped.siteScopedAll.map(c => (
              <ChoreCheckRow key={c.id} chore={c} completions={completions} />
            ))}
          </ul>
        </section>
      )}

      {siteLocations
        .filter(l => selectedLocationId === null || selectedLocationId === l.id)
        .map(l => {
          const chores = grouped?.groups?.get(l.id) ?? [];
          if (chores.length === 0 && selectedLocationId !== l.id) return null;
          const completed = chores.filter(c => completions.completedSet?.has(c.id)).length;
          return (
            <section key={l.id} className="bg-surface border border-line">
              <header className="flex items-center gap-3 px-4 py-2.5 border-b border-line">
                <span className="text-[14px] font-semibold text-fg">{l.name}</span>
                <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted font-semibold">
                  {completed}/{chores.length} done
                </span>
                <AllDoneButton chores={chores} completions={completions} />
              </header>
              {chores.length === 0 ? (
                <div className="text-faint text-[11px] italic px-4 py-3">
                  No chores assigned to this location.
                </div>
              ) : (
                <ul className="m-0 p-0 list-none">
                  {chores.map(c => (
                    <ChoreCheckRow key={c.id} chore={c} location={l} completions={completions} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
    </div>
  );
}

// ── Chore checkbox row ────────────────────────────────────────────────
// Wraps an existing chore_completions toggle with fat tap targets and
// the realtime-contention "✓ + disabled" treatment. The completedSet
// updates from the realtime channel within ~80ms of any other user's
// click; that flips the disabled state automatically.
function ChoreCheckRow({ chore, location, completions }) {
  const done = completions.completedSet?.has(chore.id) ?? false;
  const [pending, setPending] = useState(false);

  const onToggle = async () => {
    if (pending) return;
    setPending(true);
    try {
      await completions.toggle(chore.id, done);
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
          "text-[14px] " +
          (done ? "text-muted line-through" : "text-fg font-medium")
        }>
          {chore.title}
        </div>
        {location && (
          <div className="text-[11px] text-faint mt-0.5">{location.name}</div>
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
