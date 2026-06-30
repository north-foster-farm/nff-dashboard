import { useMemo, useState } from "react";
import { useActivityLog } from "../lib/data/useActivityLog.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import { useSites } from "../lib/data/useSites.js";
import { descendantIds } from "../lib/places.js";
import ActivityRow from "../components/ActivityRow.jsx";

// The Observation Log. A focused window into the activity_log rows that
// originate from Rounds quick-actions: notes, MASH intakes, mortality,
// and cohort moves. Filterable by kind, place, date range, and author.
// No new table — the source of truth is the activity_log, with the
// same edit/delete affordances Activity has. The place filter matches a
// place's whole subtree (picking Pasture C catches its coops).

const OBSERVATION_KINDS = [
  { id: "note_observed", label: "Notes" },
  { id: "mash_intake", label: "MASH" },
  { id: "mortality_observed", label: "Mortality" },
  { id: "eggs_collected", label: "Eggs" },
  { id: "cohort_moved", label: "Moves" },
];

const OBSERVATION_KIND_IDS = OBSERVATION_KINDS.map(k => k.id);

// Quick presets — saves typing for the common windows.
const RANGE_PRESETS = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "all", label: "All time", days: null },
];

export default function Observations() {
  const userEmail = useCurrentUserEmail();
  const { places, childrenByParent } = useSites();

  const [kindFilter, setKindFilter] = useState("all"); // "all" | kind id
  const [placeFilter, setPlaceFilter] = useState("all"); // "all" | place id
  const [authorFilter, setAuthorFilter] = useState("all");
  const [rangePreset, setRangePreset] = useState("30d");

  const sinceDate = useMemo(() => {
    const preset = RANGE_PRESETS.find(p => p.id === rangePreset);
    if (!preset || preset.days == null) return null;
    const d = new Date();
    d.setDate(d.getDate() - preset.days);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [rangePreset]);

  // Always pull observation kinds from the server. Per-kind narrowing
  // happens client-side so toggling chips doesn't re-subscribe realtime.
  const { entries, loading, edit, remove } = useActivityLog({
    sinceDate,
    kinds: OBSERVATION_KIND_IDS,
  });

  // The selected place's subtree — an entry matches the place filter if
  // its place_id falls anywhere inside it.
  const placeSubtree = useMemo(() => {
    if (placeFilter === "all") return null;
    return descendantIds(placeFilter, childrenByParent);
  }, [placeFilter, childrenByParent]);

  // Authors that appear in the (server-filtered) entries — drives the
  // dropdown. Falls back to the seed admins (James / Jim) if nothing has
  // been logged yet so the picker isn't empty.
  const authorOptions = useMemo(() => {
    const seen = new Set();
    for (const e of entries ?? []) if (e.ownerEmail) seen.add(e.ownerEmail);
    return Array.from(seen).sort();
  }, [entries]);

  // Client-side narrowing: kind chip + site dropdown + author dropdown.
  // (Date range + observation-kind set are applied at the query level.)
  const visible = useMemo(() => {
    if (!entries) return null;
    return entries.filter(e => {
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      if (placeSubtree) {
        if (!e.placeId || !placeSubtree.has(e.placeId)) return false;
      }
      if (authorFilter !== "all" && e.ownerEmail !== authorFilter) return false;
      return true;
    });
  }, [entries, kindFilter, placeSubtree, authorFilter]);

  const activePlaces = useMemo(
    () => (places ?? []).filter(p => p.isActive !== false),
    [places]
  );

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        kindFilter={kindFilter}
        onKindChange={setKindFilter}
        placeFilter={placeFilter}
        onPlaceChange={setPlaceFilter}
        authorFilter={authorFilter}
        onAuthorChange={setAuthorFilter}
        rangePreset={rangePreset}
        onRangeChange={setRangePreset}
        places={activePlaces}
        authors={authorOptions}
      />

      <ObservationList
        loading={loading}
        entries={visible}
        userEmail={userEmail}
        onEdit={edit}
        onDelete={remove}
      />
    </div>
  );
}

