import { useMemo, useState } from "react";
import {
  Plus, X, ArrowUp, ArrowDown, Pencil, Check, ChevronRight, ChevronDown,
} from "lucide-react";
import { useSites } from "../lib/data/useSites.js";
import { descendantIds } from "../lib/places.js";

// Resources → Sites is now the recursive PLACE TREE editor (Batch 15).
// One tree replaces the old sites / locations / residents trio:
//   - every node is a place (farm → zones → areas → structures)
//   - a node can be renamed, reparented, reordered among its siblings,
//     archived, flagged mobile, and typed (kind / kind_tag / code)
//   - any place can host occupants (livestock batches, machines, …) via
//     `placements`; the occupants pane shows who's there now.
//
// The geographic axis is primary; `kind_tag` is the secondary "type"
// (coop / tractor / brooder / pasture …) Rounds uses to sweep by kind.

const KIND_OPTIONS = ["farm", "zone", "area", "structure"];

export default function SitesAdmin({ data }) {
  // Occupant catalogs the placements pane can assign + label from.
  const occupants = useMemo(() => {
    const batches = [];
    for (const sp of data?.livestock?.species ?? []) {
      for (const g of sp.groups ?? []) {
        batches.push({ id: g.id, label: g.label, sub: sp.name });
      }
    }
    const machines = (data?.machines ?? []).map((m) => ({
      id: m.id,
      label: m.label,
      sub: m.manufacturer ?? "Machine",
    }));
    return { batch: batches, machine: machines };
  }, [data]);

  const occupantLabel = useMemo(() => {
    const byKey = new Map();
    for (const [type, list] of Object.entries(occupants)) {
      for (const o of list) byKey.set(`${type}:${o.id}`, o);
    }
    return (type, id) => byKey.get(`${type}:${id}`) ?? { label: id, sub: type };
  }, [occupants]);

  const {
    places, placesById, childrenByParent, roots, placements,
    placementsByPlaceId, loading,
    createPlace, updatePlace, deletePlace, reorderPlaces, reparentPlace,
    assignOccupant, moveOutOccupant,
  } = useSites();

  // Where is each occupant right now? (open placements only.)
  const occupantCurrentPlace = useMemo(() => {
    const m = new Map();
    for (const pl of placements ?? []) {
      if (pl.movedOut === null) m.set(`${pl.occupantType}:${pl.occupantId}`, pl.placeId);
    }
    return m;
  }, [placements]);

  const [creatingRoot, setCreatingRoot] = useState(false);
  const [draftRootName, setDraftRootName] = useState("");

  const activeRoots = roots.filter((p) => p.isActive !== false);
  const archived = (places ?? []).filter((p) => p.isActive === false);

  const submitNewRoot = async () => {
    const name = draftRootName.trim();
    if (!name) { setCreatingRoot(false); return; }
    await createPlace({ parentId: null, name, kind: "zone" });
    setDraftRootName("");
    setCreatingRoot(false);
  };

  if (loading) {
    return (
      <div className="bg-surface border border-line py-8 text-center text-[12px] text-muted uppercase tracking-[0.16em]">
        Loading places…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activeRoots.length === 0 && !creatingRoot && (
        <div className="bg-surface border border-line py-10 px-6 text-center">
          <div className="text-[13px] text-muted font-medium mb-1">No places yet</div>
          <div className="text-[12px] text-faint leading-relaxed max-w-[420px] mx-auto">
            Add the farm, then build out zones, pastures, and structures
            beneath it. Anywhere chores happen, animals live, or assets
            park lives in this tree.
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {activeRoots.map((place, i) => (
          <PlaceNode
            key={place.id}
            place={place}
            depth={0}
            isFirst={i === 0}
            isLast={i === activeRoots.length - 1}
            childrenByParent={childrenByParent}
            placesById={placesById}
            placements={placements}
            placementsByPlaceId={placementsByPlaceId}
            occupants={occupants}
            occupantLabel={occupantLabel}
            occupantCurrentPlace={occupantCurrentPlace}
            onCreatePlace={createPlace}
            onUpdatePlace={updatePlace}
            onDeletePlace={deletePlace}
            onReorder={reorderPlaces}
            onReparent={reparentPlace}
            onAssignOccupant={assignOccupant}
            onMoveOutOccupant={moveOutOccupant}
          />
        ))}
      </div>

      {creatingRoot ? (
        <div className="bg-surface-alt border border-line p-3 flex items-center gap-2">
          <input
            autoFocus
            value={draftRootName}
            onChange={(e) => setDraftRootName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewRoot();
              if (e.key === "Escape") { setDraftRootName(""); setCreatingRoot(false); }
            }}
            placeholder="Top-level place (e.g. North Foster Farm)"
            className="flex-1 bg-surface text-fg border border-line px-2 py-1.5 outline-none focus:border-accent text-[13px] font-[inherit]"
          />
          <button onClick={submitNewRoot} className="text-muted hover:text-accent p-1 cursor-pointer bg-transparent border-0" aria-label="Create">
            <Check size={14} />
          </button>
          <button onClick={() => { setDraftRootName(""); setCreatingRoot(false); }} className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0" aria-label="Cancel">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreatingRoot(true)}
          className="self-start inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold px-3 py-1.5 cursor-pointer uppercase tracking-[0.12em] leading-none"
        >
          <Plus size={13} className="shrink-0" /> New top-level place
        </button>
      )}

      {archived.length > 0 && (
        <details className="mt-2">
          <summary className="text-[11px] text-faint cursor-pointer">
            {archived.length} archived place{archived.length !== 1 ? "s" : ""}
          </summary>
          <div className="flex flex-col gap-1 mt-2">
            {archived.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-faint text-[11px] bg-surface border border-line">
                <span className="line-through flex-1">{p.name}</span>
                <button
                  onClick={() => updatePlace(p.id, { isActive: true })}
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

function PlaceNode({
  place, depth, isFirst, isLast,
  childrenByParent, placesById, placements, placementsByPlaceId,
  occupants, occupantLabel, occupantCurrentPlace,
  onCreatePlace, onUpdatePlace, onDeletePlace, onReorder, onReparent,
  onAssignOccupant, onMoveOutOccupant,
}) {
  const kids = (childrenByParent.get(place.id) ?? []).filter((p) => p.isActive !== false);
  // Expand the whole tree by default — the structures that hold animals
  // (chicken tractors, coops, brooders) live at the deepest level, and
  // collapsing past depth 2 hid them entirely.
  const [open, setOpen] = useState(true);

  // Occupants anywhere in this place's subtree (including itself), so a
  // zone/area can summarize "what's down there" without being expanded,
  // and a parent never reads "No occupants here" while a child holds a
  // batch.
  const subtree = descendantIds(place.id, childrenByParent);
  let subtreeOccupantCount = 0;
  for (const id of subtree) {
    if (id === place.id) continue;
    subtreeOccupantCount += (placementsByPlaceId.get(id) ?? []).length;
  }
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(place.name);
  const [creatingChild, setCreatingChild] = useState(false);
  const [draftChildName, setDraftChildName] = useState("");

  const residents = placementsByPlaceId.get(place.id) ?? [];

  const saveName = async () => {
    if (name.trim() && name.trim() !== place.name) {
      await onUpdatePlace(place.id, { name: name.trim() });
    } else {
      setName(place.name);
    }
    setEditing(false);
  };

  const submitNewChild = async () => {
    const n = draftChildName.trim();
    if (!n) { setCreatingChild(false); return; }
    await onCreatePlace({ parentId: place.id, name: n, kind: "structure" });
    setDraftChildName("");
    setCreatingChild(false);
    setOpen(true);
  };

  return (
    <div className="bg-surface border border-line">
      {/* Node header */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* reorder among siblings */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => reorderAmongSiblings(place, -1, childrenByParent, onReorder)}
            disabled={isFirst}
            className="border-0 bg-transparent text-dim hover:text-fg disabled:opacity-30 disabled:cursor-default cursor-pointer p-0 leading-none flex items-center justify-center h-3"
            title="Move up"
          >
            <ArrowUp size={11} />
          </button>
          <button
            type="button"
            onClick={() => reorderAmongSiblings(place, 1, childrenByParent, onReorder)}
            disabled={isLast}
            className="border-0 bg-transparent text-dim hover:text-fg disabled:opacity-30 disabled:cursor-default cursor-pointer p-0 leading-none flex items-center justify-center h-3"
            title="Move down"
          >
            <ArrowDown size={11} />
          </button>
        </div>

        {/* expand / collapse */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="border-0 bg-transparent text-dim hover:text-fg cursor-pointer p-0.5 self-center disabled:opacity-20"
          disabled={kids.length === 0}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {kids.length > 0
            ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
            : <span className="inline-block w-[14px]" />}
        </button>

        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") { setName(place.name); setEditing(false); }
            }}
            className="flex-1 self-center bg-surface text-fg border border-line px-2 py-1 outline-none focus:border-accent text-[13px] font-[inherit] font-semibold"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 self-center text-left text-[13px] font-semibold text-fg border-0 bg-transparent cursor-text px-1 inline-flex items-center gap-2 min-w-0"
          >
            <span className="truncate">{place.name}</span>
            {place.code && (
              <span className="text-[10px] text-dim font-mono bg-surface-alt border border-line px-1 py-0.5 leading-none">{place.code}</span>
            )}
            {place.mobile && (
              <span className="text-[9px] text-accent uppercase tracking-[0.12em] font-semibold">mobile</span>
            )}
            {place.kindTag && (
              <span className="text-[10px] text-faint">{place.kindTag}</span>
            )}
            {kids.length > 0 && (
              <span className="text-[10px] text-faint shrink-0">
                {kids.length} place{kids.length === 1 ? "" : "s"}
                {subtreeOccupantCount > 0
                  ? ` · ${subtreeOccupantCount} occupant`
                    + (subtreeOccupantCount === 1 ? "" : "s")
                  : ""}
              </span>
            )}
          </button>
        )}

        <button onClick={() => setCreatingChild(true)} className="text-faint hover:text-accent border-0 bg-transparent cursor-pointer self-center p-1" title="Add child place">
          <Plus size={14} />
        </button>
        <button onClick={() => onDeletePlace(place.id)} className="text-faint hover:text-warn border-0 bg-transparent cursor-pointer self-center p-1" title="Archive">
          <X size={14} />
        </button>
      </div>

      {/* Inline editor (kind / kind_tag / code / mobile / parent) */}
      {editing && (
        <PlaceEditor
          place={place}
          placesById={placesById}
          childrenByParent={childrenByParent}
          onUpdatePlace={onUpdatePlace}
          onReparent={onReparent}
        />
      )}

      {/* Occupants pane */}
      <OccupantsPane
        place={place}
        residents={residents}
        subtreeOccupantCount={subtreeOccupantCount}
        occupants={occupants}
        occupantLabel={occupantLabel}
        occupantCurrentPlace={occupantCurrentPlace}
        placesById={placesById}
        onAssign={onAssignOccupant}
        onMoveOut={onMoveOutOccupant}
      />

      {/* New child input */}
      {creatingChild && (
        <div className="flex items-center gap-2 px-3 py-2 bg-surface-alt border-t border-line">
          <input
            autoFocus
            value={draftChildName}
            onChange={(e) => setDraftChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewChild();
              if (e.key === "Escape") { setDraftChildName(""); setCreatingChild(false); }
            }}
            placeholder={`Child of ${place.name}`}
            className="flex-1 bg-surface text-fg border border-line px-2 py-1.5 outline-none focus:border-accent text-[13px] font-[inherit]"
          />
          <button onClick={submitNewChild} className="text-muted hover:text-accent p-1 cursor-pointer bg-transparent border-0" aria-label="Create">
            <Check size={14} />
          </button>
          <button onClick={() => { setDraftChildName(""); setCreatingChild(false); }} className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0" aria-label="Cancel">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Children */}
      {open && kids.length > 0 && (
        <div className="border-t border-line pl-4 pr-2 py-2 flex flex-col gap-2 bg-bg">
          {kids.map((child, i) => (
            <PlaceNode
              key={child.id}
              place={child}
              depth={depth + 1}
              isFirst={i === 0}
              isLast={i === kids.length - 1}
              childrenByParent={childrenByParent}
              placesById={placesById}
              placements={placements}
              placementsByPlaceId={placementsByPlaceId}
              occupants={occupants}
              occupantLabel={occupantLabel}
              occupantCurrentPlace={occupantCurrentPlace}
              onCreatePlace={onCreatePlace}
              onUpdatePlace={onUpdatePlace}
              onDeletePlace={onDeletePlace}
              onReorder={onReorder}
              onReparent={onReparent}
              onAssignOccupant={onAssignOccupant}
              onMoveOutOccupant={onMoveOutOccupant}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Reorder a place among its active siblings by swapping with the
// neighbor in `direction` and persisting the new order.
function reorderAmongSiblings(place, direction, childrenByParent, onReorder) {
  const siblings = (childrenByParent.get(place.parentId ?? null) ?? [])
    .filter((p) => p.isActive !== false);
  const idx = siblings.findIndex((p) => p.id === place.id);
  if (idx < 0) return;
  const target = idx + direction;
  if (target < 0 || target >= siblings.length) return;
  const order = siblings.map((p) => p.id);
  [order[idx], order[target]] = [order[target], order[idx]];
  onReorder(place.parentId ?? null, order);
}

function PlaceEditor({ place, placesById, childrenByParent, onUpdatePlace, onReparent }) {
  const [kind, setKind] = useState(place.kind ?? "structure");
  const [kindTag, setKindTag] = useState(place.kindTag ?? "");
  const [code, setCode] = useState(place.code ?? "");

  // Valid reparent targets: every active place except self + its
  // descendants (no cycles), plus "(top level)".
  const blocked = descendantIds(place.id, childrenByParent);
  const targets = [...placesById.values()].filter(
    (p) => p.isActive !== false && !blocked.has(p.id)
  );

  const commit = (patch) => onUpdatePlace(place.id, patch);

  return (
    <div className="border-t border-line bg-surface-alt px-3 py-2.5 flex flex-wrap items-end gap-3">
      <Field label="Type">
        <select
          value={kind}
          onChange={(e) => { setKind(e.target.value); commit({ kind: e.target.value }); }}
          className="bg-surface border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent"
        >
          {KIND_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </Field>
      <Field label="Tag (coop / tractor / …)">
        <input
          value={kindTag}
          onChange={(e) => setKindTag(e.target.value)}
          onBlur={() => commit({ kindTag })}
          placeholder="kind_tag"
          className="bg-surface border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent w-[120px]"
        />
      </Field>
      <Field label="Code">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onBlur={() => commit({ code })}
          placeholder="MC1"
          className="bg-surface border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent w-[80px]"
        />
      </Field>
      <Field label="Parent">
        <select
          value={place.parentId ?? ""}
          onChange={(e) => onReparent(place.id, e.target.value || null)}
          className="bg-surface border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent max-w-[180px]"
        >
          <option value="">(top level)</option>
          {targets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <label className="inline-flex items-center gap-1.5 text-[11px] text-dim hover:text-fg cursor-pointer select-none pb-1">
        <input
          type="checkbox"
          checked={!!place.mobile}
          onChange={(e) => commit({ mobile: e.target.checked })}
          className="cursor-pointer accent-[var(--c-accent)]"
        />
        <span>Mobile</span>
      </label>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-faint uppercase tracking-[0.12em]">{label}</span>
      {children}
    </label>
  );
}

function OccupantsPane({
  place, residents, subtreeOccupantCount = 0, occupants, occupantLabel,
  occupantCurrentPlace, placesById, onAssign, onMoveOut,
}) {
  const [picking, setPicking] = useState(false);
  const [type, setType] = useState("batch");
  const [pickedId, setPickedId] = useState("");

  const submitAssign = async () => {
    if (!pickedId) return;
    await onAssign(place.id, type, pickedId);
    setPickedId("");
    setPicking(false);
  };

  // Candidates of the chosen type that aren't already at THIS place.
  const candidates = (occupants[type] ?? []).filter(
    (o) => occupantCurrentPlace.get(`${type}:${o.id}`) !== place.id
  );
  const currentPlaceName = (o) => {
    const pid = occupantCurrentPlace.get(`${type}:${o.id}`);
    return pid ? placesById.get(pid)?.name : null;
  };

  const hasAny = residents.length > 0;

  return (
    <div className="bg-bg border-t border-line px-3 py-2 flex flex-col gap-1.5">
      {!hasAny && !picking && (
        <div className="text-faint text-[11px] italic">
          {subtreeOccupantCount > 0
            ? `No occupants placed directly here — ${subtreeOccupantCount} `
              + `in sub-places below.`
            : "No occupants here."}
        </div>
      )}
      {residents.map((r) => {
        const o = occupantLabel(r.occupantType, r.occupantId);
        return (
          <div key={r.id} className="flex items-center gap-3 text-[12px]">
            <span className="text-fg flex-1 truncate">
              {o.sub && <span className="text-dim">{o.sub} · </span>}
              {o.label}
              <span className="text-faint text-[10px] uppercase tracking-[0.12em] ml-2">{r.occupantType}</span>
            </span>
            <span className="text-faint text-[11px]">moved in {r.movedIn}</span>
            <button
              onClick={() => onMoveOut(r.id)}
              className="text-[10px] text-dim hover:text-warn border border-line bg-transparent cursor-pointer uppercase tracking-[0.12em] font-semibold px-2 py-0.5 leading-none"
              title="Mark moved out today"
            >
              Move out
            </button>
          </div>
        );
      })}

      {picking ? (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPickedId(""); }}
            className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent"
          >
            <option value="batch">Batch</option>
            <option value="machine">Machine</option>
          </select>
          <select
            autoFocus
            value={pickedId}
            onChange={(e) => setPickedId(e.target.value)}
            className="flex-1 min-w-[160px] bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent"
          >
            <option value="">— pick an occupant —</option>
            {candidates.map((o) => {
              const at = currentPlaceName(o);
              return (
                <option key={o.id} value={o.id}>
                  {o.sub} · {o.label}{at ? ` (now at ${at})` : ""}
                </option>
              );
            })}
          </select>
          <button onClick={submitAssign} disabled={!pickedId} className="text-muted hover:text-accent p-1 cursor-pointer bg-transparent border-0 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Assign">
            <Check size={14} />
          </button>
          <button onClick={() => { setPicking(false); setPickedId(""); }} className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0" aria-label="Cancel">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="self-start inline-flex items-center gap-1.5 bg-transparent text-dim hover:text-fg border border-line px-2 py-1 cursor-pointer uppercase tracking-[0.12em] text-[10px] font-semibold leading-none"
        >
          <Plus size={11} className="shrink-0" />
          <span>Place occupant here</span>
        </button>
      )}
    </div>
  );
}
