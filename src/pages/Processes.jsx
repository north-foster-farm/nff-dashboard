import { useMemo, useState } from "react";
import {
  ArrowUpRight, Check, ChevronDown, ChevronRight, Circle, CircleCheck,
  Plus, Trash2, Workflow, X,
} from "lucide-react";
import { useProcesses } from "../lib/data/useProcesses.js";
import { useChoreDefinitions } from "../lib/data/useChoreDefinitions.js";
import { useSites } from "../lib/data/useSites.js";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import ChoreFieldsEditor from "../components/ChoreFieldsEditor.jsx";
import { describeOffset } from "../lib/processes.js";
import { MODIFIER_ACTION_LABEL } from "../lib/modifiers.js";
import { formatDate } from "../lib/dates.js";
import { navigate, pathForProject } from "../lib/router.js";

// The Processes page (Batch 23; reworked in the 0025 automations
// rework). A process is a template tied to one or more event kinds:
// when a matching event lands on the schedule, the process expands
// into one-time chores (one per task, dated relative to the event)
// and chore modifiers.
//
// Layout: process cards (click to expand into the editor) + the
// expansion log at the bottom.

export default function Processes({ data }) {
  const proc = useProcesses();
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  const kinds = data?.events?.kinds ?? [];

  return (
    <div className="max-w-[860px] flex flex-col gap-5">
      {/* header row */}
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <p className="text-[12px] text-dim leading-relaxed m-0 max-w-[520px]">
          A process turns an event on the schedule into the work around
          it — prep tasks before, follow-up after, and chore changes on
          the day. Active processes expand automatically when a matching
          event comes within range.
        </p>
        <button
          onClick={async () => {
            setCreating(true);
            try {
              const id = await proc.createProcess({ title: "New process" });
              setOpenId(id);
            } finally {
              setCreating(false);
            }
          }}
          disabled={creating}
          className="shrink-0 inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50"
        >
          <Plus size={13} /> New process
        </button>
      </div>

      {proc.loading ? (
        <div className="text-[12px] text-dim italic">Loading…</div>
      ) : proc.processes.length === 0 ? (
        <div className="bg-surface border border-line px-6 py-10 text-center">
          <Workflow size={20} className="text-faint mx-auto mb-3" />
          <div className="text-[13px] text-muted leading-relaxed max-w-[420px] mx-auto">
            No processes yet. Create one and tie it to an event kind —
            "Processing day prep" tied to Processing days, for example.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {proc.processes.map(p => (
            <ProcessCard
              key={p.id}
              process={p}
              kinds={kinds}
              proc={proc}
              open={openId === p.id}
              onToggle={() => setOpenId(openId === p.id ? null : p.id)}
            />
          ))}
        </div>
      )}

      {/* expansion log */}
      {proc.expansions.length > 0 && (
        <ExpansionLog proc={proc} />
      )}
    </div>
  );
}

// ── process card + editor ─────────────────────────────────────────────

function ProcessCard({ process, kinds, proc, open, onToggle }) {
  const kindLabels = process.kindIds
    .map(id => kinds.find(k => k.id === id)?.label ?? id);

  return (
    <section className="bg-surface border border-line">
      {/* summary row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-0 cursor-pointer font-[inherit] text-left"
      >
        {open
          ? <ChevronDown size={14} className="text-dim shrink-0" />
          : <ChevronRight size={14} className="text-dim shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="font-heading text-[15px] font-semibold text-fg">
            {process.title}
          </div>
          <div className="text-[11px] text-muted mt-0.5 flex items-center gap-2 flex-wrap">
            <span>
              {process.steps.length} step{process.steps.length === 1 ? "" : "s"}
            </span>
            {kindLabels.length > 0 && (
              <span>· triggers on {kindLabels.join(", ")}</span>
            )}
            {process.expansions.length > 0 && (
              <span>
                · expanded {process.expansions.length} time{process.expansions.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <span
          className={
            "shrink-0 text-[10px] uppercase tracking-[0.12em] font-semibold border px-2 py-0.5 " +
            (process.isActive
              ? "text-accent border-accent"
              : "text-dim border-line")
          }
        >
          {process.isActive ? "Active" : "Off"}
        </span>
      </button>

      {/* editor */}
      {open && (
        <div className="border-t border-line px-4 py-4 flex flex-col gap-5">
          <ProcessEditor process={process} kinds={kinds} proc={proc} />
        </div>
      )}
    </section>
  );
}