function FilterBar({
  kindFilter, onKindChange,
  placeFilter, onPlaceChange,
  authorFilter, onAuthorChange,
  rangePreset, onRangeChange,
  places, authors,
}) {
  return (
    <div className="border border-line p-3 flex flex-wrap gap-3 items-center">
      <KindChips value={kindFilter} onChange={onKindChange} />

      <div className="h-5 w-px bg-line" />

      <PickerSelect
        label="Place"
        value={placeFilter}
        onChange={onPlaceChange}
        options={[
          { value: "all", label: "All places" },
          ...places.map(p => ({ value: p.id, label: p.name })),
        ]}
      />

      <PickerSelect
        label="Author"
        value={authorFilter}
        onChange={onAuthorChange}
        options={[
          { value: "all", label: "Anyone" },
          ...authors.map(e => ({ value: e, label: shortAuthor(e) })),
        ]}
      />

      <div className="h-5 w-px bg-line" />

      <RangeChips value={rangePreset} onChange={onRangeChange} />
    </div>
  );
}

function KindChips({ value, onChange }) {
  const all = [{ id: "all", label: "All kinds" }, ...OBSERVATION_KINDS];
  return (
    <div className="flex flex-wrap gap-1">
      {all.map(k => (
        <button
          key={k.id}
          type="button"
          onClick={() => onChange(k.id)}
          className={[
            "text-[11px] uppercase tracking-[0.12em] font-semibold",
            "px-2 py-1 border cursor-pointer",
            value === k.id
              ? "bg-surface-alt border-line text-fg"
              : "bg-transparent border-transparent text-muted hover:text-fg",
          ].join(" ")}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}

function RangeChips({ value, onChange }) {
  return (
    <div className="flex border border-line bg-surface ml-auto">
      {RANGE_PRESETS.map(p => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={[
            "text-[11px] uppercase tracking-[0.12em] font-semibold",
            "px-2.5 py-1 border-0 cursor-pointer",
            value === p.id
              ? "bg-surface-alt text-fg"
              : "bg-transparent text-muted hover:text-fg",
          ].join(" ")}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function PickerSelect({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-muted uppercase tracking-[0.12em] font-semibold">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent normal-case tracking-normal font-normal"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function ObservationList({ loading, entries, userEmail, onEdit, onDelete }) {
  if (loading) {
    return (
      <div className="border border-line py-9 px-6 text-center">
        <div className="text-xs text-muted uppercase tracking-[0.18em]">
          Loading observations…
        </div>
      </div>
    );
  }
  if (!entries || entries.length === 0) {
    return (
      <div className="border border-line py-9 px-6 text-center">
        <div className="text-[13px] text-muted mb-2 font-medium">
          No observations match these filters
        </div>
        <div className="text-[12px] text-faint leading-relaxed max-w-[520px] mx-auto">
          Quick-action observations from Rounds — notes, condition flags,
          mortality, cohort moves, and infra sweeps — land here as they
          happen. Try widening the date range or clearing the kind filter.
        </div>
      </div>
    );
  }
  return (
    <ol className="m-0 p-0 list-none flex flex-col gap-px bg-line">
      {entries.map(entry => (
        <ActivityRow
          key={entry.id}
          entry={entry}
          ownerEmail={userEmail}
          onEdit={onEdit}
          onDelete={onDelete}
          renderTime={renderTimeStacked}
          wrapperClass="bg-surface px-4 py-3 items-baseline"
        />
      ))}
    </ol>
  );
}

// Stacked "Mon May 5 / 10:14 AM" renderer (matches the Activity page).
function renderTimeStacked(logTime) {
  const dt = new Date(logTime);
  return (
    <div className="min-w-[140px]">
      <div>
        {dt.toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
        })}
      </div>
      <div className="text-faint mt-px">
        {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </div>
    </div>
  );
}

function shortAuthor(email) {
  if (!email) return "Someone";
  const local = email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}
