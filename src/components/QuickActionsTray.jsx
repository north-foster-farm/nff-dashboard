import { useEffect, useMemo, useState } from "react";
import {
  X, MessageSquare, AlertTriangle, Skull, ChevronDown,
  ArrowRightLeft, Wrench,
} from "lucide-react";
import { supabase } from "../lib/supabase.js";

// Bottom-pinned tray for the Rounds doing surface. Five quick
// actions — Note, Condition, Mortality, Move, Sweep — each opens a
// sheet that writes a typed Run Event via `logRunEvent` (RPC
// log_run_event).
//
// Site/location context defaults from Rounds:
//   - selectedLocationId, if set, scopes the event to that location.
//   - else selectedSiteId scopes to the site (location_id null).
//   - else "general" — both null. The user can still pick in-sheet.
//
// Quick actions write to `activity_log` with `run_id` set so the
// Performance sub-tab and the upcoming Observation Log can group
// them by run.

const CONDITION_STATES = [
  "Listless", "Unthrifty", "Off-feed",
  "Off-water", "Damaged", "Sick",
];

// 8.3 — Sweep checklist items for the kind-level "moved coops /
// chicken tractors" action. Per-instance toggles + an "all taken
// care of" mass-toggle fan these out across every location under
// the selected site.
const SWEEP_ITEMS = [
  "Fences", "Feeders", "Waterers", "Grit", "Shell",
];

