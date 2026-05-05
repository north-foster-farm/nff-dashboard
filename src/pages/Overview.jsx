import { useMemo, useState } from "react";
import {
  Clock, CheckCircle2, ArrowUpRight,
  FolderKanban, Receipt, Newspaper, Activity as ActivityIcon,
  MapPin, User
} from "lucide-react";
import { T } from "../theme.js";
import { formatTime12h } from "../lib/dates.js";
import { getEventOccurrences } from "../lib/recurrence.js";
import {
  getChoresForDay, CHORE_CATEGORIES, CHORE_PERIODS,
  displayDeadlineConcrete, getChorePeriodTimeLabel,
  getChorePeriodStartMinutes, getEarliestChoreInPeriod,
  formatTime12hShort, resolveAssignee
} from "../lib/chores.js";
import { useCurrentWeather, roundUpToHalfHour } from "../lib/weather.js";
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

// ─── Schedule at a glance (unified timeline) ─────────────────────────────────

function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isoFromDate(d) {
  return d.toISOString().slice(0, 10);
}

// Per spec: chores with period === "evening" can fall anywhere in [18:00,
// 23:59] ∪ [00:00, 04:59]. For the timeline we visually split that wide
// bucket into "evening" (post-sunset) and "pre_dawn" (early-morning) so a
// 3 AM chore renders chronologically alongside other early-morning items
// instead of being hidden inside the 8 PM rollup.
function bucketForChore(inst) {
  const p = inst.chore.period;
  if (p !== "evening") return p;
  const min = timeToMinutes(inst.chore.startTime) ?? 0;
  return min < 5 * 60 ? "pre_dawn" : "evening";
}

const BUCKET_LABEL = {
  morning: "Morning chores",
  afternoon: "Afternoon chores",
  evening: "Evening chores",
  pre_dawn: "Pre-dawn chores",
  anytime: "Anytime chores"
};

// Build the chore-group rollups for a day. One row per bucket containing
// the earliest start time + member count.
function rollupChoresForDay(data, dayDate) {
  const instances = getChoresForDay(data, dayDate);
  const byBucket = {};
  for (const inst of instances) {
    const key = bucketForChore(inst);
    (byBucket[key] ??= []).push(inst);
  }
  return Object.keys(byBucket).map((bucket) => {
    const items = byBucket[bucket];
    // Earliest by clock time within the bucket. For evening (post-sunset)
    // the literal startTime is already monotonic (18:00–23:59) so we don't
    // need the wrap-aware sort.
    let earliestMin = Infinity;
    let earliestHHMM = null;
    for (const inst of items) {
      const min = timeToMinutes(inst.chore.startTime);
      if (min != null && min < earliestMin) {
        earliestMin = min;
        earliestHHMM = inst.chore.startTime;
      }
    }
    return { bucket, items, startMin: earliestMin, startHHMM: earliestHHMM };
  });
}

function todaysMorningCutoff(data, dayDate) {
  return getChorePeriodStartMinutes(getChoresForDay(data, dayDate), "morning");
}

// If every chore in the rollup that has an assignee resolves to the same
// single person on `dayDate`, return that name. Otherwise null. Loose rule:
// unassigned chores are ignored — the moment one *named* assignee owns the
// rollup it counts as "assigned to that person".
function getRollupAssignee(rollup, dayDate) {
  const names = new Set();
  for (const inst of rollup.items) {
    const a = resolveAssignee(inst.chore, dayDate);
    if (a) names.add(a);
  }
  return names.size === 1 ? [...names][0] : null;
}

