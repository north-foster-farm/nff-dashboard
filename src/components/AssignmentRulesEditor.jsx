import { useMemo, useState } from "react";
import { X, Plus } from "lucide-react";
import { useChoreAssignmentRules } from "../lib/data/useChoreAssignmentRules.js";
import { resolveAssignees } from "../lib/chores.js";

// Reusable assignment-rules editor. Mountable on a chore (scope='chore',
// scopeId=chore.id) or a block (scope='block', scopeId=block.id).
//
// `previewChore` is optional — when provided (chore-scope mount), the
// "next 7 days" preview runs the actual resolver for that chore so the
// reader sees exactly what the resolver will produce (rules + the
// legacy chore.assignment fallbacks). For block-scope mounts no
// preview-chore is available, so we synthesize a stand-in chore that
// just carries the block id.
//
// Available assignees come from a small hardcoded list — same names
// the existing fake-auth user picker uses. Down the road this could
// pull from the admins table.

export const ASSIGNEES = ["James", "Jim"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AssignmentRulesEditor({
  scope, scopeId, previewChore = null, dense = false,
}) {
  const {
    rules, rulesByChoreId, rulesByBlockId, loading,
    createRule, deleteRule,
  } = useChoreAssignmentRules();

  // Just the rules that match this scope/scopeId. Already sorted by
  // priority desc, created_at desc by the hook.
  const scopedRules = useMemo(
    () => rules.filter(r => r.scope === scope && r.scopeId === scopeId),
    [rules, scope, scopeId]
  );

  const [draftDays, setDraftDays] = useState([]);
  const [draftAssignees, setDraftAssignees] = useState([]);
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const toggleDay = (d) => {
    setDraftDays((prev) => prev.includes(d)
      ? prev.filter(x => x !== d)
      : [...prev, d].sort((a, b) => a - b));
  };
  const toggleAssignee = (name) => {
    setDraftAssignees((prev) => prev.includes(name)
      ? prev.filter(x => x !== name)
      : [...prev, name]);
  };

  const submit = async () => {
    setErrorMsg(null);
    if (draftDays.length === 0) {
      setErrorMsg("Pick at least one day.");
      return;
    }
    if (draftAssignees.length === 0) {
      setErrorMsg("Pick at least one assignee.");
      return;
    }
    setAdding(true);
    try {
      await createRule({
        scope, scopeId,
        daysOfWeek: draftDays,
        assignees: draftAssignees,
        priority: 0,
      });
      setDraftDays([]);
      setDraftAssignees([]);
    } catch (err) {
      setErrorMsg(err?.message ?? "Save failed.");
    } finally {
      setAdding(false);
    }
  };

  // Build the "next 7 days" preview. Use the live rule maps so the
  // preview reflects unsaved persisted rules (the next render after
  // createRule completes picks up the new entry automatically).
  const previewDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const stand = previewChore ?? syntheticChoreForBlock(scope, scopeId);
      const names = resolveAssignees(stand, d, {
        rulesByChoreId,
        rulesByBlockId,
      });
      out.push({ date: d, names });
    }
    return out;
  }, [previewChore, scope, scopeId, rulesByChoreId, rulesByBlockId]);

  return (
    <div className={
      "flex flex-col gap-3 " + (dense ? "" : "")
    }>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="text-[10px] uppercase tracking-[0.12em] text-faint font-semibold">
          Assignment rules ({scope}-scope)
        </div>
        {loading && (
          <span className="text-[10px] text-faint">Loading…</span>
        )}
      </div>

      {scopedRules.length > 0 ? (
        <ul className="m-0 p-0 list-none flex flex-col gap-1">
          {scopedRules.map(r => (
            <li
              key={r.id}
              className="flex items-center gap-2 bg-surface-alt border border-line px-2 py-1.5"
            >
              <DaySet days={r.daysOfWeek} />
              <span className="text-faint text-[11px]">→</span>
              <span className="text-[12px] text-fg font-medium flex-1 truncate">
                {r.assignees.join(" · ")}
              </span>
              <button
                onClick={() => deleteRule(r.id)}
                className="text-faint hover:text-warn p-1 cursor-pointer bg-transparent border-0"
                title="Delete rule"
                aria-label="Delete rule"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-[11px] text-faint italic">
          No rules yet. Add one below to seed defaults for this {scope}.
        </div>
      )}

      <div className="bg-surface border border-line p-2 flex flex-col gap-2">
        <ChipRow
          label="Days"
          options={DAY_LABELS.map((label, idx) => ({ id: idx, label }))}
          selected={draftDays}
          onToggle={toggleDay}
        />
        <ChipRow
          label="Assignees"
          options={ASSIGNEES.map(name => ({ id: name, label: name }))}
          selected={draftAssignees}
          onToggle={toggleAssignee}
        />
        {errorMsg && (
          <div className="text-[11px] text-warn">{errorMsg}</div>
        )}
        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={adding}
            className="inline-flex items-center gap-1 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed leading-none"
          >
            <Plus size={12} className="shrink-0" />
            Add rule
          </button>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-faint font-semibold mb-1.5">
          Next 7 days preview
        </div>
        <ul className="grid grid-cols-7 gap-1 m-0 p-0 list-none">
          {previewDays.map(({ date, names }, i) => (
            <li
              key={i}
              className="bg-surface-alt border border-line px-1.5 py-1 text-center flex flex-col gap-0.5"
              title={date.toLocaleDateString("en-US", {
                weekday: "long", month: "short", day: "numeric",
              })}
            >
              <span className="text-[9px] uppercase tracking-[0.12em] text-faint font-semibold">
                {date.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span
                className={
                  "text-[11px] " +
                  (names.length === 0 ? "text-faint italic" : "text-fg font-medium")
                }
              >
                {names.length === 0 ? "—" : names.join("·")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DaySet({ days }) {
  const ordered = [...days].sort((a, b) => a - b);
  return (
    <span className="inline-flex gap-0.5">
      {DAY_LABELS.map((label, idx) => {
        const on = ordered.includes(idx);
        return (
          <span
            key={idx}
            className={
              "inline-block text-[10px] uppercase tracking-[0.06em] font-semibold px-1 py-0.5 leading-none border " +
              (on ? "border-accent bg-row-active text-fg" : "border-line text-faint bg-transparent")
            }
            title={label}
          >
            {label[0]}
          </span>
        );
      })}
    </span>
  );
}

function ChipRow({ label, options, selected, onToggle }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-[0.12em] text-faint font-semibold w-[60px] shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => {
          const active = selected.includes(opt.id);
          return (
            <button
              key={String(opt.id)}
              onClick={() => onToggle(opt.id)}
              aria-pressed={active}
              className={
                "inline-flex items-center text-[11px] font-semibold uppercase " +
                "tracking-[0.08em] px-2 py-1 cursor-pointer border leading-none " +
                "transition-colors duration-100 " +
                (active
                  ? "bg-row-active border-accent text-fg"
                  : "bg-transparent border-line text-dim hover:border-fg hover:text-fg")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Minimal stand-in chore for block-scope previews. The resolver only
// reads chore.id (used by chore-scope rules — empty here) and
// chore.blockId (used by block-scope rules — what we want to preview),
// plus the assignment fallbacks (none for a synthetic).
function syntheticChoreForBlock(scope, scopeId) {
  if (scope !== "block") return null;
  return { id: null, blockId: scopeId, assignment: null };
}
