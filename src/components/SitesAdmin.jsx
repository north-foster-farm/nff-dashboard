import { useMemo, useState } from "react";
import {
  Plus, X, ArrowUp, ArrowDown, Pencil, Check,
} from "lucide-react";
import pluralize from "pluralize";
import { useSites } from "../lib/data/useSites.js";

// Resources → Sites. Two levels of structure:
//   - Sites (parent categories: Brooders, Mobile coops, Barn, …)
//   - Locations (specific instances within a site: Brooder #1,
//     Hay room, Egg station)
// Each location can host livestock cohorts (site_residents). The
// residents panel is always visible for cohort-hosting locations
// — no toggle, no close button.

export default function SitesAdmin({ data }) {
  const livestockGroups = useMemo(() => {
    const out = [];
    for (const sp of data?.livestock?.species ?? []) {
      for (const g of sp.groups ?? []) {
        out.push({
          id: g.id,
          label: g.label,
          speciesId: sp.id,
          speciesName: sp.name,
        });
      }
    }
    return out;
  }, [data]);

  const {
    sites, locationsBySiteId, residentsByLocationId, loading,
    createSite, updateSite, deleteSite, reorderSites,
    createLocation, updateLocation, deleteLocation, reorderLocations,
    assignResident, moveOutResident, updateResident,
  } = useSites();

  const [creatingSite, setCreatingSite] = useState(false);
  const [draftSiteName, setDraftSiteName] = useState("");

  const activeSites = (sites ?? []).filter(s => s.isActive);
  const archivedSites = (sites ?? []).filter(s => !s.isActive);

  const moveSite = (id, direction) => {
    const idx = activeSites.findIndex(s => s.id === id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= activeSites.length) return;
    const order = activeSites.map(s => s.id);
    [order[idx], order[target]] = [order[target], order[idx]];
    reorderSites(order);
  };

  const submitNewSite = async () => {
    const name = draftSiteName.trim();
    if (!name) { setCreatingSite(false); return; }
    await createSite({ name });
    setDraftSiteName("");
    setCreatingSite(false);
  };

  if (loading) {
    return (
      <div className="bg-surface border border-line py-8 text-center text-[12px] text-muted uppercase tracking-[0.16em]">
        Loading sites…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {creatingSite && (
        <div className="bg-surface-alt border border-line p-3 flex items-center gap-2">
          <input
            autoFocus
            value={draftSiteName}
            onChange={(e) => setDraftSiteName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewSite();
              if (e.key === "Escape") { setDraftSiteName(""); setCreatingSite(false); }
            }}
            placeholder="Site name (e.g. Barn, Brooders, Mobile coops)"
            className="flex-1 bg-surface text-fg border border-line px-2 py-1.5 outline-none focus:border-accent text-[13px] font-[inherit]"
          />
          <button
            onClick={submitNewSite}
            className="text-muted hover:text-accent p-1 cursor-pointer bg-transparent border-0"
            aria-label="Create"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => { setDraftSiteName(""); setCreatingSite(false); }}
            className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {activeSites.length === 0 && !creatingSite && (
        <div className="bg-surface border border-line py-10 px-6 text-center">
          <div className="text-[13px] text-muted font-medium mb-1">No sites yet</div>
          <div className="text-[12px] text-faint leading-relaxed max-w-[420px] mx-auto">
            Add a site to start grouping farm locations. Brooders,
            mobile coops, paddocks, the barn, the wash &amp; pack
            station — anywhere chores happen lives here.
          </div>
        </div>
      )}

      {activeSites.map((site, i) => (
        <SiteCard
          key={site.id}
          site={site}
          isFirst={i === 0}
          isLast={i === activeSites.length - 1}
          locations={(locationsBySiteId.get(site.id) ?? []).filter(l => l.isActive)}
          archivedLocations={(locationsBySiteId.get(site.id) ?? []).filter(l => !l.isActive)}
          residentsByLocationId={residentsByLocationId}
          livestockGroups={livestockGroups}
          onUpdateSite={updateSite}
          onDeleteSite={deleteSite}
          onMoveSite={moveSite}
          onCreateLocation={createLocation}
          onUpdateLocation={updateLocation}
          onDeleteLocation={deleteLocation}
          onReorderLocations={reorderLocations}
          onAssignResident={assignResident}
          onMoveOutResident={moveOutResident}
          onUpdateResident={updateResident}
        />
      ))}

      {!creatingSite && (
        <button
          onClick={() => setCreatingSite(true)}
          className="self-start inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold px-3 py-1.5 cursor-pointer uppercase tracking-[0.12em] leading-none"
        >
          <Plus size={13} className="shrink-0" /> New site
        </button>
      )}

      {archivedSites.length > 0 && (
        <details className="mt-2">
          <summary className="text-[11px] text-faint cursor-pointer">
            {archivedSites.length} archived site{archivedSites.length !== 1 ? "s" : ""}
          </summary>
          <div className="flex flex-col gap-1 mt-2">
            {archivedSites.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-faint text-[11px] bg-surface border border-line">
                <span className="line-through flex-1">{s.name}</span>
                <button
                  onClick={() => updateSite(s.id, { isActive: true })}
                  className="text-[11px] text-dim hover:text-fg border-0 bg-transparent cursor-pointer uppercase tracking-[0.12em] font-semibold"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function SiteCard({
  site, isFirst, isLast,
  locations, archivedLocations,
  residentsByLocationId, livestockGroups,
  onUpdateSite, onDeleteSite, onMoveSite,
  onCreateLocation, onUpdateLocation, onDeleteLocation, onReorderLocations,
  onAssignResident, onMoveOutResident, onUpdateResident,
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(site.name);
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [draftLocationName, setDraftLocationName] = useState("");

  const saveName = async () => {
    if (name.trim() && name.trim() !== site.name) {
      await onUpdateSite(site.id, { name: name.trim() });
    } else {
      setName(site.name);
    }
    setEditingName(false);
  };

  const moveLocation = (id, direction) => {
    const idx = locations.findIndex(l => l.id === id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= locations.length) return;
    const order = locations.map(l => l.id);
    [order[idx], order[target]] = [order[target], order[idx]];
    onReorderLocations(site.id, order);
  };

  const submitNewLocation = async () => {
    const name = draftLocationName.trim();
    if (!name) { setCreatingLocation(false); return; }
    await onCreateLocation({ siteId: site.id, name });
    setDraftLocationName("");
    setCreatingLocation(false);
  };

  // pluralize gracefully turns "Brooders" → "Brooder", "Sheep paddocks"
  // → "Sheep paddock", "Wash & pack" → "Wash & pack" (already singular).
  const singular = pluralize.singular(site.name);
  const addLabel = `Add ${singular.toLowerCase()}`;

  return (
    <section className="bg-surface border border-line">
      {/* Site header */}
      <header className="flex items-center gap-2 px-3 py-2.5 border-b border-line bg-surface-alt">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onMoveSite(site.id, -1)}
            disabled={isFirst}
            className="border-0 bg-transparent text-dim hover:text-fg disabled:opacity-30 disabled:cursor-default cursor-pointer p-0 leading-none flex items-center justify-center h-3"
            title="Move site up"
          >
            <ArrowUp size={11} />
          </button>
          <button
            type="button"
            onClick={() => onMoveSite(site.id, 1)}
            disabled={isLast}
            className="border-0 bg-transparent text-dim hover:text-fg disabled:opacity-30 disabled:cursor-default cursor-pointer p-0 leading-none flex items-center justify-center h-3"
            title="Move site down"
          >
            <ArrowDown size={11} />
          </button>
        </div>
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") { setName(site.name); setEditingName(false); }
            }}
            className="flex-1 self-center bg-surface text-fg border border-line px-2 py-1 outline-none focus:border-accent text-[13px] font-[inherit] font-semibold"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex-1 self-center text-left text-[14px] font-semibold text-fg border-0 bg-transparent cursor-text px-1"
          >
            {site.name}
          </button>
        )}
        <button
          onClick={() => onDeleteSite(site.id)}
          className="text-faint hover:text-red-500 border-0 bg-transparent cursor-pointer self-center p-1"
          title="Archive site"
        >
          <X size={14} />
        </button>
      </header>

      {/* Locations */}
      <div className="flex flex-col">
        {locations.length === 0 && !creatingLocation && (
          <div className="text-faint text-[11px] italic px-3 py-3">
            No locations yet.
          </div>
        )}
        {locations.map((l, i) => (
          <LocationRow
            key={l.id}
            location={l}
            isFirst={i === 0}
            isLast={i === locations.length - 1}
            residents={(residentsByLocationId.get(l.id) ?? []).filter(r => r.movedOut === null)}
            livestockGroups={livestockGroups}
            onUpdate={onUpdateLocation}
            onDelete={onDeleteLocation}
            onMove={moveLocation}
            onAssignResident={onAssignResident}
            onMoveOutResident={onMoveOutResident}
            onUpdateResident={onUpdateResident}
          />
        ))}
        {creatingLocation && (
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-alt border-t border-line">
            <input
              autoFocus
              value={draftLocationName}
              onChange={(e) => setDraftLocationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewLocation();
                if (e.key === "Escape") { setDraftLocationName(""); setCreatingLocation(false); }
              }}
              placeholder={`${singular} name`}
              className="flex-1 bg-surface text-fg border border-line px-2 py-1.5 outline-none focus:border-accent text-[13px] font-[inherit]"
            />
            <button
              onClick={submitNewLocation}
              className="text-muted hover:text-accent p-1 cursor-pointer bg-transparent border-0"
              aria-label="Create"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => { setDraftLocationName(""); setCreatingLocation(false); }}
              className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {!creatingLocation && (
        <div className="px-3 py-2 border-t border-line">
          <button
            onClick={() => setCreatingLocation(true)}
            className="inline-flex items-center gap-1.5 bg-transparent text-dim hover:text-fg border border-line px-2 py-1 cursor-pointer uppercase tracking-[0.12em] text-[10px] font-semibold leading-none"
          >
            <Plus size={11} className="shrink-0" />
            <span>{addLabel}</span>
          </button>
        </div>
      )}

      {archivedLocations.length > 0 && (
        <details className="px-3 py-2 border-t border-line">
          <summary className="text-[11px] text-faint cursor-pointer">
            {archivedLocations.length} archived
          </summary>
          <div className="flex flex-col gap-1 mt-1">
            {archivedLocations.map(l => (
              <div key={l.id} className="flex items-center gap-2 py-1 text-faint text-[11px]">
                <span className="line-through flex-1">{l.name}</span>
                <button
                  onClick={() => onUpdateLocation(l.id, { isActive: true })}
                  className="text-[11px] text-dim hover:text-fg border-0 bg-transparent cursor-pointer uppercase tracking-[0.12em] font-semibold"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function LocationRow({
  location, isFirst, isLast, residents, livestockGroups,
  onUpdate, onDelete, onMove,
  onAssignResident, onMoveOutResident, onUpdateResident,
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(location.name);

  const saveName = async () => {
    if (name.trim() && name.trim() !== location.name) {
      await onUpdate(location.id, { name: name.trim() });
    } else {
      setName(location.name);
    }
    setEditing(false);
  };

  return (
    <div className="border-t border-line first:border-t-0">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onMove(location.id, -1)}
            disabled={isFirst}
            className="border-0 bg-transparent text-dim hover:text-fg disabled:opacity-30 disabled:cursor-default cursor-pointer p-0 leading-none flex items-center justify-center h-3"
            title="Move up"
          >
            <ArrowUp size={11} />
          </button>
          <button
            type="button"
            onClick={() => onMove(location.id, 1)}
            disabled={isLast}
            className="border-0 bg-transparent text-dim hover:text-fg disabled:opacity-30 disabled:cursor-default cursor-pointer p-0 leading-none flex items-center justify-center h-3"
            title="Move down"
          >
            <ArrowDown size={11} />
          </button>
        </div>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") { setName(location.name); setEditing(false); }
            }}
            className="flex-1 self-center bg-surface text-fg border border-line px-2 py-1 outline-none focus:border-accent text-[13px] font-[inherit]"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 self-center text-left text-[13px] text-fg border-0 bg-transparent cursor-text px-1"
          >
            {location.name}
          </button>
        )}
        <CheckboxField
          checked={location.hasResidents}
          onChange={(v) => onUpdate(location.id, { hasResidents: v })}
          label="Hosts cohorts"
          title="When checked, this location hosts livestock cohorts."
        />
        <button
          onClick={() => onDelete(location.id)}
          className="text-faint hover:text-red-500 border-0 bg-transparent cursor-pointer self-center p-1"
          title="Archive"
        >
          <X size={13} />
        </button>
      </div>
      {location.hasResidents && (
        <ResidentsPane
          locationId={location.id}
          residents={residents}
          livestockGroups={livestockGroups}
          onAssign={onAssignResident}
          onMoveOut={onMoveOutResident}
          onUpdate={onUpdateResident}
        />
      )}
    </div>
  );
}

function ResidentsPane({
  locationId, residents, livestockGroups,
  onAssign, onMoveOut, onUpdate,
}) {
  const [picking, setPicking] = useState(false);
  const [pickedGroupId, setPickedGroupId] = useState("");

  const submitAssign = async () => {
    if (!pickedGroupId) return;
    await onAssign(locationId, pickedGroupId);
    setPickedGroupId("");
    setPicking(false);
  };

  const occupied = new Set(residents.map(r => r.livestockGroupId));
  const available = livestockGroups.filter(g => !occupied.has(g.id));
  const groupLabel = (groupId) =>
    livestockGroups.find(g => g.id === groupId)?.label ?? groupId;
  const groupSpecies = (groupId) =>
    livestockGroups.find(g => g.id === groupId)?.speciesName ?? "";

  return (
    <div className="bg-bg border-t border-line px-3 py-2.5 flex flex-col gap-1.5">
      {residents.length === 0 && !picking && (
        <div className="text-faint text-[11px] italic">
          No cohort assigned.
        </div>
      )}
      {residents.map(r => (
        <ResidentRow
          key={r.id}
          resident={r}
          groupSpecies={groupSpecies(r.livestockGroupId)}
          groupLabel={groupLabel(r.livestockGroupId)}
          onUpdate={onUpdate}
          onMoveOut={onMoveOut}
        />
      ))}
      {picking ? (
        <div className="flex items-center gap-2">
          <select
            autoFocus
            value={pickedGroupId}
            onChange={(e) => setPickedGroupId(e.target.value)}
            className="flex-1 bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent"
          >
            <option value="">— pick a cohort —</option>
            {available.map(g => (
              <option key={g.id} value={g.id}>
                {g.speciesName} · {g.label}
              </option>
            ))}
          </select>
          <button
            onClick={submitAssign}
            disabled={!pickedGroupId}
            className="text-muted hover:text-accent p-1 cursor-pointer bg-transparent border-0 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Assign"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => { setPicking(false); setPickedGroupId(""); }}
            className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          disabled={available.length === 0}
          className="self-start inline-flex items-center gap-1.5 bg-transparent text-dim hover:text-fg border border-line px-2 py-1 cursor-pointer uppercase tracking-[0.12em] text-[10px] font-semibold leading-none disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            available.length === 0
              ? "All cohorts are already assigned somewhere"
              : "Assign a cohort"
          }
        >
          <Plus size={11} className="shrink-0" />
          <span>Assign cohort</span>
        </button>
      )}
    </div>
  );
}

function ResidentRow({ resident, groupSpecies, groupLabel, onUpdate, onMoveOut }) {
  const [editingDate, setEditingDate] = useState(false);
  const [movedIn, setMovedIn] = useState(resident.movedIn);

  const saveDate = async () => {
    if (movedIn && movedIn !== resident.movedIn) {
      await onUpdate(resident.id, { movedIn });
    } else {
      setMovedIn(resident.movedIn);
    }
    setEditingDate(false);
  };

  return (
    <div className="flex items-center gap-3 text-[12px]">
      <span className="text-fg flex-1 truncate">
        {groupSpecies && <span className="text-dim">{groupSpecies} · </span>}
        {groupLabel}
      </span>
      <span className="text-faint text-[11px] inline-flex items-center gap-1.5">
        <span>moved in</span>
        {editingDate ? (
          <input
            type="date"
            autoFocus
            value={movedIn}
            onChange={(e) => setMovedIn(e.target.value)}
            onBlur={saveDate}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveDate();
              if (e.key === "Escape") { setMovedIn(resident.movedIn); setEditingDate(false); }
            }}
            className="bg-surface border border-line text-fg text-[11px] px-1.5 py-0.5 outline-none focus:border-accent"
          />
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            className="text-fg border-0 bg-transparent cursor-text hover:underline"
          >
            {resident.movedIn}
          </button>
        )}
      </span>
      <button
        onClick={() => onMoveOut(resident.id)}
        className="text-[10px] text-dim hover:text-red-500 border border-line bg-transparent cursor-pointer uppercase tracking-[0.12em] font-semibold px-2 py-0.5 leading-none"
        title="Mark moved out today"
      >
        Move out
      </button>
    </div>
  );
}

function CheckboxField({ checked, onChange, label, title }) {
  return (
    <label
      title={title}
      className="inline-flex items-center gap-1.5 text-[11px] text-dim hover:text-fg cursor-pointer self-center select-none"
    >
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="cursor-pointer accent-[var(--c-accent)]"
      />
      <span>{label}</span>
    </label>
  );
}
