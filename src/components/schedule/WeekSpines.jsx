// Week mini-spines (Rethinker §3 / DESIGN-SYSTEM Phase 3). The week read
// as seven little load silhouettes — per day, a vertical stack of its
// blocks' item counts (height = load), so the week's shape is one glance.
// Data-driven off weekFullness(): { days:[{date, blocks:[{bucket,name,
// count}], total}], max }. Days are clickable (openDay). Presentational —
// all state in via props. lg-only via the caller's wrapper.

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// should-heat cell colour: cool stays surface-alt, a should warms through
// warn (15→60% alpha), and the deadline day burns cat-processing.
function heatColor(heat, peak) {
  if (peak) return "var(--c-cat-processing)";
  if (!heat || heat <= 0) return "var(--c-surface-alt)";
  const pct = Math.round(15 + heat * 45);
  return `color-mix(in srgb, var(--c-warn) ${pct}%, transparent)`;
}

function Spine({ day, max, isToday, isSelected, onPick }) {
  const blocks = (day.blocks ?? []).filter((b) => b.count > 0);
  const label = DOW[day.date.getDay()] + " " + day.date.getDate();
  const frame = isSelected
    ? "border-resolved"
    : isToday ? "border-resolved/50" : "border-line";
  return (
    <button
      type="button"
      onClick={() => onPick?.(day.date)}
      className="flex flex-col items-center gap-1 group cursor-pointer"
      title={label + " · " + day.total + " items"}
    >
      <span className={"font-ui text-[11px] "
        + (isSelected ? "text-resolved font-bold"
          : isToday ? "text-resolved" : "text-dim")}>
        {label}
      </span>
      <div className={"w-full flex items-end justify-center gap-px h-16 border py-1.5 "
        + frame + (isSelected ? " border-2" : "")}
        style={{ background: "color-mix(in srgb, var(--c-surface) 35%, transparent)" }}>
        {blocks.length === 0 ? (
          <span className="self-center text-[10px] text-faint">—</span>
        ) : blocks.map((b) => (
          <div
            key={b.bucket}
            className="w-[7px]"
            title={b.name + " · " + b.count}
            style={{
              height: Math.max(6, (b.count / max) * 100) + "%",
              background: "var(--c-accent-deep)",
            }}
          />
        ))}
      </div>
      <span className={"font-ui text-[10px] [font-variant-numeric:tabular-nums] "
        + (isToday || isSelected ? "text-dim" : "text-faint")}>
        {day.total}
      </span>
    </button>
  );
}

export default function WeekSpines({
  week, shouldHeat, todayISO, selectedISO, ymd, onPickDay,
}) {
  if (!week?.days?.length) return null;
  const top = shouldHeat?.top;
  const towardLabel = shouldHeat?.peakDate
    ? "warming toward " + DOW[shouldHeat.peakDate.getDay()]
      + " " + shouldHeat.peakDate.getDate()
    : "warming";
  return (
    <div className="hidden lg:block border border-line bg-bg mb-4 px-5 py-4">
      <span className="block mb-3 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
        This week — fullness spines{top ? " + should-heat" : ""}
      </span>
      <div className="grid grid-cols-7 gap-2">
        {week.days.map((day) => {
          const iso = ymd(day.date);
          return (
            <Spine
              key={iso}
              day={day}
              max={week.max}
              isToday={iso === todayISO}
              isSelected={iso === selectedISO}
              onPick={onPickDay}
            />
          );
        })}
      </div>

      {/* should-escalation heat row — only when something is actually
          warming toward a deadline this week. */}
      {top && (
        <div className="mt-4">
          <span className="block mb-1.5 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
            Should-escalation · “{top.title}” {towardLabel}
          </span>
          <div className="grid grid-cols-7 gap-2">
            {(shouldHeat.days ?? []).map((d) => (
              <div
                key={ymd(d.date)}
                className="h-2.5"
                title={DOW[d.date.getDay()] + " " + d.date.getDate()
                  + (d.peak ? " · deadline" : d.heat > 0
                    ? " · " + Math.round(d.heat * 100) + "% warm" : "")}
                style={{ background: heatColor(d.heat, d.peak) }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
