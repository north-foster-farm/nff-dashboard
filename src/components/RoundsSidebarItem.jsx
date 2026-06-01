import { ListChecks } from "lucide-react";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useChoreRuns } from "../lib/data/useChoreRuns.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";

// Custom sidebar entry for the Rounds takeover. Stays static-width
// (no live countdown, no elapsed clock) so the row can't overflow.
//
// Three label states:
//   - no active run                              → "Do rounds"
//   - active run, started by the local user     → "Resume rounds"
//   - active run, started by someone else       → "Help with rounds"

export default function RoundsSidebarItem({ onOpen }) {
  const { blocks } = useChoreBlocks();
  const { activeRun } = useChoreRuns({ blocks });
  const myEmail = useCurrentUserEmail();

  let label = "Do rounds";
  let live = false;
  if (activeRun) {
    live = true;
    label = activeRun.startedByEmail && myEmail && activeRun.startedByEmail === myEmail
      ? "Resume rounds"
      : "Help with rounds";
  }

  return (
    <button
      // Don't forward the click event — onOpen's first arg is an
      // optional deep-link blockId (Batch 17).
      onClick={() => onOpen()}
      className={
        "w-full text-left flex items-center gap-2.5 pl-6 pr-4 py-2 " +
        "border-l-2 transition-colors duration-100 cursor-pointer " +
        "bg-transparent hover:bg-row-hover " +
        (live ? "border-l-resolved" : "border-l-transparent")
      }
    >
      <ListChecks
        size={15}
        className={live ? "text-resolved" : "text-muted"}
      />
      <span className={`flex-1 text-[12.5px] truncate ${live ? "text-fg font-semibold" : "text-dim"}`}>
        {label}
      </span>
      {live && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-resolved"
          aria-label="Run in progress"
        />
      )}
    </button>
  );
}