// Input that keeps a local draft and saves on blur (or Enter), so
// typing doesn't fire a DB write per keystroke.
function SavedInput({
  value, onSave, textarea = false, number = false, className = "", ...rest
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [editing, setEditing] = useState(false);

  const save = () => {
    setEditing(false);
    const next = number
      ? (parseInt(draft, 10) || 0)
      : (String(draft).trim() || null);
    if (next !== (value ?? (number ? 0 : null))) onSave(next);
  };

  const shared = {
    value: editing ? draft : (value ?? ""),
    onFocus: () => { setDraft(value ?? ""); setEditing(true); },
    onChange: (e) => setDraft(e.target.value),
    onBlur: save,
    onKeyDown: (e) => {
      if (e.key === "Enter" && !textarea) e.target.blur();
      if (e.key === "Escape") { setEditing(false); e.target.blur(); }
    },
    className,
    ...rest,
  };

  return textarea ? <textarea {...shared} /> : <input {...shared} />;
}

function ProcessEditor({ process, kinds, proc }) {
  const { definitions } = useChoreDefinitions();
  // The chore-template fields a chore-kind step authors reuse the exact
  // chore CRUD controls (<ChoreFieldsEditor>), so they need the same
  // reference data the Chores editor pulls.
  const { places, groups, speciesById } = useSites();
  const { blocks } = useChoreBlocks();
  // New chore steps seed to the morning block so they never start
  // null (matches the expansion floor; resolved by stable slug).
  const morningBlockId = blocks.find(b => b.slug === "morning")?.id;
  const editorData = { places, blocks, groups, speciesById };

  return (
    <>
      {/* title + description + active */}
      <div className="flex flex-col gap-2">
        <SavedInput
          value={process.title}
          onSave={(v) => v && proc.updateProcess(process.id, { title: v })
            .catch(() => {})}
          className="bg-bg border border-line text-fg text-[14px] font-semibold px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full"
          placeholder="Process title"
        />
        <SavedInput
          textarea
          value={process.description ?? ""}
          onSave={(v) => proc.updateProcess(process.id, { description: v })
            .catch(() => {})}
          rows={2}
          className="bg-bg border border-line text-fg text-[12px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full resize-y"
          placeholder="What this process covers (optional)"
        />
        <label className="inline-flex items-center gap-2 text-[12px] text-fg cursor-pointer self-start">
          <button
            onClick={() => proc.setActive(process.id, !process.isActive)
              .catch(() => {})}
            className="bg-transparent border-0 p-0 cursor-pointer"
            aria-pressed={process.isActive}
          >
            {process.isActive
              ? <CircleCheck size={16} className="text-accent" />
              : <Circle size={16} className="text-faint" />}
          </button>
          Active — expand automatically for upcoming events
        </label>
      </div>

      {/* event kinds */}
      <Block title="Triggers on">
        <div className="flex items-center gap-1.5 flex-wrap">
          {kinds.map(k => {
            const on = process.kindIds.includes(k.id);
            return (
              <button
                key={k.id}
                onClick={() => {
                  const next = on
                    ? process.kindIds.filter(id => id !== k.id)
                    : [...process.kindIds, k.id];
                  proc.setKinds(process.id, next).catch(() => {});
                }}
                className={
                  "font-[inherit] text-[11px] font-semibold px-2.5 py-1 border cursor-pointer " +
                  (on
                    ? "bg-accent text-on-accent border-accent"
                    : "bg-transparent text-dim border-line hover:border-accent")
                }
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </Block>

      {/* steps */}
      <Block title="Steps">
        <div className="flex flex-col gap-2">
          {process.steps.map(step => (
            <StepEditor
              key={step.id}
              step={step}
              proc={proc}
              chores={definitions ?? []}
              editorData={editorData}
            />
          ))}
          <div className="flex items-center gap-2">
            <button
              onClick={() => proc.createStep(process.id, {
                title: "New chore", kind: "chore", offsetDays: 0,
                blockId: morningBlockId,
              }).catch(() => {})}
              className="inline-flex items-center gap-1 bg-transparent border border-dashed border-line text-dim hover:text-fg hover:border-accent font-[inherit] text-[11px] font-semibold px-2.5 py-1.5 cursor-pointer"
            >
              <Plus size={12} /> Chore
            </button>
            <button
              onClick={() => proc.createStep(process.id, {
                title: "Chore change", kind: "chore_modifier",
                offsetDays: 0, modifierAction: "prepend",
              }).catch(() => {})}
              className="inline-flex items-center gap-1 bg-transparent border border-dashed border-line text-dim hover:text-fg hover:border-accent font-[inherit] text-[11px] font-semibold px-2.5 py-1.5 cursor-pointer"
            >
              <Plus size={12} /> Chore change
            </button>
          </div>
        </div>
        <p className="text-[11px] text-faint leading-relaxed m-0 mt-2">
          Chore steps become one-time chores, dated relative to the
          event. Chore changes write a one-day modifier onto an existing
          chore
          (skip it, replace it, add an instruction, or tighten its
          deadline).
        </p>
      </Block>

      {/* danger */}
      <div className="flex justify-end border-t border-line pt-3">
        <button
          onClick={() => {
            if (!window.confirm(
              `Delete "${process.title}"? Past expansions and their ` +
              "chores stay; nothing new will expand.")) return;
            proc.removeProcess(process.id).catch(() => {});
          }}
          className="inline-flex items-center gap-1.5 bg-transparent border border-line text-warn font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
        >
          <Trash2 size={13} /> Delete process
        </button>
      </div>
    </>
  );
}

function Block({ title, children }) {
  return (
    <section>
      <div className="font-ui text-[10px] uppercase tracking-[0.14em] font-bold text-fg mb-2">
        {title}
      </div>
      {children}
    </section>
  );
}

// One process step row: offset + (chore template | chore-change target
// + action + text). A chore-kind step is a full chore template authored
// with the shared <ChoreFieldsEditor>; only its date (event + offset)
// and concrete batch/species anchor are resolved later, at expansion.
function StepEditor({ step, proc, chores, editorData }) {
  const isModifier = step.kind === "chore_modifier";

  return (
    <div className="bg-bg border border-line p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* offset */}
        <SavedInput
          number
          type="number"
          value={step.offsetDays}
          onSave={(v) => proc.updateStep(step.id, { offsetDays: v })
            .catch(() => {})}
          className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit] w-[70px]"
          title="Days relative to the event (negative = before)"
        />
        <span className="text-[11px] text-muted whitespace-nowrap">
          {describeOffset(step.offsetDays)}
        </span>
        <span className={
          "ml-auto text-[9px] uppercase tracking-[0.1em] font-semibold px-1.5 py-0.5 border " +
          (isModifier
            ? "text-accent-deep border-accent-deep"
            : "text-dim border-line")
        }>
          {isModifier ? "Chore change" : "Chore"}
        </span>
        <button
          onClick={() => proc.removeStep(step.id).catch(() => {})}
          className="bg-transparent border-0 p-1 text-muted hover:text-warn cursor-pointer"
          title="Delete step"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {isModifier ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={step.targetChoreId ?? ""}
              onChange={(e) => proc.updateStep(step.id, {
                targetChoreId: e.target.value || null,
              }).catch(() => {})}
              className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit] flex-1 min-w-[180px]"
            >
              <option value="">— pick the chore to change —</option>
              {chores.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <select
              value={step.modifierAction ?? "prepend"}
              onChange={(e) => proc.updateStep(step.id, {
                modifierAction: e.target.value,
              }).catch(() => {})}
              className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit]"
            >
              {Object.entries(MODIFIER_ACTION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {step.modifierAction !== "skip" && (
            <SavedInput
              value={step.modifierText ?? ""}
              onSave={(v) => proc.updateStep(step.id, { modifierText: v })
                .catch(() => {})}
              className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit] w-full"
              placeholder={
                step.modifierAction === "replace"
                  ? "What to do instead"
                  : step.modifierAction === "restrict_until"
                    ? "New deadline — e.g. by 2 PM"
                    : "The extra instruction"
              }
            />
          )}
        </div>
      ) : (
        <ChoreFieldsEditor
          value={{
            title: step.title,
            description: step.bodyMd ?? "",
            blockId: step.blockId ?? null,
            lastChanceBlockId: step.lastChanceBlockId ?? null,
            startTime: step.startTime ?? null,
            assignment: step.assignment ?? null,
            anchorType: step.anchorType ?? "none",
            anchorKindTag: step.anchorKindTag ?? null,
            placeId: step.placeId ?? null,
            atPlaceId: step.atPlaceId ?? null,
          }}
          onChange={(patch) => {
            // The step stores the chore description in body_md; every
            // other field maps straight through to stepPatch.
            const out = { ...patch };
            if ("description" in out) {
              out.bodyMd = out.description;
              delete out.description;
            }
            proc.updateStep(step.id, out).catch(() => {});
          }}
          places={editorData.places}
          blocks={editorData.blocks}
          groups={editorData.groups}
          speciesById={editorData.speciesById}
          concreteAnimals={false}
          commitMode="blur"
          showAssignment
        />
      )}
    </div>
  );
}

// ── expansion log ─────────────────────────────────────────────────────

function ExpansionLog({ proc }) {
  const [dismissingId, setDismissingId] = useState(null);
  const [reason, setReason] = useState("");

  const processTitleById = useMemo(
    () => new Map(proc.processes.map(p => [p.id, p.title])),
    [proc.processes]
  );

  return (
    <section className="bg-surface border border-line p-4">
      <div className="font-ui text-[11px] uppercase tracking-[0.14em] font-bold text-fg mb-3">
        Expansions
      </div>
      <ol className="m-0 p-0 list-none flex flex-col gap-1.5">
        {proc.expansions.map(exp => (
          <li
            key={exp.id}
            className="flex flex-col gap-2 bg-bg border border-line px-3 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <Workflow size={13} className="text-accent-deep shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-fg leading-relaxed">
                  {exp.summary}
                </div>
                <div className="text-[10px] text-faint mt-0.5">
                  {processTitleById.get(exp.processId) ?? "Deleted process"}
                  {" · expanded "}{formatDate(exp.expandedAt?.slice(0, 10))}
                  {exp.status !== "active" && ` · ${exp.status}`}
                  {exp.dismissedReason && ` ("${exp.dismissedReason}")`}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(exp.created?.chore_ids?.length ?? 0) > 0
                  && exp.status !== "dismissed" && (
                  <span className="text-[10px] text-dim uppercase tracking-[0.08em] px-2 py-1 border border-line">
                    {exp.created.chore_ids.length} chore
                    {exp.created.chore_ids.length === 1 ? "" : "s"}
                  </span>
                )}
                {/* Legacy: pre-0025 expansions created a project. */}
                {exp.created?.project_id && exp.status !== "dismissed" && (
                  <button
                    onClick={() =>
                      navigate(pathForProject(exp.created.project_id))}
                    className="inline-flex items-center gap-1 bg-transparent border border-line text-fg font-[inherit] text-[10px] font-semibold uppercase tracking-[0.08em] px-2 py-1 cursor-pointer hover:border-accent"
                  >
                    Project <ArrowUpRight size={11} />
                  </button>
                )}
                {exp.status === "active" && (
                  <>
                    <button
                      onClick={() => proc.acknowledgeExpansion(exp.id)
                        .catch(() => {})}
                      title="Keep everything it created"
                      className="bg-accent text-on-accent border-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] cursor-pointer inline-flex items-center gap-1"
                    >
                      <Check size={11} /> Got it
                    </button>
                    <button
                      onClick={() => { setDismissingId(exp.id); setReason(""); }}
                      title="Undo — retire the chores and remove the chore changes"
                      className="bg-transparent text-dim border border-line px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
            {dismissingId === exp.id && (
              <div className="flex items-center gap-2 pl-6">
                <input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      proc.dismissExpansion(exp.id, reason).catch(() => {});
                      setDismissingId(null);
                    }
                    if (e.key === "Escape") setDismissingId(null);
                  }}
                  placeholder="Why dismiss? (e.g. event canceled)"
                  className="flex-1 bg-surface border border-line px-2.5 py-1.5 text-[12px] text-fg font-[inherit] outline-none"
                />
                <button
                  onClick={() => {
                    proc.dismissExpansion(exp.id, reason).catch(() => {});
                    setDismissingId(null);
                  }}
                  className="bg-warn text-on-accent border-0 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] cursor-pointer"
                >
                  Dismiss + undo
                </button>
                <button
                  onClick={() => setDismissingId(null)}
                  className="bg-transparent text-dim border-0 p-1 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
