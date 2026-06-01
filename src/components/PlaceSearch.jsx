import { useEffect, useMemo, useRef, useState } from "react";
import { Search, MapPin, History } from "lucide-react";
import PlaceTag from "./PlaceTag.jsx";

// Place search (Batch 18.2) — the express lane over the place tree.
// Searches place names, codes (MC1, CT3), and current occupants
// (typing "gold band" finds Mobile Coop 1 because the gold-band layers
// live there). Results are D1-disambiguated (name + bold parent) so
// "Mobile Coop 1 · Pasture B" vs "· Pasture C" never confuses anyone.
// Recently-opened places surface when the input is focused but empty.

const RECENTS_KEY = "nff:place-recents";
const RECENTS_MAX = 8;

export function readRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function pushRecent(placeId) {
  try {
    const list = readRecents().filter((id) => id !== placeId);
    list.unshift(placeId);
    localStorage.setItem(
      RECENTS_KEY,
      JSON.stringify(list.slice(0, RECENTS_MAX))
    );
  } catch {
    // localStorage unavailable (private browsing) — recents just don't
    // persist; search still works.
  }
}

export default function PlaceSearch({
  places,
  placesById,
  groupsById,
  placementsByPlaceId,
  onOpenPlace,
  className = "",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  // Occupant labels per place — so "gold band" matches MC1.
  const occupantTextByPlace = useMemo(() => {
    const out = new Map();
    for (const [placeId, occupants] of placementsByPlaceId?.entries() ?? []) {
      const labels = occupants
        .map((o) =>
          o.occupantType === "batch"
            ? groupsById?.get(o.occupantId)?.label ?? o.occupantId
            : o.occupantId.replaceAll("_", " ")
        )
        .join(" ");
      out.set(placeId, labels.toLowerCase());
    }
    return out;
  }, [placementsByPlaceId, groupsById]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (places ?? [])
      .filter((p) => p.isActive !== false)
      .filter((p) => {
        if (p.name.toLowerCase().includes(q)) return true;
        if ((p.code ?? "").toLowerCase().includes(q)) return true;
        if ((p.kindTag ?? "").replaceAll("_", " ").includes(q)) return true;
        if ((occupantTextByPlace.get(p.id) ?? "").includes(q)) return true;
        return false;
      })
      .slice(0, 10);
  }, [query, places, occupantTextByPlace]);

  const recents = useMemo(() => {
    if (query.trim()) return [];
    return readRecents()
      .map((id) => placesById?.get(id))
      .filter((p) => p && p.isActive !== false)
      .slice(0, 5);
  }, [query, placesById, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (placeId) => {
    pushRecent(placeId);
    setQuery("");
    setOpen(false);
    onOpenPlace(placeId);
  };

  const showDropdown = open && (results.length > 0 || recents.length > 0);

  return (
    <div ref={wrapRef} className={"relative " + className}>
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Find a place, code, or animal batch…"
          className={
            "w-full bg-surface border border-line text-fg text-[12px] " +
            "py-[7px] pl-[30px] pr-2.5 outline-none font-[inherit] " +
            "focus:border-accent"
          }
        />
      </div>
      {showDropdown && (
        <div
          className={
            "absolute top-full left-0 right-0 mt-1 z-30 bg-surface " +
            "border border-line shadow-[0_8px_24px_rgba(0,0,0,0.3)] " +
            "max-h-[320px] overflow-y-auto"
          }
        >
          {results.map((p) => (
            <ResultRow
              key={p.id}
              icon={MapPin}
              place={p}
              placesById={placesById}
              occupantsLine={occupantsLine(
                p.id, placementsByPlaceId, groupsById
              )}
              onPick={() => pick(p.id)}
            />
          ))}
          {results.length === 0 && recents.length > 0 && (
            <>
              <div className="px-3 pt-2.5 pb-1 font-ui text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
                Recent
              </div>
              {recents.map((p) => (
                <ResultRow
                  key={p.id}
                  icon={History}
                  place={p}
                  placesById={placesById}
                  occupantsLine={occupantsLine(
                    p.id, placementsByPlaceId, groupsById
                  )}
                  onPick={() => pick(p.id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function occupantsLine(placeId, placementsByPlaceId, groupsById) {
  const occupants = placementsByPlaceId?.get(placeId) ?? [];
  if (occupants.length === 0) return null;
  return occupants
    .map((o) =>
      o.occupantType === "batch"
        ? groupsById?.get(o.occupantId)?.label ?? o.occupantId
        : o.occupantId.replaceAll("_", " ")
    )
    .join(", ");
}

function ResultRow({ icon: Icon, place, placesById, occupantsLine, onPick }) {
  return (
    <button
      onClick={onPick}
      className={
        "w-full flex items-center gap-2.5 px-3 py-2 bg-transparent " +
        "border-0 cursor-pointer text-left font-[inherit] " +
        "hover:bg-row-hover transition-colors duration-100"
      }
    >
      <Icon size={13} className="shrink-0 text-muted" />
      <span className="flex-1 min-w-0 flex flex-col">
        <PlaceTag
          place={place}
          placesById={placesById}
          className="text-[13px] text-fg"
        />
        {occupantsLine && (
          <span className="text-[11px] text-muted truncate">
            {occupantsLine}
          </span>
        )}
      </span>
      {place.code && (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint border border-line px-1.5 py-0.5">
          {place.code}
        </span>
      )}
    </button>
  );
}
