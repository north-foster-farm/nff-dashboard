// The Rethinker desktop two-lane time ribbon (DESIGN-SYSTEM §3 / Phase 3),
// data-driven off the per-person load model (lib/schedule/personLoad.js).
// A horizontal hour axis with one lane per admin; each lane's segments are
// absolutely positioned by their start/end minutes. A green now-line marks
// the wall clock. Presentational — all state comes in via props.

const HATCH_EVENT =
  "repeating-linear-gradient(45deg,var(--c-cat-fm) 0 7px," +
  "color-mix(in srgb, var(--c-cat-fm) 70%, transparent) 7px 9px)";
const HATCH_BREAK =
  "repeating-linear-gradient(45deg,var(--c-line) 0 4px,transparent 4px 8px)";
const HATCH_HOLE =
  "repeating-linear-gradient(45deg," +
  "color-mix(in srgb, var(--c-warn) 22%, transparent) 0 4px,transparent 4px 8px)";

function segStyle(kind) {
  switch (kind) {
    case "done": return { background: "var(--c-resolved)" };
    case "committed": return { background: "var(--c-accent-deep)" };
    case "event": return { background: HATCH_EVENT };
    case "break": return { background: HATCH_BREAK };
    case "hole":
      return {
        boxShadow: "inset 0 0 0 1.5px var(--c-warn)",
        backgroundImage: HATCH_HOLE,
      };
    default: return {};
  }
}

// 6*60 -> "6a", 13*60 -> "1p", 12*60 -> "12p", 0 -> "12a".
function fmtHour(min) {
  const h = Math.floor(min / 60) % 24;
  const ap = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ap;
}
function fmtClock(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ap = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ":" + String(m).padStart(2, "0") + ap;
}

function Lane({ name, badge, segments, span, axisStart }) {
  const pct = (v) => ((v - axisStart) / span) * 100;
  return (
    <div className="flex items-stretch gap-3">
      <div className="w-16 shrink-0 flex items-center font-ui text-[12px] font-semibold text-dim">
        {name}
        {badge && <span className="ml-1.5 text-[10px] text-cat-fm">{badge}</span>}
      </div>
      <div className="relative flex-1 h-11 border border-line bg-surface-alt/40">
        {segments.map((s) => {
          const left = pct(s.startMin);
          const width = Math.max(pct(s.endMin) - left, 2.5);
          const tone = s.kind === "event" || s.kind === "done"
            ? "text-[#0d1410]" : s.kind === "hole" ? "text-warn"
            : s.kind === "break" ? "text-faint" : "text-on-accent";
          return (
            <div
              key={s.id}
              className={"absolute top-1 bottom-1 flex flex-col justify-center px-1.5 overflow-hidden font-ui " + tone}
              style={{ left: left + "%", width: width + "%", ...segStyle(s.kind) }}
              title={s.label + (s.meta ? " · " + s.meta : "")}
            >
              <span className="text-[10.5px] font-semibold leading-tight truncate">
                {s.label}
              </span>
              {s.meta && (
                <span className="text-[9px] opacity-80 leading-tight">{s.meta}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DayRibbon({ lanes, axisStart, axisEnd, nowMin, silhouette }) {
  const span = Math.max(axisEnd - axisStart, 60);
  const hours = [];
  for (let m = axisStart; m <= axisEnd; m += 60) hours.push(m);
  const showNow = nowMin != null && nowMin >= axisStart && nowMin <= axisEnd;
  const nowLeft = ((nowMin - axisStart) / span) * 100;

  const hasAny = (lanes ?? []).some((l) => l.segments.length > 0);

  return (
    <div className="hidden lg:block border border-line bg-bg mb-4">
      <div className="px-5 pt-4 pb-1">
        <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Day load · who's on what
        </span>
      </div>
      {/* hour axis */}
      <div className="px-5 pt-2 pb-1">
        <div
          className="grid text-[10px] font-ui text-faint border-b border-line pb-1 [font-variant-numeric:tabular-nums]"
          style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}
        >
          {hours.map((m) => <span key={m}>{fmtHour(m)}</span>)}
        </div>
      </div>
      {/* lanes */}
      <div className="px-5 pb-4 pt-1 flex flex-col gap-2 relative">
        {showNow && (
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              left: `calc(${64 + 12}px + (100% - ${64 + 12}px) * ${nowLeft / 100})`,
              top: 2, bottom: 8, width: 1.5, background: "var(--c-resolved)",
            }}
          >
            <span
              className="absolute font-ui text-[9px] font-bold tracking-[0.06em] text-resolved whitespace-nowrap"
              style={{ top: -14, left: -22 }}
            >
              NOW {fmtClock(nowMin)}
            </span>
          </div>
        )}
        {(lanes ?? []).map((l) => (
          <Lane
            key={l.name}
            name={l.name}
            segments={l.segments}
            span={span}
            axisStart={axisStart}
          />
        ))}
        {!hasAny && (
          <div className="font-ui text-[11px] text-faint px-1 pt-1">
            No one is assigned named work yet today — assign chores or add
            time off to see the lanes fill.
          </div>
        )}
      </div>

      {/* combined day silhouette — the whole day's load as one bar per
          block (height = item count), colored by completion / man-down. */}
      {silhouette && silhouette.bars.length > 0 && (
        <div className="px-5 pb-4">
          <span className="block mb-1.5 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
            Day load — combined silhouette
          </span>
          <div className="flex items-end gap-0.5 h-10 border-b border-line">
            {silhouette.bars.map((b) => (
              <div
                key={b.key}
                className="flex-1"
                title={b.name + " · " + b.load}
                style={{
                  height: Math.max(8, (b.load / silhouette.max) * 100) + "%",
                  ...segStyle(b.state),
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
