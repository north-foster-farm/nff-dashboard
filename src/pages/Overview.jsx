import { useEffect, useMemo, useState } from "react";
import {
  Clock, CheckCircle2, ArrowUpRight, ArrowRight,
  FolderKanban, Receipt, Newspaper, Activity as ActivityIcon,
  MapPin, User, CloudOff, Workflow,
  Sun, CloudSun, Cloud, CloudRain, CloudSnow,
} from "lucide-react";
import { Chicken } from "../components/animalIcons.jsx";
import { T } from "../theme.js";
import { formatDate, formatTime12h } from "../lib/dates.js";
import { getEventOccurrences } from "../lib/recurrence.js";
import {
  rollupChoresForDay,
  getRollupAssignee,
  todaysMorningCutoff,
} from "../lib/schedule/deriveDay.js";
import {
  getChoresForDay, displayDeadlineConcrete, describeChoreAnchor,
  firstBlockOfDay, blockTimeLabel,
  formatTime12hShort,
  obligationPlaceIds
} from "../lib/chores.js";
import { resolveBlockMinutes } from "../lib/sunTimes.js";
import { displayPlace } from "../lib/places.js";
import {
  navigate, pathForBatch, pathForProject, pathForSection,
} from "../lib/browser/router.js";
import { useProcessingDates } from "../lib/data/useProcessingDates.js";
import { batchLifecycle, isMeatSpecies, weeksTimeline } from "../lib/metrics.js";
import { isActiveProject } from "../lib/projects.js";
import { Pane, LoadSpine, AttentionCard, NowRule } from "../components/ui.jsx";
import { farmLoad } from "../lib/load/farmLoad.js";
import {
  blockLabel, NO_BLOCK_BUCKET, NO_BLOCK_LABEL,
} from "../lib/schedule/placement.js";
import { useScheduleDeltas } from "../lib/data/useScheduleDeltas.js";
import { useCurrentWeather, roundUpToHalfHour } from "../lib/browser/weather.js";
import { useActivityLog } from "../lib/data/useActivityLog.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useChoreAssignmentRules } from "../lib/data/useChoreAssignmentRules.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { useChoreModifiers } from "../lib/data/useChoreModifiers.js";
import { countModified } from "../lib/modifiers.js";
import { useSites } from "../lib/data/useSites.js";
import { sunMinutesOfDay } from "../lib/sunTimes.js";
import { Sunrise, Sunset } from "lucide-react";
import CurrentConditionsCard from "../components/WeatherWidget.jsx";
import ActivityRow from "../components/ActivityRow.jsx";

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
  // Used by UpcomingChoresCard's labels and by the schedule-at-a-glance
  // pre-morning cutoff. Editing a block in Settings → Sites & blocks
  // propagates to both surfaces in real time.
  const { blocks } = useChoreBlocks();
  // Assignment rules engine (Batch 12). Maps thread through to the
  // chore expander so rollup assignees + per-row assignees pick up
  // both chore-scoped and block-scoped rules.
  const { rulesByChoreId, rulesByBlockId } = useChoreAssignmentRules();
  const ruleOpts = useMemo(
    () => ({ rulesByChoreId, rulesByBlockId, blocks }),
    [rulesByChoreId, rulesByBlockId, blocks]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Phone-led Today glance (Round-3): the lead signals stacked in
          tap-priority — now → needs-cover → day-load — above the
          reflowed desktop grid. Phone only; desktop keeps the grid. */}
      <TodayGlance
        data={data} today={today} blocks={blocks} ruleOpts={ruleOpts} />
      {/* The Heads-up lane lived here from Batch 19 until Batch 27.5 —
          automation firings now surface as bell notifications
          (InboxBell), and process expansions create chores that show
          up in the normal chore surfaces. */}
      {/* Row 1: chores on the left; conditions stacked above the day's
          schedule on the right. */}
      <GridRow cols={2}>
        <UpcomingChoresCard data={data} today={today} blocks={blocks} ruleOpts={ruleOpts} />
        <Stack>
          <CurrentConditionsCard />
          {/* Broiler weeks-remaining widget (Batch 26.2) — the stat
              James's dad keeps tabs on day to day. Renders nothing
              when no broiler batch is on the farm. */}
          <BroilerWeeksCard data={data} />
          <TodayScheduleCard data={data} today={today} blocks={blocks} ruleOpts={ruleOpts} />
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
  // Single column on phones — the multi-column grid squeezed cards to
  // ~190px and overflowed their right-aligned content. Splits to 2/3
  // columns at the `sm` breakpoint up.
  const cls = cols === 2
    ? "grid grid-cols-1 sm:grid-cols-[repeat(2,minmax(0,1fr))] gap-4 items-stretch"
    : "grid grid-cols-1 sm:grid-cols-[repeat(3,minmax(0,1fr))] gap-4 items-stretch";
  return <div className={cls}>{children}</div>;
}

