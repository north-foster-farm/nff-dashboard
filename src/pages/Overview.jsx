import { useMemo, useState } from "react";
import {
  Clock, CheckCircle2, ArrowUpRight,
  FolderKanban, Receipt, Newspaper, Activity as ActivityIcon
} from "lucide-react";
import { T } from "../theme.js";
import { formatTime12h } from "../lib/dates.js";
import { getEventOccurrences } from "../lib/recurrence.js";
import {
  getChoresForDay, CHORE_CATEGORIES, CHORE_PERIODS,
  displayDeadlineConcrete, getChorePeriodTimeLabel
} from "../lib/chores.js";
import { useActivityLog } from "../lib/data/useActivityLog.js";
import CurrentConditionsCard from "../components/WeatherWidget.jsx";

// The Dashboard is the first screen James / Jim see every morning. It
// surfaces everything happening "right now" without requiring navigation —
// activity since yesterday, today's schedule, what's still to be done, and
// anything that needs a human decision (orders, farm updates, etc.).
//
// Layout (top → bottom):
//   row 1: Upcoming chores | (Conditions / Schedule at a glance stacked)
//   row 2: Projects | Orders | Farm updates                  (3 equal cols)
//   row 3: Activity                                          (full width)

const ACTIVITY_LIMIT = 10;
const UPCOMING_LIMIT = 5;

export default function Overview({ data, onNavigate }) {
  const today = useMemo(() => new Date(), []);

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: chores on the left; conditions stacked above the day's
          schedule on the right. */}
      <GridRow cols={2}>
        <UpcomingChoresCard data={data} today={today} />
        <Stack>
          <CurrentConditionsCard />
          <TodayScheduleCard data={data} today={today} />
        </Stack>
      </GridRow>
      {/* Row 2: three status cards, each taking a third of the row. */}
      <GridRow cols={3}>
        <ProjectsInProgressCard data={data} />
        <OpenOrdersCard data={data} />
        <FarmUpdatesCard data={data} />
      </GridRow>
      {/* Row 3: activity spans the full width. */}
      <ActivitySinceYesterday data={data} today={today} onNavigate={onNavigate} />
    </div>
  );
}

// Evenly-spaced CSS-grid row. minmax(0, 1fr) lets children shrink below
// their intrinsic width, which matters for long titles inside cards.
function GridRow({ cols, children }) {
  // items-stretch (the grid default) makes each cell match the tallest in
  // the row — so cards align flush at the bottom even when their content
  // is uneven.
  const cls = cols === 2
    ? "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 items-stretch"
    : "grid grid-cols-[repeat(3,minmax(0,1fr))] gap-4 items-stretch";
  return <div className={cls}>{children}</div>;
}

// Vertical stack of cards inside a single grid column.
function Stack({ children }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

// ─── Activity (capped + link) ───────────────────────────────────────────────

function ActivitySinceYesterday({ data, today, onNavigate }) {
  const windowStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [today]);

  // Live activity log query, capped server-side at ACTIVITY_LIMIT + 1 so we
  // can detect overflow ("View all N entries") without pulling everything.
  // The hook already subscribes to realtime so this card ticks forward as
  // chores get checked off.
  const { entries } = useActivityLog({ sinceDate: windowStart, limit: ACTIVITY_LIMIT + 1 });
  const all = entries ?? [];
  const visible = all.slice(0, ACTIVITY_LIMIT);
  const hasMore = all.length > ACTIVITY_LIMIT;

  return (
    <Card
      title="Activity"
      subtitle={`Since ${windowStart.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}, 12:00 AM`}
      icon={ActivityIcon}
    >
      {all.length === 0 ? (
        <EmptyLine>No activity logged yet. Chore completions, temperature readings, and other log entries will appear here as they're recorded.</EmptyLine>
      ) : (
        <>
          <ActivityTimeline items={visible} />
          {hasMore && (
            <button
              onClick={() => onNavigate?.("activity")}
              className="inline-flex items-center bg-transparent border-0 text-accent-deep font-[inherit] text-[11px] font-semibold pt-2.5 cursor-pointer uppercase tracking-[0.12em]"
            >
              View all activity
              <ArrowUpRight size={12} className="ml-1 translate-y-0.5" />
            </button>
          )}
        </>
      )}
    </Card>
  );
}

