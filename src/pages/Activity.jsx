import { useActivityLog } from "../lib/data/useActivityLog.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import ActivityRow from "../components/ActivityRow.jsx";

// Full activity log. Mirrors the Activity card on the Dashboard but without
// the row cap. The data source is the live activity_log table — every chore
// check / batch assignment lands here through DB triggers, with realtime
// pushes so the page updates as work is logged in another tab.

export default function Activity() {
  const { entries, loading, edit, remove } = useActivityLog();
  const userEmail = useCurrentUserEmail();

  if (loading) {
    return (
      <div className="border border-line py-9 px-6 text-center">
        <div className="text-xs text-muted uppercase tracking-[0.18em]">
          Loading activity…
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="border border-line py-9 px-6 text-center">
        <div className="text-[13px] text-muted mb-2 font-medium">No activity logged yet</div>
        <div className="text-[12px] text-faint leading-relaxed max-w-[520px] mx-auto">
          Once chores start being checked off, every completion (and the person who did it) will land here, alongside other log entries — temperature readings, weight logs, sales, and more.
        </div>
      </div>
    );
  }

  return (
    <ol className="m-0 p-0 list-none flex flex-col gap-px bg-line">
      {entries.map((entry) => (
        <ActivityRow
          key={entry.id}
          entry={entry}
          ownerEmail={userEmail}
          onEdit={edit}
          onDelete={remove}
          renderTime={renderTimeStacked}
          wrapperClass="bg-surface px-4 py-3 items-baseline"
        />
      ))}
    </ol>
  );
}

// Stacked "Mon May 5 / 10:14 AM" time renderer for the full Activity page.
function renderTimeStacked(logTime) {
  const dt = new Date(logTime);
  return (
    <div className="min-w-[140px]">
      <div>
        {dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      </div>
      <div className="text-faint mt-px">
        {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </div>
    </div>
  );
}