// Vertical stack of cards inside a single grid column.
function Stack({ children }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

// Open-Meteo weather code → a Lucide icon (C1: no emoji). Buckets mirror
// `describeCode` in lib/browser/weather.js.
function weatherIcon(code) {
  if (code == null) return Cloud;
  if (code <= 1) return Sun;
  if (code === 2) return CloudSun;
  if (code === 3 || code === 45 || code === 48) return Cloud;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 85 && code <= 86) return CloudSnow;
  if (code >= 51) return CloudRain;
  return Cloud;
}

// ─── Phone Today glance (Round-3, phone-led lead tier) ──────────────────
// The Operator's headline read: the day's live signals in tap-priority —
// now-marker, an emphatic needs-cover card (man-down only), and the
// count-driven day-load — sitting above the reflowed desktop grid. Reads
// the one `farmLoad` model so it can never drift from the Schedule. Phone
// only (`lg:hidden`); desktop keeps its multi-pane grid. The full block
// list + ticking lives one tap away in Rounds, so this stays a glance.
function TodayGlance({ data, today, ruleOpts }) {
  const { choreCtx } = useSites();
  const completions = useChoreCompletions(today);
  const todayISO = useMemo(() => {
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${today.getFullYear()}-${m}-${d}`;
  }, [today]);
  const { deltas } = useScheduleDeltas(todayISO);
  const { data: wx } = useCurrentWeather();
  const [nowMin, setNowMin] = useState(
    () => today.getHours() * 60 + today.getMinutes());
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const fl = useMemo(
    () => farmLoad({
      data, date: today, ruleOpts, choreCtx, completions, deltas, nowMin,
    }),
    // completions/deltas are stable per-day subscriptions; rerun on their
    // identity so a fresh tick or a new completion redraws the load.
    [data, today, ruleOpts, choreCtx, completions, deltas, nowMin],
  );

  const uncovered = fl.totals.uncovered;
  // Counter language (42.3 round 3): chores (not "items"), blocks incl.
  // project gaps, DISTINCT projects worked — matches the Schedule day-load.
  const projectCount = fl.totals.projectsDistinct;
  const summary = [
    `${fl.totals.chores} ${fl.totals.chores === 1 ? "chore" : "chores"}`,
    `${fl.totals.blocksAll} ${fl.totals.blocksAll === 1 ? "block" : "blocks"}`,
    projectCount > 0
      ? `${projectCount} ${projectCount === 1 ? "project" : "projects"}`
      : null,
  ].filter(Boolean).join(" · ");

  const WxIcon = weatherIcon(wx?.code);

  return (
    <section className="lg:hidden flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[22px] -tracking-[0.01em] text-fg">
          {today.toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric",
          })}
        </h1>
        {wx && (
          <span className="inline-flex items-center gap-1.5 text-dim [font-variant-numeric:tabular-nums]">
            <WxIcon size={16} className="text-dim" />
            <span className="text-[13px] font-medium">{wx.tempCurrent}°</span>
          </span>
        )}
      </div>

      <NowRule
        className="pt-2"
        time={formatTime12h(minutesToHHMM(nowMin))}
      />

      {/* Round 5 — uncovered counts UNITS (time offs needing cover),
          not per-chore rows; the Schedule's needs-cover card resolves
          each with one tap. */}
      {uncovered > 0 && (
        <AttentionCard
          kind="cover"
          work={uncovered === 1
            ? "A time off needs cover"
            : `${uncovered} time offs need cover`}
          reason="Someone is off while blocks still have work on them."
          action="Open Schedule"
          onAct={() => navigate(pathForSection("schedule"))}
        />
      )}

      <Pane title="Day load" subtitle={summary}>
        <LoadSpine blocks={fl.spine} />
        <button
          type="button"
          onClick={() => navigate(pathForSection("rounds"))}
          className="mt-3 inline-flex items-center gap-1 self-start font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-accent hover:text-accent-deep cursor-pointer"
        >
          Open Rounds <ArrowRight size={13} />
        </button>
      </Pane>
    </section>
  );
}

// ─── Activity (capped + link) ───────────────────────────────────────────────

function ActivitySinceYesterday({ today, onNavigate }) {
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
  const { entries, edit, remove } = useActivityLog({ sinceDate: windowStart, limit: ACTIVITY_LIMIT + 1 });
  const userEmail = useCurrentUserEmail();
  const all = entries ?? [];
  const visible = all.slice(0, ACTIVITY_LIMIT);
  const hasMore = all.length > ACTIVITY_LIMIT;

  return (
    <Pane
      title="Activity"
      subtitle={`Since ${windowStart.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}, 12:00 AM`}
      icon={ActivityIcon}
    >
      {all.length === 0 ? (
        <EmptyLine>No activity logged yet. Chore completions, temperature readings, and other log entries will appear here as they're recorded.</EmptyLine>
      ) : (
        <>
          <ol className="m-0 p-0 list-none flex flex-col gap-2">
            {visible.map((entry) => (
              <ActivityRow
                key={entry.id}
                entry={entry}
                ownerEmail={userEmail}
                onEdit={edit}
                onDelete={remove}
                renderTime={renderTimeShort}
                compact
              />
            ))}
          </ol>
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
    </Pane>
  );
}

// Compact "10:14 AM" time renderer for the dashboard activity card.
function renderTimeShort(logTime) {
  return new Date(logTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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

// minutes-of-day → "HH:MM" (inverse of timeToMinutes).
function minutesToHHMM(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:`
    + `${String(m % 60).padStart(2, "0")}`;
}

function TodayScheduleCard({ data, today, blocks, ruleOpts }) {
  const { data: weather } = useCurrentWeather();
  // Batch 23: chore modifiers — rollup rows show how many of their
  // chores are modified that day.
  const { modifiers } = useChoreModifiers();
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
    () => todaysMorningCutoff(today, blocks),
    [today, blocks]
  );
  const tomorrowMorningCutoff = useMemo(
    () => todaysMorningCutoff(tomorrow, blocks),
    [tomorrow, blocks]
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
    () => rollupChoresForDay(data, today, ruleOpts),
    [data, today, ruleOpts]
  );
  const todaysProjects = useMemo(
    () => (data.projects ?? []).filter(p => isActiveProject(p, todayISO)),
    [data, todayISO]
  );

  const todayItems = useMemo(
    () => buildTimelineItems({
      events: todaysEvents,
      choreRollups: todaysChoreRollups,
      projects: todaysProjects,
      morningCutoff: todayMorningCutoff,
      sundownLabel,
      modifiers,
      dateISO: todayISO
    }),
    [todaysEvents, todaysChoreRollups, todaysProjects, todayMorningCutoff, sundownLabel, modifiers, todayISO]
  );

  // ─── Tomorrow: pre-morning items + assigned morning rollup ─────────────
  const tomorrowsEvents = useMemo(
    () => getEventOccurrences(data.events, tomorrowUTC, tomorrowUTC, null),
    [data, tomorrowUTC]
  );
  const tomorrowsChoreRollups = useMemo(
    () => rollupChoresForDay(data, tomorrow, ruleOpts),
    [data, tomorrow, ruleOpts]
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
      } else if (r.block && r.block.id === firstBlockOfDay(blocks, tomorrow)?.id) {
        // First-block rollup → only include if a single named assignee owns
        // it, and surface that name in place of the item count.
        const assignee = getRollupAssignee(r, tomorrow, ruleOpts);
        if (assignee) filteredRollups.push({ ...r, assignee });
      }
    }
    return buildTimelineItems({
      events: filteredEvents,
      choreRollups: filteredRollups,
      projects: [],
      morningCutoff: tomorrowMorningCutoff,
      sundownLabel,
      modifiers,
      dateISO: isoFromDate(tomorrowUTC)
    });
  }, [tomorrowsEvents, tomorrowsChoreRollups, tomorrowMorningCutoff, tomorrow, blocks, sundownLabel, modifiers, tomorrowUTC]);

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
    <Pane title="Schedule at a glance" icon={Clock}>
      <SunCountdownPill />
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
    </Pane>
  );
}

