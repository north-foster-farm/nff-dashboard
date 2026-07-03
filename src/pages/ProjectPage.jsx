import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, Archive, ArchiveRestore, CalendarClock, CalendarRange, Check,
  Circle, CircleCheck, FolderKanban, GripVertical, Link2, Lock, Paperclip,
  Pencil, Plus, Trash2, X,
} from "lucide-react";
import { useProject, useProjects } from "../lib/data/useProjects.js";
import { useEventSeries } from "../lib/data/useEventSeries.js";
import { navigate, pathForProject, pathForAttachment } from "../lib/router.js";
import { formatDateRange, checklistRollup } from "../lib/projects.js";
import { ProgressBar } from "./Projects.jsx";
import ProjectStepModal from "../components/ProjectStepModal.jsx";
import Markdown from "../components/Markdown.jsx";
import {
  AssigneeChips, AttachmentsBlock, EditableText,
} from "../components/ProjectBits.jsx";
import { LiveDocViewer, isLiveDoc } from "../components/LiveDocViewer.jsx";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import { BTN_ACCENT } from "../components/ui.jsx";

// The project detail page (Batch 22) — one project's full hierarchy:
//
//   Project → Phase → Step → Checklist → Checklist item
//
// Phases render as sections; steps as drag-orderable rows that open
// the Trello-style step modal (ProjectStepModal.jsx). The progress
// header applies the completeness rule from lib/projects.js. Links
// and project-level attachments sit at the bottom.

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

