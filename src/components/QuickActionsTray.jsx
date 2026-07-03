import { useEffect, useMemo, useState } from "react";
import {
  X, MessageSquare, AlertTriangle, Skull, Egg, ChevronDown, MapPin,
} from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { descendantIds } from "../lib/places.js";
import PlaceTag from "./PlaceTag.jsx";

// Bottom-pinned tray for the Rounds doing surface. Quick actions —
// Note, MASH, Mortality, Eggs — each opens a sheet that writes a typed
// Run Event via `logRunEvent` / `logMortality` / `logEggCollection`.
// Since Batch 16.2 those helpers append to the device-local outbox
// (lib/outbox.js) rather than calling Supabase directly, so a capture
// in a dead zone saves instantly and syncs when signal returns. Move +
// Sweep retired from the tray in Batch 10: cohort moves are planned
// events, and sweep is just bulk-tick on the doing surface itself.
// Eggs added in Batch 26.1: counts land in egg_collections (the
// metrics engine's production record) plus an activity row.
//
// Place context defaults from Rounds: selectedPlaceId (the drilled
// child if set, else the top-level place) seeds the sheet; "" means
// general (no place) and the user can still pick in-sheet. The
// resolved place is displayed prominently — name + bold parent (D1,
// Batch 17) — above the form so what's about to be saved is never
// ambiguous. Quick actions write to `activity_log` with `run_id` +
// `place_id` set so the Observation Log can group them.

const CONDITION_STATES = [
  "Listless", "Unthrifty", "Off-feed",
  "Off-water", "Damaged", "Sick",
];

