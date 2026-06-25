// Desktop-only Schedule sidebars (S9). The day-rail spine pins the whole
// day's shape beside the accordion; the week list shows seven days as
// fullness silhouettes (bar height = item count). Both are hidden on phone
// (the accordion is the whole surface there) and appear at lg+.

// Scale an item count to a bar size in px, between min and max.
function barSize(count, max, min, span) {
  if (!count) return min;
  return Math.round(min + (count / Math.max(1, max)) * span);
}

// The thin left spine: one bar per block, tallest = heaviest, warn-tinted
// when the block has a man-down, accent for the block "now" is in.
export function DayRailSpine({ blocks, nowBucket }) {
  const max = blocks.reduce((m, b) => Math.max(m, b.count), 1);
  return (
    <div className="hidden lg:flex flex-col items-center gap-1 border-r border-line py-5 px-2 bg-surface">
      <div className="text-[9px] font-ui uppercase tracking-[0.14em] text-faint mb-1">
        Day
      </div>
      {blocks.map((b) => (
        <div
          key={b.bucket}
          title={`${b.name} · ${b.count}`}
          style={{ height: barSize(b.count, max, 6, 34) + "px" }}
          className={
            "w-7 rounded-sm " +
            (b.hasManDown ? "bg-warn"
              : b.bucket === nowBucket ? "bg-accent"
              : b.allDone ? "bg-resolved/40" : "bg-line")
          }
        />
      ))}
    </div>
  );
}

// The right week list: a day-list of silhouettes (not a 7-column grid).
export function WeekList({ week, todayISO, ymd, onPickDay }) {
  return (
    <div className="hidden lg:block border-l border-line py-5 px-4 bg-surface w-[300px]">
      <div className="text-[10px] font-ui font-semibold uppercase tracking-[0.16em] text-faint mb-4">
        This week
      </div>
      <div className="flex flex-col gap-1">
        {week.days.map((day) => {
          const iso = ymd(day.date);
          const isToday = iso === todayISO;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPickDay?.(day.date)}
              className={
                "w-full flex items-center gap-3 px-2 py-2 text-left rounded-sm " +
                (isToday ? "bg-row-active" : "hover:bg-row-hover")
              }
            >
              <span className={
                "w-12 shrink-0 text-[12px] [font-variant-numeric:tabular-nums] " +
                (isToday ? "font-semibold text-fg" : "text-dim")
              }>
                {day.date.toLocaleDateString("en-US", {
                  weekday: "short",
                }).slice(0, 3)}{" "}
                {day.date.getDate()}
              </span>
              <span className="flex-1 flex items-end gap-1 h-7">
                {day.blocks.map((b) => (
                  <span
                    key={b.bucket}
                    title={`${b.name} · ${b.count}`}
                    style={{ height: barSize(b.count, week.max, 3, 25) + "px" }}
                    className={
                      "flex-1 min-w-[3px] rounded-sm " +
                      (b.count ? "bg-accent/70" : "bg-line")
                    }
                  />
                ))}
              </span>
              <span className="w-6 shrink-0 text-right text-[11px] text-faint [font-variant-numeric:tabular-nums]">
                {day.total}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 pt-4 border-t border-line text-[11px] text-faint font-ui">
        Taller bar = heavier block. Tap a day to open it.
      </div>
    </div>
  );
}
