import { useMemo, useState } from "react";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FolderKanban, Plus, GripVertical, Lock, ArrowDownToLine, ArrowUp,
  CalendarSync,
} from "lucide-react";
import { BTN_ACCENT, BTN_GHOST, AlertStrip } from "../components/ui.jsx";
import { useProjects } from "../lib/data/useProjects.js";
import { useScheduleReflow } from "../lib/data/useScheduleReflow.js";
import { navigate, pathForProject, usePersistedState } from "../lib/router.js";
import { formatDateRange } from "../lib/projects.js";
import { formatISODate, todayUTC } from "../lib/dates.js";

// The Projects list page — forced-ranked rework (Batch: projects rework,
// structural core). Priority is a SINGLE total order, not plural flags:
//   • Ranked list — every active project ranked against every other; the
//     top is THE focus and ranks 2+ are deliberately de-emphasized
//     ("working on anything but the top should feel wrong"). Drag to
//     reorder; the cascade is implicit (drop P1 at slot 2 and P2 takes
//     the top).
//   • Unprioritized bucket — scoped-but-not-yet-actionable / one-line
//     ideas, with an optional plain-text timing note. Replaces "on hold".
//   • Lock-to-date — the escape hatch to jump the queue; a locked project
//     stays put and (a later batch) the schedule flows around it.
// Done is completedAt; archived is archivedAt — both orthogonal to the
// queue. The old status-as-priority model is gone.

export default function Projects() {
  const {
    projects, archived, loading,
    createProject, reorderProjects, setQueueState, setProjectLocked,
    setTimingNote, archiveProject,
  } = useProjects();
  const [tab, setTab] = useState("active");
  const [creating, setCreating] = useState(false);
  // Scheduling engine: today's reflow of the ranked list into the day's
  // project gaps. Surfaces a "stale" nudge here (the ranking lives on this
  // page) with a manual Sync. Slice 4 — auto-reflow (the automatic
  // fallback) is on by default; an easy per-device off switch lives by the
  // list. Nothing rearranges silently: the nudge shows the instant it's
  // stale, and auto only fires after a quiet window.
  const [autoReflow, setAutoReflow] = usePersistedState(
    "nff-schedule-autoreflow", true);
  const todayISO = useMemo(() => formatISODate(todayUTC()), []);
  const reflow = useScheduleReflow({
    dateISO: todayISO, projects, autoReflow });

  // Active (non-archived, non-done) split by queue placement; done +
  // archived live in their own tabs.
  const ranked = useMemo(
    () => projects
      .filter(p => !p.completedAt && p.queueState !== "unprioritized")
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [projects]
  );
  const unprioritized = useMemo(
    () => projects.filter(
      p => !p.completedAt && p.queueState === "unprioritized"),
    [projects]
  );
  const completed = useMemo(
    () => projects.filter(p => p.completedAt),
    [projects]
  );

  const actions = { setQueueState, setProjectLocked, archiveProject };

  return (
    <div className="max-w-[860px] flex flex-col gap-5">
      {/* tabs + new-project button */}
      <div className="flex items-center gap-1 border-b border-line flex-wrap gap-y-2">
        <Tab
          active={tab === "active"}
          onClick={() => setTab("active")}
          label={`Active · ${ranked.length + unprioritized.length}`}
        />
        <Tab
          active={tab === "completed"}
          onClick={() => setTab("completed")}
          label={`Completed · ${completed.length}`}
        />
        <Tab
          active={tab === "archived"}
          onClick={() => setTab("archived")}
          label={`Archived · ${archived.length}`}
        />
        <button
          onClick={() => setCreating(c => !c)}
          className={"ml-auto mb-2 " + BTN_ACCENT}
        >
          <Plus size={13} /> New project
        </button>
      </div>

      {creating && (
        <NewProjectForm
          onCancel={() => setCreating(false)}
          onCreate={async (fields) => {
            const id = await createProject(fields);
            setCreating(false);
            navigate(pathForProject(id));
          }}
        />
      )}

      {loading ? (
        <div className="text-[12px] text-dim italic">Loading…</div>
      ) : tab === "active" ? (
        <ActiveView
          ranked={ranked}
          unprioritized={unprioritized}
          reorderProjects={reorderProjects}
          actions={actions}
          setTimingNote={setTimingNote}
          reflow={reflow}
          autoReflow={autoReflow}
          onToggleAuto={() => setAutoReflow(!autoReflow)}
        />
      ) : tab === "completed" ? (
        <FlatList list={completed} empty={<EmptyState tab="completed" />} />
      ) : (
        <FlatList list={archived} empty={<EmptyState tab="archived" />} />
      )}
    </div>
  );
}

