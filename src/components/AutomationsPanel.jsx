import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import {
  useAutomations, useAutomationEmissions,
} from "../lib/data/useAutomations.js";

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
    "When a new broiler batch is added, creates its arrival event. Its "
    + "pasture-move and brooder-cleanout chores come from the broiler "
    + "pasture process. Processing days are not auto-created — add them "
    + "from the Schedule once the date is set.",
  inventory_reorder:
    "When a feed's on-hand amount drops to or below its reorder "
    + "point, creates a feed-order chore and a delivery event.",
};

export default function AutomationsPanel({ triggerKind, speciesId = null }) {
  const { automations, loading, setEnabled } = useAutomations();
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
      <div className="border border-line px-6 py-10 text-center">
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
        />
      ))}

      <FiringHistory emissions={ruleEmissions} />
    </div>
  );
}

// ── rule card ──────────────────────────────────────────────────────────

function AutomationRuleCard({ automation: a, onToggle }) {
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