// Compose timeline items from a day's events / chore-rollups / projects.
// `sundownLabel` is the formatted sundown time used for evening chore
// rollups (e.g. "7 PM"); falls back to the literal "Sundown" if weather
// data isn't loaded yet.
function buildTimelineItems({
  events, choreRollups, projects, sundownLabel, modifiers, dateISO,
}) {
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
    // The end-of-day block is anchored to sunset → show the sundown time.
    const isSunset = r.block?.startKind === "sunset";
    // If the rollup carries an explicit assignee (e.g. tomorrow's morning
    // is owned by Jim), show the name in the right column instead of the
    // item count.
    const detail = r.assignee
      ? r.assignee
      : `${count} ${count === 1 ? "item" : "items"}`;
    // Batch 23: how many chores in this rollup carry a modifier that
    // day — surfaces as a small "N changed" badge on the row.
    const modifiedCount = modifiers && dateISO
      ? countModified(modifiers, r.items.map(i => i.chore.id), dateISO)
      : 0;
    out.push({
      kind: "chore-group",
      id: `chores:${r.bucket}`,
      bucket: r.bucket,
      startMin: r.startMin,
      timeLabel: isSunset
        ? sundownLabel
        : (r.startMin != null ? formatTime12hShort(minutesToHHMM(r.startMin)) : ""),
      title: r.block
        ? `${r.block.name} chores` : `${NO_BLOCK_LABEL} chores`,
      detail,
      detailIcon: r.assignee ? "user" : null,
      modifiedCount
    });
  }
  for (const p of projects) {
    out.push({
      kind: "project",
      id: `project:${p.id}`,
      startMin: null,
      timeLabel: "All day",
      title: p.title,
      // Batch 22: the completeness rule's verbatim copy when the
      // project has phases; "in progress" otherwise.
      detail: p.progress?.label ?? "in progress",
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
//   project → italic title; detail carries the progress copy (Batch 22).
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
        {/* Batch 23: "N changed" — chores in this rollup carrying a
            modifier that day (from a process or placed by hand). */}
        {(item.modifiedCount ?? 0) > 0 && (
          <div
            className="text-accent-deep text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
            title="Some chores in this group are modified — open Rounds or the Today tab to see how"
          >
            <Workflow size={11} className="mb-[1px]" />
            <span>{item.modifiedCount} changed</span>
          </div>
        )}
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

function UpcomingChoresCard({ data, today, blocks, ruleOpts }) {
  const instances = useMemo(
    () => getChoresForDay(data, today, ruleOpts),
    [data, today, ruleOpts]
  );
  // Live completion subscription: realtime checkbox flips on the
  // dashboard mirror what's happening in Rounds + the Today tab.
  const completions = useChoreCompletions(today);
  // Place tree + occupancy + livestock groups for the anchor-driven
  // obligation fan-out (Batches 16.1 + 18) — a fanned chore shows
  // "N of M" progress with expandable per-place sub-checkboxes.
  const {
    placesById, choreCtx, loading: sitesLoading,
  } = useSites();
  const now = today.getTime();
  // Drop fully-completed chores from the upcoming list — once every
  // obligation is ticked off, the chore shouldn't crowd the dashboard.
  // Partially-done fanned chores stay (there's still work to do).
  // Dormant chores (anchor fans out to nothing — no active animals)
  // drop too: done == total == 0. While occupancy is still loading,
  // skip the dormancy filter so animal-anchored chores don't flash out.
  const upcoming = instances
    .filter(i => i.deadlineAt.getTime() >= now)
    .filter(i => {
      if (sitesLoading) return true;
      const placeIds = obligationPlaceIds(i.chore, choreCtx);
      const { done, total } = completions.doneCountForChore(
        i.chore.id, placeIds
      );
      return done < total;
    })
    .slice(0, UPCOMING_LIMIT);

  // Group by block, ordered by the block's resolved start time.
  const byBlock = {};
  for (const inst of upcoming) {
    (byBlock[inst.chore.blockId ?? NO_BLOCK_BUCKET] ??= []).push(inst);
  }
  const blockById = new Map((blocks ?? []).map(b => [b.id, b]));
  const startOf = (key) => {
    const b = blockById.get(key);
    if (!b) return 99999; // block-less / unknown → last
    return resolveBlockMinutes(today, b.startKind, b.startMinutes)
      ?? b.startMinutes ?? 99998;
  };
  const orderedKeys = Object.keys(byBlock).sort(
    (a, b) => startOf(a) - startOf(b)
  );

  return (
    <Pane title="Upcoming chores" icon={CheckCircle2}>
      {upcoming.length === 0 ? (
        <EmptyLine>No more chores on the list today.</EmptyLine>
      ) : (
        <div className="flex flex-col gap-3">
          {orderedKeys.map(key => (
            <UpcomingBlockGroup
              key={key}
              block={blockById.get(key) ?? null}
              instances={byBlock[key]}
              blocks={blocks}
              completions={completions}
              placesById={placesById}
              choreCtx={choreCtx}
            />
          ))}
        </div>
      )}
    </Pane>
  );
}

function UpcomingBlockGroup({
  block, instances, blocks, completions, placesById, choreCtx,
}) {
  const label = blockLabel(block);
  const timeLabel = blockTimeLabel(block);
  return (
    <div>
      <div className="text-[11px] text-fg uppercase tracking-[0.14em] font-bold mb-1.5">
        {label}
        {timeLabel && <span className="text-muted font-medium ml-2">{timeLabel}</span>}
      </div>
      <div className="flex flex-col gap-0.5">
        {instances.map(inst => (
          <UpcomingChoreRow
            key={inst.choreId}
            inst={inst}
            blocks={blocks}
            completions={completions}
            placesById={placesById}
            choreCtx={choreCtx}
          />
        ))}
      </div>
    </div>
  );
}

function UpcomingChoreRow({
  inst, blocks, completions, placesById, choreCtx,
}) {
  const { chore } = inst;
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Per-place obligations via the chore's anchor (Batches 16.1 + 18).
  const placeIds = useMemo(
    () => obligationPlaceIds(chore, choreCtx),
    [chore, choreCtx]
  );
  const { done, total } = completions.doneCountForChore(chore.id, placeIds);
  const allDone = total > 0 && done === total;
  const fanned = total > 1;
  // Batch 16.2 — any obligation still queued in the device-local
  // outbox (offline tick waiting for signal).
  const queued = placeIds.some(
    pid => completions.isQueued?.(chore.id, pid) ?? false
  );

  // Main checkbox: single-obligation chores toggle that one
  // obligation; fanned chores bulk-complete all remaining (or
  // un-complete all when everything is done).
  const onToggle = async () => {
    if (pending) return;
    setPending(true);
    try {
      if (fanned) {
        await completions.toggleMany(chore.id, placeIds, !allDone);
      } else {
        await completions.toggle(chore.id, placeIds[0] ?? null, allDone);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="py-1 text-xs">
      <div className="flex gap-2.5 items-center">
        <button
          onClick={onToggle}
          disabled={pending}
          aria-label={allDone ? "Mark incomplete" : "Mark complete"}
          className={
            "w-4 h-4 shrink-0 cursor-pointer p-0 border-[1.5px] " +
            (allDone
              ? "bg-accent border-accent"
              : "bg-transparent border-line")
          }
        />
        <div className="flex-1 min-w-0">
          <div className={
            "flex items-center gap-2 " +
            (allDone ? "text-faint line-through" : "text-fg")
          }>
            <span>{chore.title}</span>
            {queued && (
              <CloudOff
                size={12}
                className="shrink-0 text-warn"
                aria-label="Saved on this device — not synced yet"
              />
            )}
            {fanned && (
              <button
                onClick={() => setExpanded(e => !e)}
                className={
                  "bg-transparent border-0 cursor-pointer p-0 " +
                  "text-[11px] font-semibold " +
                  (done > 0 && !allDone ? "text-accent" : "text-muted")
                }
                aria-label={expanded ? "Collapse places" : "Expand places"}
              >
                {done} of {total} {expanded ? "▾" : "▸"}
              </button>
            )}
          </div>
          <div className="text-[12px] text-muted mt-px">
            {describeChoreAnchor(chore, choreCtx)} · {displayDeadlineConcrete(chore, blocks)}
          </div>
        </div>
      </div>
      {fanned && expanded && (
        <div className="flex flex-col gap-1 mt-1.5 ml-[26px]">
          {placeIds.map(pid => (
            <UpcomingPlaceRow
              key={pid ?? "general"}
              choreId={chore.id}
              placeId={pid}
              placesById={placesById}
              completions={completions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Per-place sub-row inside an expanded fanned chore on the dashboard:
// checkbox + place name + bold parent (D1 disambiguation).
function UpcomingPlaceRow({ choreId, placeId, placesById, completions }) {
  const place = placeId ? placesById?.get(placeId) : null;
  const { name, parentName } = displayPlace(place, placesById);
  const isDone = completions.isDone(choreId, placeId);
  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={() => completions.toggle(choreId, placeId, isDone)}
        aria-label={isDone ? "Mark incomplete" : "Mark complete"}
        className={
          "w-3.5 h-3.5 shrink-0 cursor-pointer p-0 border-[1.5px] " +
          (isDone
            ? "bg-accent border-accent"
            : "bg-transparent border-line")
        }
      />
      <div className={
        "text-[12px] " + (isDone ? "text-faint line-through" : "text-fg")
      }>
        {name || "This chore"}
        {parentName && (
          <span className="text-muted">
            {" · "}<strong>{parentName}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Projects, orders, updates ───────────────────────────────────────────────

function ProjectsInProgressCard({ data }) {
  // Active = in its [start, target] window and not completed — the same
  // selector the sidebar badge uses, so the two never disagree, and a
  // prep project whose day has passed drops off both.
  const todayISO = new Date().toISOString().slice(0, 10);
  const inProgress = (data.projects ?? [])
    .filter(p => isActiveProject(p, todayISO));
  return (
    <Pane title="Active projects" icon={FolderKanban}>
      {inProgress.length === 0 ? (
        <EmptyLine>No active projects.</EmptyLine>
      ) : (
        <div className="flex flex-col gap-1.5">
          {inProgress.map(p => (
            <QuickOpenRow
              key={p.id}
              label={p.progress
                ? `${p.title} · ${p.progress.label}`
                : p.title}
              onOpen={() => navigate(pathForProject(p.id))}
            />
          ))}
        </div>
      )}
    </Pane>
  );
}

function OpenOrdersCard({ data }) {
  // Open + ready orders are the ones still awaiting action (Batch
  // 29.1's lifecycle: open → ready → fulfilled, plus cancelled).
  const open = (data.orders ?? []).filter(
    o => o.status === "open" || o.status === "ready");
  return (
    <Pane title="Open orders" icon={Receipt}>
      {open.length === 0 ? (
        <EmptyLine>No open orders.</EmptyLine>
      ) : (
        <QuickOpenRow
          label={`${open.length} ${open.length === 1 ? "order" : "orders"}`
            + " awaiting action"}
          onOpen={() => navigate(pathForSection("orders"))}
        />
      )}
    </Pane>
  );
}

function FarmUpdatesCard({ data }) {
  const needsAttention = (data.updates ?? []).filter(u =>
    u.status === "ready_for_review" || u.status === "reviewed"
  );
  return (
    <Pane title="In-progress farm updates" icon={Newspaper}>
      {needsAttention.length === 0 ? (
        <EmptyLine>Nothing in the review queue.</EmptyLine>
      ) : (
        <div className="flex flex-col gap-1.5">
          {needsAttention.map(u => (
            <QuickOpenRow key={u.id} label={u.title} onOpen={() => alert(`Open ${u.title} — not implemented.`)} />
          ))}
        </div>
      )}
    </Pane>
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

function EmptyLine({ children }) {
  return <div className="text-xs text-dim italic leading-relaxed">{children}</div>;
}

// ─── Broiler weeks remaining (Batch 26.2) ────────────────────────────────────

// One line per broiler batch still on the farm:
//   Batch 1   ·   week 5   ·   2 weeks remaining
// Counts down to the scheduled processing event when one exists,
// otherwise to the species' target process week from arrival. Clicking
// a row deep-links to the batch page. Renders nothing when no meat
// batch is active.
function BroilerWeeksCard({ data }) {
  const { processingDateByBatchId } = useProcessingDates();

  const rows = useMemo(() => {
    const out = [];
    for (const sp of data.livestock?.species ?? []) {
      if (!isMeatSpecies(sp)) continue;
      for (const batch of sp.groups ?? []) {
        if (typeof batch.count === "number" && batch.count <= 0) continue;
        const processingISO = processingDateByBatchId.get(batch.id) ?? null;
        const life = batchLifecycle(batch, processingISO);
        // Processed batches are done — they drop off "weeks to
        // processing" entirely. Arriving batches show their arrival
        // date instead of a (negative) week count.
        if (life.state === "processed" || life.state === "unknown") continue;
        const weeks = weeksTimeline(batch, sp, processingISO);
        out.push({ speciesId: sp.id, batch, life, weeks });
      }
    }
    // Arriving batches sort after active ones, by soonest first.
    out.sort((a, b) => {
      const ra = a.life.state === "arriving"
        ? Infinity : (a.weeks.weeksRemaining ?? Infinity);
      const rb = b.life.state === "arriving"
        ? Infinity : (b.weeks.weeksRemaining ?? Infinity);
      if (ra !== rb) return ra - rb;
      return (a.life.arrivalISO ?? "").localeCompare(b.life.arrivalISO ?? "");
    });
    return out;
  }, [data.livestock, processingDateByBatchId]);

  if (rows.length === 0) return null;

  return (
    <Pane title="Broilers" icon={Chicken} subtitle="weeks to processing">
      <div className="flex flex-col">
        {rows.map(({ speciesId, batch, life, weeks }) => {
          const arriving = life.state === "arriving";
          // Only a batch that's actually on the farm has a real "week N"
          // — guard against the negative weeks future batches produced.
          const week = !arriving && weeks.weeksOnFarm != null
            && weeks.weeksOnFarm >= 0
            ? Math.floor(weeks.weeksOnFarm) + 1
            : null;
          const remaining = weeks.weeksRemaining == null
            ? null
            : Math.max(0, Math.ceil(weeks.weeksRemaining));
          return (
            <button
              key={batch.id}
              onClick={() => navigate(pathForBatch(speciesId, batch.id))}
              className={
                "flex items-baseline gap-2 py-2 first:pt-0 last:pb-0 " +
                "bg-transparent border-0 border-b border-line last:border-b-0 " +
                "font-[inherit] text-left cursor-pointer group w-full"
              }
            >
              <span className="text-[13px] font-semibold text-fg group-hover:text-accent-deep">
                {batch.label}
              </span>
              {arriving ? (
                <span className="text-[12px] text-dim">not yet arrived</span>
              ) : week != null ? (
                <span className="text-[12px] text-dim">week {week}</span>
              ) : null}
              <span className="ml-auto text-[12px] text-fg whitespace-nowrap">
                {arriving
                  ? `arrives ${formatDate(life.arrivalISO)}`
                  : remaining == null
                    ? "no target"
                    : remaining === 0
                      ? "processing week"
                      : `${remaining} week${remaining === 1 ? "" : "s"} remaining`}
              </span>
              <ArrowUpRight size={12} className="text-muted shrink-0 self-center" />
            </button>
          );
        })}
      </div>
    </Pane>
  );
}


// Live-ticking sun countdown — sits at the top of Schedule-at-a-glance.
// Renders the next sunrise / sunset with how long until it lands. Updates
// once a minute; falls back to silence if SunCalc cant compute.
function SunCountdownPill() {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const now = new Date(tick);
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const sunriseMin = sunMinutesOfDay(now, "sunrise");
  const sunsetMin = sunMinutesOfDay(now, "sunset");
  const candidates = [];
  if (sunriseMin !== null && sunriseMin > nowMin) candidates.push({ kind: "sunrise", min: sunriseMin });
  if (sunsetMin !== null && sunsetMin > nowMin) candidates.push({ kind: "sunset", min: sunsetMin });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.min - b.min);
  const next = candidates[0];
  const delta = next.min - nowMin;
  let label;
  if (delta < 1) label = "now";
  else if (delta < 60) label = `${Math.round(delta)}m`;
  else {
    const h = Math.floor(delta / 60);
    const m = Math.round(delta % 60);
    label = m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const Icon = next.kind === "sunrise" ? Sunrise : Sunset;
  return (
    <div className="flex items-center gap-1.5 mb-3 -mt-1.5">
      <Icon size={12} className="text-dim shrink-0" />
      <span className="text-[11px] text-dim font-semibold uppercase tracking-[0.08em]">
        {next.kind} in {label}
      </span>
    </div>
  );
}
