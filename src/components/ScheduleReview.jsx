import { TrendingUp, TrendingDown, Minus, CalendarCheck } from "lucide-react";
import { formatMinutesOfDay } from "../lib/sunTimes.js";

// The Schedule's "Review" zoom (S11 / Epic L — looking back). Two reads, both
// framed for LEARNING the routine, not grading anyone (S120): routine drift
// (are chore blocks creeping later?) and per-day plan-vs-actual (did the
// agreed shape hold?). Data is derived in lookBack.js from the commitments
// exec history + confirmed-day captures.

// A drift delta in minutes -> { label, tone, Icon }. Within ±5 min reads as
// "steady" — we don't want noise from normal day-to-day variation.
function driftRead(deltaMin) {
  if (deltaMin == null) return { label: "new", tone: "faint", Icon: Minus };
  if (deltaMin > 5) {
    return { label: `${deltaMin}m later`, tone: "warn", Icon: TrendingUp };
  }
  if (deltaMin < -5) {
    return {
      label: `${-deltaMin}m earlier`, tone: "resolved", Icon: TrendingDown,
    };
  }
  return { label: "steady", tone: "faint", Icon: Minus };
}

function dayLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export function ScheduleReview({ drift, reviews, splitDays }) {
  return (
    <div className="mt-3 lg:mt-0 space-y-6">
      {/* Routine drift — are chores creeping later? (S117) */}
      <section className="border border-line">
        <div className="px-4 py-2.5 border-b border-line bg-surface-alt">
          <div className="text-[10px] font-ui font-semibold uppercase tracking-[0.16em] text-faint">
            Routine drift
          </div>
          <div className="text-[11px] text-dim mt-0.5">
            Average start, last {splitDays} days vs before.
          </div>
        </div>
        {drift.length === 0 ? (
          <div className="px-4 py-6 text-center text-dim text-[13px]">
            Not enough run history yet.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {drift.map((b) => {
              const r = driftRead(b.deltaMin);
              const toneClass = r.tone === "warn" ? "text-warn"
                : r.tone === "resolved" ? "text-resolved" : "text-faint";
              return (
                <li key={b.blockId}
                  className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 min-w-0 truncate text-[13px] text-fg">
                    {b.name}
                  </span>
                  {b.recentAvg != null && (
                    <span className="shrink-0 text-[13px] text-dim [font-variant-numeric:tabular-nums]">
                      {formatMinutesOfDay(b.recentAvg)}
                    </span>
                  )}
                  <span className={
                    "shrink-0 inline-flex items-center gap-1 text-[12px] font-medium "
                    + "[font-variant-numeric:tabular-nums] " + toneClass
                  }>
                    <r.Icon size={14} />
                    {r.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Per-day plan vs actual — did the shape hold? (S116/S91/S119) */}
      <section className="border border-line">
        <div className="px-4 py-2.5 border-b border-line bg-surface-alt">
          <div className="text-[10px] font-ui font-semibold uppercase tracking-[0.16em] text-faint">
            Recent days — planned vs ran
          </div>
        </div>
        {reviews.length === 0 ? (
          <div className="px-4 py-6 text-center text-dim text-[13px]">
            No confirmed days yet. Confirm a day to start the record.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {reviews.map((d) => {
              const held = d.plannedBlocks > 0 && d.ranBlocks >= d.plannedBlocks;
              return (
                <li key={d.date}
                  className="flex items-center gap-3 px-4 py-3">
                  <CalendarCheck size={15}
                    className={"shrink-0 " + (held ? "text-resolved" : "text-faint")} />
                  <span className="flex-1 min-w-0 truncate text-[13px] text-fg">
                    {dayLabel(d.date)}
                  </span>
                  <span className="shrink-0 text-[12px] text-dim [font-variant-numeric:tabular-nums]">
                    {d.ranBlocks}/{d.plannedBlocks} blocks
                  </span>
                  <span className="shrink-0 w-16 text-right text-[11px] text-faint [font-variant-numeric:tabular-nums]">
                    {d.plannedEntries} items
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
