import { useEffect, useRef, useState } from "react";
import { buildPlaceTree } from "../lib/places.js";
import { displayBlockSide } from "../lib/sunTimes.js";
import { ASSIGNEES } from "./AssignmentRulesEditor.jsx";

// ChoreFieldsEditor — the single source of truth for the chore
// field-set (Phase 2 of processes-as-chore-generators). It renders the
// fields a chore definition AND a chore-kind process step share:
// title, description, the "belongs to" anchor, the When block, and the
// deadline block. A process step is a chore template + an event anchor,
// so the same control set drives both editors (Chores.jsx inline editor
// and Processes.jsx step editor).
//
// Fully controlled: the host owns the data; this component reports every
// change through `onChange(patch)` where patch is a partial of the chore
// shape (camelCase keys: title, description, blockId, lastChanceBlockId,
// anchorType, anchorSpeciesId, anchorBatchId, anchorKindTag, placeId,
// atPlaceId). The host decides what to do with it — accumulate into a
// draft and save on a button (the Chores inline editor) or persist each
// change immediately (the process step editor).
//
// Two host-shaped knobs:
//   concreteAnimals — true for a chore (the Animals anchor picks a real
//     species/batch); false for a process step (the concrete batch /
//     species comes from the bound event, so the step only authors the
//     anchor *shape* — "the event's batch" / "the event's species").
//   commitMode — "change" commits text fields on every keystroke (the
//     chore editor accumulates locally, so per-keystroke is free);
//     "blur" commits text only on blur / Enter (the step editor writes
//     to the DB per change, so we don't want a write per keystroke).
//   showAssignment — true renders a simple default-assignee dropdown that
//     writes the `assignment` jsonb ({ default: name } | null). Used by
//     the process step editor, whose steps carry assignment inline. The
//     Chores host leaves this off and mounts the full per-day
//     <AssignmentRulesEditor> (chore-scoped rules table) instead.
export default function ChoreFieldsEditor({
  value,
  onChange,
  places,
  blocks,
  groups,
  speciesById,
  concreteAnimals = true,
  commitMode = "change",
  showTitle = true,
  showDescription = true,
  showAssignment = false,
}) {
  const activeBlocks = (blocks ?? []).filter(b => b.isActive);
  // The DB stores start_time as free "HH:MM" text; a few legacy rows
  // carry "HH:MM:SS". Normalize to what <input type="time"> expects.
  const startTimeValue = (value.startTime ?? "").slice(0, 5);

  return (
    <div className="flex flex-col gap-3">
      {showTitle && (
        <EditField label="Title">
          <TextField
            value={value.title ?? ""}
            mode={commitMode}
            onCommit={(v) => onChange({ title: v })}
            className={EDIT_INPUT_CLS}
            placeholder="Chore title"
          />
        </EditField>
      )}
      {showDescription && (
        <EditField label="Description">
          <TextField
            value={value.description ?? ""}
            mode={commitMode}
            onCommit={(v) => onChange({ description: v })}
            multiline
            rows={2}
            className={EDIT_INPUT_CLS + " resize-y"}
            placeholder="Details (optional)"
          />
        </EditField>
      )}

      <EditField label="Belongs to">
        <AnchorEditor
          value={value}
          onChange={onChange}
          places={places}
          groups={groups}
          speciesById={speciesById}
          concreteAnimals={concreteAnimals}
        />
      </EditField>

      <EditField label="When">
        {/* Every chore belongs to a block — there is no "anytime". A new
            chore step seeds to morning; existing chores already carry a
            block. (The deadline block below stays optional.) */}
        <select
          value={value.blockId ?? ""}
          onChange={(e) => onChange({ blockId: e.target.value || null })}
          className={EDIT_INPUT_CLS}
        >
          {!value.blockId && <option value="">— pick a block —</option>}
          {activeBlocks.map(b => (
            <option key={b.id} value={b.id}>
              {b.name} · {displayBlockSide(b.startKind, b.startMinutes)}
            </option>
          ))}
        </select>
      </EditField>

      <EditField label="Start time">
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={startTimeValue}
            onChange={(e) =>
              onChange({ startTime: e.target.value || null })}
            className={EDIT_INPUT_CLS + " w-[120px]"}
          />
          {startTimeValue && (
            <button
              type="button"
              onClick={() => onChange({ startTime: null })}
              className="text-[11px] text-dim bg-transparent border-none cursor-pointer p-0"
            >
              clear
            </button>
          )}
        </div>
        <div className="text-[11px] text-faint mt-1 leading-normal">
          Overrides the block's default start for ordering and the day
          strip. Empty = inherit the block's time.
        </div>
      </EditField>

      <EditField label="Deadline block">
        <select
          value={value.lastChanceBlockId ?? ""}
          onChange={(e) =>
            onChange({ lastChanceBlockId: e.target.value || null })}
          className={EDIT_INPUT_CLS}
        >
          <option value="">— no specific deadline —</option>
          {activeBlocks.map(b => (
            <option key={b.id} value={b.id}>
              {b.name} · {displayBlockSide(b.startKind, b.startMinutes)}
            </option>
          ))}
        </select>
        <div className="text-[11px] text-faint mt-1 leading-normal">
          The last block on the deadline day before the chore counts as
          overrun. Drives the "(N days remaining)" pill on multi-day
          chores.
        </div>
      </EditField>

      {showAssignment && (
        <EditField label="Assigned to">
          <select
            value={value.assignment?.default ?? ""}
            onChange={(e) => {
              const who = e.target.value;
              onChange({ assignment: who ? { default: who } : null });
            }}
            className={EDIT_INPUT_CLS}
          >
            <option value="">Unassigned</option>
            {ASSIGNEES.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="text-[11px] text-faint mt-1 leading-normal">
            Who the generated chores default to. Per-day rules can refine
            this later on the chore itself.
          </div>
        </EditField>
      )}
    </div>
  );
}

// ── Anchor ("belongs to") sub-editor ─────────────────────────────────
// Four UI modes mapping onto the six anchor types:
//   animals    → 'species' | 'batch'
//   place      → 'place' | 'occupied_place' (checkbox)
//   place_kind → 'place_kind'
//   none       → 'none'
//
// The mode + sub-selections are local UI state (initialized from the
// value once). A complete selection emits its anchor patch through
// onChange; an incomplete one (e.g. Animals mode with nothing picked)
// emits nothing, so the value keeps whatever it had. Every anchor field
// is written on each emit, so switching modes clears the fields the new
// mode doesn't use.
function AnchorEditor({
  value, onChange, places, groups, speciesById, concreteAnimals,
}) {
  const initialType =
    value.anchorType ?? (value.placeId ? "occupied_place" : "none");
  const initialMode =
    initialType === "species" || initialType === "batch"
      || initialType === "former_occupancy" ? "animals"
    : initialType === "place" || initialType === "occupied_place" ? "place"
    : initialType === "place_kind" ? "place_kind"
    : "none";

  const [anchor, setAnchor] = useState(() => ({
    mode: initialMode,
    // concrete (chore): "species:<id>" | "batch:<id>"
    animalKey:
      (initialType === "batch" || initialType === "former_occupancy")
        && value.anchorBatchId
        ? `batch:${value.anchorBatchId}`
        : initialType === "species" && value.anchorSpeciesId
          ? `species:${value.anchorSpeciesId}`
          : "",
    // shape (step): 'batch' | 'species'. former_occupancy is batch-only.
    animalScope:
      initialType === "species" ? "species" : "batch",
    // cleanup-after-leaving: anchor to the places the batch USED, even
    // once it's moved on (brooder cleanout). Resolves via placement
    // history, kind-filtered by housedTag.
    formerOccupancy: initialType === "former_occupancy",
    housedTag:
      initialType === "species" || initialType === "batch"
        || initialType === "former_occupancy"
        ? value.anchorKindTag ?? ""
        : "",
    atPlaceId: value.atPlaceId ?? "",
    placeId: value.placeId ?? "",
    occupiedOnly: initialType === "occupied_place",
    kindTag: initialType === "place_kind" ? value.anchorKindTag ?? "" : "",
  }));
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  // Apply a sub-field change, then emit the resulting anchor patch (if
  // the selection is now complete). Reads the ref so chained calls in
  // one tick stay consistent.
  const update = (partial) => {
    const next = { ...anchorRef.current, ...partial };
    anchorRef.current = next;
    setAnchor(next);
    const patch = buildAnchorPatch(next, concreteAnimals);
    if (patch) onChange(patch);
  };

  const placeOptions = placeSelectOptions(places);
  const speciesList = [...(speciesById?.values() ?? [])];
  const kindTags = [...new Set(
    (places ?? [])
      .filter(p => p.isActive !== false && p.kindTag)
      .map(p => p.kindTag)
  )].sort();
  const prettyTag = (tag) => tag.replaceAll("_", " ");

  return (
    <div className="flex flex-col gap-2">
      <AnchorModeRadio
        value={anchor.mode}
        onChange={(mode) => update({ mode })}
        options={[
          { id: "animals", label: "Animals" },
          { id: "place", label: "A place" },
          { id: "place_kind", label: "Every place of a kind" },
          {
            id: "none",
            label: concreteAnimals
              ? "Nothing — whole farm"
              : "The event's animals (default)",
          },
        ]}
      />

      {anchor.mode === "animals" && (
        <div className="flex flex-col gap-2 pl-[22px]">
          {concreteAnimals ? (
            <select
              value={anchor.animalKey}
              onChange={(e) => update({ animalKey: e.target.value })}
              className={EDIT_INPUT_CLS}
            >
              <option value="">— pick animals —</option>
              <optgroup label="A species (every batch)">
                {speciesList.map(s => (
                  <option key={s.id} value={`species:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="One specific batch">
                {(groups ?? []).map(g => (
                  <option key={g.id} value={`batch:${g.id}`}>
                    {g.label}
                    {speciesById?.get(g.speciesId)
                      ? ` (${speciesById.get(g.speciesId).name})`
                      : ""}
                  </option>
                ))}
              </optgroup>
            </select>
          ) : (
            <select
              value={anchor.animalScope}
              onChange={(e) => update({ animalScope: e.target.value })}
              className={EDIT_INPUT_CLS}
              title="The bound event supplies the concrete batch/species"
            >
              <option value="batch">The event's batch</option>
              <option value="species">The event's species (every batch)</option>
            </select>
          )}
          <div className="flex gap-2 flex-wrap">
            <select
              value={anchor.housedTag}
              onChange={(e) => update({ housedTag: e.target.value })}
              className={EDIT_INPUT_CLS}
              title="Only count these animals where they're housed in this kind of place"
            >
              <option value="">housed anywhere</option>
              {kindTags.map(tag => (
                <option key={tag} value={tag}>
                  housed in {prettyTag(tag)}s
                </option>
              ))}
            </select>
            <select
              value={anchor.atPlaceId}
              onChange={(e) => update({ atPlaceId: e.target.value })}
              className={EDIT_INPUT_CLS}
              title="Where the work physically happens"
            >
              <option value="">work happens where they live</option>
              {placeOptions.map(o => (
                <option key={o.id} value={o.id}>
                  work happens at {o.label.trim()}
                </option>
              ))}
            </select>
          </div>
          {anchor.housedTag &&
            (concreteAnimals
              ? anchor.animalKey.startsWith("batch:")
              : anchor.animalScope === "batch") && (
            <label className="flex items-start gap-1.5 text-[12px] text-dim cursor-pointer">
              <input
                type="checkbox"
                checked={anchor.formerOccupancy}
                onChange={(e) => update({ formerOccupancy: e.target.checked })}
                className="mt-0.5"
              />
              Cleanup after they leave — anchor to the{" "}
              {prettyTag(anchor.housedTag)}s this batch used, even once
              it has moved on (brooder cleanout).
            </label>
          )}
          <div className="text-[11px] text-faint leading-normal">
            {anchor.formerOccupancy
              ? `The chore stays on the ${prettyTag(anchor.housedTag)}s `
                + `this batch occupied — resolved from its placement `
                + `history — so a cleanout fires there after the batch `
                + `has moved on.`
              : `The chore follows these animals — move them and the `
                + `chore moves with them. No active animals → the chore `
                + `goes dormant. "Wash eggs" belongs to the layers but `
                + `happens at the House.`}
          </div>
        </div>
      )}

      {anchor.mode === "place" && (
        <div className="flex flex-col gap-2 pl-[22px]">
          <select
            value={anchor.placeId}
            onChange={(e) => update({ placeId: e.target.value })}
            className={EDIT_INPUT_CLS}
          >
            <option value="">— pick a place —</option>
            {placeOptions.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-dim cursor-pointer">
            <input
              type="checkbox"
              checked={anchor.occupiedOnly}
              onChange={(e) => update({ occupiedOnly: e.target.checked })}
            />
            Only where animals currently live (fans into occupied
            places beneath it)
          </label>
          <div className="text-[11px] text-faint leading-normal">
            Unchecked: the chore sticks to this exact place whether or
            not anything lives there ("mow Pasture B").
          </div>
        </div>
      )}

      {anchor.mode === "place_kind" && (
        <div className="flex flex-col gap-2 pl-[22px]">
          <select
            value={anchor.kindTag}
            onChange={(e) => update({ kindTag: e.target.value })}
            className={EDIT_INPUT_CLS}
          >
            <option value="">— pick a kind —</option>
            {kindTags.map(tag => (
              <option key={tag} value={tag}>
                every {prettyTag(tag)}
              </option>
            ))}
          </select>
          <div className="text-[11px] text-faint leading-normal">
            One obligation per active place of this kind, occupied or
            not ("power-wash nest boxes" → every coop).
          </div>
        </div>
      )}
    </div>
  );
}

// The anchor patch for a given anchor UI state. Returns null when the
// active mode's selection is incomplete (so nothing is committed). For
// a process step (concreteAnimals=false) the species/batch *id* columns
// don't exist, so they're omitted — the bound event supplies them.
function buildAnchorPatch(a, concreteAnimals) {
  const clearIds = concreteAnimals
    ? { anchorSpeciesId: null, anchorBatchId: null }
    : {};
  if (a.mode === "animals") {
    if (concreteAnimals) {
      const [kind, id] = (a.animalKey || "").split(":");
      if (!id) return null;
      // Cleanup-after-leaving only makes sense for a specific batch +
      // a place kind (the brooders that batch used).
      if (a.formerOccupancy && kind === "batch" && a.housedTag) {
        return {
          anchorType: "former_occupancy",
          anchorSpeciesId: null,
          anchorBatchId: id,
          anchorKindTag: a.housedTag,
          atPlaceId: null,
          placeId: null,
        };
      }
      return {
        anchorType: kind === "batch" ? "batch" : "species",
        anchorSpeciesId: kind === "species" ? id : null,
        anchorBatchId: kind === "batch" ? id : null,
        anchorKindTag: a.housedTag || null,
        atPlaceId: a.atPlaceId || null,
        placeId: null,
      };
    }
    if (a.formerOccupancy && a.animalScope === "batch" && a.housedTag) {
      return {
        anchorType: "former_occupancy",
        anchorKindTag: a.housedTag,
        atPlaceId: null,
        placeId: null,
      };
    }
    return {
      anchorType: a.animalScope, // 'batch' | 'species'
      anchorKindTag: a.housedTag || null,
      atPlaceId: a.atPlaceId || null,
      placeId: null,
    };
  }
  if (a.mode === "place") {
    if (!a.placeId) return null;
    return {
      anchorType: a.occupiedOnly ? "occupied_place" : "place",
      ...clearIds,
      anchorKindTag: null,
      atPlaceId: null,
      placeId: a.placeId,
    };
  }
  if (a.mode === "place_kind") {
    if (!a.kindTag) return null;
    return {
      anchorType: "place_kind",
      ...clearIds,
      anchorKindTag: a.kindTag,
      atPlaceId: null,
      placeId: null,
    };
  }
  return {
    anchorType: "none",
    ...clearIds,
    anchorKindTag: null,
    atPlaceId: null,
    placeId: null,
  };
}

// Text input / textarea that commits per the host's commit mode. In
// "change" mode it reports every keystroke; in "blur" mode it keeps a
// local draft and commits on blur / Enter (Escape reverts). The draft
// re-syncs from `value` whenever the field isn't focused, so external
// updates (e.g. a realtime refetch) land cleanly.
function TextField({
  value, onCommit, mode = "change", multiline = false, ...rest
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value ?? "");
  }, [value, focused]);

  const Comp = multiline ? "textarea" : "input";
  return (
    <Comp
      {...rest}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (mode === "change") onCommit(e.target.value);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (mode === "blur" && draft !== (value ?? "")) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !multiline && mode === "blur") e.target.blur();
        if (e.key === "Escape") { setDraft(value ?? ""); e.target.blur(); }
      }}
    />
  );
}

// Radio row for the anchor mode.
function AnchorModeRadio({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {options.map(o => (
        <label
          key={o.id}
          className={
            "flex items-center gap-1.5 text-[12px] cursor-pointer " +
            (value === o.id ? "text-fg" : "text-dim")
          }
        >
          <input
            type="radio"
            checked={value === o.id}
            onChange={() => onChange(o.id)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

// Depth-ordered, indented options for a place <select>. A chore scoped
// to a place applies to that place's whole subtree, so any node is a
// valid target. Order is a pre-order tree walk; depth drives the indent.
export function placeSelectOptions(places) {
  const { childrenByParent } = buildPlaceTree(
    (places ?? []).filter(p => p.isActive !== false)
  );
  const out = [];
  const walk = (parentId, depth) => {
    for (const p of childrenByParent.get(parentId) ?? []) {
      // Non-breaking spaces so the depth indent survives in a <select>.
      out.push({ id: p.id, label: `${"  ".repeat(depth)}${p.name}` });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function EditField({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] text-faint uppercase tracking-[0.12em]">
        {label}
      </label>
      {children}
    </div>
  );
}

// The shared field look for both editors (Chores inline + Processes step).
// Form controls stay raised by design — `bg-surface` on a hairline border —
// but expressed as token Tailwind classes, not the old inline `T.*` object.
// Geometry matches the former editInputStyle (12px text, 6/8 padding); the
// focus treatment now matches every other input in the kit (INPUT_CLS).
export const EDIT_INPUT_CLS =
  "bg-surface border border-line text-fg text-[12px] px-2 py-1.5 " +
  "outline-none focus:border-accent font-[inherit]";