// ── Active view: ranked list + Unprioritized bucket ────────────────────

function ActiveView({
  ranked, unprioritized, reorderProjects, actions, setTimingNote, reflow,
  autoReflow, onToggleAuto,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const rankedIds = ranked.map(p => p.id);

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = rankedIds.indexOf(active.id);
    const to = rankedIds.indexOf(over.id);
    if (from < 0 || to < 0) return;
    reorderProjects(arrayMove(rankedIds, from, to)).catch(() => {});
  };

  return (
    <div className="flex flex-col gap-6">
      {reflow?.stale && (
        <AlertStrip
          tone="info"
          icon={CalendarSync}
          action="Sync now"
          onAct={() => reflow.syncNow()}
        >
          Today's schedule doesn't reflect this ranking yet.
          {autoReflow ? " It'll auto-sync shortly." : " Auto-sync is off."}
        </AlertStrip>
      )}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>
            The ranked list — top is the focus
          </SectionLabel>
          <AutoSyncToggle enabled={autoReflow} onToggle={onToggleAuto} />
        </div>
        {ranked.length === 0 ? (
          <EmptyState tab="active" />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={rankedIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {ranked.map((p, i) => (
                  <SortableProjectCard
                    key={p.id}
                    project={p}
                    rank={i + 1}
                    actions={actions}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>
          Unprioritized · {unprioritized.length}
        </SectionLabel>
        <div className="text-[11px] text-faint leading-relaxed -mt-1 mb-1">
          Not yet scoped or not yet actionable. Rank one when you commit
          to it.
        </div>
        {unprioritized.length === 0 ? (
          <div className="border border-line px-5 py-6 text-center text-[12px] text-faint">
            Nothing parked here.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {unprioritized.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                actions={actions}
                setTimingNote={setTimingNote}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FlatList({ list, empty }) {
  if (list.length === 0) return empty;
  return (
    <div className="flex flex-col gap-2">
      {list.map(p => <ProjectCard key={p.id} project={p} />)}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="font-ui text-[11px] text-fg uppercase tracking-[0.14em] font-bold">
      {children}
    </div>
  );
}

// The per-device off switch for the auto-reflow fallback. On (accent) =
// the schedule reflows itself a moment after you re-rank; off (faint) =
// you sync deliberately via the nudge's "Sync now".
function AutoSyncToggle({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={enabled
        ? "Auto-sync is on — the schedule reflows shortly after you re-rank"
        : "Auto-sync is off — sync the schedule manually"}
      className={
        "shrink-0 inline-flex items-center gap-1.5 font-ui text-[10px] " +
        "font-semibold uppercase tracking-[0.12em] cursor-pointer " +
        "bg-transparent border-0 " +
        (enabled ? "text-accent-deep" : "text-faint hover:text-dim")
      }
    >
      <CalendarSync size={13} />
      Auto-sync {enabled ? "on" : "off"}
    </button>
  );
}

function Tab({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={
        "bg-transparent border-0 font-[inherit] text-[12px] font-semibold " +
        "uppercase tracking-[0.12em] px-3 pb-2 pt-1 cursor-pointer " +
        (active
          ? "text-fg shadow-[inset_0_-2px_0_0_var(--c-accent)]"
          : "text-dim hover:text-fg")
      }
    >
      {label}
    </button>
  );
}

function EmptyState({ tab }) {
  const copy =
    tab === "active"
      ? "No ranked projects. Hit \"New project\" to start one — it joins " +
        "the bottom of the list; drag it up when it's the focus."
      : tab === "completed"
        ? "Nothing completed yet."
        : "Nothing archived. Archiving hides a project from the other " +
          "tabs without deleting anything.";
  return (
    <div className="border border-line px-6 py-10 text-center">
      <FolderKanban size={20} className="text-faint mx-auto mb-3" />
      <div className="text-[13px] text-muted leading-relaxed max-w-[420px] mx-auto">
        {copy}
      </div>
    </div>
  );
}

function NewProjectForm({ onCreate, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const submit = async () => {
    if (!title.trim()) { setErrorMsg("Title required."); return; }
    setPending(true);
    setErrorMsg(null);
    try {
      await onCreate({ title, description });
    } catch (err) {
      setErrorMsg(err?.message ?? "Create failed.");
      setPending(false);
    }
  };

  return (
    <div className="border border-line p-4 flex flex-col gap-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        autoFocus
        className="bg-bg border border-line text-fg text-[14px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full"
        placeholder="Project title — e.g. Build the second mobile coop"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="bg-bg border border-line text-fg text-[12px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full resize-y"
        placeholder="One-line description (optional)"
      />
      {errorMsg && <div className="text-[11px] text-warn">{errorMsg}</div>}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} disabled={pending} className={BTN_GHOST}>
          Cancel
        </button>
        <button onClick={submit} disabled={pending} className={BTN_ACCENT}>
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </div>
  );
}

// ── one project card ───────────────────────────────────────────────────
// `rank` (1-based) + `dragHandleProps` are passed only on the ranked
// list. The #1 focus is emphasized (accent edge + eyebrow); ranks 2+ are
// muted so the eye is pulled to the top.

function SortableProjectCard({ project, rank, actions }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: project.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-60 z-10 relative" : ""}
    >
      <ProjectCard
        project={project}
        rank={rank}
        actions={actions}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function ProjectCard({
  project, rank, actions, dragHandleProps, setTimingNote,
}) {
  const dates = formatDateRange(project.startedAt, project.targetDate);
  const isFocus = rank === 1;
  const isRanked = rank != null;
  const unprioritized = project.queueState === "unprioritized";

  return (
    <div
      className={
        "border p-4 flex flex-col gap-2.5 " +
        (isFocus ? "border-accent" : "border-line")
      }
    >
      {isFocus && (
        <div className="font-ui text-[10px] text-accent uppercase tracking-[0.16em] font-bold">
          Focus
        </div>
      )}
      <div className="flex items-start gap-2.5">
        {isRanked && (
          <span
            {...dragHandleProps}
            className="shrink-0 mt-0.5 text-faint hover:text-dim cursor-grab touch-none"
            title="Drag to reorder"
          >
            <GripVertical size={15} />
          </span>
        )}
        {isRanked && (
          <span
            className={
              "shrink-0 mt-0.5 font-ui text-[12px] font-bold tabular-nums " +
              (isFocus ? "text-accent" : "text-faint")
            }
          >
            {rank}
          </span>
        )}
        <div
          onClick={() => navigate(pathForProject(project.id))}
          className="min-w-0 flex-1 cursor-pointer"
        >
          <div
            className={
              "font-heading text-[16px] font-semibold leading-snug " +
              (isRanked && !isFocus ? "text-dim" : "text-fg")
            }
          >
            {project.title}
          </div>
          {project.description && (
            <div className="text-[12px] text-dim leading-relaxed mt-1 line-clamp-2">
              {project.description}
            </div>
          )}
        </div>
        {actions && (
          <CardActions
            project={project}
            isRanked={isRanked}
            actions={actions}
          />
        )}
      </div>

      <ProgressBar progress={project.progress} />

      <div className="flex items-center gap-3 text-[11px] text-muted flex-wrap">
        {project.progress && <span>{project.progress.label}</span>}
        {!project.progress && project.phaseCount === 0 && (
          <span className="italic">No phases yet</span>
        )}
        {project.lockedDate && (
          <span className="inline-flex items-center gap-1 text-accent-deep">
            <Lock size={11} /> {project.lockedDate}
          </span>
        )}
        {dates && <span className="ml-auto">{dates}</span>}
      </div>

      {unprioritized && setTimingNote && (
        <TimingNote project={project} onSave={setTimingNote} />
      )}
    </div>
  );
}

// Per-card controls: lock-to-date, and a one-tap move between the ranked
// list and the Unprioritized bucket. Stop propagation so they never
// trigger the card's navigate.
function CardActions({ project, isRanked, actions }) {
  return (
    <div
      className="shrink-0 flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <LockControl project={project} onLock={actions.setProjectLocked} />
      {isRanked ? (
        <IconBtn
          title="Send to Unprioritized"
          onClick={() => actions.setQueueState(project.id, "unprioritized")
            .catch(() => {})}
        >
          <ArrowDownToLine size={14} />
        </IconBtn>
      ) : (
        <IconBtn
          title="Rank it (move to the list)"
          onClick={() => actions.setQueueState(project.id, "ranked")
            .catch(() => {})}
        >
          <ArrowUp size={14} />
        </IconBtn>
      )}
    </div>
  );
}

function IconBtn({ title, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="shrink-0 text-faint hover:text-fg cursor-pointer p-1 bg-transparent border-0"
    >
      {children}
    </button>
  );
}

// Lock-to-date: a lock toggle that reveals a native date input. A set
// lock shows as the date badge in the card footer; here we only edit.
function LockControl({ project, onLock }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <IconBtn
        title={project.lockedDate ? "Change the lock date" : "Lock to a date"}
        onClick={() => setOpen(true)}
      >
        <Lock
          size={14}
          className={project.lockedDate ? "text-accent-deep" : ""}
        />
      </IconBtn>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="date"
        value={project.lockedDate ?? ""}
        autoFocus
        onChange={(e) => onLock(project.id, e.target.value || null)
          .catch(() => {})}
        className="bg-surface border border-line text-fg text-[11px] px-1.5 py-1 outline-none focus:border-accent font-[inherit]"
      />
      {project.lockedDate && (
        <button
          type="button"
          onClick={() => onLock(project.id, null).catch(() => {})}
          className="text-[10px] text-dim hover:text-warn bg-transparent border-0 cursor-pointer uppercase tracking-[0.1em] font-semibold"
        >
          clear
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[10px] text-dim hover:text-fg bg-transparent border-0 cursor-pointer uppercase tracking-[0.1em] font-semibold"
      >
        done
      </button>
    </span>
  );
}

// Plain-text timing for an unprioritized project ("when it cools off,
// ~September"). Pure metadata — committed on blur, never scheduled on.
function TimingNote({ project, onSave }) {
  const [val, setVal] = useState(project.timingNote ?? "");
  return (
    <input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => {
        if ((val ?? "") !== (project.timingNote ?? "")) {
          onSave(project.id, val).catch(() => {});
        }
      }}
      placeholder="Timing note — e.g. when it cools off, ~September"
      className="bg-surface border border-line text-dim text-[11px] px-2 py-1.5 outline-none focus:border-accent font-[inherit] w-full"
    />
  );
}

// Thin progress bar — accent fill over the surface-alt track.
export function ProgressBar({ progress, tall = false }) {
  if (!progress) return null;
  return (
    <div className={
      "w-full bg-surface-alt overflow-hidden " + (tall ? "h-2" : "h-1")
    }>
      <div
        className="h-full bg-accent transition-[width] duration-300"
        style={{ width: `${progress.pct}%` }}
      />
    </div>
  );
}