function ActivityTimeline({ items }) {
  return (
    <ol className="m-0 p-0 list-none flex flex-col gap-2">
      {items.map((l, i) => (
        <li key={l.id ?? i} className="flex gap-2.5 text-xs">
          <div className="[font-variant-numeric:tabular-nums] text-dim shrink-0 min-w-[68px]">
            {new Date(l.logTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </div>
          <div className="text-fg">
            <span className="text-dim">{l.actor}</span> {l.summary ?? l.type ?? "logged an entry"}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ─── Today's schedule ────────────────────────────────────────────────────────

function TodayScheduleCard({ data, today }) {
  const occurrences = useMemo(() => {
    const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const end = new Date(start);
    return getEventOccurrences(data.events, start, end, null);
  }, [data, today]);
  const instances = useMemo(() => getChoresForDay(data, today), [data, today]);

  const choresByPeriod = {};
  for (const inst of instances) {
    const p = inst.chore.period;
    (choresByPeriod[p] ??= []).push(inst);
  }
  const orderedPeriods = Object.keys(choresByPeriod).sort(
    (a, b) => (CHORE_PERIODS[a]?.order ?? 99) - (CHORE_PERIODS[b]?.order ?? 99)
  );

  return (
    <Card title="Schedule at a glance" icon={Clock}>
      {occurrences.length === 0 && instances.length === 0 ? (
        <EmptyLine>Nothing on the calendar today.</EmptyLine>
      ) : (
        <div className="flex flex-col gap-1.5">
          {occurrences.map(ev => (
            <EventScheduleRow
              key={ev.instanceId + ev.date}
              time={formatTime12h(ev.startTime)}
              title={ev.instanceLabel}
              detail={ev.location?.name}
              color={T.cat[ev.kindId] || T.cat.default}
            />
          ))}
          {orderedPeriods.length > 0 && (
            <div className="text-[11px] text-muted uppercase tracking-[0.14em] pt-2.5 pb-1 font-semibold">
              Chores
            </div>
          )}
          {orderedPeriods.map(p => {
            const count = choresByPeriod[p].length;
            const meta = CHORE_PERIODS[p];
            const timeLabel = getChorePeriodTimeLabel(instances, p) || meta?.hint || "";
            return (
              <ChoreRollupRow
                key={p}
                time={timeLabel}
                title={`${meta?.label ?? p} chores`}
                count={count}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

// Schedule row variant for events (with the small color dot).
function EventScheduleRow({ time, title, detail, color }) {
  return (
    <div className="flex gap-2.5 items-baseline text-[13px]">
      <div className="[font-variant-numeric:tabular-nums] text-dim min-w-[78px] shrink-0">{time}</div>
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0 -translate-y-px"
        style={{ background: color }}
      />
      <div className="text-fg flex-1 min-w-0">{title}</div>
      {detail && <div className="text-faint text-[11px]">{detail}</div>}
    </div>
  );
}

// Chore rollup row format: "8 AM   Morning chores                20 items"
function ChoreRollupRow({ time, title, count }) {
  return (
    <div className="flex gap-2.5 items-baseline text-[13px]">
      <div className="text-dim min-w-[78px] shrink-0">{time}</div>
      <div className="text-fg flex-1 min-w-0">{title}</div>
      <div className="text-faint text-[11px]">{count} {count === 1 ? "item" : "items"}</div>
    </div>
  );
}

// ─── Upcoming chores (next N, grouped by period, in seed order) ──────────────

function UpcomingChoresCard({ data, today }) {
  const instances = useMemo(() => getChoresForDay(data, today), [data, today]);
  const now = today.getTime();
  const upcoming = instances
    .filter(i => i.deadlineAt.getTime() >= now)
    .slice(0, UPCOMING_LIMIT);

  const byPeriod = {};
  for (const inst of upcoming) {
    (byPeriod[inst.chore.period] ??= []).push(inst);
  }
  const orderedPeriods = Object.keys(byPeriod).sort(
    (a, b) => (CHORE_PERIODS[a]?.order ?? 99) - (CHORE_PERIODS[b]?.order ?? 99)
  );

  return (
    <Card title="Upcoming chores" icon={CheckCircle2}>
      {upcoming.length === 0 ? (
        <EmptyLine>No more chores on the list today.</EmptyLine>
      ) : (
        <div className="flex flex-col gap-3">
          {orderedPeriods.map(p => (
            <UpcomingPeriodGroup key={p} period={p} instances={byPeriod[p]} />
          ))}
        </div>
      )}
    </Card>
  );
}

function UpcomingPeriodGroup({ period, instances }) {
  const meta = CHORE_PERIODS[period];
  const timeLabel = getChorePeriodTimeLabel(instances, period) || meta?.hint || "";
  return (
    <div>
      <div className="text-[11px] text-fg uppercase tracking-[0.14em] font-bold mb-1.5">
        {meta?.label ?? period}
        {timeLabel && <span className="text-muted font-medium ml-2">{timeLabel}</span>}
      </div>
      <div className="flex flex-col gap-0.5">
        {instances.map(inst => <UpcomingChoreRow key={inst.choreId} inst={inst} />)}
      </div>
    </div>
  );
}

function UpcomingChoreRow({ inst }) {
  const [done, setDone] = useState(false);
  const { chore } = inst;
  return (
    <div className="flex gap-2.5 items-center py-1 text-xs">
      <button
        onClick={() => setDone(v => !v)}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        className={
          "w-4 h-4 shrink-0 cursor-pointer p-0 border-[1.5px] " +
          (done ? "bg-accent border-accent" : "bg-transparent border-line")
        }
      />
      <div className="flex-1 min-w-0">
        <div className={done ? "text-faint line-through" : "text-fg"}>{chore.title}</div>
        <div className="text-[11px] text-muted mt-px">
          {CHORE_CATEGORIES[chore.category]?.label ?? chore.category} · {displayDeadlineConcrete(chore)}
        </div>
      </div>
    </div>
  );
}

// ─── Projects, orders, updates (empty-state placeholders) ────────────────────

function ProjectsInProgressCard({ data }) {
  const inProgress = (data.projects ?? []).filter(p => p.status === "in_progress");
  return (
    <Card title="This week's projects" icon={FolderKanban}>
      {inProgress.length === 0 ? (
        <EmptyLine>No projects in progress.</EmptyLine>
      ) : (
        <div className="flex flex-col gap-1.5">
          {inProgress.map(p => (
            <QuickOpenRow key={p.id} label={p.title} onOpen={() => alert(`Open ${p.title} — not implemented.`)} />
          ))}
        </div>
      )}
    </Card>
  );
}

function OpenOrdersCard({ data }) {
  const open = (data.orders ?? []).filter(o => o.status === "open" || o.status === "pending");
  return (
    <Card title="Open orders" icon={Receipt}>
      {open.length === 0 ? (
        <EmptyLine>No open orders.</EmptyLine>
      ) : (
        <div className="text-[13px] text-fg">
          {open.length} {open.length === 1 ? "order" : "orders"} awaiting action
        </div>
      )}
    </Card>
  );
}

function FarmUpdatesCard({ data }) {
  const needsAttention = (data.updates ?? []).filter(u =>
    u.status === "ready_for_review" || u.status === "reviewed"
  );
  return (
    <Card title="In-progress farm updates" icon={Newspaper}>
      {needsAttention.length === 0 ? (
        <EmptyLine>Nothing in the review queue.</EmptyLine>
      ) : (
        <div className="flex flex-col gap-1.5">
          {needsAttention.map(u => (
            <QuickOpenRow key={u.id} label={u.title} onOpen={() => alert(`Open ${u.title} — not implemented.`)} />
          ))}
        </div>
      )}
    </Card>
  );
}

function QuickOpenRow({ label, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2 bg-transparent border-0 text-fg font-[inherit] text-xs py-1.5 cursor-pointer text-left"
    >
      <span className="flex-1 min-w-0">{label}</span>
      <ArrowUpRight size={13} className="text-muted" />
    </button>
  );
}

// ─── Shared card shell ───────────────────────────────────────────────────────

function Card({ title, subtitle, icon: Icon, children }) {
  return (
    <section className="bg-surface border border-line py-[18px] px-5">
      <header className="flex items-baseline gap-2.5 mb-3.5">
        {Icon && <Icon size={15} className="text-dim translate-y-0.5" />}
        <div className="font-ui text-xs text-fg uppercase tracking-[0.14em] font-bold">
          {title}
        </div>
        {subtitle && <div className="text-[11px] text-dim ml-auto">{subtitle}</div>}
      </header>
      {children}
    </section>
  );
}

function EmptyLine({ children }) {
  return <div className="text-xs text-dim italic leading-relaxed">{children}</div>;
}
