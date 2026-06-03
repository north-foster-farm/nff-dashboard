import { StatusPill } from "../components/ui.jsx";

// Threads — open questions + their resolutions (Batch 39: migrated off
// inline styles + the dead primitives.jsx to Tailwind tokens).
export default function Threads({ data }) {
  const open = data.threads.filter(t => t.status === "open");
  const resolved = data.threads.filter(t => t.status === "resolved");
  return (
    <div>
      <Subsection title={`Open · ${open.length}`}>
        <div className="flex flex-col gap-px bg-line mb-7">
          {open.map(t => <ThreadRow key={t.id} thread={t} />)}
        </div>
      </Subsection>
      <Subsection title={`Resolved · ${resolved.length}`}>
        <div className="flex flex-col gap-px bg-line">
          {resolved.map(t => <ThreadRow key={t.id} thread={t} />)}
        </div>
      </Subsection>
    </div>
  );
}

function Subsection({ title, children }) {
  return (
    <div className="mt-5">
      <div className="text-[10px] text-dim uppercase tracking-[0.12em] mb-2.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function ThreadRow({ thread }) {
  const isResolved = thread.status === "resolved";
  return (
    <div className="bg-surface px-[22px] py-[18px]">
      <div className="flex justify-between items-baseline mb-2 gap-3">
        <div className="font-heading text-[16px] font-semibold text-fg">
          {thread.title}
        </div>
        <StatusPill tone={isResolved ? "resolved" : "warn"} className="shrink-0">
          {thread.status}
        </StatusPill>
      </div>
      <p className={
        "text-[12px] text-dim leading-[1.7] m-0 " +
        (isResolved || thread.notes ? "mb-2.5" : "")
      }>
        {thread.question}
      </p>
      {thread.notes && (
        <div className="text-[12px] text-muted leading-[1.7] pt-2.5 border-t border-surface-alt italic">
          {thread.notes}
        </div>
      )}
      {isResolved && thread.resolution && (
        <div className="text-[12px] text-fg leading-[1.7] pt-2.5 border-t border-surface-alt">
          <span className="text-[10px] text-resolved uppercase tracking-[0.12em] mr-2">
            →
          </span>
          {thread.resolution}
        </div>
      )}
    </div>
  );
}
