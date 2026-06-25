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

function fmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// "james.boynton0+claude@gmail.com" -> "james". Keeps the log readable
// without leaking the full address.
function shortWho(email) {
  return String(email).split("@")[0].split("+")[0];
}
