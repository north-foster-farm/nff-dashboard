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
//   row 1: Upcoming chores    | Today's schedule            (2 equal cols)
//   row 2: Projects | Orders  | Farm updates                (3 equal cols)
//   row 3: Activity                                         (full width)

const ACTIVITY_LIMIT = 10;
const UPCOMING_LIMIT = 5;

export default function Overview({ data, onNavigate }) {
  const today = useMemo(() => new Date(), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 16, alignItems: "start" }}>
      {children}
    </div>
  );
}

// Vertical stack of cards inside a single grid column.
function Stack({ children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {children}
    </div>
  );
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
  // We pulled LIMIT+1 specifically so a non-zero diff means "there's more".
  // The Activity page does the unbounded query when the user clicks through.
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
              style={linkButtonStyle}
            >
              View all activity
              <ArrowUpRight size={12} style={{ marginLeft: 4, transform: "translateY(2px)" }} />
            </button>
          )}
        </>
      )}
    </Card>
  );
}

function ActivityTimeline({ items }) {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((l, i) => (
        <li key={l.id ?? i} style={{ display: "flex", gap: 10, fontSize: 12 }}>
          <div style={{ fontVariantNumeric: "tabular-nums", color: T.textDim, flexShrink: 0, minWidth: 68 }}>
            {new Date(l.logTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </div>
          <div style={{ color: T.text }}>
            <span style={{ color: T.textDim }}>{l.actor}</span> {l.summary ?? l.type ?? "logged an entry"}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
            <div style={{
              fontSize: 11, color: T.textMuted, textTransform: "uppercase",
              letterSpacing: "0.14em", padding: "10px 0 4px", fontWeight: 600
            }}>
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
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 13 }}>
      <div style={{ fontVariantNumeric: "tabular-nums", color: T.textDim, minWidth: 78, flexShrink: 0 }}>{time}</div>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, transform: "translateY(-1px)" }} />
      <div style={{ color: T.text, flex: 1, minWidth: 0 }}>{title}</div>
      {detail && <div style={{ color: T.textFaint, fontSize: 11 }}>{detail}</div>}
    </div>
  );
}

// Chore rollup row format: "8 AM   Morning chores                20 items"
// — no bullet, no "~", item count on the right.
function ChoreRollupRow({ time, title, count }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 13 }}>
      <div style={{ color: T.textDim, minWidth: 78, flexShrink: 0 }}>{time}</div>
      <div style={{ color: T.text, flex: 1, minWidth: 0 }}>{title}</div>
      <div style={{ color: T.textFaint, fontSize: 11 }}>{count} {count === 1 ? "item" : "items"}</div>
    </div>
  );
}

// ─── Upcoming chores (next N, grouped by period, in seed order) ──────────────

function UpcomingChoresCard({ data, today }) {
  const instances = useMemo(() => getChoresForDay(data, today), [data, today]);
  const now = today.getTime();
  // Drop chores whose deadline already passed; keep seed order.
  const upcoming = instances
    .filter(i => i.deadlineAt.getTime() >= now)
    .slice(0, UPCOMING_LIMIT);

  // Group by period while preserving seed order within each group.
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
      <div style={{
        fontSize: 11, color: T.text, textTransform: "uppercase",
        letterSpacing: "0.14em", fontWeight: 700, marginBottom: 6
      }}>
        {meta?.label ?? period}
        {timeLabel && <span style={{ color: T.textMuted, fontWeight: 500, marginLeft: 8 }}>{timeLabel}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {instances.map(inst => <UpcomingChoreRow key={inst.choreId} inst={inst} />)}
      </div>
    </div>
  );
}

function UpcomingChoreRow({ inst }) {
  const [done, setDone] = useState(false);
  const { chore } = inst;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 0", fontSize: 12 }}>
      <button
        onClick={() => setDone(v => !v)}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        style={{
          width: 16, height: 16, flexShrink: 0,
          background: done ? T.accent : "transparent",
          border: `1.5px solid ${done ? T.accent : T.border}`,
          cursor: "pointer", padding: 0
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: done ? T.textFaint : T.text,
          textDecoration: done ? "line-through" : "none"
        }}>{chore.title}</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
        <div style={{ fontSize: 13, color: T.text }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "transparent", border: "none",
        color: T.text, fontFamily: "inherit", fontSize: 12,
        padding: "6px 0", cursor: "pointer", textAlign: "left"
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      <ArrowUpRight size={13} color={T.textMuted} />
    </button>
  );
}

// ─── Shared card shell ───────────────────────────────────────────────────────

function Card({ title, subtitle, icon: Icon, children }) {
  return (
    <section style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      padding: "18px 20px"
    }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        {Icon && <Icon size={15} color={T.textDim} style={{ transform: "translateY(2px)" }} />}
        <div style={{
          fontFamily: T.uiLabel, fontSize: 12, color: T.text,
          textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700
        }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: T.textDim, marginLeft: "auto" }}>{subtitle}</div>}
      </header>
      {children}
    </section>
  );
}

function EmptyLine({ children }) {
  return <div style={{ fontSize: 12, color: T.textDim, fontStyle: "italic", lineHeight: 1.6 }}>{children}</div>;
}

const linkButtonStyle = {
  display: "inline-flex", alignItems: "center",
  background: "transparent", border: "none",
  color: T.accentDeep, fontFamily: "inherit", fontSize: 11, fontWeight: 600,
  padding: "10px 0 0", cursor: "pointer",
  textTransform: "uppercase", letterSpacing: "0.12em"
};
