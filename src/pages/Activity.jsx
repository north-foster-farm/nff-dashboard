import { T } from "../theme.js";
import { useActivityLog } from "../lib/data/useActivityLog.js";

// Full activity log. Mirrors the Activity card on the Dashboard but without
// the row cap and with richer filters once the schema picks up more `kind`
// values. The data source is the live activity_log table — every chore
// check / batch assignment lands here through DB triggers, with realtime
// pushes so the page updates as work is logged in another tab.

export default function Activity() {
  const { entries, loading } = useActivityLog();

  if (loading) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "36px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.18em" }}>
          Loading activity…
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "36px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 8, fontWeight: 500 }}>No activity logged yet</div>
        <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
          Once chores start being checked off, every completion (and the person who did it) will land here, alongside other log entries — temperature readings, weight logs, sales, and more.
        </div>
      </div>
    );
  }
  // useActivityLog already returns rows in reverse-chronological order.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
      {entries.map((l, i) => <LogRow key={l.id ?? i} log={l} />)}
    </div>
  );
}

function LogRow({ log }) {
  const dt = new Date(log.logTime);
  const dateStr = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <div style={{ background: T.surface, padding: "12px 16px", display: "flex", gap: 14, alignItems: "baseline" }}>
      <div style={{ fontVariantNumeric: "tabular-nums", color: T.textDim, fontSize: 11, minWidth: 140, flexShrink: 0 }}>
        <div>{dateStr}</div>
        <div style={{ color: T.textFaint, marginTop: 1 }}>{timeStr}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.text }}>
        <span style={{ color: T.textDim }}>{log.actor}</span> {log.summary ?? log.type ?? "logged an entry"}
      </div>
    </div>
  );
}
