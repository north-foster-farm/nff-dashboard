import { useMemo } from "react";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useRunHistory } from "../lib/data/useRunHistory.js";
import {
  histogramBins, summarizeRuns, runDurationMinutes,
  formatHourLabel, formatDurationMinutes, formatRate,
} from "../lib/runMetrics.js";
import { displayBlockSide } from "../lib/sunTimes.js";

// Performance sub-tab on the Chores page. One card per active block,
// showing run history aggregated over the last 30 days. No per-user
// splits, no predictive nudges, no reason prompts — just data.
//
// Reads chore_runs via useRunHistory. Sun-event blocks resolve their
// nominal window per run-date (so a run from three weeks ago is
// compared against THAT day's sunrise/sunset, not today's).

const HISTORY_DAYS = 30;

export default function ChoresPerformanceTab() {
  const { blocks, loading: blocksLoading } = useChoreBlocks();
  const { runs, loading: runsLoading } = useRunHistory({ days: HISTORY_DAYS });

  const activeBlocks = useMemo(
    () => (blocks ?? [])
      .filter(b => b.isActive)
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [blocks]
  );

  const runsByBlockId = useMemo(() => {
    const out = new Map();
    for (const r of runs ?? []) {
      if (!out.has(r.blockId)) out.set(r.blockId, []);
      out.get(r.blockId).push(r);
    }
    return out;
  }, [runs]);

  if (blocksLoading || runsLoading) {
    return (
      <div className="bg-surface border border-line py-8 text-center text-[12px] text-muted uppercase tracking-[0.16em]">
        Loading performance…
      </div>
    );
  }

  if (activeBlocks.length === 0) {
    return (
      <div className="bg-surface border border-line py-10 px-6 text-center">
        <div className="text-[13px] text-muted font-medium mb-1">
          No active blocks yet
        </div>
        <div className="text-[12px] text-faint leading-relaxed max-w-[420px] mx-auto">
          Add at least one block in the Blocks tab and run a few rounds —
          the data shows up here once history exists.
        </div>
      </div>
    );
  }

  const totalRuns = (runs ?? []).filter(r => r.state === "done").length;

  return (
    <div className="flex flex-col gap-3">
      <PerformanceHeader days={HISTORY_DAYS} totalRuns={totalRuns} />
      {activeBlocks.map(b => (
        <BlockPerformanceCard
          key={b.id}
          block={b}
          runs={runsByBlockId.get(b.id) ?? []}
        />
      ))}
    </div>
  );
}

function PerformanceHeader({ days, totalRuns }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <p className="text-[12px] text-dim m-0 max-w-[560px] leading-relaxed">
        Run history aggregated over the last {days} days. Late-start =
        round started after the block's nominal start time. Overrun =
        round ended after the block's nominal window.
      </p>
      <div className="text-[10px] text-faint uppercase tracking-[0.16em] font-semibold">
        {totalRuns} {totalRuns === 1 ? "run" : "runs"}
      </div>
    </div>
  );
}

function BlockPerformanceCard({ block, runs }) {
  const summary = useMemo(() => summarizeRuns(runs, block), [runs, block]);
  const histogram = useMemo(
    () => histogramBins(runs, block, { binMinutes: 10 }),
    [runs, block]
  );

  if (summary.count === 0) {
    return (
      <section className="bg-surface border border-line p-4">
        <BlockCardHeader block={block} />
        <div className="mt-3 text-[11px] text-faint italic">
          No completed runs in the last {HISTORY_DAYS} days.
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface border border-line p-4 flex flex-col gap-4">
      <BlockCardHeader block={block} count={summary.count} />
      <StatsRow summary={summary} />
      <div>
        <SubLabel>Start times</SubLabel>
        <StartTimeHistogram histogram={histogram} block={block} />
      </div>
      <div>
        <SubLabel>Duration trend</SubLabel>
        <DurationTrend runs={runs} block={block} summary={summary} />
      </div>
    </section>
  );
}

function BlockCardHeader({ block, count }) {
  const window = `${displayBlockSide(block.startKind, block.startMinutes)} ` +
    `· ${formatBlockDuration(block.durationMinutes)}`;
  return (
    <header className="flex items-baseline gap-3 flex-wrap">
      <span className="text-[15px] font-semibold text-fg">{block.name}</span>
      <span className="text-[11px] text-dim">{window}</span>
      {typeof count === "number" && (
        <span className="ml-auto text-[10px] text-faint uppercase tracking-[0.12em] font-semibold">
          {count} {count === 1 ? "run" : "runs"}
        </span>
      )}
    </header>
  );
}

function StatsRow({ summary }) {
  const startDelta = summary.medianStartDelta;
  let startDeltaLabel = "—";
  if (startDelta !== null) {
    const abs = Math.round(Math.abs(startDelta));
    if (abs === 0) startDeltaLabel = "on time";
    else if (startDelta > 0) startDeltaLabel = `+${abs}m late`;
    else startDeltaLabel = `${abs}m early`;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat
        label="Late-start rate"
        value={formatRate(summary.lateRate)}
      />
      <Stat
        label="Overrun rate"
        value={formatRate(summary.overrunRate)}
      />
      <Stat
        label="Median duration"
        value={formatDurationMinutes(summary.medianDuration)}
        sub={summary.p25Duration !== null && summary.p75Duration !== null
          ? `${formatDurationMinutes(summary.p25Duration)} – ${formatDurationMinutes(summary.p75Duration)}`
          : null}
      />
      <Stat
        label="Median start"
        value={startDeltaLabel}
      />
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-surface-alt border border-line px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-faint font-semibold">
        {label}
      </div>
      <div className="text-[16px] text-fg font-semibold mt-0.5 leading-none">
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-faint mt-0.5 leading-none">{sub}</div>
      )}
    </div>
  );
}