function TodayScheduleCard({ data, today }) {
  const { data: weather } = useCurrentWeather();
  const todayUTC = useMemo(
    () => new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())),
    [today]
  );
  const todayISO = useMemo(() => isoFromDate(todayUTC), [todayUTC]);

  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);
  const tomorrowUTC = useMemo(
    () => new Date(Date.UTC(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())),
    [tomorrow]
  );

  const todayMorningCutoff = useMemo(
    () => todaysMorningCutoff(data, today),
    [data, today]
  );
  const tomorrowMorningCutoff = useMemo(
    () => todaysMorningCutoff(data, tomorrow),
    [data, tomorrow]
  );

  // Round sundown up to the next half-hour so the schedule shows a clean
  // "7 PM" / "7:30 PM" rather than 6:34 PM. Falls back to the literal word
  // "Sundown" if the weather payload hasn't arrived (or errored).
  const sundownLabel = useMemo(() => {
    if (!weather?.sunsetHHMM) return "Sundown";
    return formatTime12hShort(roundUpToHalfHour(weather.sunsetHHMM));
  }, [weather]);

  // ─── Today's items ────────────────────────────────────────────────────
  const todaysEvents = useMemo(
    () => getEventOccurrences(data.events, todayUTC, todayUTC, null),
    [data, todayUTC]
  );
  const todaysChoreRollups = useMemo(
    () => rollupChoresForDay(data, today),
    [data, today]
  );
  const todaysProjects = useMemo(
    () => (data.projects ?? []).filter(p =>
      p.status !== "completed"
      && (!p.start || p.start <= todayISO)
      && (!p.end || p.end >= todayISO)
    ),
    [data, todayISO]
  );

  const todayItems = useMemo(
    () => buildTimelineItems({
      events: todaysEvents,
      choreRollups: todaysChoreRollups,
      projects: todaysProjects,
      morningCutoff: todayMorningCutoff,
      sundownLabel
    }),
    [todaysEvents, todaysChoreRollups, todaysProjects, todayMorningCutoff, sundownLabel]
  );

  // ─── Tomorrow: pre-morning items + assigned morning rollup ─────────────
  const tomorrowsEvents = useMemo(
    () => getEventOccurrences(data.events, tomorrowUTC, tomorrowUTC, null),
    [data, tomorrowUTC]
  );
  const tomorrowsChoreRollups = useMemo(
    () => rollupChoresForDay(data, tomorrow),
    [data, tomorrow]
  );

  const tomorrowItems = useMemo(() => {
    if (tomorrowMorningCutoff == null) return [];
    const filteredEvents = tomorrowsEvents.filter(ev => {
      const min = timeToMinutes(ev.startTime);
      return min != null && min < tomorrowMorningCutoff;
    });
    const filteredRollups = [];
    for (const r of tomorrowsChoreRollups) {
      if (r.startMin != null && r.startMin < tomorrowMorningCutoff) {
        // Pre-morning rollup → always include in Tomorrow.
        filteredRollups.push(r);
      } else if (r.bucket === "morning") {
        // Morning rollup → only include if a single named assignee owns it,
        // and surface that name in place of the item count.
        const assignee = getRollupAssignee(r, tomorrow);
        if (assignee) filteredRollups.push({ ...r, assignee });
      }
    }
    return buildTimelineItems({
      events: filteredEvents,
      choreRollups: filteredRollups,
      projects: [],
      morningCutoff: tomorrowMorningCutoff,
      sundownLabel
    });
  }, [tomorrowsEvents, tomorrowsChoreRollups, tomorrowMorningCutoff, tomorrow, sundownLabel]);

  // ─── "Upcoming events" — events between (today + 2) and (today + 7) ────
  const upcomingEvents = useMemo(() => {
    const start = new Date(todayUTC);
    start.setUTCDate(start.getUTCDate() + 2);
    const end = new Date(todayUTC);
    end.setUTCDate(end.getUTCDate() + 7);
    return getEventOccurrences(data.events, start, end, null);
  }, [data, todayUTC]);

  // Render the upcoming events as the same item shape so they share
  // TimelineRow + the parent grid's column tracks.
  const upcomingItems = useMemo(
    () => upcomingEvents.map((ev) => {
      const d = new Date(ev.date + "T12:00:00Z");
      return {
        kind: "event",
        id: `upcoming:${ev.instanceId}:${ev.date}`,
        startMin: null,
        timeLabel: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        title: ev.instanceLabel,
        detail: ev.startTime ? formatTime12h(ev.startTime) : null,
        detailIcon: null,
        color: T.cat[ev.kindId] || T.cat.default
      };
    }),
    [upcomingEvents]
  );

  const splitDays = tomorrowItems.length > 0;
  const nothingToShow =
    todayItems.length === 0 && tomorrowItems.length === 0 && upcomingItems.length === 0;

  return (
    <Card title="Schedule at a glance" icon={Clock}>
      {nothingToShow ? (
        <EmptyLine>Nothing on the calendar today.</EmptyLine>
      ) : (
        // Outer grid so every row across Today / Tomorrow / Upcoming events
        // shares the same column tracks (left = auto-sized to widest label,
        // middle ≥ 66% of container, right = auto). Each row is a subgrid
        // with col-span-3 so per-row backgrounds + borders work.
        // Grid template:
        //   left  → auto (max-content of widest entry, e.g. "Sat, May 9").
        //           This column is shared via subgrid so all rows align.
        //   right → 1fr (everything else). Per-row, that cell holds a flex
        //           container with title (truncates) + detail (right-aligned,
        //           shrink-0). This lets the title grow into space the
        //           detail doesn't use, instead of capping every title at
        //           the widest detail's width across all rows.
        <div className="grid grid-cols-[auto_minmax(0,1fr)]">
          {splitDays && <SubHeading>Today</SubHeading>}
          {todayItems.length === 0 ? (
            <SubHeading className="font-normal normal-case tracking-normal text-dim italic">
              Nothing on the calendar today.
            </SubHeading>
          ) : (
            todayItems.map((it) => <TimelineRow key={it.id} item={it} />)
          )}

          {splitDays && <SubHeading className="mt-3">Tomorrow</SubHeading>}
          {tomorrowItems.map((it) => (
            <TimelineRow key={it.id} item={it} />
          ))}

          {upcomingItems.length > 0 && (
            <>
              <SubHeading className="mt-3 pt-3 border-t border-line">
                Upcoming events
              </SubHeading>
              {upcomingItems.map((it) => (
                <TimelineRow key={it.id} item={it} />
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// Compose timeline items from a day's events / chore-rollups / projects.
// `sundownLabel` is the formatted sundown time used for evening chore
// rollups (e.g. "7 PM"); falls back to the literal "Sundown" if weather
// data isn't loaded yet.
function buildTimelineItems({ events, choreRollups, projects, sundownLabel }) {
  const out = [];
  for (const ev of events) {
    const min = timeToMinutes(ev.startTime);
    const locationName = ev.location?.name;
    out.push({
      kind: "event",
      id: `event:${ev.instanceId}:${ev.date}`,
      startMin: min,
      timeLabel: min != null ? formatTime12h(ev.startTime) : "All day",
      title: ev.instanceLabel,
      detail: locationName ?? null,
      detailIcon: locationName ? "location" : null,
      color: T.cat[ev.kindId] || T.cat.default
    });
  }
  for (const r of choreRollups) {
    const count = r.items.length;
    const isEvening = r.bucket === "evening";
    // If the rollup carries an explicit assignee (e.g. tomorrow's morning
    // is owned by Jim), show the name in the right column instead of the
    // item count.
    const detail = r.assignee
      ? r.assignee
      : `${count} ${count === 1 ? "item" : "items"}`;
    out.push({
      kind: "chore-group",
      id: `chores:${r.bucket}`,
      bucket: r.bucket,
      // Sort key for evening uses the rollup's startMin (e.g. 8 PM = 1200).
      // Pre-dawn already gets its own bucket via bucketForChore.
      startMin: r.startMin,
      timeLabel: isEvening
        ? sundownLabel
        : (r.startHHMM ? formatTime12hShort(r.startHHMM) : ""),
      title: BUCKET_LABEL[r.bucket] ?? `${r.bucket} chores`,
      detail,
      detailIcon: r.assignee ? "user" : null
    });
  }
  for (const p of projects) {
    out.push({
      kind: "project",
      id: `project:${p.id}`,
      startMin: null,
      timeLabel: "All day",
      title: p.title,
      detail: "in progress",
      detailIcon: null
    });
  }
  // Sort chronologically: nulls (all-day) at top, then by startMin.
  out.sort((a, b) => {
    const aMin = a.startMin == null ? -1 : a.startMin;
    const bMin = b.startMin == null ? -1 : b.startMin;
    return aMin - bMin;
  });
  return out;
}

// Section subheading inside the schedule grid. Spans all 3 columns so it
// can sit between subgrid rows.
function SubHeading({ children, className = "" }) {
  return (
    <div className={`col-span-2 text-[11px] text-muted uppercase tracking-[0.14em] font-semibold pb-1 ${className}`}>
      {children}
    </div>
  );
}

// One row in the timeline. Implemented as a subgrid that inherits the
// parent's column tracks so every row across Today / Tomorrow / Upcoming
// shares column widths.
//
// Decoration rules:
//   event  → bright left border in the kind color + tinted bg via
//            color-mix on the same color (9% mix for dark-mode legibility).
//   chore  → plain (no border, no tint). Reserved kind-color treatment
//            for events keeps the visual hierarchy clean.
//   project → italic title placeholder until the new project model lands.
function TimelineRow({ item }) {
  const isEvent = item.kind === "event";
  // Use an inset box-shadow for the event's left bar instead of a real
  // border so the row's content stays in the same column-grid positions
  // as non-event rows. (A real border-left would shift cell contents 2px
  // and break top-to-bottom column alignment.)
  const eventStyle = isEvent
    ? {
        boxShadow: `inset 2px 0 0 0 ${item.color}`,
        background: `color-mix(in srgb, ${item.color} 9%, transparent)`
      }
    : undefined;

  const titleClass =
    item.kind === "chore-group" ? "text-fg font-medium" :
    item.kind === "project" ? "text-fg italic" :
    "text-fg";

  return (
    <div
      className="col-span-2 grid grid-cols-subgrid items-center py-1 text-[13px]"
      style={eventStyle}
    >
      <div className="[font-variant-numeric:tabular-nums] text-dim shrink-0 pl-2 whitespace-nowrap">
        {item.timeLabel}
      </div>
      {/* Title + detail share one fluid cell so the title can grow into
          space the detail doesn't need, instead of being capped by the
          widest detail across all rows (e.g. "Pat's Pastured"). */}
      <div className="flex items-center gap-2 min-w-0 pl-3 pr-2">
        <div className={`min-w-0 flex-1 truncate ${titleClass}`}>
          {item.title}
        </div>
        {item.detail && (
          <div className="text-dim text-[12px] flex items-center gap-1 whitespace-nowrap shrink-0">
            {item.detailIcon === "location" && (
              <MapPin size={12} className="mb-[1.75px]" />
            )}
            {item.detailIcon === "user" && (
              <User size={12} className="mb-[1.75px]" />
            )}
            <span className="text-[12px]">{item.detail}</span>
          </div>
        )}
      </div>
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
        <div className="text-[12px] text-muted mt-px">
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
        {subtitle && <div className="text-[12px] text-dim ml-auto">{subtitle}</div>}
      </header>
      {children}
    </section>
  );
}

function EmptyLine({ children }) {
  return <div className="text-xs text-dim italic leading-relaxed">{children}</div>;
}
