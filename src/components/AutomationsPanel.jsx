import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  useAutomations, useAutomationEmissions,
} from "../lib/data/useAutomations.js";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";

// AutomationsPanel (Batch 27.5) — the automation rules UI, relocated
// from the Settings page to live next to the thing each rule is about:
//
//   Broiler page → Automations tab    → batch_created rules
//   Feed page    → Automations tab    → inventory_reorder rules
//
// A panel = the matching rule cards (enable toggle + per-rule config)
// followed by that rule's firing history. Emission triage (clear /
// delete) lives in the bell (InboxBell); the history here is the
// audit log.

// Per-trigger-kind copy describing what the rule does (post-0025
// behavior).
const AUTOMATION_COPY = {
  batch_created:
    "When a new broiler batch is added, creates its arrival event, a "
    + "pasture-move chore, and a brooder cleanout chore. Processing "
    + "days are not auto-created — add them from the Schedule once "
    + "the date is set.",
  inventory_reorder:
    "When a feed's on-hand amount drops to or below its reorder "
    + "point, creates a feed-order chore and a delivery event.",
};

export default function AutomationsPanel({ triggerKind, speciesId = null }) {
  const { automations, loading, setEnabled, updateConfig } = useAutomations();
  const { emissions } = useAutomationEmissions({ activeOnly: false });

  const rules = useMemo(() => {
    return automations.filter(a => {
      if (a.triggerKind !== triggerKind) return false;
      if (speciesId && a.triggerConfig?.species_id
        && a.triggerConfig.species_id !== speciesId) return false;
      return true;
    });
  }, [automations, triggerKind, speciesId]);

  const ruleIds = useMemo(() => new Set(rules.map(r => r.id)), [rules]);
  const ruleEmissions = useMemo(
    () => (emissions ?? []).filter(e => ruleIds.has(e.automationId)),
    [emissions, ruleIds]
  );

  if (loading) {
    return <div className="text-[12px] text-dim italic">Loading…</div>;
  }
  if (rules.length === 0) {
    return (
      <div className="bg-surface border border-line px-6 py-10 text-center">
        <Sparkles size={20} className="text-faint mx-auto mb-3" />
        <div className="text-[13px] text-muted">
          No automation rules apply here.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-[760px]">
      <p className="text-[12px] text-dim leading-relaxed m-0">
        Rules that create events and chores for you. Anything they
        create is flagged with a{" "}
        <Sparkles size={11} className="inline -translate-y-px" /> sparkle;
        new firings show up as notifications under the bell.
      </p>

      {rules.map(rule => (
        <AutomationRuleCard
          key={rule.id}
          automation={rule}
          onToggle={(enabled) => setEnabled(rule.id, enabled)}
          onUpdateConfig={(cfg) => updateConfig(rule.id, cfg)}
        />
      ))}

      <FiringHistory emissions={ruleEmissions} />
    </div>
  );
}

// ── rule card ──────────────────────────────────────────────────────────

function AutomationRuleCard({ automation: a, onToggle, onUpdateConfig }) {
  const cfg = a.triggerConfig ?? {};
  const lastFired = a.lastFiredAt
    ? new Date(a.lastFiredAt).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      })
    : "never";

  return (
    <div className="border border-line bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Sparkles size={14}
          className="text-accent-deep shrink-0 translate-y-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-fg">{a.name}</div>
          <p className="text-[12px] text-dim leading-relaxed m-0 mt-1">
            {AUTOMATION_COPY[a.triggerKind] ?? a.triggerKind}
          </p>
          <div className="text-[11px] text-faint mt-1.5">
            Last fired: {lastFired}
          </div>
        </div>
        <Toggle checked={a.enabled} onChange={onToggle} />
      </div>

      {a.triggerKind === "batch_created" && (
        <BatchRuleConfig cfg={cfg} onUpdateConfig={onUpdateConfig} />
      )}
    </div>
  );
}