export default function QuickActionsTray({
  runId,
  selectedSiteId,
  selectedLocationId,
  sites,
  locations,
  residents,
  recentConditionsByLocation,
  repeatWindowDays,
  onLogRunEvent,
  onAssignResident,
  onMoveOutResident,
}) {
  const [open, setOpen] = useState(null);
  // 'note' | 'condition' | 'mortality' | 'move' | 'sweep'

  // Derived: the location_id we'll seed the sheet with. When the user
  // picked a site without drilling into a location, we'll leave the
  // sheet's location null so they explicitly pick.
  const seedLocationId = selectedLocationId ?? null;
  const seedSiteId = selectedSiteId
    ?? (seedLocationId
        ? locations.find(l => l.id === seedLocationId)?.siteId
        : null);

  return (
    <>
      <nav
        className={
          "shrink-0 flex items-stretch border-t border-line bg-surface " +
          "divide-x divide-line"
        }
      >
        <TrayButton
          icon={MessageSquare}
          label="Note"
          onClick={() => setOpen("note")}
        />
        <TrayButton
          icon={AlertTriangle}
          label="Condition"
          onClick={() => setOpen("condition")}
        />
        <TrayButton
          icon={Skull}
          label="Mortality"
          onClick={() => setOpen("mortality")}
        />
        <TrayButton
          icon={ArrowRightLeft}
          label="Move"
          onClick={() => setOpen("move")}
        />
        <TrayButton
          icon={Wrench}
          label="Sweep"
          onClick={() => setOpen("sweep")}
        />
      </nav>

      {open === "note" && (
        <NoteSheet
          runId={runId}
          seedSiteId={seedSiteId}
          seedLocationId={seedLocationId}
          sites={sites}
          locations={locations}
          onLogRunEvent={onLogRunEvent}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "condition" && (
        <ConditionSheet
          runId={runId}
          seedSiteId={seedSiteId}
          seedLocationId={seedLocationId}
          sites={sites}
          locations={locations}
          recentConditionsByLocation={recentConditionsByLocation}
          repeatWindowDays={repeatWindowDays}
          onLogRunEvent={onLogRunEvent}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "mortality" && (
        <MortalitySheet
          runId={runId}
          seedSiteId={seedSiteId}
          seedLocationId={seedLocationId}
          sites={sites}
          locations={locations}
          residents={residents}
          onLogRunEvent={onLogRunEvent}
          onMoveOutResident={onMoveOutResident}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "move" && (
        <MoveSheet
          runId={runId}
          seedSiteId={seedSiteId}
          seedLocationId={seedLocationId}
          sites={sites}
          locations={locations}
          residents={residents}
          onLogRunEvent={onLogRunEvent}
          onAssignResident={onAssignResident}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "sweep" && (
        <SweepSheet
          runId={runId}
          seedSiteId={seedSiteId}
          sites={sites}
          locations={locations}
          onLogRunEvent={onLogRunEvent}
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
  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className={
          "bg-bg border border-line w-full sm:max-w-[480px] " +
          "max-h-[90vh] flex flex-col font-body"
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

// ── Site/location picker (shared) ─────────────────────────────────────
function SitePicker({
  siteId, locationId, sites, locations, onChange,
}) {
  const activeSites = sites.filter(s => s.isActive);
  const siteLocations = locations.filter(
    l => l.siteId === siteId && l.isActive
  );
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
        Where
      </label>
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          value={siteId ?? ""}
          onChange={(v) => onChange({ siteId: v || null, locationId: null })}
          placeholder="General"
        >
          {activeSites.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </SelectField>
        <SelectField
          value={locationId ?? ""}
          disabled={!siteId || siteLocations.length === 0}
          onChange={(v) => onChange({ siteId, locationId: v || null })}
          placeholder={siteId ? "Anywhere" : "—"}
        >
          {siteLocations.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </SelectField>
      </div>
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

// ── Note sheet ────────────────────────────────────────────────────────
function NoteSheet({
  runId, seedSiteId, seedLocationId, sites, locations,
  onLogRunEvent, onClose,
}) {
  const [text, setText] = useState("");
  const [siteId, setSiteId] = useState(seedSiteId);
  const [locationId, setLocationId] = useState(seedLocationId);
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
        siteId: siteId ?? null,
        locationId: locationId ?? null,
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
        <SitePicker
          siteId={siteId}
          locationId={locationId}
          sites={sites}
          locations={locations}
          onChange={(v) => {
            setSiteId(v.siteId);
            setLocationId(v.locationId);
          }}
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

// ── Condition sheet ───────────────────────────────────────────────────
function ConditionSheet({
  runId, seedSiteId, seedLocationId, sites, locations,
  recentConditionsByLocation, repeatWindowDays,
  onLogRunEvent, onClose,
}) {
  const [siteId, setSiteId] = useState(seedSiteId);
  const [locationId, setLocationId] = useState(seedLocationId);
  const [picked, setPicked] = useState(() => new Set());
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
  // observed at this location within the rolling window.
  const repeatBanners = useMemo(() => {
    if (!locationId) return [];
    const counts = recentConditionsByLocation.get(locationId);
    if (!counts) return [];
    const out = [];
    for (const state of picked) {
      const c = counts.get(state);
      if (c && c >= 2) {
        const loc = locations.find(l => l.id === locationId);
        out.push(
          `${loc?.name ?? "this location"}: ${c} ${state.toLowerCase()} ` +
          `calls in the last ${repeatWindowDays} days`
        );
      }
    }
    return out;
  }, [picked, locationId, recentConditionsByLocation, locations, repeatWindowDays]);

  const submit = async () => {
    if (picked.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const states = Array.from(picked);
      await onLogRunEvent({
        kind: "condition_observed",
        payload: { states },
        runId,
        siteId: siteId ?? null,
        locationId: locationId ?? null,
        conditions: states,
      });
      onClose();
    } catch (e) {
      setError(e.message ?? "Couldn't log condition.");
      setSaving(false);
    }
  };

  return (
    <Sheet
      title="Condition"
      onClose={onClose}
      footer={
        <PrimaryButton onClick={submit} disabled={saving || picked.size === 0}>
          {saving ? "Saving…" : `Log ${picked.size || "…"} condition${picked.size === 1 ? "" : "s"}`}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        <SitePicker
          siteId={siteId}
          locationId={locationId}
          sites={sites}
          locations={locations}
          onChange={(v) => {
            setSiteId(v.siteId);
            setLocationId(v.locationId);
          }}
        />
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
            What you saw
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CONDITION_STATES.map(s => {
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
  runId, seedSiteId, seedLocationId, sites, locations, residents,
  onLogRunEvent, onMoveOutResident, onClose,
}) {
  const [siteId, setSiteId] = useState(seedSiteId);
  const [locationId, setLocationId] = useState(seedLocationId);
  const [groupId, setGroupId] = useState(null);
  const [count, setCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Pull livestock_group labels just for cohorts present at locations
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

  // Cohorts currently living at the picked location.
  const candidates = useMemo(() => {
    if (!locationId) return [];
    return residents
      .filter(r => r.locationId === locationId && !r.movedOut)
      .map(r => ({
        id: r.livestockGroupId,
        label: groupLabels.get(r.livestockGroupId)?.label
          ?? r.livestockGroupId,
        count: groupLabels.get(r.livestockGroupId)?.count,
      }));
  }, [locationId, residents, groupLabels]);

  // Reset cohort selection when location changes.
  useEffect(() => { setGroupId(null); }, [locationId]);

  const submit = async () => {
    if (!groupId || count < 1) return;
    setSaving(true);
    setError(null);
    try {
      const groupLabel = groupLabels.get(groupId)?.label ?? groupId;
      await onLogRunEvent({
        kind: "mortality_observed",
        payload: {
          livestock_group_id: groupId,
          group_label: groupLabel,
          count,
        },
        runId,
        siteId: siteId ?? null,
        locationId: locationId ?? null,
      });
      // Auto-decrement the cohort count. Best-effort: ignore errors so
      // a count-out-of-sync doesn't lose the activity_log entry.
      const current = groupLabels.get(groupId)?.count;
      let nextCount = null;
      if (typeof current === "number") {
        nextCount = Math.max(0, current - count);
        await supabase
          .from("livestock_groups")
          .update({ count: nextCount })
          .eq("id", groupId);
      }
      // 8.3 — auto move-out: when a cohort empties to zero, mark its
      // open site_residents row(s) moved-out today so the location no
      // longer surfaces it in cohort pickers.
      if (nextCount === 0 && onMoveOutResident) {
        const open = (residents ?? []).filter(
          r => r.livestockGroupId === groupId && !r.movedOut
        );
        await Promise.all(
          open.map(r => onMoveOutResident(r.id).catch(() => {}))
        );
      }
      onClose();
    } catch (e) {
      setError(e.message ?? "Couldn't log mortality.");
      setSaving(false);
    }
  };

  const noLocation = !locationId;
  const noCandidates = !noLocation && candidates.length === 0;

  return (
    <Sheet
      title="Mortality"
      onClose={onClose}
      footer={
        <PrimaryButton
          onClick={submit}
          disabled={saving || !groupId || count < 1}
        >
          {saving
            ? "Saving…"
            : `Log ${count} ${count === 1 ? "loss" : "losses"}`}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        <SitePicker
          siteId={siteId}
          locationId={locationId}
          sites={sites}
          locations={locations}
          onChange={(v) => {
            setSiteId(v.siteId);
            setLocationId(v.locationId);
          }}
        />
        {noLocation && (
          <div className="text-[12px] text-faint leading-relaxed">
            Pick a specific location so we can resolve the cohort.
          </div>
        )}
        {noCandidates && (
          <div className="text-[12px] text-faint leading-relaxed">
            No cohorts currently live at this location. Assign one in
            Settings → Sites first.
          </div>
        )}
        {!noLocation && candidates.length > 0 && (
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCount(c => Math.max(1, c - 1))}
                className="w-10 h-10 border border-line bg-surface text-fg cursor-pointer hover:bg-row-hover text-[18px] font-bold"
                aria-label="Decrease"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={count}
                onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                className={
                  "flex-1 bg-surface border border-line text-fg " +
                  "text-[18px] font-bold text-center px-3 py-2 " +
                  "focus:outline-none focus:border-fg"
                }
              />
              <button
                type="button"
                onClick={() => setCount(c => c + 1)}
                className="w-10 h-10 border border-line bg-surface text-fg cursor-pointer hover:bg-row-hover text-[18px] font-bold"
                aria-label="Increase"
              >
                +
              </button>
            </div>
          </div>
        )}
        {error && <div className="text-[12px] text-warn">{error}</div>}
      </div>
    </Sheet>
  );
}

// ── Move sheet (cohort fast-path) ─────────────────────────────────────
// Generic cohort relocation. Source: any location currently hosting
// residents (typical case: Brooder #1). Destination: any active
// location. Logs `cohort_moved` and updates site_residents in a single
// `assignResident` call — that helper closes the open row and inserts
// a new one at the destination. Use case: chicks graduating from a
// brooder into the MASH ward (both rows in `site_locations`).
function MoveSheet({
  runId, seedSiteId, seedLocationId, sites, locations, residents,
  onLogRunEvent, onAssignResident, onClose,
}) {
  const [fromSiteId, setFromSiteId] = useState(seedSiteId);
  const [fromLocationId, setFromLocationId] = useState(seedLocationId);
  const [toLocationId, setToLocationId] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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

  const candidates = useMemo(() => {
    if (!fromLocationId) return [];
    return residents
      .filter(r => r.locationId === fromLocationId && !r.movedOut)
      .map(r => ({
        id: r.livestockGroupId,
        label: groupLabels.get(r.livestockGroupId)?.label
          ?? r.livestockGroupId,
        count: groupLabels.get(r.livestockGroupId)?.count,
      }));
  }, [fromLocationId, residents, groupLabels]);

  useEffect(() => { setGroupId(null); }, [fromLocationId]);

  const destLocations = useMemo(
    () => locations.filter(
      l => l.isActive && l.hasResidents && l.id !== fromLocationId
    ),
    [locations, fromLocationId]
  );

  const submit = async () => {
    if (!groupId || !toLocationId) return;
    setSaving(true);
    setError(null);
    try {
      const groupLabel = groupLabels.get(groupId)?.label ?? groupId;
      const fromLoc = locations.find(l => l.id === fromLocationId);
      const toLoc = locations.find(l => l.id === toLocationId);
      await onLogRunEvent({
        kind: "cohort_moved",
        payload: {
          livestock_group_id: groupId,
          group_label: groupLabel,
          from_location_id: fromLocationId,
          from_location_name: fromLoc?.name ?? null,
          to_location_id: toLocationId,
          to_location_name: toLoc?.name ?? null,
        },
        runId,
        siteId: fromSiteId ?? null,
        locationId: fromLocationId ?? null,
      });
      if (onAssignResident) {
        await onAssignResident(toLocationId, groupId);
      }
      onClose();
    } catch (e) {
      setError(e.message ?? "Couldn't move cohort.");
      setSaving(false);
    }
  };

  return (
    <Sheet
      title="Move cohort"
      onClose={onClose}
      footer={
        <PrimaryButton
          onClick={submit}
          disabled={saving || !groupId || !toLocationId}
        >
          {saving ? "Saving…" : "Move cohort"}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        <SitePicker
          siteId={fromSiteId}
          locationId={fromLocationId}
          sites={sites}
          locations={locations}
          onChange={(v) => {
            setFromSiteId(v.siteId);
            setFromLocationId(v.locationId);
          }}
        />
        {!fromLocationId && (
          <div className="text-[12px] text-faint leading-relaxed">
            Pick the source location to see which cohorts live there.
          </div>
        )}
        {fromLocationId && candidates.length === 0 && (
          <div className="text-[12px] text-faint leading-relaxed">
            No cohorts currently at this location.
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
              Move to
            </label>
            <SelectField
              value={toLocationId ?? ""}
              onChange={(v) => setToLocationId(v || null)}
              placeholder="Pick a destination"
            >
              {destLocations.map(l => {
                const site = sites.find(s => s.id === l.siteId);
                return (
                  <option key={l.id} value={l.id}>
                    {site ? `${site.name} — ${l.name}` : l.name}
                  </option>
                );
              })}
            </SelectField>
          </div>
        )}
        {error && <div className="text-[12px] text-warn">{error}</div>}
      </div>
    </Sheet>
  );
}

// ── Sweep sheet (kind-level sub-checklist) ────────────────────────────
// "Moved coops / Moved chicken tractors" — pick a site (typically
// Mobile coops or Chicken tractors), then per-instance toggles for
// the five sub-tasks. The "All taken care of" mass-toggle flips every
// chip on every active location at once. Logs a single `infra_swept`
// event with the full per-instance payload.
function SweepSheet({
  runId, seedSiteId, sites, locations,
  onLogRunEvent, onClose,
}) {
  const [siteId, setSiteId] = useState(seedSiteId);
  const [picked, setPicked] = useState(() => new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const siteLocations = useMemo(
    () => locations.filter(l => l.siteId === siteId && l.isActive),
    [locations, siteId]
  );

  useEffect(() => { setPicked(new Map()); }, [siteId]);

  const togglePick = (locationId, item) => {
    setPicked(prev => {
      const next = new Map(prev);
      const cur = new Set(next.get(locationId) ?? []);
      if (cur.has(item)) cur.delete(item);
      else cur.add(item);
      next.set(locationId, cur);
      return next;
    });
  };

  const allTakenCareOf = useMemo(() => {
    if (siteLocations.length === 0) return false;
    for (const l of siteLocations) {
      const cur = picked.get(l.id);
      if (!cur || cur.size !== SWEEP_ITEMS.length) return false;
    }
    return true;
  }, [siteLocations, picked]);

  const sweepAll = () => {
    setPicked(() => {
      const next = new Map();
      if (!allTakenCareOf) {
        for (const l of siteLocations) {
          next.set(l.id, new Set(SWEEP_ITEMS));
        }
      }
      return next;
    });
  };

  const totalPicked = useMemo(() => {
    let n = 0;
    for (const set of picked.values()) n += set.size;
    return n;
  }, [picked]);

  const submit = async () => {
    if (!siteId || totalPicked === 0) return;
    setSaving(true);
    setError(null);
    try {
      const site = sites.find(s => s.id === siteId);
      const instances = [];
      for (const l of siteLocations) {
        const items = Array.from(picked.get(l.id) ?? []);
        if (items.length === 0) continue;
        instances.push({
          location_id: l.id,
          location_name: l.name,
          items,
        });
      }
      await onLogRunEvent({
        kind: "infra_swept",
        payload: {
          site_id: siteId,
          site_name: site?.name ?? null,
          instances,
          all_taken_care_of: allTakenCareOf,
        },
        runId,
        siteId,
        locationId: null,
      });
      onClose();
    } catch (e) {
      setError(e.message ?? "Couldn't log sweep.");
      setSaving(false);
    }
  };

  const activeSites = sites.filter(s => s.isActive);

  return (
    <Sheet
      title="Sweep"
      onClose={onClose}
      footer={
        <PrimaryButton
          onClick={submit}
          disabled={saving || !siteId || totalPicked === 0}
        >
          {saving
            ? "Saving…"
            : totalPicked === 0
              ? "Tick what's done"
              : `Log sweep (${totalPicked})`}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
            Site
          </label>
          <SelectField
            value={siteId ?? ""}
            onChange={(v) => setSiteId(v || null)}
            placeholder="Pick a site"
          >
            {activeSites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </SelectField>
        </div>
        {siteId && siteLocations.length === 0 && (
          <div className="text-[12px] text-faint leading-relaxed">
            No active locations under this site yet. Add one in
            Settings → Sites first.
          </div>
        )}
        {siteId && siteLocations.length > 0 && (
          <>
            <button
              type="button"
              onClick={sweepAll}
              className={
                "self-start inline-flex items-center font-[inherit] " +
                "text-[11px] font-semibold uppercase tracking-[0.12em] " +
                "px-3 py-2 cursor-pointer border leading-none " +
                "transition-colors duration-100 " +
                (allTakenCareOf
                  ? "bg-row-active border-fg text-fg"
                  : "bg-transparent border-line text-dim hover:border-fg hover:text-fg")
              }
            >
              {allTakenCareOf ? "Clear all" : "All taken care of"}
            </button>
            <div className="flex flex-col gap-3">
              {siteLocations.map(l => {
                const cur = picked.get(l.id) ?? new Set();
                return (
                  <div key={l.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-fg">
                        {l.name}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-muted font-semibold ml-auto">
                        {cur.size}/{SWEEP_ITEMS.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SWEEP_ITEMS.map(item => {
                        const active = cur.has(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => togglePick(l.id, item)}
                            className={
                              "inline-flex items-center font-[inherit] text-[12px] " +
                              "font-semibold px-3 py-2 cursor-pointer border " +
                              "leading-none transition-colors duration-100 " +
                              (active
                                ? "bg-row-active border-fg text-fg"
                                : "bg-transparent border-line text-dim hover:border-fg hover:text-fg")
                            }
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {error && <div className="text-[12px] text-warn">{error}</div>}
      </div>
    </Sheet>
  );
}