// Depth-ordered, indented place options for the in-sheet picker.
function buildPlaceOptions(places, childrenByParent) {
  const out = [];
  const walk = (parentId, depth) => {
    for (const p of childrenByParent.get(parentId) ?? []) {
      if (p.isActive !== false) {
        out.push({ id: p.id, label: `${"  ".repeat(depth)}${p.name}` });
      }
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export default function QuickActionsTray({
  runId,
  selectedPlaceId,
  places,
  placesById,
  childrenByParent,
  placementsByPlaceId,
  recentConditionsByPlace,
  repeatWindowDays,
  onLogRunEvent,
  onLogMortality,
  onLogEggCollection,
}) {
  const [open, setOpen] = useState(null);
  // 'note' | 'mash' | 'mortality' | 'eggs'

  const seedPlaceId = selectedPlaceId ?? null;
  const placeOptions = useMemo(
    () => buildPlaceOptions(places ?? [], childrenByParent),
    [places, childrenByParent]
  );

  return (
    <>
      {/* Pinned to the viewport bottom: the Rounds surface scrolls as
          a normal document, so `sticky bottom-0` keeps the tray
          reachable however tall the chore list is (and however much
          browser chrome iOS shows). */}
      <nav
        className={
          "sticky bottom-0 z-30 shrink-0 flex items-stretch " +
          "border-t border-line bg-surface divide-x divide-line"
        }
      >
        <TrayButton
          icon={MessageSquare}
          label="Note"
          onClick={() => setOpen("note")}
        />
        <TrayButton
          icon={AlertTriangle}
          label="MASH"
          onClick={() => setOpen("mash")}
        />
        <TrayButton
          icon={Skull}
          label="Mortality"
          onClick={() => setOpen("mortality")}
        />
        <TrayButton
          icon={Egg}
          label="Eggs"
          onClick={() => setOpen("eggs")}
        />
      </nav>

      {open === "note" && (
        <NoteSheet
          runId={runId}
          seedPlaceId={seedPlaceId}
          placeOptions={placeOptions}
          placesById={placesById}
          onLogRunEvent={onLogRunEvent}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "mash" && (
        <MashSheet
          runId={runId}
          seedPlaceId={seedPlaceId}
          placeOptions={placeOptions}
          placesById={placesById}
          recentConditionsByPlace={recentConditionsByPlace}
          repeatWindowDays={repeatWindowDays}
          onLogRunEvent={onLogRunEvent}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "mortality" && (
        <MortalitySheet
          runId={runId}
          seedPlaceId={seedPlaceId}
          placeOptions={placeOptions}
          placesById={placesById}
          childrenByParent={childrenByParent}
          placementsByPlaceId={placementsByPlaceId}
          onLogMortality={onLogMortality}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "eggs" && (
        <EggsSheet
          runId={runId}
          seedPlaceId={seedPlaceId}
          placeOptions={placeOptions}
          placesById={placesById}
          childrenByParent={childrenByParent}
          placementsByPlaceId={placementsByPlaceId}
          onLogEggCollection={onLogEggCollection}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

// ── Tray button ───────────────────────────────────────────────────────
function TrayButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex-1 flex flex-col items-center justify-center gap-1 py-3 " +
        "bg-transparent border-0 cursor-pointer text-fg " +
        "hover:bg-row-hover active:bg-row-active transition-colors"
      }
    >
      <Icon size={18} className="shrink-0" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </span>
    </button>
  );
}

// ── Sheet shell ───────────────────────────────────────────────────────
function Sheet({ title, onClose, children, footer }) {
  // Lock body scroll while open; Escape closes like every other sheet.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  // The card caps at max-h-full, NOT a vh unit: the app zooms `body`
  // for text density, and vh resolves against the unzoomed viewport —
  // a 90vh card renders at 108–135% of the screen and ejects the
  // header (and its close X) past the top edge (F57). The fixed
  // inset-0 overlay spans the real viewport under any zoom, so its
  // padding is the backdrop strip and the card can never outgrow it.
  return (
    <div
      className={
        "fixed inset-0 z-50 flex items-end sm:items-center " +
        "justify-center bg-black/60 pt-12 sm:py-8"
      }
      onClick={onClose}
    >
      <div
        className={
          "bg-bg border border-line w-full sm:max-w-[480px] " +
          "max-h-full flex flex-col font-body"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
            {title}
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {footer && (
          <footer className="px-5 py-4 border-t border-line shrink-0 bg-surface">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

// ── Place context banner (shared) ─────────────────────────────────────
// D1 (Batch 17): the resolved place is displayed prominently — its own
// name plus its parent in bold — so what's about to be saved is never
// ambiguous in the field. Sits above the picker in every sheet.
function PlaceContextBanner({ placeId, placesById }) {
  const place = placeId ? placesById?.get(placeId) : null;
  return (
    <div className="flex items-center gap-2.5 bg-surface-alt border border-line px-3 py-2.5">
      <MapPin size={16} className="shrink-0 text-accent" />
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
          Logging at
        </span>
        {place ? (
          <PlaceTag
            place={place}
            placesById={placesById}
            className="text-[15px] text-fg"
          />
        ) : (
          <span className="text-[15px] text-fg">
            General — whole farm
          </span>
        )}
      </div>
    </div>
  );
}

// ── Place picker (shared) ─────────────────────────────────────────────
function PlacePicker({ placeId, placeOptions, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
        Where
      </label>
      <SelectField
        value={placeId ?? ""}
        onChange={(v) => onChange(v || null)}
        placeholder="General"
      >
        {placeOptions.map(o => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </SelectField>
    </div>
  );
}

function SelectField({
  value, onChange, disabled, placeholder, children,
}) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={
          "appearance-none w-full bg-surface border border-line text-fg " +
          "text-[13px] px-3 py-2.5 pr-8 cursor-pointer " +
          "disabled:opacity-50 disabled:cursor-not-allowed " +
          "focus:outline-none focus:border-fg"
        }
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
      />
    </div>
  );
}

function PrimaryButton({ children, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "w-full inline-flex items-center justify-center gap-2 " +
        "bg-accent text-on-accent border-0 font-[inherit] text-[13px] " +
        "font-bold uppercase tracking-[0.12em] px-6 py-3 cursor-pointer " +
        "disabled:opacity-50 disabled:cursor-not-allowed"
      }
    >
      {children}
    </button>
  );
}

// ── Quantity stepper (shared) ─────────────────────────────────────────
// R6: one quantity control for both Mortality and Eggs so the sheets
// read as one component in two configs. − / typeable centre / +. Value
// is a string so the centre stays freely typeable (large egg counts);
// each sheet parses + validates. Empty input steps up to `min`.
function QuantityStepper({ value, onChange, min = 1, placeholder }) {
  const num = Number(value);
  const base = Number.isFinite(num) ? num : min - 1;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(String(Math.max(min, base - 1)))}
        className="w-10 h-10 border border-line bg-surface text-fg cursor-pointer hover:bg-row-hover text-[18px] font-bold shrink-0"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={
          "flex-1 bg-surface border border-line text-fg " +
          "text-[18px] font-bold text-center px-3 py-2 " +
          "focus:outline-none focus:border-fg"
        }
      />
      <button
        type="button"
        onClick={() => onChange(String(base + 1))}
        className="w-10 h-10 border border-line bg-surface text-fg cursor-pointer hover:bg-row-hover text-[18px] font-bold shrink-0"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

// ── Note sheet ────────────────────────────────────────────────────────
function NoteSheet({
  runId, seedPlaceId, placeOptions, placesById,
  onLogRunEvent, onClose,
}) {
  const [text, setText] = useState("");
  const [placeId, setPlaceId] = useState(seedPlaceId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onLogRunEvent({
        kind: "note_observed",
        payload: { text: text.trim() },
        runId,
        placeId: placeId ?? null,
      });
      onClose();
    } catch (e) {
      setError(e.message ?? "Couldn't save note.");
      setSaving(false);
    }
  };

  return (
    <Sheet
      title="Note"
      onClose={onClose}
      footer={
        <PrimaryButton onClick={submit} disabled={saving || !text.trim()}>
          {saving ? "Saving…" : "Log note"}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        <PlaceContextBanner placeId={placeId} placesById={placesById} />
        <PlacePicker
          placeId={placeId}
          placeOptions={placeOptions}
          onChange={setPlaceId}
        />
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
            What happened
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Saw a hawk circling. Topped off coop B's grit. Anything."
            className={
              "bg-surface border border-line text-fg text-[14px] " +
              "px-3 py-2.5 leading-relaxed resize-none " +
              "focus:outline-none focus:border-fg placeholder:text-faint"
            }
            autoFocus
          />
        </div>
        {error && (
          <div className="text-[12px] text-warn">{error}</div>
        )}
      </div>
    </Sheet>
  );
}

// ── MASH sheet ────────────────────────────────────────────────────────
// Reframed from the old "Condition" action: ticking chips means "I
// moved this bird to the MASH unit because X." The state list still
// describes symptoms; the verb is now "moved to MASH because…", not
// "observed". Free-text Other field for descriptors the chip set
// doesn't cover.
const OTHER_CHIP = "Other";

function MashSheet({
  runId, seedPlaceId, placeOptions, placesById,
  recentConditionsByPlace, repeatWindowDays,
  onLogRunEvent, onClose,
}) {
  const [placeId, setPlaceId] = useState(seedPlaceId);
  const [picked, setPicked] = useState(() => new Set());
  const [otherText, setOtherText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const togglePick = (state) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  };

  // Repeat detection — show a banner if any picked condition has been
  // logged at this place within the rolling window.
  const repeatBanners = useMemo(() => {
    if (!placeId) return [];
    const counts = recentConditionsByPlace.get(placeId);
    if (!counts) return [];
    const out = [];
    for (const state of picked) {
      if (state === OTHER_CHIP) continue;
      const c = counts.get(state);
      if (c && c >= 2) {
        const place = placesById.get(placeId);
        out.push(
          `${place?.name ?? "this place"}: ${c} ${state.toLowerCase()} ` +
          `calls in the last ${repeatWindowDays} days`
        );
      }
    }
    return out;
  }, [picked, placeId, recentConditionsByPlace, placesById, repeatWindowDays]);

  const otherPicked = picked.has(OTHER_CHIP);
  const otherTextValid =
    !otherPicked || otherText.trim().length > 0;
  const canSubmit = picked.size > 0 && otherTextValid;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const states = Array.from(picked);
      const trimmedOther = otherText.trim();
      await onLogRunEvent({
        kind: "mash_intake",
        payload: {
          states,
          ...(trimmedOther ? { other_text: trimmedOther } : {}),
        },
        runId,
        placeId: placeId ?? null,
        conditions: states,
      });
      onClose();
    } catch (e) {
      setError(e.message ?? "Couldn't log MASH intake.");
      setSaving(false);
    }
  };

  return (
    <Sheet
      title="MASH"
      onClose={onClose}
      footer={
        <PrimaryButton onClick={submit} disabled={saving || !canSubmit}>
          {saving
            ? "Saving…"
            : `Move to MASH (${picked.size || "…"})`}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        <PlaceContextBanner placeId={placeId} placesById={placesById} />
        <PlacePicker
          placeId={placeId}
          placeOptions={placeOptions}
          onChange={setPlaceId}
        />
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
            Why move to MASH
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[...CONDITION_STATES, OTHER_CHIP].map(s => {
              const active = picked.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => togglePick(s)}
                  className={
                    "inline-flex items-center font-[inherit] text-[12px] " +
                    "font-semibold px-3 py-2 cursor-pointer border " +
                    "leading-none transition-colors duration-100 " +
                    (active
                      ? "bg-row-active border-fg text-fg"
                      : "bg-transparent border-line text-dim hover:border-fg hover:text-fg")
                  }
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        {otherPicked && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
              Describe
            </label>
            <textarea
              autoFocus
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              rows={2}
              placeholder="What did you see?"
              className="bg-surface text-fg border border-line px-2.5 py-2 text-[13px] outline-none focus:border-accent font-[inherit] resize-y"
            />
          </div>
        )}
        {repeatBanners.length > 0 && (
          <div className="bg-surface border border-warn/40 px-3 py-2.5 text-[12px] text-warn leading-relaxed">
            {repeatBanners.map((b, i) => <div key={i}>{b}</div>)}
          </div>
        )}
        {error && <div className="text-[12px] text-warn">{error}</div>}
      </div>
    </Sheet>
  );
}

// ── Mortality sheet ───────────────────────────────────────────────────
function MortalitySheet({
  runId, seedPlaceId, placeOptions, placesById,
  childrenByParent, placementsByPlaceId,
  onLogMortality, onClose,
}) {
  const [placeId, setPlaceId] = useState(seedPlaceId);
  const [groupId, setGroupId] = useState(null);
  const [count, setCount] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const parsedCount = Number(count);

  // Pull livestock_group labels just for cohorts present at places
  // we can address. Cheaper than wiring useReferenceData through.
  const [groupLabels, setGroupLabels] = useState(() => new Map());
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("livestock_groups")
      .select("id, label, count")
      .then(({ data, error: e }) => {
        if (cancelled || e || !data) return;
        const m = new Map();
        for (const g of data) m.set(g.id, g);
        setGroupLabels(m);
      });
    return () => { cancelled = true; };
  }, []);

  // All current batch placements, flattened from the by-place map.
  const batchPlacements = useMemo(() => {
    const out = [];
    for (const list of placementsByPlaceId?.values() ?? []) {
      for (const pl of list) {
        if (pl.occupantType === "batch") out.push(pl);
      }
    }
    return out;
  }, [placementsByPlaceId]);

  // Cohort candidates. When a place is picked, scope to the batches
  // living anywhere in its subtree. When no place is picked (General),
  // widen to every active cohort on the farm — common case is logging
  // losses on a cohort between places or never given a placement.
  const candidates = useMemo(() => {
    if (placeId) {
      const subtree = descendantIds(placeId, childrenByParent);
      return batchPlacements
        .filter(pl => subtree.has(pl.placeId))
        .map(pl => ({
          id: pl.occupantId,
          label: groupLabels.get(pl.occupantId)?.label ?? pl.occupantId,
          count: groupLabels.get(pl.occupantId)?.count,
        }));
    }
    return Array.from(groupLabels.values())
      .filter(g => typeof g.count !== "number" || g.count > 0)
      .map(g => ({
        id: g.id,
        label: g.label ?? g.id,
        count: g.count,
      }));
  }, [placeId, batchPlacements, childrenByParent, groupLabels]);

  // R7: at a stop with a single cohort, preselect it; otherwise drop a
  // selection the place change invalidated (keeps a still-valid one).
  useEffect(() => {
    if (candidates.length === 1) {
      setGroupId(candidates[0].id);
    } else {
      setGroupId(prev =>
        prev && candidates.some(c => c.id === prev) ? prev : null
      );
    }
  }, [candidates]);

  const submit = async () => {
    if (!groupId || !(parsedCount >= 1)) return;
    setSaving(true);
    setError(null);
    try {
      const groupLabel = groupLabels.get(groupId)?.label ?? groupId;
      // Batch 16.2: one call queues the observation row plus an
      // ADDITIVE count decrement (a delta, applied against the count
      // at sync time). The auto move-out for emptied cohorts happens
      // in the outbox executor when the decrement actually lands.
      await onLogMortality({
        groupId,
        groupLabel,
        count: parsedCount,
        runId,
        placeId: placeId ?? null,
      });
      onClose();
    } catch (e) {
      setError(e.message ?? "Couldn't log mortality.");
      setSaving(false);
    }
  };

  const noCandidates = candidates.length === 0;

  return (
    <Sheet
      title="Mortality"
      onClose={onClose}
      footer={
        <PrimaryButton
          onClick={submit}
          disabled={saving || !groupId || !(parsedCount >= 1)}
        >
          {saving
            ? "Saving…"
            : `Log ${parsedCount || 0} ${parsedCount === 1 ? "loss" : "losses"}`}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        <PlaceContextBanner placeId={placeId} placesById={placesById} />
        <PlacePicker
          placeId={placeId}
          placeOptions={placeOptions}
          onChange={setPlaceId}
        />
        {noCandidates && (
          <div className="text-[12px] text-faint leading-relaxed">
            {placeId
              ? "No cohorts currently live in this place. Assign one in Settings → Sites first."
              : "No active cohorts on the farm yet."}
          </div>
        )}
        {candidates.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
              Cohort
            </label>
            <div className="flex flex-col gap-1">
              {candidates.map(c => {
                const active = groupId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setGroupId(c.id)}
                    className={
                      "flex items-center gap-3 px-3 py-2.5 border " +
                      "cursor-pointer text-left transition-colors " +
                      (active
                        ? "bg-row-active border-fg"
                        : "bg-transparent border-line hover:bg-row-hover")
                    }
                  >
                    <span className="text-[13px] font-medium text-fg flex-1">
                      {c.label}
                    </span>
                    {typeof c.count === "number" && (
                      <span className="text-[11px] text-muted">
                        {c.count} alive
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {groupId && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
              How many
            </label>
            <QuantityStepper value={count} onChange={setCount} min={1} />
          </div>
        )}
        {error && <div className="text-[12px] text-warn">{error}</div>}
      </div>
    </Sheet>
  );
}

// ── Eggs sheet (Batch 26.1) ───────────────────────────────────────────
// Field capture for "how many eggs did this group just give us." Only
// layer groups (species whose purpose mentions eggs) are offered as
// candidates. One submit queues two outbox ops: an eggs_collected
// activity row (the feed / Observations record) and a structured
// egg_collections insert (what the metrics engine reads).
function EggsSheet({
  runId, seedPlaceId, placeOptions, placesById,
  childrenByParent, placementsByPlaceId,
  onLogEggCollection, onClose,
}) {
  const [placeId, setPlaceId] = useState(seedPlaceId);
  const [groupId, setGroupId] = useState(null);
  const [count, setCount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Layer groups only: join livestock_groups to livestock_species
  // client-side and keep groups whose species purpose mentions eggs.
  const [layerGroups, setLayerGroups] = useState(() => new Map());
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("livestock_groups").select("id, label, count, species_id"),
      supabase.from("livestock_species").select("id, purpose"),
    ]).then(([groupsRes, speciesRes]) => {
      if (cancelled || groupsRes.error || speciesRes.error) return;
      const eggSpecies = new Set(
        (speciesRes.data ?? [])
          .filter(s => /egg/i.test(s.purpose ?? ""))
          .map(s => s.id)
      );
      const m = new Map();
      for (const g of groupsRes.data ?? []) {
        if (eggSpecies.has(g.species_id)) m.set(g.id, g);
      }
      setLayerGroups(m);
    });
    return () => { cancelled = true; };
  }, []);

  // Current layer placements, flattened from the by-place map.
  const layerPlacements = useMemo(() => {
    const out = [];
    for (const list of placementsByPlaceId?.values() ?? []) {
      for (const pl of list) {
        if (pl.occupantType === "batch" && layerGroups.has(pl.occupantId)) {
          out.push(pl);
        }
      }
    }
    return out;
  }, [placementsByPlaceId, layerGroups]);

  // Layer-group candidates (F28 — "flock" was the wrong unit): scoped to the picked place's subtree when one is
  // set, otherwise every layer group on the farm.
  const candidates = useMemo(() => {
    if (placeId) {
      const subtree = descendantIds(placeId, childrenByParent);
      const inPlace = layerPlacements
        .filter(pl => subtree.has(pl.placeId))
        .map(pl => ({
          id: pl.occupantId,
          label: layerGroups.get(pl.occupantId)?.label ?? pl.occupantId,
          count: layerGroups.get(pl.occupantId)?.count,
        }));
      // A place with no layer group in it still gets the full list —
      // eggs get carried around; don't make the user fight the picker.
      if (inPlace.length > 0) return inPlace;
    }
    return Array.from(layerGroups.values()).map(g => ({
      id: g.id,
      label: g.label ?? g.id,
      count: g.count,
    }));
  }, [placeId, layerPlacements, childrenByParent, layerGroups]);

  // Single candidate → preselect it (the common one-group-farm case).
  useEffect(() => {
    if (candidates.length === 1) setGroupId(candidates[0].id);
  }, [candidates]);

  const parsedCount = Number(count);
  const canSubmit = groupId && Number.isFinite(parsedCount) && parsedCount > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const groupLabel = layerGroups.get(groupId)?.label ?? groupId;
      await onLogEggCollection({
        groupId,
        groupLabel,
        count: parsedCount,
        runId,
        placeId: placeId ?? null,
      });
      onClose();
    } catch (e) {
      setError(e.message ?? "Couldn't log eggs.");
      setSaving(false);
    }
  };

  return (
    <Sheet
      title="Eggs"
      onClose={onClose}
      footer={
        <PrimaryButton onClick={submit} disabled={saving || !canSubmit}>
          {saving
            ? "Saving…"
            : canSubmit
              ? `Log ${parsedCount} egg${parsedCount === 1 ? "" : "s"}`
              : "Log eggs"}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        <PlaceContextBanner placeId={placeId} placesById={placesById} />
        <PlacePicker
          placeId={placeId}
          placeOptions={placeOptions}
          onChange={setPlaceId}
        />
        {candidates.length === 0 && (
          <div className="text-[12px] text-faint leading-relaxed">
            No layer groups on the farm yet.
          </div>
        )}
        {candidates.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
              Layer group
            </label>
            <div className="flex flex-col gap-1">
              {candidates.map(c => {
                const active = groupId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setGroupId(c.id)}
                    className={
                      "flex items-center gap-3 px-3 py-2.5 border " +
                      "cursor-pointer text-left transition-colors " +
                      (active
                        ? "bg-row-active border-fg"
                        : "bg-transparent border-line hover:bg-row-hover")
                    }
                  >
                    <span className="text-[13px] font-medium text-fg flex-1">
                      {c.label}
                    </span>
                    {typeof c.count === "number" && (
                      <span className="text-[11px] text-muted">
                        {c.count} hens
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {groupId && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
              How many eggs
            </label>
            <QuantityStepper
              value={count}
              onChange={setCount}
              min={1}
              placeholder="0"
            />
          </div>
        )}
        {error && <div className="text-[12px] text-warn">{error}</div>}
      </div>
    </Sheet>
  );
}