function SubLabel({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.12em] text-faint font-semibold mb-1.5">
      {children}
    </div>
  );
}

// ── Start-time histogram ──────────────────────────────────────────────
// 10-minute bins; absolute time-of-day on the X axis; vertical
// dashed line at the median nominal start (so sun-event blocks land
// at their typical-day position over the window).
function StartTimeHistogram({ histogram, block }) {
  if (!histogram || histogram.maxCount === 0) {
    return (
      <div className="text-[11px] text-faint italic">
        Not enough data to render a histogram.
      </div>
    );
  }
  const W = 600;
  const H = 90;
  const padTop = 8;
  const padBot = 18;
  const padX = 4;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBot;
  const { bins, domainStart, domainEnd, binMinutes,
          nominalStartMedian, nominalEndMedian, maxCount } = histogram;
  const span = domainEnd - domainStart;
  const xFor = (m) => padX + ((m - domainStart) / span) * innerW;
  const binW = innerW / bins.length;

  // Hour ticks across the domain.
  const tickStart = Math.ceil(domainStart / 60) * 60;
  const ticks = [];
  for (let m = tickStart; m <= domainEnd; m += 60) ticks.push(m);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height: H }}
        role="img"
        aria-label={`Start-time histogram for ${block.name}`}
      >
        {/* Bars */}
        {bins.map((c, i) => {
          if (c === 0) return null;
          const h = (c / maxCount) * innerH;
          const x = padX + i * binW;
          const y = padTop + (innerH - h);
          const center = domainStart + (i + 0.5) * binMinutes;
          const isAfterStart = nominalStartMedian !== null
            && center >= nominalStartMedian;
          const isAfterEnd = nominalEndMedian !== null
            && center >= nominalEndMedian;
          const fill = isAfterEnd
            ? "var(--c-warn)"
            : isAfterStart
              ? "var(--c-text)"
              : "var(--c-text-muted)";
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={Math.max(1, binW - 1)}
              height={h}
              fill={fill}
              opacity={0.85}
            />
          );
        })}
        {/* Nominal-start vertical line */}
        {nominalStartMedian !== null && (
          <line
            x1={xFor(nominalStartMedian)}
            x2={xFor(nominalStartMedian)}
            y1={padTop}
            y2={padTop + innerH}
            stroke="var(--c-accent)"
            strokeWidth={1.25}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* Nominal-end vertical line (lighter) */}
        {nominalEndMedian !== null && (
          <line
            x1={xFor(nominalEndMedian)}
            x2={xFor(nominalEndMedian)}
            y1={padTop}
            y2={padTop + innerH}
            stroke="var(--c-warn)"
            strokeWidth={1}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
            opacity={0.65}
          />
        )}
        {/* Baseline */}
        <line
          x1={padX}
          x2={padX + innerW}
          y1={padTop + innerH}
          y2={padTop + innerH}
          stroke="var(--c-border)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {/* Hour ticks */}
        {ticks.map(m => (
          <g key={m}>
            <line
              x1={xFor(m)} x2={xFor(m)}
              y1={padTop + innerH}
              y2={padTop + innerH + 3}
              stroke="var(--c-border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={xFor(m)} y={padTop + innerH + 12}
              textAnchor="middle"
              fontSize={9}
              fill="var(--c-text-faint)"
              style={{ fontFamily: "inherit", letterSpacing: "0.06em" }}
            >
              {formatHourLabel(m)}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-faint">
        <LegendSwatch swatch="bg-accent" label="nominal start" line />
        <LegendSwatch swatch="bg-warn" label="nominal end" line />
        <span>· bins of {histogram.binMinutes}m</span>
      </div>
    </div>
  );
}

function LegendSwatch({ swatch, label, line }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block ${line ? "w-3 h-px" : "w-2 h-2"} ${swatch}`}
        style={line
          ? { borderTop: "1px dashed currentColor", height: 0, width: 12 }
          : {}}
      />
      <span>{label}</span>
    </span>
  );
}

// ── Duration trend ────────────────────────────────────────────────────
// Chronological dot/line chart of run durations with a horizontal
// median + IQR band. X = run_date order; Y = minutes.
function DurationTrend({ runs, block, summary }) {
  const points = useMemo(() => {
    const usable = (runs ?? [])
      .filter(r => r.state === "done" && r.startedAt && r.endedAt)
      .slice()
      .sort((a, b) => {
        if (a.runDate !== b.runDate) return a.runDate < b.runDate ? -1 : 1;
        return a.startedAt.getTime() - b.startedAt.getTime();
      });
    return usable.map(r => ({
      runDate: r.runDate,
      duration: runDurationMinutes(r),
      overran: !!summary && false, // recomputed below
      run: r,
    }));
  }, [runs, summary]);

  if (points.length === 0) {
    return (
      <div className="text-[11px] text-faint italic">
        No completed runs to chart yet.
      </div>
    );
  }

  const W = 600;
  const H = 90;
  const padTop = 8;
  const padBot = 18;
  const padLeft = 28;
  const padRight = 4;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBot;

  // Y domain padded slightly so points don't sit on the baseline.
  const ys = points.map(p => p.duration).filter(v => v !== null);
  const yMin = Math.min(0, Math.min(...ys));
  const yMax = Math.max(...ys, block.durationMinutes ?? 0);
  const yPad = Math.max(5, Math.round((yMax - yMin) * 0.08));
  const yLo = Math.max(0, yMin);
  const yHi = yMax + yPad;
  const ySpan = Math.max(1, yHi - yLo);
  const yFor = (v) => padTop + innerH - ((v - yLo) / ySpan) * innerH;

  const xFor = (i) =>
    points.length === 1
      ? padLeft + innerW / 2
      : padLeft + (i / (points.length - 1)) * innerW;

  const linePath = points
    .map((p, i) => {
      const x = xFor(i);
      const y = yFor(p.duration);
      return (i === 0 ? "M" : "L") + x + " " + y;
    })
    .join(" ");

  const median = summary.medianDuration;
  const p25 = summary.p25Duration;
  const p75 = summary.p75Duration;
  const nominal = block.durationMinutes ?? null;

  // Y ticks: nominal duration + median (if both exist), plus axis ends.
  const yTicks = [];
  if (yLo !== null) yTicks.push(yLo);
  if (median !== null) yTicks.push(median);
  if (nominal !== null) yTicks.push(nominal);
  yTicks.push(yHi);
  const uniqueTicks = [...new Set(yTicks.map(v => Math.round(v)))]
    .sort((a, b) => a - b);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height: H }}
        role="img"
        aria-label={`Duration trend for ${block.name}`}
      >
        {/* Y-axis baseline */}
        <line
          x1={padLeft} x2={padLeft}
          y1={padTop} y2={padTop + innerH}
          stroke="var(--c-border)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {/* IQR band */}
        {p25 !== null && p75 !== null && (
          <rect
            x={padLeft}
            y={yFor(p75)}
            width={innerW}
            height={Math.max(1, yFor(p25) - yFor(p75))}
            fill="var(--c-accent)"
            opacity={0.07}
          />
        )}
        {/* Nominal duration line */}
        {nominal !== null && nominal >= yLo && nominal <= yHi && (
          <line
            x1={padLeft} x2={padLeft + innerW}
            y1={yFor(nominal)} y2={yFor(nominal)}
            stroke="var(--c-warn)"
            strokeWidth={1}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
            opacity={0.7}
          />
        )}
        {/* Median line */}
        {median !== null && (
          <line
            x1={padLeft} x2={padLeft + innerW}
            y1={yFor(median)} y2={yFor(median)}
            stroke="var(--c-accent)"
            strokeWidth={1.25}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* Data line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--c-text-dim)"
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
        />
        {/* Data points */}
        {points.map((p, i) => {
          const overran = nominal !== null && p.duration > nominal;
          return (
            <circle
              key={i}
              cx={xFor(i)}
              cy={yFor(p.duration)}
              r={2.5}
              fill={overran ? "var(--c-warn)" : "var(--c-text)"}
            />
          );
        })}
        {/* Y tick labels (left margin) */}
        {uniqueTicks.map(v => (
          <text
            key={v}
            x={padLeft - 4}
            y={yFor(v) + 3}
            textAnchor="end"
            fontSize={9}
            fill="var(--c-text-faint)"
            style={{ fontFamily: "inherit" }}
          >
            {formatDurationMinutes(v)}
          </text>
        ))}
      </svg>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-faint flex-wrap">
        <LegendSwatch swatch="bg-accent" label="median" line />
        <LegendSwatch swatch="bg-warn" label="nominal duration" line />
        <span>· {points.length} runs over {HISTORY_DAYS}d</span>
      </div>
    </div>
  );
}

function formatBlockDuration(minutes) {
  if (typeof minutes !== "number" || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
