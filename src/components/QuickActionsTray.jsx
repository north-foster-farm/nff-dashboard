import { useEffect, useMemo, useState } from "react";
import {
  X, MessageSquare, AlertTriangle, Skull, ChevronDown,
} from "lucide-react";
import { supabase } from "../lib/supabase.js";

// Bottom-pinned tray for the Rounds doing surface. Quick actions —
// Note, MASH, Mortality — each opens a sheet that writes a typed Run
// Event via `logRunEvent` (RPC log_run_event). Move + Sweep retired
// from the tray in Batch 10: cohort moves are planned events, and
// sweep is just bulk-tick on the doing surface itself.
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
  onMoveOutResident,
}) {
  const [open, setOpen] = useState(null);
  // 'note' | 'mash' | 'mortality'

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
          label="MASH"
          onClick={() => setOpen("mash")}
        />
        <TrayButton
          icon={Skull}
          label="Mortality"
          onClick={() => setOpen("mortality")}
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
      {open === "mash" && (
        <MashSheet
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

// ── MASH sheet ────────────────────────────────────────────────────────
// Reframed from the old "Condition" action: ticking chips means "I
// moved this bird to the MASH unit because X." The state list still
// describes symptoms; the verb is now "moved to MASH because…", not
// "observed". Free-text Other field for descriptors the chip set
// doesn't cover.
const OTHER_CHIP = "Other";

function MashSheet({
  runId, seedSiteId, seedLocationId, sites, locations,
  recentConditionsByLocation, repeatWindowDays,
  onLogRunEvent, onClose,
}) {
  const [siteId, setSiteId] = useState(seedSiteId);
  const [locationId, setLocationId] = useState(seedLocationId);
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
  // logged at this location within the rolling window.
  const repeatBanners = useMemo(() => {
    if (!locationId) return [];
    const counts = recentConditionsByLocation.get(locationId);
    if (!counts) return [];
    const out = [];
    for (const state of picked) {
      if (state === OTHER_CHIP) continue;
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
        siteId: siteId ?? null,
        locationId: locationId ?? null,
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

  // Cohort candidates. When a location is picked, scope to its
  // residents. When no location is picked (General), widen to every
  // active cohort on the farm — common case is logging losses on a
  // cohort that's between locations or that was never assigned a
  // residency row.
  const candidates = useMemo(() => {
    if (locationId) {
      return residents
        .filter(r => r.locationId === locationId && !r.movedOut)
        .map(r => ({
          id: r.livestockGroupId,
          label: groupLabels.get(r.livestockGroupId)?.label
            ?? r.livestockGroupId,
          count: groupLabels.get(r.livestockGroupId)?.count,
        }));
    }
    return Array.from(groupLabels.values())
      .filter(g => typeof g.count !== "number" || g.count > 0)
      .map(g => ({
        id: g.id,
        label: g.label ?? g.id,
        count: g.count,
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

  const noCandidates = candidates.length === 0;

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
        {noCandidates && (
          <div className="text-[12px] text-faint leading-relaxed">
            {locationId
              ? "No cohorts currently live at this location. Assign one in Settings → Sites first."
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
