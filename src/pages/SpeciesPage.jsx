import { useMemo, useState } from "react";
import {
  MapPin, Pencil, Plus, Sparkles,
} from "lucide-react";
import { computeAge, formatDate } from "../lib/dates.js";
import { batchLifecycle } from "../lib/metrics.js";
import { useProcessingDates } from "../lib/data/useProcessingDates.js";
import BatchStatePill from "../components/BatchStatePill.jsx";
import { computeStageCost } from "../lib/feedCost.js";
import { describeConsumption } from "../lib/feedConsumption.js";
import { supabase } from "../lib/supabase.js";
import { navigate, pathForBatch, pathForSection } from "../lib/router.js";
import {
  getAllChoreDefinitions, describeFrequency, describeChoreAnchor,
  describeChoreSchedule,
} from "../lib/chores.js";
import { useSites } from "../lib/data/useSites.js";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useActivityLog } from "../lib/data/useActivityLog.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import ActivityRow from "../components/ActivityRow.jsx";
import AutomationsPanel from "../components/AutomationsPanel.jsx";
import { BTN_ACCENT } from "../components/ui.jsx";

// One species' record page (Batch 25.2 rewrite — Tailwind, placements,
// real activity log). Five tabs:
//
//   Groups        — the batches/groups, each card showing where the
//                   group actually lives (placements), age, count.
//   Feed schedule — read view of the species' feed programs, linking
//                   to the Manage feed editor.
//   Chores        — chore definitions tagged for / anchored to this
//                   species.
//   Activity log  — activity_log rows that touch this species: chore
//                   completions, mortality, MASH intakes, notes at
//                   places its batches live, cohort moves.
//   More info     — husbandry reference (acquisition, lifecycle,
//                   constraints).

export default function SpeciesPage({ species, data }) {
  const [tab, setTab] = useState("groups");
  const speciesChores = useMemo(
    () => getAllChoreDefinitions(data).filter(c =>
      (c.tags ?? []).includes(species.id)
      || c.anchorSpeciesId === species.id
      || (species.groups ?? []).some(g => g.id === c.anchorBatchId)
    ),
    [data, species]
  );
  const speciesSchedules = (data.feedSchedules ?? [])
    .filter(fs => fs.speciesId === species.id);

  const tabs = [
    { id: "groups", label: `Groups · ${species.groups.length}` },
    { id: "feed", label: `Feed schedule · ${speciesSchedules.length}` },
    { id: "chores", label: `Chores · ${speciesChores.length}` },
    // Automation rules that fire for this species (Batch 27.5 —
    // relocated here from the Settings page).
    { id: "automations", label: "Automations" },
    { id: "activity", label: "Activity log" },
    { id: "more", label: "More info" },
  ];

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-line mb-6 flex-wrap">
        {tabs.map(t => (
          <Tab
            key={t.id}
            active={tab === t.id}
            onClick={() => setTab(t.id)}
            label={t.label}
          />
        ))}
      </div>
      {tab === "groups" && <GroupsTab species={species} />}
      {tab === "feed" && (
        <FeedScheduleTab
          species={species}
          schedules={speciesSchedules}
          feeds={data.feeds}
        />
      )}
      {tab === "chores" && (
        <SpeciesChoresTab species={species} chores={speciesChores} />
      )}
      {tab === "automations" && (
        <AutomationsPanel
          triggerKind="batch_created"
          speciesId={species.id}
        />
      )}
      {tab === "activity" && (
        <ActivityLogTab species={species} chores={speciesChores} />
      )}
      {tab === "more" && <MoreInfoTab species={species} />}
    </div>
  );
}

function Tab({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={
        "bg-transparent border-0 font-[inherit] text-[12px] font-semibold " +
        "uppercase tracking-[0.12em] px-3 pb-2.5 pt-1 cursor-pointer " +
        (active
          ? "text-fg shadow-[inset_0_-2px_0_0_var(--c-accent)]"
          : "text-dim hover:text-fg")
      }
    >
      {label}
    </button>
  );
}

