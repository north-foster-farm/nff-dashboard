import { useMemo } from "react";
import {
  ArrowLeft, ChevronRight, MapPin, CalendarRange, Check, Cog,
} from "lucide-react";
import { iconForSpecies } from "../components/animalIcons.jsx";
import { useSites } from "../lib/data/useSites.js";
import { useChoreDefinitions } from "../lib/data/useChoreDefinitions.js";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { useActivityLog } from "../lib/data/useActivityLog.js";
import { computePlaceStatus } from "../lib/placeStatus.js";
import { placePath, descendantIds, childrenOf } from "../lib/places.js";
import { tintForFlag } from "../lib/farmMap.js";
import { navigate, pathForPlaceTimeline } from "../lib/router.js";
import ActivityRow from "../components/ActivityRow.jsx";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";

// The place page (Batch 18.2) — everything the dashboard knows about
// one place: who lives there right now, what work is due there today,
// what's been observed there recently, and what places sit inside it.
// Reached from the map (zone plate / structure pin), from place
// search, and from the recents strip.

const OBSERVATION_KINDS = [
  "note_observed", "mash_intake", "mortality_observed", "cohort_moved",
];

export default function PlacePage({
  placeId, data, onBack, onOpenPlace, onOpenRounds, onNavigate,
}) {
  const {
    placesById, childrenByParent, placementsByPlaceId, groupsById,
    speciesById, choreCtx, loading: sitesLoading,
  } = useSites();
  const { definitions } = useChoreDefinitions();
  const { blocks } = useChoreBlocks();
  const today = useMemo(() => new Date(), []);
  const completions = useChoreCompletions(today);
  const userEmail = useCurrentUserEmail();

  const place = placesById.get(placeId);
  const path = useMemo(
    () => placePath(placeId, placesById),
    [placeId, placesById]
  );
  const subtree = useMemo(
    () => descendantIds(placeId, childrenByParent),
    [placeId, childrenByParent]
  );

  // Status projection — same math as Now / the map tint.
  const status = useMemo(() => computePlaceStatus({
    definitions,
    blocks,
    choreCtx,
    isDone: completions.isDone,
    now: today,
  }), [definitions, blocks, choreCtx, completions.isDone, today]);

  // Work due here = obligations anywhere in this place's subtree.
  const obligationsHere = useMemo(
    () => status.obligations.filter(
      (o) => o.placeId != null && subtree.has(o.placeId)
    ),
    [status.obligations, subtree]
  );

  // Occupants: open placements at this place + everything beneath it.
  const occupants = useMemo(() => {
    const out = [];
    for (const pid of subtree) {
      for (const pl of placementsByPlaceId?.get(pid) ?? []) {
        out.push({ ...pl, atPlace: placesById.get(pid) });
      }
    }
    return out;
  }, [subtree, placementsByPlaceId, placesById]);

  // Recent observations logged anywhere in the subtree.
  const { entries, loading: obsLoading, edit, remove } = useActivityLog({
    kinds: OBSERVATION_KINDS,
    limit: 200,
  });
  const observationsHere = useMemo(
    () => (entries ?? [])
      .filter((e) => e.placeId != null && subtree.has(e.placeId))
      .slice(0, 8),
    [entries, subtree]
  );

  const children = childrenOf(placeId, childrenByParent);

  if (sitesLoading) {
    return (
      <div className="text-[12px] text-muted uppercase tracking-[0.16em] py-10 text-center">
        Loading…
      </div>
    );
  }
  if (!place) {
    return (
      <div className="border border-line px-5 py-8 text-center">
        <div className="text-[13px] text-muted">
          This place no longer exists.
        </div>
        <button
          onClick={onBack}
          className="mt-3 text-[12px] text-accent bg-transparent border-0 cursor-pointer underline"
        >
          Back to the map
        </button>
      </div>
    );
  }

  const flag = status.flagOf(place.id);
  const tint = tintForFlag(flag);
  const machinesById = new Map(
    (data?.machines ?? []).map((m) => [m.id, m])
  );

  return (
    <div className="max-w-[860px] flex flex-col gap-7">
      {/* Breadcrumb + back */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onBack}
          className={
            "inline-flex items-center gap-1.5 bg-transparent border-0 " +
            "text-dim font-ui text-[11px] font-semibold uppercase " +
            "tracking-[0.14em] p-0 cursor-pointer hover:text-fg"
          }
        >
          <ArrowLeft size={12} />
          Map
        </button>
        {path.slice(0, -1).map((ancestor) => (
          <span key={ancestor.id} className="inline-flex items-center gap-2">
            <ChevronRight size={11} className="text-faint" />
            <button
              onClick={() => onOpenPlace(ancestor.id)}
              className={
                "bg-transparent border-0 p-0 cursor-pointer text-[12px] " +
                "text-dim hover:text-fg"
              }
            >
              {ancestor.name}
            </button>
          </span>
        ))}
      </div>

      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-[32px] font-bold -tracking-[0.02em] m-0 text-fg flex items-center gap-3">
            {place.name}
            {place.code && (
              <span className="text-[12px] font-ui font-semibold uppercase tracking-[0.1em] text-muted border border-line px-2 py-1">
                {place.code}
              </span>
            )}
          </h2>
          <div className="text-[12px] text-dim mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="capitalize">{place.kind}</span>
            {place.kindTag && (
              <>
                <span className="text-faint">·</span>
                <span className="capitalize">
                  {place.kindTag.replaceAll("_", " ")}
                </span>
              </>
            )}
            {place.mobile && (
              <>
                <span className="text-faint">·</span>
                <span>Mobile — moves around the farm</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] px-2 py-1 border border-line"
            style={{ color: "var(--c-text)" }}
          >
            <span
              className="inline-block w-2.5 h-2.5"
              style={{
                background: tint.fill,
                opacity: tint.fillOpacity + 0.3,
              }}
            />
            {tint.label}
          </span>
          {/* This place's timeline (Batch 27.6) — the Schedule
              filtered to the events of the batches placed here,
              replacing the old jump to the generic Schedule. */}
          <button
            onClick={() => navigate(pathForPlaceTimeline(place.id))}
            className={
              "inline-flex items-center gap-1.5 bg-transparent border " +
              "border-line text-dim text-[11px] font-semibold uppercase " +
              "tracking-[0.12em] px-2.5 py-1.5 cursor-pointer hover:text-fg"
            }
            title="See this place's events on the Schedule"
          >
            <CalendarRange size={12} />
            View on timeline
          </button>
        </div>
      </header>

      {/* Occupants */}
      <Section title="Who's here" count={occupants.length}>
        {occupants.length === 0 ? (
          <EmptyLine>Nothing currently lives or is parked here.</EmptyLine>
        ) : (
          <ul className="m-0 p-0 list-none border border-line">
            {occupants.map((o) => (
              <OccupantRow
                key={o.id}
                occupant={o}
                place={place}
                groupsById={groupsById}
                speciesById={speciesById}
                machinesById={machinesById}
                placesById={placesById}
                onOpenPlace={onOpenPlace}
              />
            ))}
          </ul>
        )}
      </Section>

      {/* Chores due here today */}
      <Section
        title="Chores here today"
        count={obligationsHere.length}
      >
        {obligationsHere.length === 0 ? (
          <EmptyLine>No chores land here today.</EmptyLine>
        ) : (
          <ul className="m-0 p-0 list-none border border-line">
            {obligationsHere.map((o) => (
              <ChoreHereRow
                key={`${o.chore.id}|${o.placeId}`}
                obligation={o}
                placesById={placesById}
                showPlace={o.placeId !== place.id}
                onOpenRounds={onOpenRounds}
              />
            ))}
          </ul>
        )}
      </Section>

      {/* Places inside */}
      {children.length > 0 && (
        <Section title="Places inside" count={children.length}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-px bg-line border border-line">
            {children.map((child) => (
              <ChildPlaceCard
                key={child.id}
                place={child}
                flag={status.flagOf(child.id)}
                counts={status.byPlace.get(child.id)}
                placementsByPlaceId={placementsByPlaceId}
                groupsById={groupsById}
                onOpen={() => onOpenPlace(child.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Recent observations */}
      <Section title="Recent observations" count={observationsHere.length}>
        {obsLoading ? (
          <EmptyLine>Loading…</EmptyLine>
        ) : observationsHere.length === 0 ? (
          <EmptyLine>
            Nothing logged here recently — notes, MASH intakes, and
            mortality records from Rounds will show up in this list.
          </EmptyLine>
        ) : (
          <ol className="m-0 p-0 list-none flex flex-col gap-px bg-line border border-line">
            {observationsHere.map((entry) => (
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
        )}
      </Section>
    </div>
  );
}

// Stacked date + time column for observation rows (same shape as the
// Observations page).
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

// ── Section scaffold ──────────────────────────────────────────────────
function Section({ title, count, children }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="font-ui text-[11px] uppercase tracking-[0.16em] font-bold text-fg flex items-baseline gap-2">
        {title}
        {typeof count === "number" && count > 0 && (
          <span className="text-muted font-medium">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ children }) {
  return (
    <div className="border border-line px-4 py-5 text-[12px] text-muted">
      {children}
    </div>
  );
}

// ── Occupants ─────────────────────────────────────────────────────────
function OccupantRow({
  occupant: o, place, groupsById, speciesById, machinesById, placesById,
  onOpenPlace,
}) {
  const isBatch = o.occupantType === "batch";
  const group = isBatch ? groupsById?.get(o.occupantId) : null;
  const species = group ? speciesById?.get(group.speciesId) : null;
  const machine = !isBatch ? machinesById?.get(o.occupantId) : null;
  const Icon = isBatch ? iconForSpecies(group?.speciesId) : Cog;
  const name = isBatch
    ? group?.label ?? o.occupantId
    : machine
      ? `${machine.manufacturer ?? ""} ${machine.label}`.trim()
      : o.occupantId.replaceAll("_", " ");
  // Occupant actually lives in a sub-place (subtree roll-up) — show
  // where, and let it navigate.
  const elsewhere = o.atPlace && o.atPlace.id !== place.id ? o.atPlace : null;

  return (
    <li className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0">
      <Icon size={15} className="shrink-0 text-muted" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-fg font-medium">
          {name}
          {species && (
            <span className="text-dim font-normal"> · {species.name}</span>
          )}
          {isBatch && group?.count != null && (
            <span className="text-muted font-normal"> · {group.count}</span>
          )}
        </div>
        <div className="text-[11px] text-faint mt-0.5">
          {o.movedIn && `Since ${o.movedIn}`}
          {elsewhere && (
            <>
              {o.movedIn ? " · " : ""}
              in{" "}
              <button
                onClick={() => onOpenPlace(elsewhere.id)}
                className="bg-transparent border-0 p-0 cursor-pointer text-[11px] text-dim underline hover:text-fg"
              >
                {elsewhere.name}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

// ── Chores due here ───────────────────────────────────────────────────
function ChoreHereRow({ obligation: o, placesById, showPlace, onOpenRounds }) {
  const subPlace = showPlace && o.placeId
    ? placesById.get(o.placeId)
    : null;
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        onClick={() => onOpenRounds?.(o.chore.blockId ?? null)}
        className={
          "w-full flex items-center gap-3 px-4 py-2.5 bg-transparent " +
          "border-0 cursor-pointer text-left font-[inherit] " +
          "hover:bg-row-hover transition-colors duration-100"
        }
        title="Open in Rounds"
      >
        <span
          className={
            "shrink-0 w-4 h-4 border-[1.5px] inline-flex items-center " +
            "justify-center " +
            (o.done
              ? "bg-resolved border-resolved text-on-accent"
              : o.status === "overdue"
                ? "border-warn"
                : "border-line")
          }
          aria-hidden
        >
          {o.done && <Check size={11} strokeWidth={3} />}
        </span>
        <span
          className={
            "flex-1 min-w-0 text-[13px] truncate " +
            (o.done ? "text-muted line-through" : "text-fg")
          }
        >
          {o.chore.title}
          {subPlace && (
            <span className="text-dim"> · {subPlace.name}</span>
          )}
        </span>
        {o.status === "overdue" && !o.done && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 border border-warn text-warn">
            Overdue
          </span>
        )}
        {o.block && (
          <span className="shrink-0 text-[11px] text-dim">
            {o.block.name}
          </span>
        )}
        <ChevronRight size={13} className="shrink-0 text-muted" />
      </button>
    </li>
  );
}

// ── Child place cards ─────────────────────────────────────────────────
function ChildPlaceCard({
  place, flag, counts, placementsByPlaceId, groupsById, onOpen,
}) {
  const tint = tintForFlag(flag);
  const occupants = placementsByPlaceId?.get(place.id) ?? [];
  const occupantText = occupants
    .filter((o) => o.occupantType === "batch")
    .map((o) => groupsById?.get(o.occupantId)?.label ?? o.occupantId)
    .join(", ");
  return (
    <button
      onClick={onOpen}
      className={
        "flex flex-col items-start gap-1.5 bg-surface px-4 py-3.5 " +
        "border-0 cursor-pointer text-left font-[inherit] " +
        "hover:bg-row-hover transition-colors duration-100"
      }
    >
      <span className="flex items-center gap-2 w-full">
        <MapPin size={13} className="shrink-0 text-muted" />
        <span className="text-[13px] text-fg font-medium truncate flex-1">
          {place.name}
        </span>
        <span
          className="shrink-0 inline-block w-2.5 h-2.5"
          style={{ background: tint.fill, opacity: tint.fillOpacity + 0.3 }}
          title={tint.label}
        />
      </span>
      <span className="text-[11px] text-muted truncate w-full">
        {occupantText ||
          (counts && counts.total > 0
            ? `${counts.done}/${counts.total} chores done`
            : "Quiet")}
      </span>
    </button>
  );
}