// `projectId` is the URL key — a slug or a uuid; useProject resolves
// either. `attachmentId` (the /files/<id> tail) deep-links one file.
export default function ProjectPage({
  projectId, attachmentId, data, onOpenEvent,
}) {
  const proj = useProject(projectId);
  const userEmail = useCurrentUserEmail();
  const [openStepId, setOpenStepId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  // The deep-linked live doc (non-live deep links open in a new tab).
  const [deepDoc, setDeepDoc] = useState(null);
  const consumedDeepLink = useRef(null);

  const openStep = proj.steps.find(s => s.id === openStepId) ?? null;

  // Canonicalize a uuid URL to the slug once the row is loaded, so
  // copied links read well; pre-slug uuid links still resolve.
  useEffect(() => {
    const { project } = proj;
    if (project?.slug && projectId === project.id) {
      navigate(
        pathForProject(project)
          + (attachmentId ? `/files/${attachmentId}` : ""),
        { replace: true }
      );
    }
  }, [proj.project, projectId, attachmentId]);

  // Deep-linked attachment: search project- AND step-level files;
  // live HTML docs open the in-app viewer, anything else opens its
  // signed URL in a new tab. Consumed once per attachment id.
  useEffect(() => {
    if (!attachmentId || proj.loading) return;
    if (consumedDeepLink.current === attachmentId) return;
    const att = [
      ...proj.attachments,
      ...proj.steps.flatMap(st => st.attachments),
    ].find(a => a.id === attachmentId);
    if (!att) return;
    consumedDeepLink.current = attachmentId;
    if (isLiveDoc(att)) {
      setDeepDoc(att);
    } else {
      proj.attachmentUrl(att)
        .then(url => window.open(url, "_blank", "noopener"))
        .catch(() => {});
    }
  }, [attachmentId, proj]);

  if (proj.loading) {
    return <div className="text-[12px] text-dim italic">Loading…</div>;
  }
  if (!proj.project) {
    return (
      <div className="max-w-[860px]">
        <BackToProjects />
        <div className="border border-line px-6 py-10 text-center mt-4">
          <div className="text-[13px] text-muted">
            This project doesn't exist (it may have been deleted).
          </div>
        </div>
      </div>
    );
  }

  const { project, phases } = proj;
  const archived = !!project.archivedAt;

  const setStatus = (status) => {
    const patch = { status };
    // Completing stamps completed_at; un-completing clears it.
    patch.completedAt = status === "completed"
      ? new Date().toISOString().slice(0, 10)
      : null;
    proj.updateProject(patch).catch(() => {});
  };

  const deleteProject = async () => {
    await proj.removeProject();
    navigate("/projects", { replace: true });
  };

  return (
    <div className="max-w-[860px] flex flex-col gap-5">
      {/* ── header ── */}
      <div>
        <BackToProjects />
        <div className="flex items-start justify-between gap-4 flex-wrap mt-3">
          <div className="min-w-0 flex-1">
            <div className="font-ui text-[10px] uppercase tracking-[0.16em] text-faint font-semibold">
              Project{archived ? " · archived" : ""}
            </div>
            <h2 className="font-heading text-[28px] font-bold -tracking-[0.02em] m-0 leading-tight">
              <EditableText
                value={project.title}
                onSave={(v) => v && proj.updateProject({ title: v })}
                inputClassName="text-[24px] font-bold"
              />
            </h2>
            <div className="text-[12px] text-dim mt-1">
              <EditableText
                value={project.description}
                placeholder="Add a one-line description"
                onSave={(v) => proj.updateProject({ description: v })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={project.status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit]"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <HeaderAction
              title={archived ? "Restore from archive" : "Archive project"}
              onClick={() => (archived
                ? proj.updateProject({ archivedAt: null })
                : proj.updateProject({
                    archivedAt: new Date().toISOString(),
                  })
              ).catch(() => {})}
            >
              {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </HeaderAction>
            <HeaderAction
              title="Delete project"
              warn
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} />
            </HeaderAction>
          </div>
        </div>
      </div>

      {/* ── progress + dates ── */}
      <section className="border border-line p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-heading text-[20px] font-semibold">
            {project.progress
              ? `${project.progress.pct}%`
              : "Not started"}
            {project.progress && (
              <span className="font-body text-[12px] text-dim font-normal ml-2.5">
                {project.progress.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-dim flex-wrap">
            <CalendarRange size={13} className="shrink-0" />
            <DateInput
              value={project.startedAt}
              onChange={(v) => proj.updateProject({ startedAt: v })}
              placeholder="Start"
            />
            <span className="text-faint">→</span>
            <DateInput
              value={project.targetDate}
              onChange={(v) => proj.updateProject({ targetDate: v })}
              placeholder="Target"
            />
          </div>
        </div>
        <ProgressBar progress={project.progress} tall />
      </section>

      {/* ── markdown body ── */}
      <section className="border border-line p-4">
        <SectionLabel
          icon={Pencil}
          title="Notes"
          action={!editingBody && (
            <SmallAction onClick={() => setEditingBody(true)}>
              {project.bodyMd ? "Edit" : "Write"}
            </SmallAction>
          )}
        />
        {editingBody ? (
          <BodyEditor
            initial={project.bodyMd ?? ""}
            onSave={async (v) => {
              await proj.updateProject({ bodyMd: v || null });
              setEditingBody(false);
            }}
            onCancel={() => setEditingBody(false)}
          />
        ) : project.bodyMd ? (
          <Markdown source={project.bodyMd} />
        ) : (
          <div className="text-[12px] text-faint italic">
            Markdown notes — the full write-up, plans, measurements,
            shopping lists…
          </div>
        )}
      </section>

      {/* ── phases (drag the header grip to reorder) ── */}
      <PhaseList proj={proj} phases={phases} onOpenStep={setOpenStepId} />
      <AddRow
        label={phases.length === 0 ? "Add the first phase" : "Add phase"}
        onAdd={(title) => proj.createPhase({ title }).catch(() => {})}
        placeholder="Phase title — e.g. Framing"
      />

      {/* ── links ── */}
      <LinksSection
        proj={proj}
        data={data}
        onOpenEvent={onOpenEvent}
      />

      {/* ── project-level files ── */}
      <section className="border border-line p-4">
        <SectionLabel icon={Paperclip} title="Files" />
        <AttachmentsBlock
          attachments={proj.attachments}
          onUpload={(f) => proj.uploadAttachment(f)}
          onRemove={proj.removeAttachment}
          getUrl={proj.attachmentUrl}
          project={project}
        />
      </section>

      {/* ── step modal ── */}
      {openStep && (
        <ProjectStepModal
          step={openStep}
          proj={proj}
          onClose={() => setOpenStepId(null)}
        />
      )}

      {/* ── deep-linked live doc ── */}
      {deepDoc && (
        <LiveDocViewer
          attachment={deepDoc}
          getUrl={proj.attachmentUrl}
          me={userEmail}
          onClose={() => setDeepDoc(null)}
        />
      )}

      {/* ── delete confirm ── */}
      {confirmDelete && (
        <ConfirmDelete
          project={project}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={deleteProject}
        />
      )}
    </div>
  );
}

// ── header pieces ─────────────────────────────────────────────────────

function BackToProjects() {
  return (
    <button
      onClick={() => navigate("/projects")}
      className="inline-flex items-center gap-1.5 bg-transparent border-0 p-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-dim hover:text-fg cursor-pointer font-[inherit]"
    >
      <ArrowLeft size={12} className="shrink-0" />
      All projects
    </button>
  );
}

function HeaderAction({ title, onClick, warn = false, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={
        "bg-surface border border-line p-2 cursor-pointer " +
        (warn ? "text-muted hover:text-warn" : "text-muted hover:text-fg")
      }
    >
      {children}
    </button>
  );
}

function SectionLabel({ icon: Icon, title, action = null }) {
  return (
    <header className="flex items-center gap-2.5 mb-3">
      {Icon && <Icon size={14} className="text-dim" />}
      <div className="font-ui text-[11px] text-fg uppercase tracking-[0.14em] font-bold">
        {title}
      </div>
      {action && <span className="ml-auto">{action}</span>}
    </header>
  );
}

function SmallAction({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="bg-transparent border-0 p-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] text-dim hover:text-accent cursor-pointer"
    >
      {children}
    </button>
  );
}

function DateInput({ value, onChange, placeholder }) {
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="bg-bg border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent font-[inherit]"
      placeholder={placeholder}
    />
  );
}

function BodyEditor({ initial, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <ToggleChip on={!preview} onClick={() => setPreview(false)}>
          Write
        </ToggleChip>
        <ToggleChip on={preview} onClick={() => setPreview(true)}>
          Preview
        </ToggleChip>
      </div>
      {preview ? (
        <div className="bg-bg border border-line px-3 py-2.5 min-h-[120px]">
          <Markdown source={draft} />
          {!draft && (
            <span className="text-[12px] text-faint italic">
              Nothing to preview.
            </span>
          )}
        </div>
      ) : (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          autoFocus
          className="bg-bg border border-line text-fg text-[13px] leading-relaxed px-3 py-2.5 outline-none focus:border-accent font-[inherit] w-full resize-y"
          placeholder={"# Markdown supported\n\n- lists\n- **bold**, *italic*\n- tables, links, etc."}
        />
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={pending}
          className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            setPending(true);
            try { await onSave(draft.trim()); }
            finally { setPending(false); }
          }}
          disabled={pending}
          className={BTN_ACCENT}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function ToggleChip({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "font-[inherit] text-[11px] font-semibold px-2.5 py-1 border cursor-pointer " +
        (on
          ? "bg-surface-alt text-fg border-line"
          : "bg-transparent text-dim border-transparent hover:text-fg")
      }
    >
      {children}
    </button>
  );
}

// ── phases + steps ────────────────────────────────────────────────────

// The reorderable phase stack: an outer DndContext over phase ids
// (nested cleanly outside each phase's own step-reorder context),
// mirroring the ranked-projects and step patterns. Writes the new
// order via proj.reorderPhases.
function PhaseList({ proj, phases, onOpenStep }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const phaseIds = phases.map(p => p.id);

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = phaseIds.indexOf(active.id);
    const to = phaseIds.indexOf(over.id);
    if (from < 0 || to < 0) return;
    proj.reorderPhases(arrayMove(phaseIds, from, to)).catch(() => {});
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={phaseIds}
        strategy={verticalListSortingStrategy}
      >
        {phases.map(phase => (
          <SortablePhaseSection
            key={phase.id}
            phase={phase}
            phaseCount={phases.length}
            proj={proj}
            onOpenStep={onOpenStep}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortablePhaseSection(props) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: props.phase.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-60 z-10 relative" : ""}
    >
      <PhaseSection
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function PhaseSection({
  phase, phaseCount, proj, onOpenStep, dragHandleProps,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const stepIds = phase.steps.map(s => s.id);
  const doneSteps = phase.steps.filter(s => s.completedAt).length;
  const dates = formatDateRange(phase.startDate, phase.targetDate);

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = stepIds.indexOf(active.id);
    const to = stepIds.indexOf(over.id);
    if (from < 0 || to < 0) return;
    proj.reorderSteps(arrayMove(stepIds, from, to)).catch(() => {});
  };

  return (
    <section className="border border-line">
      {/* phase header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-line group/phase">
        <span
          {...dragHandleProps}
          className="shrink-0 text-faint hover:text-dim cursor-grab touch-none opacity-0 group-hover/phase:opacity-100"
          title="Drag to reorder phases"
        >
          <GripVertical size={14} />
        </span>
        {/* Milestone toggle — only meaningful when milestones drive the
            percentage (more than one phase). */}
        <button
          onClick={() => proj.setPhaseDone(phase.id, !phase.done)
            .catch(() => {})}
          title={phase.done ? "Milestone reached" : "Mark milestone reached"}
          className="bg-transparent border-0 p-0 cursor-pointer shrink-0"
        >
          {phase.done
            ? <CircleCheck size={18} className="text-resolved" />
            : <Circle size={18} className="text-faint hover:text-dim" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-heading text-[15px] font-semibold leading-snug">
            <EditableText
              value={phase.title}
              onSave={(v) => v && proj.updatePhase(phase.id, { title: v })}
            />
          </div>
          <div className="text-[11px] text-muted mt-0.5 flex items-center gap-2 flex-wrap">
            <span>
              {doneSteps}/{phase.steps.length} steps complete
            </span>
            {phaseCount > 1 && phase.done && (
              <span className="text-resolved font-semibold">
                milestone reached
              </span>
            )}
            {dates && <span>· {dates}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <DateInput
            value={phase.targetDate}
            onChange={(v) => proj.updatePhase(phase.id, { targetDate: v })
              .catch(() => {})}
          />
          <button
            onClick={() => {
              if (phase.steps.length > 0 &&
                  !window.confirm(
                    `Delete "${phase.title}" and its ` +
                    `${phase.steps.length} steps?`)) return;
              proj.removePhase(phase.id).catch(() => {});
            }}
            title="Delete phase"
            className="bg-transparent border-0 p-1 text-muted hover:text-warn cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </header>

      {/* steps */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
          <ol className="m-0 p-0 list-none">
            {phase.steps.map(step => (
              <SortableStepRow
                key={step.id}
                step={step}
                proj={proj}
                onOpen={() => onOpenStep(step.id)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {/* add step */}
      <div className="px-4 py-2.5">
        <AddRow
          label="Add step"
          inline
          onAdd={(title) => proj.createStep(phase.id, { title })
            .catch(() => {})}
          placeholder="Step title"
        />
      </div>
    </section>
  );
}

function SortableStepRow({ step, proj, onOpen }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-60 z-10 relative" : ""}
    >
      <StepRow
        step={step}
        proj={proj}
        onOpen={onOpen}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </li>
  );
}

function StepRow({ step, proj, onOpen, dragHandleProps }) {
  const done = !!step.completedAt;
  const rollup = checklistRollup(step);
  const dates = formatDateRange(step.startDate, step.targetDate);
  const blocked = step.blockedBy.length > 0;

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 border-b border-line last:border-b-0 hover:bg-row-hover group">
      <span
        {...dragHandleProps}
        className="shrink-0 text-faint hover:text-dim cursor-grab touch-none opacity-0 group-hover:opacity-100"
        title="Drag to reorder"
      >
        <GripVertical size={13} />
      </span>
      <button
        onClick={() => proj.setStepDone(step.id, !done).catch(() => {})}
        title={done ? "Mark not done" : "Mark done"}
        className="bg-transparent border-0 p-0 cursor-pointer shrink-0"
      >
        {done
          ? <CircleCheck size={16} className="text-resolved" />
          : <Circle size={16} className="text-faint hover:text-dim" />}
      </button>
      <button
        onClick={onOpen}
        className={
          "bg-transparent border-0 p-0 font-[inherit] text-[13px] text-left cursor-pointer flex-1 min-w-0 truncate " +
          (done ? "text-dim line-through" : "text-fg hover:text-accent-deep")
        }
      >
        {step.title}
      </button>
      <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted">
        {blocked && (
          <span title="Has unfinished prerequisite steps">
            <Lock size={11} className="text-faint" />
          </span>
        )}
        {step.bodyMd && <Pencil size={11} className="text-faint" />}
        {(step.attachments?.length ?? 0) > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Paperclip size={11} />{step.attachments.length}
          </span>
        )}
        {rollup && (
          <span className={
            rollup.done === rollup.total ? "text-resolved" : ""
          }>
            <Check size={11} className="inline -translate-y-px" />
            {" "}{rollup.done}/{rollup.total}
          </span>
        )}
        <AssigneeChips value={step.assignees} readonly />
        <StepLockControl step={step} proj={proj} />
        {dates && <span>{dates}</span>}
      </div>
    </div>
  );
}

// Lock-to-date for one step — the escape hatch the scheduling engine
// honors (a locked step pins to its day and jumps the reflow queue). A
// CalendarClock toggle (distinct from the prereq `Lock`); opens a compact
// native date input. Writes step.locked_date via proj.updateStep.
function StepLockControl({ step, proj }) {
  const [open, setOpen] = useState(false);
  const locked = step.lockedDate;
  const set = (v) =>
    proj.updateStep(step.id, { lockedDate: v || null }).catch(() => {});
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={locked ? `Locked to ${locked}` : "Lock to a date"}
        className={
          "shrink-0 inline-flex items-center gap-1 bg-transparent border-0 "
          + "cursor-pointer p-0 "
          + (locked ? "text-accent-deep" : "text-faint hover:text-dim")
        }
      >
        <CalendarClock size={12} />
        {locked && <span className="text-[10px]">{locked}</span>}
      </button>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="date"
        value={locked ?? ""}
        autoFocus
        onChange={(e) => set(e.target.value)}
        className="bg-surface border border-line text-fg text-[10px] px-1 py-0.5 outline-none focus:border-accent font-[inherit]"
      />
      {locked && (
        <button
          type="button"
          onClick={() => { set(null); setOpen(false); }}
          className="text-[9px] text-dim hover:text-warn bg-transparent border-0 cursor-pointer uppercase tracking-[0.1em]"
        >
          clear
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[9px] text-dim hover:text-fg bg-transparent border-0 cursor-pointer uppercase tracking-[0.1em]"
      >
        ok
      </button>
    </span>
  );
}

// Inline "+ add" row that expands to an input on click.
function AddRow({ label, onAdd, placeholder, inline = false }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const submit = () => {
    const t = title.trim();
    if (t) onAdd(t);
    setTitle("");
    setAdding(false);
  };

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className={
          "inline-flex items-center gap-1.5 font-[inherit] text-[12px] font-semibold text-dim hover:text-fg cursor-pointer " +
          (inline
            ? "bg-transparent border-0 p-0"
            : "bg-surface border border-dashed border-line hover:border-accent px-4 py-3 w-full justify-center")
        }
      >
        <Plus size={13} /> {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setTitle(""); setAdding(false); }
        }}
        autoFocus
        className="bg-bg border border-line text-fg text-[13px] px-2.5 py-1.5 outline-none focus:border-accent font-[inherit] flex-1"
        placeholder={placeholder}
      />
      <button
        onClick={submit}
        className={BTN_ACCENT}
      >
        Add
      </button>
      <button
        onClick={() => { setTitle(""); setAdding(false); }}
        className="bg-transparent border-0 p-1 text-muted hover:text-fg cursor-pointer"
        aria-label="Cancel"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── links ─────────────────────────────────────────────────────────────

const LINK_KINDS = [
  { value: "event_series", label: "Event" },
  { value: "chore", label: "Chore" },
  // Project→project references ride the same project_links table
  // (target_kind is unconstrained); clicking navigates to the target.
  { value: "project", label: "Project" },
];

function LinksSection({ proj, data, onOpenEvent }) {
  const { series } = useEventSeries();
  const { projects: allProjects } = useProjects();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState("event_series");
  const [targetId, setTargetId] = useState("");

  // Options for the picker, per kind. Already-linked targets drop out.
  const linkedKeys = useMemo(
    () => new Set(proj.links.map(l => `${l.targetKind}:${l.targetId}`)),
    [proj.links]
  );
  const options = useMemo(() => {
    const all = kind === "event_series"
      ? (series ?? []).map(s => ({ id: s.id, label: s.label }))
      : kind === "project"
        ? (allProjects ?? [])
          .filter(p => p.id !== proj.project?.id) // no self-link
          .map(p => ({ id: p.id, label: p.title }))
        : (data?.chores?.definitions ?? [])
          .map(c => ({ id: c.id, label: c.title }));
    return all.filter(o => !linkedKeys.has(`${kind}:${o.id}`));
  }, [kind, series, data, allProjects, proj.project, linkedKeys]);

  const add = async () => {
    const opt = options.find(o => o.id === targetId);
    if (!opt) return;
    await proj.addLink({
      targetKind: kind,
      targetId: opt.id,
      label: opt.label,
    });
    setTargetId("");
    setAdding(false);
  };

  const openLink = (link) => {
    if (link.targetKind === "event_series") {
      onOpenEvent?.({ mode: "edit", seriesId: link.targetId });
    } else if (link.targetKind === "chore") {
      navigate("/chores");
    } else if (link.targetKind === "project") {
      const target = (allProjects ?? [])
        .find(p => p.id === link.targetId);
      navigate(pathForProject(target ?? link.targetId));
    }
  };

  return (
    <section className="bg-surface border border-line p-4">
      <SectionLabel
        icon={Link2}
        title="Linked to"
        action={!adding && (
          <SmallAction onClick={() => setAdding(true)}>Add link</SmallAction>
        )}
      />
      {proj.links.length === 0 && !adding && (
        <div className="text-[12px] text-faint italic">
          Nothing linked. Connect this project to the events, chores,
          and other projects it relates to.
        </div>
      )}
      <div className="flex flex-col gap-1">
        {proj.links.map(link => (
          <div
            key={link.id}
            className="flex items-center gap-2 bg-surface-alt px-2.5 py-1.5"
          >
            <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-faint shrink-0">
              {LINK_KINDS.find(k => k.value === link.targetKind)?.label
                ?? link.targetKind}
            </span>
            <button
              onClick={() => openLink(link)}
              className="bg-transparent border-0 p-0 font-[inherit] text-[12px] text-fg hover:text-accent cursor-pointer truncate text-left flex-1"
            >
              {link.label ?? link.targetId}
            </button>
            <button
              onClick={() => proj.removeLink(link.id).catch(() => {})}
              className="bg-transparent border-0 p-0.5 text-muted hover:text-warn cursor-pointer shrink-0"
              title="Remove link"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      {adding && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <select
            value={kind}
            onChange={(e) => { setKind(e.target.value); setTargetId(""); }}
            className="bg-bg border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit]"
          >
            {LINK_KINDS.map(k => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="bg-bg border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit] flex-1 min-w-[180px]"
          >
            <option value="">— pick —</option>
            {options.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => add().catch(() => {})}
            disabled={!targetId}
            className={BTN_ACCENT}
          >
            Link
          </button>
          <button
            onClick={() => setAdding(false)}
            className="bg-transparent border-0 p-1 text-muted hover:text-fg cursor-pointer"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </section>
  );
}

// ── delete confirm ────────────────────────────────────────────────────

function ConfirmDelete({ project, onCancel, onConfirm }) {
  const [pending, setPending] = useState(false);
  return (
    <div
      className="fixed inset-0 z-[150] bg-black/40 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-bg border border-line p-5 max-w-[420px] w-full flex flex-col gap-3"
      >
        <div className="flex items-center gap-2.5">
          <FolderKanban size={16} className="text-warn" />
          <div className="font-heading text-[16px] font-semibold">
            Delete "{project.title}"?
          </div>
        </div>
        <p className="text-[12px] text-dim leading-relaxed m-0">
          This permanently deletes the project and everything inside it —
          phases, steps, checklists, links, and attachments. Archiving is
          the reversible option.
        </p>
        <div className="flex items-center justify-end gap-2 mt-1">
          <button
            onClick={onCancel}
            disabled={pending}
            className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setPending(true);
              try { await onConfirm(); }
              catch { setPending(false); }
            }}
            disabled={pending}
            className="bg-transparent border border-warn text-warn font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete forever"}
          </button>
        </div>
      </div>
    </div>
  );
}
