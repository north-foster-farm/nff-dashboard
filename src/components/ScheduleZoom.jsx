import { Check, Ban } from "lucide-react";
import { blockIcon } from "./BlockBadge.jsx";
import { formatMinutesOfDay } from "../lib/sunTimes.js";

// Schedule zoom views (S9 tail — "one timeline, three zooms"). The Day tab is
// the master-detail surface in Schedule.jsx; these are the wider two. Both are
// NAVIGATORS first: every day (and, in Week, every block) is a button that
// snaps the surface back to the Day zoom on that target. They read the same
// cheap chore fan-out the silhouette sidebar uses (item counts, no durations),
// plus a confirmed-day stamp pulled in a single range query.
//
// Markers match the rest of the feature: today = ring, the viewed day = fill.

const compactTime = (min) =>
  min == null ? "" : formatMinutesOfDay(min).replace(":00", "");

// Shared day-cell chrome class: ring for today, fill for the viewed day.
function dayChrome(isToday, isSel) {
  return (isSel ? "bg-row-active " : "hover:bg-row-hover ")
    + (isToday ? "border-resolved" : "border-line");
}

// ── Week zoom: seven day columns, each listing its blocks ───────────────
// A person's reserved non-work time, compactly: "James off" / "Jim 1–4p".
function reservationChip(w) {
  if (w.kind === "day_off") return `${w.assignee} off`;
  const range = `${compactTime(w.startMin)}–${compactTime(w.endMin)}`;
  return `${w.assignee} ${range}`;
}

export function WeekView({
  week, todayISO, selectedISO, confirmedDays, reservations, ymd,
  onPickDay, onPickBlock,
}) {
  return (
    <div className="mt-3 lg:mt-0 grid grid-cols-7 gap-px bg-line border border-line">
      {week.days.map((day) => {
        const iso = ymd(day.date);
        const isToday = iso === todayISO;
        const isSel = iso === selectedISO;
        const confirmed = confirmedDays.has(iso);
        const dayRes = reservations?.get(iso) ?? [];
        return (
          <div key={iso} className="flex flex-col bg-surface min-h-[160px]">
            <button
              type="button"
              onClick={() => onPickDay(day.date)}
              className={
                "flex items-center gap-1.5 px-2 py-1.5 text-left border-b "
                + "cursor-pointer transition-colors " + dayChrome(isToday, isSel)
              }
            >
              <span className="flex-1 min-w-0 leading-tight">
                <span className="block eyebrow text-[9px] text-faint">
                  {day.date.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className={
                  "block text-[15px] [font-variant-numeric:tabular-nums] "
                  + (isSel ? "font-semibold text-fg" : "text-fg")
                }>
                  {day.date.getDate()}
                </span>
              </span>
              {confirmed && (
                <Check size={13} strokeWidth={3}
                  className="shrink-0 text-resolved" title="Confirmed" />
              )}
            </button>

            <div className="flex-1 flex flex-col">
              {day.blocks.length === 0 ? (
                <span className="px-2 py-3 text-[11px] text-faint">Clear</span>
              ) : day.blocks.map((b) => {
                const Icon = blockIcon(b.block);
                return (
                  <button
                    key={b.bucket}
                    type="button"
                    onClick={() => onPickBlock(day.date, b.bucket)}
                    title={`${b.name} · ${b.count} · ${compactTime(b.startMin)}`}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-left border-b border-line/60 hover:bg-row-hover cursor-pointer"
                  >
                    <Icon size={12} className="shrink-0 text-faint" />
                    <span className="flex-1 min-w-0 truncate text-[11.5px] text-fg">
                      {b.name}
                    </span>
                    <span className="shrink-0 text-[10.5px] text-dim [font-variant-numeric:tabular-nums]">
                      {b.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {dayRes.length > 0 && (
              <ul className="px-2 py-1 border-t border-line/60 flex flex-col gap-0.5">
                {dayRes.map((w) => (
                  <li key={w.id}
                    className="flex items-center gap-1 text-[10px] text-faint">
                    <Ban size={9} className="shrink-0" />
                    <span className="truncate">{reservationChip(w)}</span>
                  </li>
                ))}
              </ul>
            )}

            {day.total > 0 && (
              <div className="px-2 py-1 text-right text-[10px] text-faint [font-variant-numeric:tabular-nums] border-t border-line">
                {day.total} total
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const WEEKDAY_HEADS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Month zoom: a calendar grid, each cell a day with its load ──────────
export function MonthView({
  month, todayISO, selectedISO, confirmedDays, ymd, onPickDay,
}) {
  return (
    <div className="mt-3 lg:mt-0 border border-line">
      <div className="grid grid-cols-7 border-b border-line bg-surface-alt">
        {WEEKDAY_HEADS.map((d) => (
          <div key={d}
            className="px-2 py-1.5 text-center eyebrow text-[9px] text-faint">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {month.weeks.flat().map((cell) => {
          const iso = ymd(cell.date);
          const isToday = iso === todayISO;
          const isSel = iso === selectedISO;
          const confirmed = confirmedDays.has(iso);
          // Load intensity: a faint accent wash scaled by the day's count.
          const intensity = cell.total
            ? 0.12 + 0.5 * (cell.total / month.max) : 0;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPickDay(cell.date)}
              className={
                "relative min-h-[76px] px-2 py-1.5 text-left border-r border-b "
                + "border-line cursor-pointer transition-colors flex flex-col "
                + (isSel ? "bg-row-active " : "hover:bg-row-hover ")
                + (cell.inMonth ? "" : "opacity-40")
              }
            >
              <span className="flex items-center gap-1">
                <span className={
                  "inline-flex items-center justify-center w-6 h-6 text-[12px] "
                  + "[font-variant-numeric:tabular-nums] "
                  + (isToday
                    ? "rounded-full border border-resolved text-resolved font-semibold"
                    : isSel ? "font-semibold text-fg" : "text-dim")
                }>
                  {cell.date.getDate()}
                </span>
                {confirmed && (
                  <Check size={12} strokeWidth={3}
                    className="shrink-0 text-resolved" title="Confirmed" />
                )}
              </span>
              {cell.total > 0 && (
                <span className="mt-auto flex items-center gap-1.5">
                  <span className="flex-1 h-1.5"
                    style={{
                      background: `color-mix(in srgb, var(--accent) ${Math.round(
                        intensity * 100)}%, transparent)`,
                    }} />
                  <span className="text-[10.5px] text-faint [font-variant-numeric:tabular-nums]">
                    {cell.total}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
