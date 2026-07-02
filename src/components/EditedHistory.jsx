import { ChevronRight } from "lucide-react";

// The viewable modification history of a scheduled instance (S74). Renders
// the append-only log [{at, by, summary}] as a compact, full-width list
// beneath its row — so "what changed and when" is diagnosable from a
// written record. Newest first.
export default function EditedHistory({ history }) {
  const entries = [...(history ?? [])].reverse();
  if (entries.length === 0) return null;
  return (
    <ul className="basis-full w-full mt-1 ml-10 border-l border-line pl-3 flex flex-col gap-1">
      {entries.map((e, i) => (
        <li key={i} className="text-[11px] text-dim leading-snug">
          <span className="text-fg">{e.summary}</span>
          <span className="text-faint">
            {" — "}{fmt(e.at)}{e.by ? ` · ${shortWho(e.by)}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

// The "edited" affordance on a rescheduled row (42.3 round 4): a colored
// semibold tag whose trailing chevron points right closed and rotates to
// point down while the history is open (140ms, the app's motion beat).
// Text sits vertically centered; hover/press tints the tag (row-active —
// row-hover's 9% is imperceptible on white). Shared by ChoreCheckRow and
// AdHocRow so a moved chore and a moved task read identically.
export function EditedTag({ open, onToggle, className = "" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={
        "shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold "
        + "uppercase tracking-wide text-accent px-1 py-0.5 cursor-pointer "
        + "transition-colors hover:bg-row-active active:bg-row-active "
        + className
      }
    >
      edited
      <ChevronRight
        size={11}
        className={
          "transition-transform duration-[140ms] ease-out "
          + (open ? "rotate-90" : "")
        }
      />
    </button>
  );
}

// "HH:MM" (24h, the stored clock_time) -> "3:30 PM" — the 12-hour clock a
// rescheduled row displays (round 4; the raw 24h string read as data, not
// a time of day). Minutes are dropped on the hour ("3 PM").
export function fmtClock12(hm) {
  if (!hm || typeof hm !== "string") return null;
  const [h, m] = hm.split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return (m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`)
    + " " + period;
}

function fmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// "james.boynton0+claude@gmail.com" -> "James". Keeps the log readable
// without leaking the full address; first name capitalized (round 4).
function shortWho(email) {
  const name = String(email).split("@")[0].split("+")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}
