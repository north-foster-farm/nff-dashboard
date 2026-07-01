import { useState } from "react";
import {
  Check, X, RotateCcw, FolderKanban, CalendarRange, ListChecks,
  ArrowUpRight, Bot,
} from "lucide-react";
import { useAgentProposals } from "../lib/data/useAgentProposals.js";
import { useProjects } from "../lib/data/useProjects.js";
import { navigate, pathForProject } from "../lib/router.js";

// The Proposals page — the review queue for actions a Claude chat
// proposes through the nff-dashboard MCP server (see mcp/). Each pending
// card is something the agent wants to create; Approve runs the app's
// real create path (so rank/phase/step structure is correct by
// construction) and Reject discards it. Nothing an agent proposes
// touches live data until James approves it here.

const KIND_META = {
  project: { icon: FolderKanban, label: "Project" },
  event: { icon: CalendarRange, label: "Event" },
  chore: { icon: ListChecks, label: "Chore" },
};

export default function Proposals() {
  const proposals = useAgentProposals();
  const { createProjectTree } = useProjects();
  const [tab, setTab] = useState("pending");
  const [busy, setBusy] = useState(null);

  const approve = async (p) => {
    if (busy) return;
    setBusy(p.id);
    try {
      if (p.kind === "project") {
        const id = await createProjectTree({
          title: p.payload.title ?? p.title,
          description: p.payload.description,
          steps: p.payload.steps,
        });
        await proposals.markApplied(p.id, { project_id: id });
      } else {
        throw new Error(
          `Approving ${p.kind} proposals isn't supported yet.`
        );
      }
    } catch (e) {
      await proposals.markFailed(p.id, e.message).catch(() => {});
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-[760px] flex flex-col gap-5">
      <p className="text-[13px] text-muted leading-relaxed max-w-[560px]">
        Actions a Claude chat has proposed for the farm. Approve one and
        the app creates it for real; reject to discard. Nothing here
        changes your data until you approve it.
      </p>

      <div className="flex items-center gap-1 border-b border-line">
        <Tab
          active={tab === "pending"}
          onClick={() => setTab("pending")}
          label={`Pending · ${proposals.pending.length}`}
        />
        <Tab
          active={tab === "history"}
          onClick={() => setTab("history")}
          label={`History · ${proposals.history.length}`}
        />
      </div>

      {proposals.loading ? (
        <div className="text-[12px] text-dim italic">Loading…</div>
      ) : tab === "pending" ? (
        proposals.pending.length === 0 ? (
          <EmptyState>
            No proposals waiting. When you ask a Claude chat (with the
            nff-dashboard tools connected) to create a project, it lands
            here for your approval.
          </EmptyState>
        ) : (
          <ol className="m-0 p-0 list-none flex flex-col gap-2">
            {proposals.pending.map((p) => (
              <li key={p.id}>
                <ProposalCard
                  p={p}
                  busy={busy === p.id}
                  onApprove={() => approve(p)}
                  onReject={() => proposals.reject(p.id).catch(() => {})}
                />
              </li>
            ))}
          </ol>
        )
      ) : proposals.history.length === 0 ? (
        <EmptyState>Nothing reviewed yet.</EmptyState>
      ) : (
        <ol className="m-0 p-0 list-none flex flex-col gap-2">
          {proposals.history.map((p) => (
            <li key={p.id}>
              <HistoryCard
                p={p}
                onRetry={() => proposals.retry(p.id).catch(() => {})}
              />
            </li>
          ))}
        </ol>
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

function EmptyState({ children }) {
  return (
    <div className="border border-line px-6 py-10 text-center">
      <div className="text-[13px] text-muted leading-relaxed max-w-[440px] mx-auto">
        {children}
      </div>
    </div>
  );
}

// Header shared by pending + history cards: kind icon, title, "from
// Claude" attribution, and creation time.
function CardHead({ p }) {
  const meta = KIND_META[p.kind] ?? { icon: Bot, label: p.kind };
  const KindIcon = meta.icon;
  return (
    <div className="flex items-start gap-2.5">
      <span className="shrink-0 text-accent pt-0.5" title={meta.label}>
        <KindIcon size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-fg leading-snug break-words">
          {p.title}
        </div>
        <div className="text-[10px] text-faint mt-1 uppercase tracking-[0.12em] flex items-center gap-1.5">
          <Bot size={11} /> {meta.label} · proposed {formatRelative(p.createdAt)}
        </div>
      </div>
    </div>
  );
}

// The payload preview — description, "why", and any proposed steps.
function ProjectBody({ p }) {
  const steps = Array.isArray(p.payload.steps) ? p.payload.steps : [];
  return (
    <div className="flex flex-col gap-2.5 pl-[26px]">
      {p.payload.description && (
        <div className="text-[13px] text-fg leading-relaxed break-words">
          {p.payload.description}
        </div>
      )}
      {steps.length > 0 && (
        <div>
          <div className="font-ui text-[10px] uppercase tracking-[0.16em] font-semibold text-muted mb-1">
            {steps.length} step{steps.length === 1 ? "" : "s"}
          </div>
          <ol className="m-0 pl-4 flex flex-col gap-0.5 list-decimal">
            {steps.map((s, i) => (
              <li key={i} className="text-[12.5px] text-dim leading-snug">
                {typeof s === "string" ? s : s?.title}
              </li>
            ))}
          </ol>
        </div>
      )}
      {p.summary && (
        <div className="text-[12px] text-muted italic leading-relaxed border-l-2 border-line pl-2.5">
          {p.summary}
        </div>
      )}
    </div>
  );
}

function ProposalCard({ p, busy, onApprove, onReject }) {
  return (
    <div className="border border-line border-l-2 border-l-accent px-4 py-3.5 flex flex-col gap-3">
      <CardHead p={p} />
      {p.kind === "project" ? (
        <ProjectBody p={p} />
      ) : (
        <div className="pl-[26px] text-[12px] text-muted italic">
          {KIND_META[p.kind]?.label ?? p.kind} proposals aren't
          approvable in-app yet.
        </div>
      )}
      <div className="flex items-center gap-2 pl-[26px] pt-0.5">
        <button
          onClick={onApprove}
          disabled={busy}
          className={
            "inline-flex items-center gap-1.5 text-[12px] font-semibold " +
            "px-3 py-1.5 border-0 cursor-pointer bg-accent text-on-accent " +
            "hover:opacity-90 disabled:opacity-50 disabled:cursor-wait"
          }
        >
          <Check size={14} /> {busy ? "Creating…" : "Approve & create"}
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          className={
            "inline-flex items-center gap-1.5 text-[12px] font-semibold " +
            "px-3 py-1.5 border border-line bg-transparent cursor-pointer " +
            "text-muted hover:text-fg disabled:opacity-50"
          }
        >
          <X size={14} /> Reject
        </button>
      </div>
    </div>
  );
}

function HistoryCard({ p, onRetry }) {
  const projectId = p.appliedRef?.project_id;
  return (
    <div className="border border-line px-4 py-3 flex flex-col gap-2 opacity-95">
      <CardHead p={p} />
      <div className="pl-[26px] flex items-center gap-2 flex-wrap">
        <StatusPill status={p.status} />
        {p.status === "applied" && projectId && (
          <button
            onClick={() => navigate(pathForProject(projectId))}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent bg-transparent border-0 cursor-pointer hover:underline p-0"
          >
            Open project <ArrowUpRight size={12} />
          </button>
        )}
        {p.status === "failed" && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted bg-transparent border-0 cursor-pointer hover:text-fg p-0"
          >
            <RotateCcw size={12} /> Retry
          </button>
        )}
      </div>
      {p.status === "failed" && p.error && (
        <div className="pl-[26px] text-[11px] text-warn leading-snug break-words">
          {p.error}
        </div>
      )}
      {p.status === "rejected" && p.reviewNote && (
        <div className="pl-[26px] text-[11px] text-muted italic">
          “{p.reviewNote}”
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    applied: { label: "Applied", cls: "text-resolved" },
    rejected: { label: "Rejected", cls: "text-muted" },
    failed: { label: "Failed", cls: "text-warn" },
  };
  const s = map[status] ?? { label: status, cls: "text-muted" };
  return (
    <span
      className={
        "font-ui text-[10px] uppercase tracking-[0.14em] font-semibold " +
        s.cls
      }
    >
      {s.label}
    </span>
  );
}

function formatRelative(iso) {
  const t = new Date(iso).getTime();
  const dt = Date.now() - t;
  const m = Math.floor(dt / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