// ── Groups tab ────────────────────────────────────────────────────────
function GroupsTab({ species }) {
  // Placements answer "where does this group live right now" — the
  // dead currentLocation column this page used to read was dropped in
  // Batch 15.
  const { placements, placesById, loading: sitesLoading } = useSites();
  const { processingDateByBatchId } = useProcessingDates();
  const [showPast, setShowPast] = useState(false);

  // Split by derived lifecycle so processed batches collapse into their
  // own "Past batches" section instead of looking like live flocks.
  const { current, past } = useMemo(() => {
    const cur = [];
    const done = [];
    for (const g of species.groups ?? []) {
      const life = batchLifecycle(
        g, processingDateByBatchId.get(g.id) ?? null);
      (life.state === "processed" ? done : cur).push({ group: g, life });
    }
    return { current: cur, past: done };
  }, [species.groups, processingDateByBatchId]);

  const renderCard = ({ group, life }) => (
    <GroupCard
      key={group.id}
      group={group}
      life={life}
      species={species}
      placements={placements}
      placesById={placesById}
      placeLoading={sitesLoading}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <AddBatchForm species={species} />
      {species.groups.length === 0 ? (
        <div className="border border-line px-6 py-10 text-center">
          <div className="text-[13px] text-muted">
            No groups recorded yet.
          </div>
        </div>
      ) : (
        <>
          {current.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {current.map(renderCard)}
            </div>
          )}
          {current.length === 0 && past.length > 0 && (
            <div className="text-[12px] text-dim italic">
              No active {species.name.toLowerCase()} batches — all
              processed. Past batches are below.
            </div>
          )}
          {past.length > 0 && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowPast(s => !s)}
                className="self-start inline-flex items-center gap-1.5 bg-transparent border-0 p-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] text-dim hover:text-fg cursor-pointer"
              >
                {showPast ? "▾" : "▸"} Past batches · {past.length}
              </button>
              {showPast && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 opacity-75">
                  {past.map(renderCard)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Minimal create-batch form. For broilers, inserting a row fires the
// broiler-lifecycle automation server-side: arrival / pasture-move /
// processing events + a brooder cleanout chore.
function AddBatchForm({ species }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [count, setCount] = useState("");
  const [arrival, setArrival] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const hasAutomation = species.id === "broilers";
  const noun = species.trackingModel === "batch" ? "batch" : "group";

  const reset = () => {
    setOpen(false);
    setLabel("");
    setCount("");
    setError(null);
  };

  const submit = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const maxOrdinal = Math.max(
      0, ...species.groups.map(g => g.ordinal ?? 0)
    );
    const { error: err } = await supabase.from("livestock_groups").insert({
      id: `${species.id}_${slug}`,
      species_id: species.id,
      label: trimmed,
      ordinal: maxOrdinal + 1,
      count: count === "" ? null : Number(count),
      // placed_count (Batch 26.1): the count a cohort starts with is
      // its placed count — mortality decrements `count` but never this.
      placed_count: count === "" ? null : Number(count),
      arrival_date: arrival || null,
    });
    setSaving(false);
    if (err) {
      setError(err.code === "23505"
        ? new Error(`A group named "${trimmed}" already exists.`)
        : err);
      return;
    }
    reset();
  };

  if (!open) {
    return (
      <div>
        <button
          onClick={() => setOpen(true)}
          className={BTN_ACCENT}
        >
          <Plus size={13} /> Add {noun}
        </button>
      </div>
    );
  }

  return (
    <div className="border border-line px-4 py-4">
      <div className="flex items-end gap-4 flex-wrap">
        <Field label="Name">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={
              species.trackingModel === "batch" ? "Batch 3" : "Group name"
            }
            className={inputCls + " w-[160px]"}
          />
        </Field>
        <Field label="Count">
          <input
            type="number"
            min={0}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="—"
            className={inputCls + " w-[80px]"}
          />
        </Field>
        <Field label="Arrival date">
          <input
            type="date"
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="flex items-center gap-2">
          <button
            onClick={submit}
            disabled={saving || !label.trim()}
            className={BTN_ACCENT + " disabled:cursor-not-allowed"}
          >
            {saving ? "Adding…" : "Add"}
          </button>
          <button
            onClick={reset}
            className="bg-transparent text-dim border border-line font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3.5 py-1.5 cursor-pointer hover:text-fg"
          >
            Cancel
          </button>
        </div>
      </div>
      {hasAutomation && (
        <div className="flex items-center gap-1.5 text-[11px] text-dim mt-3 leading-relaxed">
          <Sparkles size={12} className="text-accent-deep shrink-0" />
          Adding a batch fires the broiler lifecycle automation: arrival,
          pasture-move, and processing events plus a brooder cleanout chore.
        </div>
      )}
      {error && (
        <div className="text-[11px] text-warn mt-2.5">
          {error.message ?? String(error)}
        </div>
      )}
      <div className="text-[11px] text-faint mt-3 leading-relaxed">
        The arrival date anchors the feed schedule — without it, the
        Feed page can&rsquo;t project when this {noun} will need a
        reorder.
      </div>
    </div>
  );
}

function GroupCard({
  group, life, species, placements, placesById, placeLoading,
}) {
  const isSheep = species.id === "sheep";
  const showCount = species.trackingModel !== "individual";
  const arriving = life?.state === "arriving";
  const processed = life?.state === "processed";
  // A not-yet-arrived batch has no age; show its arrival instead.
  const age = arriving ? null : computeAge(group.knownAge);
  const arrivalDisplay = formatDate(group.arrivalDate)
    || (arriving ? "—" : "Unknown");
  const countDisplay = group.count != null
    ? group.count.toLocaleString()
    : "Unknown";

  // Where does this group live right now? (placements, Batch 25.2 —
  // replaces the dead currentLocation column.) A processed batch is off
  // the farm — never show it sitting in a structure even if a stale
  // open placement lingers.
  const activePlacement = processed ? null : (placements ?? []).find(
    p => p.occupantType === "batch"
      && p.occupantId === group.id
      && !p.movedOut
  ) ?? null;
  const currentPlace = activePlacement
    ? placesById?.get(activePlacement.placeId)
    : null;

  const fields = [
    ...(!isSheep && !arriving ? [{ label: "Age", value: age }] : []),
    ...(showCount && !isSheep
      ? [{ label: "Count", value: countDisplay }] : []),
    ...(!isSheep
      ? [{ label: arriving ? "Arrives" : "Arrived", value: arrivalDisplay }]
      : []),
  ];

  const open = () => navigate(pathForBatch(species.id, group.id));

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="border border-line px-4 py-3.5 cursor-pointer hover:border-accent transition-colors"
    >
      <div className="flex items-baseline justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-heading text-[17px] font-semibold leading-tight text-fg">
              {group.label}
            </div>
            {life && <BatchStatePill state={life.state} />}
          </div>
          {species.breed && (
            <div className="text-[11px] text-dim mt-0.5">{species.breed}</div>
          )}
        </div>
        {group.ordinal != null && (
          <div className="text-[10px] text-muted shrink-0">
            #{group.ordinal}
          </div>
        )}
      </div>

      {fields.length > 0 && (
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 mt-2">
          {fields.map(f => {
            const unknown = f.value === "Unknown";
            return (
              <div key={f.label} className="contents">
                <div className="text-[9px] text-faint uppercase tracking-[0.12em] pt-0.5">
                  {f.label}
                </div>
                <div
                  className={
                    "text-[11px] " +
                    (unknown ? "text-faint italic" : "text-fg")
                  }
                >
                  {f.value}
                </div>
              </div>
            );
          })}
          {/* Where the group lives — from placements */}
          <div className="text-[9px] text-faint uppercase tracking-[0.12em] pt-0.5">
            Where
          </div>
          <div className="text-[11px]">
            {placeLoading ? (
              <span className="text-faint italic">…</span>
            ) : currentPlace ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/place/${currentPlace.id}`);
                }}
                className="bg-transparent border-0 p-0 font-[inherit] text-[11px] text-accent-deep hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <MapPin size={10} className="shrink-0" />
                {currentPlace.name}
              </button>
            ) : (
              <span className="text-faint italic">not placed</span>
            )}
          </div>
        </div>
      )}

      {group.cohabits && (
        <div className="text-[10px] text-muted mt-3 pt-2.5 border-t border-line leading-relaxed">
          {group.cohabits}
        </div>
      )}
    </div>
  );
}

// ── Feed schedule tab ─────────────────────────────────────────────────
function FeedScheduleTab({ species, schedules, feeds }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-muted leading-relaxed max-w-[560px]">
          The feed programs assigned to {species.name.toLowerCase()}.
          The Feed page&rsquo;s reorder projections run on these numbers.
        </div>
        <button
          onClick={() => navigate(pathForSection("manage_feed_schedule"))}
          className="inline-flex items-center gap-1.5 bg-transparent text-fg border border-line font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer hover:border-accent"
        >
          <Pencil size={12} /> Edit schedules
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="border border-line px-6 py-8 text-center">
          <div className="text-[12px] text-muted">
            No feed schedule defined for {species.name.toLowerCase()} —
            create one under Animals → Manage feed.
          </div>
        </div>
      ) : (
        schedules.map(s => (
          <FeedSchedulePanel
            key={s.id}
            schedule={s}
            feeds={feeds}
            species={species}
          />
        ))
      )}
    </div>
  );
}

function FeedSchedulePanel({ schedule, feeds, species }) {
  const stagesWithCost = schedule.stages.map(stage => ({
    ...stage,
    feed: feeds.find(f => f.id === stage.feedTypeId),
    costInfo: computeStageCost(
      stage, feeds.find(f => f.id === stage.feedTypeId)
    ),
  }));
  const meteredCosts = stagesWithCost
    .filter(s => s.costInfo && s.costInfo.cost != null);
  const totalCost = meteredCosts
    .reduce((sum, s) => sum + s.costInfo.cost, 0);
  const assignedLabels = (schedule.assignedGroupIds ?? []).map(gid =>
    species.groups.find(g => g.id === gid)?.label || gid);

  return (
    <section className="border border-line">
      <header className="px-5 py-4 border-b border-line">
        <h3 className="font-heading text-[18px] font-semibold m-0 text-fg">
          {schedule.name}
        </h3>
        {schedule.description && (
          <p className="text-[12px] text-dim mt-1 mb-0 leading-relaxed">
            {schedule.description}
          </p>
        )}
        <div className="text-[11px] text-muted mt-2.5 pt-2.5 border-t border-line">
          <span className="text-[9px] text-faint uppercase tracking-[0.12em] mr-2">
            Assigned to
          </span>
          {assignedLabels.join(", ") || "No groups assigned"}
        </div>
      </header>
      <div className="flex flex-col gap-px bg-line">
        {stagesWithCost.map(s => (
          <StageReadRow
            key={s.id}
            stage={s}
            anchorLabel={schedule.cycleAnchorLabel}
          />
        ))}
      </div>
      {meteredCosts.length > 0 && (
        <div className="px-5 py-3.5 bg-surface-alt flex items-baseline justify-between gap-3 flex-wrap">
          <div className="text-[11px] text-dim uppercase tracking-[0.12em]">
            Total estimated cost (metered stages)
          </div>
          <div className="font-heading text-[20px] text-accent">
            ${totalCost.toFixed(2)}
          </div>
        </div>
      )}
    </section>
  );
}

function StageReadRow({ stage }) {
  const dayRange = stage.endDay == null
    ? `Day ${stage.startDay}+`
    : `Days ${stage.startDay}–${stage.endDay}`;
  let costText;
  if (stage.consumption?.type === "metered") {
    if (stage.costInfo && stage.costInfo.cost != null) {
      costText = `$${stage.costInfo.cost.toFixed(2)}`;
    } else if (stage.costInfo?.unitMismatch) {
      costText = "Unit mismatch";
    } else {
      costText = "Ongoing";
    }
  } else {
    costText = "—";
  }
  return (
    <div className="bg-surface px-5 py-3">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <div className="font-heading text-[14px] font-semibold text-fg">
          {stage.name}
        </div>
        <div className="text-[10px] text-muted uppercase tracking-[0.12em]">
          {dayRange}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5 text-[11px]">
        <div>
          <span className="text-[9px] text-faint uppercase tracking-[0.1em] mr-1.5">
            Feed
          </span>
          <span className="text-fg">
            {stage.feed?.name || stage.feedTypeId || "—"}
          </span>
        </div>
        <div>
          <span className="text-[9px] text-faint uppercase tracking-[0.1em] mr-1.5">
            Amount
          </span>
          <span className="text-fg">
            {describeConsumption(stage.consumption)}
          </span>
        </div>
        <div>
          <span className="text-[9px] text-faint uppercase tracking-[0.1em] mr-1.5">
            Cost
          </span>
          <span
            className={
              stage.costInfo?.cost != null ? "text-accent" : "text-dim"
            }
          >
            {costText}
          </span>
        </div>
      </div>
      {stage.notes && (
        <div className="text-[11px] text-muted mt-2.5 pt-2 border-t border-line italic leading-relaxed">
          {stage.notes}
        </div>
      )}
    </div>
  );
}

// ── Chores tab ────────────────────────────────────────────────────────
function SpeciesChoresTab({ species, chores }) {
  const { choreCtx } = useSites();
  const { blockById } = useChoreBlocks();
  if (chores.length === 0) {
    return (
      <div className="border border-line px-6 py-8 text-center">
        <div className="text-[12px] text-muted">
          No chores tagged for {species.name.toLowerCase()}.
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      <div className="text-[11px] text-muted leading-relaxed">
        Recurring chore definitions tagged for or anchored to{" "}
        {species.name.toLowerCase()}.
      </div>
      <div className="flex flex-col gap-px bg-line border border-line">
        {chores.map(c => (
          <SpeciesChoreRow
            key={c.id} chore={c} choreCtx={choreCtx} blockById={blockById}
          />
        ))}
      </div>
    </div>
  );
}

function SpeciesChoreRow({ chore, choreCtx, blockById }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between gap-2.5 mb-1.5 flex-wrap">
        <div className="font-heading text-[14px] font-semibold text-fg">
          {chore.title}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(chore.tags ?? []).map(tag => (
            <span
              key={tag}
              className="text-[9px] text-dim bg-surface-alt border border-line px-1.5 py-0.5 uppercase tracking-[0.08em]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      {chore.description && (
        <div className="text-[12px] text-dim leading-relaxed mb-2">
          {chore.description}
        </div>
      )}
      <div className="text-[11px] text-muted">
        {describeChoreAnchor(chore, choreCtx)}
        {" · "}{describeChoreSchedule(chore, blockById)}
        {" · "}{describeFrequency(chore)}
      </div>
    </div>
  );
}

// ── Activity log tab ──────────────────────────────────────────────────
// Real implementation (Batch 25.2). Pulls the activity kinds that can
// touch a species and filters them to this one:
//   chore_completed / chore_uncompleted → the chore is tagged for /
//     anchored to this species
//   mortality_observed / cohort_moved   → the cohort is one of this
//     species' groups
//   mash_intake / note_observed         → logged at a place where one
//     of this species' groups currently lives
const SPECIES_ACTIVITY_KINDS = [
  "chore_completed", "chore_uncompleted", "mortality_observed",
  "cohort_moved", "mash_intake", "note_observed",
];

function ActivityLogTab({ species, chores }) {
  const { entries, loading, edit, remove } = useActivityLog({
    kinds: SPECIES_ACTIVITY_KINDS,
    limit: 500,
  });
  const userEmail = useCurrentUserEmail();
  const { placements } = useSites();

  const filtered = useMemo(() => {
    if (!entries) return null;
    const choreIds = new Set(chores.map(c => c.id));
    const groupIds = new Set((species.groups ?? []).map(g => g.id));
    // Places where one of this species' groups currently lives.
    const speciesPlaceIds = new Set(
      (placements ?? [])
        .filter(p => p.occupantType === "batch"
          && groupIds.has(p.occupantId)
          && !p.movedOut)
        .map(p => p.placeId)
    );
    return entries.filter(e => {
      const p = e.payload ?? {};
      switch (e.kind) {
        case "chore_completed":
        case "chore_uncompleted":
          return choreIds.has(p.chore_id);
        case "mortality_observed":
        case "cohort_moved":
          return groupIds.has(p.livestock_group_id);
        case "mash_intake":
        case "note_observed":
          return e.placeId != null && speciesPlaceIds.has(e.placeId);
        default:
          return false;
      }
    });
  }, [entries, chores, species.groups, placements]);

  if (loading || filtered === null) {
    return (
      <div className="border border-line px-6 py-8 text-center">
        <div className="text-[11px] text-muted uppercase tracking-[0.16em]">
          Loading activity…
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="border border-line px-6 py-9 text-center">
        <div className="text-[13px] text-muted mb-2 font-medium">
          Nothing logged for {species.name.toLowerCase()} yet
        </div>
        <div className="text-[12px] text-faint leading-relaxed max-w-[480px] mx-auto">
          Chore completions on {species.name.toLowerCase()} chores,
          mortality and MASH intakes on their cohorts, and notes taken
          where they live will all land here.
        </div>
      </div>
    );
  }

  return (
    <ol className="m-0 p-0 list-none flex flex-col gap-px bg-line border border-line">
      {filtered.map(entry => (
        <ActivityRow
          key={entry.id}
          entry={entry}
          ownerEmail={userEmail}
          onEdit={edit}
          onDelete={remove}
          renderTime={renderTimeStacked}
          wrapperClass="bg-surface px-4 py-3 items-baseline"
        />
      ))}
    </ol>
  );
}

function renderTimeStacked(logTime) {
  const dt = new Date(logTime);
  return (
    <div className="min-w-[120px]">
      <div>
        {dt.toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
        })}
      </div>
      <div className="text-faint mt-px">
        {dt.toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit",
        })}
      </div>
    </div>
  );
}

// ── More info tab ─────────────────────────────────────────────────────
function MoreInfoTab({ species }) {
  return (
    <div className="flex flex-col gap-5 max-w-[760px]">
      <div className="border border-line">
        <InfoRow label="Acquisition" value={species.acquisition} />
        <InfoRow
          label="Feed regimen"
          value={species.feedRegimen
            ? species.feedRegimen.join(", ")
              + (species.feedNote ? `. ${species.feedNote}` : "")
            : null}
        />
        <InfoRow label="Processing" value={species.processingTimeline} />
        <InfoRow label="Feed tracking" value={species.feedTracking} />
        <InfoRow
          label="Brooder→Tractor"
          value={species.brooderToTractorTransition}
        />
      </div>

      {species.lifecycle && species.lifecycle.length > 0 && (
        <Subsection title="Lifecycle">
          <div className="flex flex-col gap-2">
            {species.lifecycle.map((stage, idx) => (
              <div
                key={idx}
                className="border border-line px-4 py-3"
              >
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="font-heading text-[14px] font-semibold text-fg">
                    {stage.stage}
                  </div>
                  <div className="text-[11px] text-dim">{stage.duration}</div>
                </div>
                {stage.graduationCriteria && (
                  <div className="text-[12px] text-dim leading-relaxed mb-1">
                    <span className="text-accent">→</span>{" "}
                    {stage.graduationCriteria}
                  </div>
                )}
                {stage.notes && (
                  <div className="text-[12px] text-dim leading-relaxed">
                    {stage.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Subsection>
      )}

      {species.constraints && species.constraints.length > 0 && (
        <Subsection title="Constraints">
          <ul className="m-0 pl-5 text-[13px] text-fg leading-loose">
            {species.constraints.map((c, idx) => <li key={idx}>{c}</li>)}
          </ul>
        </Subsection>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-4 py-2.5 border-b border-line last:border-b-0">
      <div className="text-[10px] text-dim uppercase tracking-[0.12em] pt-0.5">
        {label}
      </div>
      <div className="text-[13px] text-fg leading-relaxed">{value}</div>
    </div>
  );
}

function Subsection({ title, children }) {
  return (
    <div>
      <div className="text-[10px] text-dim uppercase tracking-[0.12em] mb-2.5">
        {title}
      </div>
      {children}
    </div>
  );
}

// ── shared bits ───────────────────────────────────────────────────────
const inputCls =
  "bg-surface-alt border border-line px-2 py-1.5 text-[13px] text-fg " +
  "font-[inherit] outline-none focus:border-accent";

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[9px] text-faint uppercase tracking-[0.12em] mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
