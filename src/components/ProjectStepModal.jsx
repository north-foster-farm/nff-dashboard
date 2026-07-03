import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Check, Circle, CircleCheck, GitBranch, ListChecks,
  Paperclip, Pencil, Plus, Trash2, Users, X,
} from "lucide-react";
import Markdown from "./Markdown.jsx";
import {
  AssigneeChips, AttachmentsBlock, EditableText,
} from "./ProjectBits.jsx";

// The Trello-style step edit modal (Batch 22). Side panel on desktop,
// full-screen sheet on mobile — same shell as EventEditor. Everything
// about one step lives here:
//
//   * title + done state
//   * assignees + start/target dates (date moves trigger the
//     dependency date-shuffle in useProject.updateStep)
//   * markdown body (write / preview)
//   * checklists → checklist items
//   * attachments (Supabase Storage)
//   * dependencies (blocked by / blocks)
//
// All mutations come through the `proj` prop — the useProject() return
// value owned by ProjectPage.

export default function ProjectStepModal({ step, proj, onClose }) {
  const done = !!step.completedAt;
  // "N dependent steps shifted" toast after a date change.
  const [shiftNote, setShiftNote] = useState(null);

  // Lock body scroll while open (same pattern as EventEditor).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const changeDates = async (patch) => {
    const shifted = await proj.updateStep(step.id, patch);
    if (shifted > 0) {
      setShiftNote(
        `${shifted} dependent step${shifted === 1 ? "" : "s"} shifted ` +
        "by the same number of days."
      );
      setTimeout(() => setShiftNote(null), 5000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/40 flex items-stretch justify-end"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-bg border-l border-line w-full sm:max-w-[560px] flex flex-col h-full"
      >
        {/* ── header ── */}
        <header className="flex items-center gap-3 px-5 py-3 border-b border-line">
          <button
            onClick={() => proj.setStepDone(step.id, !done).catch(() => {})}
            title={done ? "Mark not done" : "Mark done"}
            className="bg-transparent border-0 p-0 cursor-pointer shrink-0"
          >
            {done
              ? <CircleCheck size={20} className="text-resolved" />
              : <Circle size={20} className="text-faint hover:text-dim" />}
          </button>
          <div className={
            "font-heading text-[17px] font-semibold flex-1 min-w-0 " +
            (done ? "text-dim line-through" : "")
          }>
            <EditableText
              value={step.title}
              onSave={(v) => v && proj.updateStep(step.id, { title: v })
                .catch(() => {})}
            />
          </div>
          <button
            onClick={onClose}
            className="text-faint hover:text-fg p-1 cursor-pointer bg-transparent border-0 shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* ── body ── */}
        <main className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* assignees */}
          <Block icon={Users} title="Assignees">
            <AssigneeChips
              value={step.assignees}
              onChange={(next) => proj.updateStep(step.id, {
                assignees: next,
              }).catch(() => {})}
            />
          </Block>

          {/* dates */}
          <Block icon={ArrowRight} title="Dates">
            <div className="flex items-center gap-2 flex-wrap">
              <LabeledDate
                label="Start"
                value={step.startDate}
                onChange={(v) => changeDates({ startDate: v })
                  .catch(() => {})}
              />
              <LabeledDate
                label="Target"
                value={step.targetDate}
                onChange={(v) => changeDates({ targetDate: v })
                  .catch(() => {})}
              />
            </div>
            {step.blocks.length > 0 && (
              <p className="text-[11px] text-faint leading-relaxed m-0 mt-2">
                Moving this step's dates shifts its {step.blocks.length}{" "}
                dependent step{step.blocks.length === 1 ? "" : "s"} by the
                same number of days.
              </p>
            )}
            {shiftNote && (
              <div className="text-[11px] text-accent-deep font-semibold mt-1.5">
                {shiftNote}
              </div>
            )}
          </Block>

          {/* markdown body */}
          <Block icon={Pencil} title="Details">
            <StepBody step={step} proj={proj} />
          </Block>

          {/* checklists */}
          <Block icon={ListChecks} title="Checklists">
            <div className="flex flex-col gap-4">
              {step.checklists.map(cl => (
                <Checklist key={cl.id} checklist={cl} proj={proj} />
              ))}
              <AddInline
                label="Add checklist"
                placeholder="Checklist title — e.g. Materials"
                onAdd={(title) => proj.createChecklist(step.id, title)
                  .catch(() => {})}
              />
            </div>
          </Block>

          {/* attachments */}
          <Block icon={Paperclip} title="Attachments">
            <AttachmentsBlock
              attachments={step.attachments}
              onUpload={(f) => proj.uploadAttachment(f, { stepId: step.id })}
              onRemove={proj.removeAttachment}
              getUrl={proj.attachmentUrl}
              project={proj.project}
              compact
            />
          </Block>

          {/* dependencies */}
          <Block icon={GitBranch} title="Dependencies">
            <Dependencies step={step} proj={proj} />
          </Block>
        </main>

        {/* ── footer ── */}
        <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-line">
          <button
            onClick={() => {
              if (!window.confirm(`Delete step "${step.title}"?`)) return;
              proj.removeStep(step.id).then(onClose).catch(() => {});
            }}
            className="inline-flex items-center gap-1.5 bg-transparent border border-line text-warn font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
          >
            <Trash2 size={13} className="shrink-0" /> Delete step
          </button>
          <button
            onClick={onClose}
            className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

// ── building blocks ───────────────────────────────────────────────────

function Block({ icon: Icon, title, children }) {
  return (
    <section>
      <header className="flex items-center gap-2 mb-2">
        <Icon size={13} className="text-dim" />
        <div className="font-ui text-[10px] text-fg uppercase tracking-[0.14em] font-bold">
          {title}
        </div>
      </header>
      {children}
    </section>
  );
}

function LabeledDate({ label, value, onChange }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-dim">
      {label}
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="bg-surface border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent font-[inherit]"
      />
    </label>
  );
}

// Markdown body with write / preview toggle.
function StepBody({ step, proj }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(step.bodyMd ?? "");
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);

  if (!editing) {
    return (
      <div>
        {step.bodyMd
          ? <Markdown source={step.bodyMd} />
          : (
            <span className="text-[12px] text-faint italic">
              No details yet.
            </span>
          )}
        <button
          onClick={() => { setDraft(step.bodyMd ?? ""); setEditing(true); }}
          className="block bg-transparent border-0 p-0 mt-2 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] text-dim hover:text-accent cursor-pointer"
        >
          {step.bodyMd ? "Edit" : "Write details"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPreview(false)}
          className={
            "font-[inherit] text-[11px] font-semibold px-2.5 py-1 border cursor-pointer " +
            (!preview
              ? "bg-surface-alt text-fg border-line"
              : "bg-transparent text-dim border-transparent hover:text-fg")
          }
        >
          Write
        </button>
        <button
          onClick={() => setPreview(true)}
          className={
            "font-[inherit] text-[11px] font-semibold px-2.5 py-1 border cursor-pointer " +
            (preview
              ? "bg-surface-alt text-fg border-line"
              : "bg-transparent text-dim border-transparent hover:text-fg")
          }
        >
          Preview
        </button>
      </div>
      {preview ? (
        <div className="bg-surface border border-line px-3 py-2.5 min-h-[80px]">
          <Markdown source={draft} />
        </div>
      ) : (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          autoFocus
          className="bg-surface border border-line text-fg text-[13px] leading-relaxed px-3 py-2.5 outline-none focus:border-accent font-[inherit] w-full resize-y"
          placeholder="Markdown supported — lists, **bold**, links…"
        />
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setEditing(false)}
          disabled={pending}
          className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            setPending(true);
            try {
              await proj.updateStep(step.id, {
                bodyMd: draft.trim() || null,
              });
              setEditing(false);
            } finally {
              setPending(false);
            }
          }}
          disabled={pending}
          className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// One checklist: title, progress, items, add-item input.
function Checklist({ checklist, proj }) {
  const items = checklist.items ?? [];
  const doneCount = items.filter(i => i.doneAt).length;
  const pct = items.length > 0
    ? Math.round((doneCount / items.length) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="text-[13px] font-semibold text-fg flex-1 min-w-0">
          <EditableText
            value={checklist.title}
            onSave={(v) => v && proj.renameChecklist(checklist.id, v)
              .catch(() => {})}
          />
        </div>
        <span className="text-[11px] text-muted shrink-0">
          {doneCount}/{items.length}
        </span>
        <button
          onClick={() => {
            if (items.length > 0 &&
                !window.confirm(`Delete "${checklist.title}"?`)) return;
            proj.removeChecklist(checklist.id).catch(() => {});
          }}
          title="Delete checklist"
          className="bg-transparent border-0 p-0.5 text-muted hover:text-warn cursor-pointer shrink-0"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {/* progress */}
      {items.length > 0 && (
        <div className="w-full h-1 bg-surface-alt overflow-hidden">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {/* items */}
      <div className="flex flex-col">
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-center gap-2 py-1 group"
          >
            <button
              onClick={() => proj.toggleChecklistItem(item.id, !item.doneAt)
                .catch(() => {})}
              className="bg-transparent border-0 p-0 cursor-pointer shrink-0"
            >
              {item.doneAt
                ? <CircleCheck size={14} className="text-resolved" />
                : <Circle size={14} className="text-faint hover:text-dim" />}
            </button>
            <span className={
              "text-[12px] flex-1 min-w-0 break-words " +
              (item.doneAt ? "text-dim line-through" : "text-fg")
            }>
              {item.body}
            </span>
            <button
              onClick={() => proj.removeChecklistItem(item.id)
                .catch(() => {})}
              className="bg-transparent border-0 p-0.5 text-muted hover:text-warn cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
              title="Delete item"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <AddInline
        label="Add item"
        placeholder="Checklist item"
        compact
        onAdd={(body) => proj.createChecklistItem(checklist.id, body)
          .catch(() => {})}
        keepOpen
      />
    </div>
  );
}

// Inline add control — collapsed "+ label" until clicked. `keepOpen`
// keeps the input open after submitting (rapid checklist entry).
function AddInline({ label, placeholder, onAdd, compact = false, keepOpen = false }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const submit = () => {
    const v = value.trim();
    if (v) onAdd(v);
    setValue("");
    if (!keepOpen) setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={
          "inline-flex items-center gap-1 bg-transparent border-0 p-0 font-[inherit] font-semibold text-dim hover:text-fg cursor-pointer self-start " +
          (compact ? "text-[11px]" : "text-[12px]")
        }
      >
        <Plus size={compact ? 11 : 13} /> {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setValue(""); setOpen(false); }
        }}
        autoFocus
        className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit] flex-1"
        placeholder={placeholder}
      />
      <button
        onClick={submit}
        className="bg-accent text-on-accent border border-accent p-1.5 cursor-pointer"
        aria-label="Add"
      >
        <Check size={12} />
      </button>
      <button
        onClick={() => { setValue(""); setOpen(false); }}
        className="bg-transparent border-0 p-1 text-muted hover:text-fg cursor-pointer"
        aria-label="Cancel"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// Dependencies: what blocks this step, what this step blocks, and the
// add-dependency picker.
function Dependencies({ step, proj }) {
  const [adding, setAdding] = useState(false);
  const [direction, setDirection] = useState("blocked_by");
  const [otherId, setOtherId] = useState("");
  const [shift, setShift] = useState(true);

  const stepsById = useMemo(
    () => new Map(proj.steps.map(s => [s.id, s])),
    [proj.steps]
  );

  // Steps not already linked in either direction (and not this step).
  const candidates = useMemo(() => {
    const used = new Set([step.id, ...step.blocks, ...step.blockedBy]);
    return proj.steps.filter(s => !used.has(s.id));
  }, [proj.steps, step]);

  const edgeFor = (predecessorId, dependentId) =>
    proj.dependencies.find(d =>
      d.predecessorStepId === predecessorId
      && d.dependentStepId === dependentId);

  const add = async () => {
    if (!otherId) return;
    await proj.addDependency(direction === "blocked_by"
      ? {
          predecessorStepId: otherId,
          dependentStepId: step.id,
          shiftDependents: shift,
        }
      : {
          predecessorStepId: step.id,
          dependentStepId: otherId,
          shiftDependents: shift,
        });
    setOtherId("");
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {step.blockedBy.length === 0 && step.blocks.length === 0 && !adding && (
        <span className="text-[12px] text-faint italic">
          No dependencies.
        </span>
      )}

      {step.blockedBy.map(id => {
        const other = stepsById.get(id);
        const edge = edgeFor(id, step.id);
        return (
          <DependencyRow
            key={`in:${id}`}
            prefix="Blocked by"
            title={other?.title ?? "(deleted step)"}
            done={!!other?.completedAt}
            shift={edge?.shiftDependents}
            onRemove={() => edge && proj.removeDependency(edge.id)
              .catch(() => {})}
          />
        );
      })}
      {step.blocks.map(id => {
        const other = stepsById.get(id);
        const edge = edgeFor(step.id, id);
        return (
          <DependencyRow
            key={`out:${id}`}
            prefix="Blocks"
            title={other?.title ?? "(deleted step)"}
            done={!!other?.completedAt}
            shift={edge?.shiftDependents}
            onRemove={() => edge && proj.removeDependency(edge.id)
              .catch(() => {})}
          />
        );
      })}

      {adding ? (
        <div className="flex flex-col gap-2 bg-surface border border-line p-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="bg-bg border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit]"
            >
              <option value="blocked_by">This step is blocked by</option>
              <option value="blocks">This step blocks</option>
            </select>
            <select
              value={otherId}
              onChange={(e) => setOtherId(e.target.value)}
              className="bg-bg border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit] flex-1 min-w-[160px]"
            >
              <option value="">— pick a step —</option>
              {candidates.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-[11px] text-dim cursor-pointer">
            <input
              type="checkbox"
              checked={shift}
              onChange={(e) => setShift(e.target.checked)}
            />
            Shift the dependent's dates when the predecessor's dates move
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => add().catch(() => {})}
              disabled={!otherId}
              className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={candidates.length === 0}
          className="inline-flex items-center gap-1 bg-transparent border-0 p-0 font-[inherit] text-[12px] font-semibold text-dim hover:text-fg cursor-pointer self-start disabled:opacity-40 disabled:cursor-default"
          title={candidates.length === 0
            ? "No other steps to depend on"
            : undefined}
        >
          <Plus size={13} /> Add dependency
        </button>
      )}
    </div>
  );
}

function DependencyRow({ prefix, title, done, shift, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-surface-alt px-2.5 py-1.5">
      <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-faint shrink-0">
        {prefix}
      </span>
      <span className={
        "text-[12px] flex-1 min-w-0 truncate " +
        (done ? "text-dim line-through" : "text-fg")
      }>
        {title}
      </span>
      {shift && (
        <span
          className="text-[10px] text-faint shrink-0"
          title="Date changes propagate along this edge"
        >
          shifts dates
        </span>
      )}
      <button
        onClick={onRemove}
        className="bg-transparent border-0 p-0.5 text-muted hover:text-warn cursor-pointer shrink-0"
        title="Remove dependency"
      >
        <X size={12} />
      </button>
    </div>
  );
}
