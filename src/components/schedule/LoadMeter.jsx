// LoadMeter — the Rethinker's signature primitive. A person's slice of a
// block drawn as a fill on a fixed-capacity track: read length = "how
// heavy", stack two lanes (Jim / James) = "who's slammed when". Pure
// presentational; the per-person load model feeds it `lanes`.
//
//   lanes: [{ name, meta, metaFaint?, segments: [{ kind, pct }] }]
//   segment kinds:
//     done       solid resolved        — ticked
//     committed  solid accent-deep     — locked work (a "must")
//     open       hatched accent        — discretionary (a pulled-in "should")
//     event      hatched celadon       — an event reservation owning the lane
//     hole       amber dashed outline  — assigned but the person's off-site
//
// Ported from examples/schedule/mockups/rethinker.html. Colors are the
// dark-theme literals for now (we're matching the dark mockup first); the
// light-theme variants come when we target light.

const HATCH_ACCENT =
  "repeating-linear-gradient(45deg,"
  + "rgba(173,200,173,0.55) 0 3px,rgba(173,200,173,0.16) 3px 7px)";
const HATCH_EVENT =
  "repeating-linear-gradient(45deg,var(--c-cat-fm) 0 7px,#4cc278 7px 9px)";
const HATCH_HOLE =
  "repeating-linear-gradient(45deg,"
  + "rgba(230,184,90,0.18) 0 4px,transparent 4px 8px)";

function segStyle(kind) {
  switch (kind) {
    case "done":      return { background: "var(--c-resolved)" };
    case "committed": return { background: "var(--c-accent-deep)" };
    case "open":      return { background: HATCH_ACCENT };
    case "event":     return { background: HATCH_EVENT };
    case "hole":
      return {
        boxShadow: "inset 0 0 0 1.5px var(--c-warn)",
        backgroundImage: HATCH_HOLE,
      };
    default:          return {};
  }
}

// A single track (no name/meta) — reused by the lane and anywhere a bare
// load bar is wanted (the day silhouette, the week mini-spines).
export function LoadTrack({ segments, height = 13, className = "" }) {
  return (
    <div
      className={"relative flex overflow-hidden bg-surface-alt " + className}
      style={{ height, boxShadow: "inset 0 0 0 1px #2a322a" }}
    >
      {segments.map((seg, i) => (
        <div
          key={i}
          className="h-full motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: seg.pct + "%", ...segStyle(seg.kind) }}
        />
      ))}
    </div>
  );
}

export default function LoadMeter({ lanes }) {
  return (
    <div className="flex flex-col gap-1">
      {lanes.map((lane, i) => (
        <div key={lane.name ?? i} className="flex items-center gap-2">
          <span className="w-[42px] shrink-0 font-ui text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
            {lane.name}
          </span>
          <LoadTrack segments={lane.segments} className="flex-1" />
          <span
            className={
              "shrink-0 min-w-[30px] text-right font-ui text-[11px] font-semibold "
              + (lane.metaFaint ? "text-faint" : "text-dim")
            }
          >
            {lane.meta}
          </span>
        </div>
      ))}
    </div>
  );
}
