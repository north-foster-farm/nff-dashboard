import { useMemo, useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { useProjects } from "../lib/data/useProjects.js";
import { navigate, pathForProject } from "../lib/router.js";
import { formatDateRange } from "../lib/projects.js";

// The Projects list page (Batch 22). Every project as a card with its
// status, progress (the completeness rule's verbatim copy), and dates.
// Clicking a card opens the project's detail page
// (/projects/<projectId> → ProjectPage.jsx).

const STATUS_META = {
  planned: { label: "Planned", cls: "text-dim border-line" },
  in_progress: { label: "In progress", cls: "text-accent border-accent" },
  completed: { label: "Completed", cls: "text-resolved border-resolved" },
};

export default function Projects() {
  const {
    projects, archived, loading, createProject,
  } = useProjects();
  const [tab, setTab] = useState("active");
  const [creating, setCreating] = useState(false);

  const active = useMemo(
    () => projects.filter(p => p.status !== "completed"),
    [projects]
  );
  const completed = useMemo(
    () => projects.filter(p => p.status === "completed"),
    [projects]
  );

  const visible =
    tab === "active" ? active :
    tab === "completed" ? completed :
    archived;

  return (
    <div className="max-w-[860px] flex flex-col gap-5">
      {/* tabs + new-project button */}
      <div className="flex items-center gap-1 border-b border-line">
        <Tab
          active={tab === "active"}
          onClick={() => setTab("active")}
          label={`Active · ${active.length}`}
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
          className="ml-auto inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 mb-2 cursor-pointer"
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
      ) : visible.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
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
      ? "No active projects. Hit \"New project\" to start one — phases, " +
        "steps, and checklists live inside it."
      : tab === "completed"
        ? "Nothing completed yet."
        : "Nothing archived. Archiving hides a project from the other " +
          "tabs without deleting anything.";
  return (
    <div className="bg-surface border border-line px-6 py-10 text-center">
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
    <div className="bg-surface border border-line p-4 flex flex-col gap-3">
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
        <button
          onClick={onCancel}
          disabled={pending}
          className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={pending}
          className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </div>
  );
}

function ProjectCard({ project }) {
  const status = STATUS_META[project.status] ?? STATUS_META.planned;
  const dates = formatDateRange(project.startedAt, project.targetDate);

  return (
    <button
      onClick={() => navigate(pathForProject(project.id))}
      className="bg-surface border border-line p-4 text-left cursor-pointer hover:border-accent font-[inherit] flex flex-col gap-2.5 w-full"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-heading text-[16px] font-semibold text-fg leading-snug">
            {project.title}
          </div>
          {project.description && (
            <div className="text-[12px] text-dim leading-relaxed mt-1 line-clamp-2">
              {project.description}
            </div>
          )}
        </div>
        <span
          className={
            "shrink-0 text-[10px] uppercase tracking-[0.12em] font-semibold " +
            "border px-2 py-0.5 " + status.cls
          }
        >
          {status.label}
        </span>
      </div>

      <ProgressBar progress={project.progress} />

      <div className="flex items-center gap-3 text-[11px] text-muted">
        {project.progress && <span>{project.progress.label}</span>}
        {!project.progress && project.phaseCount === 0 && (
          <span className="italic">No phases yet</span>
        )}
        {dates && <span className="ml-auto">{dates}</span>}
      </div>
    </button>
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