// Config block for the broiler-lifecycle rule: the week offsets plus
// the pasture-move chore's block / custom-time overrides (read by the
// 0025 trigger when it creates the chore).
function BatchRuleConfig({ cfg, onUpdateConfig }) {
  const { blocksOrdered } = useChoreBlocks();
  const activeBlocks = (blocksOrdered ?? []).filter(b => b.isActive);

  return (
    <div className="flex flex-col gap-3 pl-7">
      <div className="flex items-center gap-4 flex-wrap">
        <NumberSetting
          label="Pasture move"
          unit="weeks after arrival"
          value={cfg.pasture_move_weeks ?? 3}
          min={1} max={12}
          onCommit={(v) =>
            onUpdateConfig({ ...cfg, pasture_move_weeks: v })}
        />
        <NumberSetting
          label="Brooder cleanout"
          unit="days after the move"
          value={cfg.cleanout_offset_days ?? 1}
          min={0} max={14}
          onCommit={(v) =>
            onUpdateConfig({ ...cfg, cleanout_offset_days: v })}
        />
      </div>

      {/* Pasture-move chore: which block it lands in + optional custom
          start time. */}
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <div className="text-[9px] text-faint uppercase tracking-[0.12em] mb-1">
            Pasture-move chore block
          </div>
          <select
            value={cfg.pasture_move_block_id ?? ""}
            onChange={(e) => onUpdateConfig({
              ...cfg,
              pasture_move_block_id: e.target.value || null,
            })}
            className="bg-bg border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit]"
          >
            <option value="">No block — uses the morning period</option>
            {activeBlocks.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[9px] text-faint uppercase tracking-[0.12em] mb-1">
            Custom time override
          </div>
          <input
            type="time"
            value={cfg.pasture_move_start_time ?? ""}
            onChange={(e) => onUpdateConfig({
              ...cfg,
              pasture_move_start_time: e.target.value || null,
            })}
            className="bg-bg border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit]"
          />
        </div>
      </div>
      <div className="text-[10px] text-faint leading-relaxed">
        Block and time apply to the pasture-move chores this rule
        creates from now on — already-created chores keep what they
        have (editable on the Chores page).
      </div>
    </div>
  );
}

// ── firing history ─────────────────────────────────────────────────────

function FiringHistory({ emissions }) {
  if (emissions.length === 0) {
    return (
      <div className="text-[11px] text-faint italic">
        This rule hasn't fired yet.
      </div>
    );
  }
  return (
    <div>
      <div className="text-[10px] text-dim uppercase tracking-[0.12em] mb-2">
        Firing history
      </div>
      <ol className="m-0 p-0 list-none flex flex-col gap-px bg-line border border-line">
        {emissions.map(em => (
          <li key={em.id} className="bg-surface px-3 py-2.5">
            <div className="text-[12px] text-fg leading-relaxed">
              {em.summary}
            </div>
            <div className="text-[10px] text-faint mt-0.5">
              {new Date(em.firedAt).toLocaleString("en-US", {
                month: "short", day: "numeric",
                hour: "numeric", minute: "2-digit",
              })}
              {em.status !== "active" && ` · ${em.status}`}
              {em.dismissedReason && ` ("${em.dismissedReason}")`}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── shared inputs (moved verbatim from Settings.jsx with the section) ──

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={
        "relative w-9 h-5 rounded-full border transition-colors cursor-pointer shrink-0 " +
        (checked
          ? "bg-accent border-accent"
          : "bg-surface border-line")
      }
    >
      <span
        className={
          "absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform " +
          (checked
            ? "left-0.5 translate-x-4 bg-on-accent"
            : "left-0.5 bg-dim")
        }
      />
    </button>
  );
}

// Small inline number editor: label + stepper input + unit hint.
// Commits on blur or Enter so half-typed numbers don't thrash the DB.
function NumberSetting({ label, unit, value, min, max, onCommit }) {
  const [draft, setDraft] = useState(null); // null = not editing

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (Number.isFinite(n) && n >= min && n <= max && n !== value) {
      onCommit(Math.round(n));
    }
    setDraft(null);
  };

  return (
    <label className="flex items-center gap-2">
      <span className="text-[12px] text-fg font-medium">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
        className="w-14 bg-surface border border-line px-2 py-1 text-[12px] text-fg font-[inherit] outline-none text-center"
      />
      <span className="text-[11px] text-faint">{unit}</span>
    </label>
  );
}
