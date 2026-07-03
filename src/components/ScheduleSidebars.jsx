import { useState } from "react";
import {
  LayoutList, AlertTriangle, ChevronLeft, ChevronRight, Moon, UserX,
} from "lucide-react";
import {
  BadgeHint, CoveredBadge, KindBadge, NowEdgeLine, NowRule, WarmingBadge,
  hatchConflict, hatchCover, hatchUnplanned, kindTint,
} from "./ui.jsx";
import { formatMinutesOfDay } from "../lib/sunTimes.js";

// Schedule navigators (Design Bracket 2 — the day-spine + accordion rework).
// The day is navigated by its SHAPE: a load-spine (desktop, vertical) / a
// day-strip (phone, horizontal) is the primary control; selecting a segment
// drives the center to that one block (master-detail). Both read as a labelled
// TIME AXIS — each segment carries the block's sun-position glyph + start time,
// over a faint dawn->night wash — so tapping reads as "pick a time of day,"
// not "poke a box."
//
// Two coordinated markers everywhere a "current vs chosen" split exists:
//   the CLOCK's pick gets a RING (now);  YOUR pick gets a FILL (focus/selected).
// Same rule on the spine, the strip, and the week pane (today=ring, viewed=fill).

// Scale an item count to a bar size in px, between min and min+span.
function barSize(count, max, min, span) {
  if (!count) return min;
  return Math.round(min + (count / Math.max(1, max)) * span);
}

// Coarse-duration sizing for Project gaps — three steps (short / mid / long),
// not pixel-accurate (the duration-to-height navigator rewrite is deferred).
function projSize(durationMin, min, span) {
  const t = durationMin == null ? 0.25
    : durationMin >= 150 ? 1 : durationMin >= 60 ? 0.55 : 0.25;
  return Math.round(min + t * span);
}

// Short who's-free tag for a Project gap's structured availability.
function freeShort(who) {
  const n = who?.freeCount ?? 0;
  if (n >= 2) return "both";
  if (n === 1) return who?.who?.[0] ?? "";
  return "";
}

// The heaviest chore-block load on the day (Project gaps carry no count).
function maxLoad(blocks) {
  return blocks.reduce((m, b) => Math.max(m, b.count ?? 0), 1);
}

// Compact clock label ("6a", "8:30a", "1p") — the time axis.
function compactTime(min) {
  if (min == null) return "";
  return formatMinutesOfDay(min).replace(":00", "");
}

// "6a–8:30a" — tooltips carry BOTH ends of the window (round 5).
function compactRange(startMin, endMin) {
  if (startMin == null) return "";
  if (endMin == null || endMin === startMin) return compactTime(startMin);
  return compactTime(startMin) + "–" + compactTime(endMin);
}

// The covered tooltip body (F9): lead with the coverage — who covers —
// then what. (Round 6) an `ack` cover — the "Nobody at the farm"
// acknowledgement — reads "acknowledged", not "covered". The hanging
// indent keeps a wrapped entry visually one line, not two entries.
function coveredTip(covered) {
  return (covered ?? []).map((c, i) => (
    <span key={i} className="block pl-3 -indent-3">
      <b className="text-fg font-semibold">
        {c.by ? `${c.by} covers`
          : c.ack ? "Acknowledged" : "Covered"}
      </b>
      {` — ${c.label}`}
    </span>
  ));
}

// Needs-cover rows wear the project-hatch language in the WARN color
// (round 5), layered over the kind tint so identity still reads.
const coverWash = (base) => [hatchCover(12), base].join(", ");

// Split a strip time into its numeric part and am/pm period so the phone
// strip can stack them on two fixed lines. Without this the inline
// "5:15 AM" wraps where it likes, giving some columns one tier and others
// three — F41. The number line never wraps; am/pm always sits on its own
// line; every column is exactly two tiers tall.
function StripTime({ min, className }) {
  const full = compactTime(min);
  const sp = full.lastIndexOf(" ");
  const num = sp === -1 ? full : full.slice(0, sp);
  const period = sp === -1 ? "" : full.slice(sp + 1);
  return (
    <span className={className}>
      <span className="block leading-tight whitespace-nowrap">{num}</span>
      <span className="block leading-tight text-[8px] tracking-wider">
        {period}
      </span>
    </span>
  );
}

// F11 (settled 2026-07-01) — spine block names stay in the body sans at
// 12px, matching the This Week day labels (the one inconsistency was
// SIZE, and the smaller size won). One weight for active AND inactive:
// the row fill/border carries the state, the type never jumps.
const SPINE_TITLE_CLS =
  "block text-[12px] truncate leading-tight text-fg font-medium";

// (BadgeHint moved to ui.jsx — round 4: This Week wears it too, so the
// cue is a kit primitive now, imported above.)

// ── Desktop load-spine (the primary navigator) ──────────────────────────
// Restyled to the WeekStrip visual language (findings slice B): no dividers,
// an outlined active row (the border IS the indicator), lighter-on-hover,
// equal heights, lettered KindBadge identity, and the canonical NowRule in
// the list. Block names collapse to "Chores" (F12) — the C badge + time
// carry the identity, like every project reads "Project".
export function DayRailSpine({
  blocks, focus, nowBucket, nowMin, nowEdge, onPick, onPickTimeOff,
}) {
  const nowTime = nowMin != null ? compactTime(nowMin) : null;
  // Now outside the day's blocks (nowEdge): no row is current — the
  // horizontal NowRule sits full-width above the first block (now is
  // earlier) or below the last (now is later).
  const edgeRule = nowTime != null && (
    <NowRule time={nowTime} className="px-2 py-1" />
  );

  // One row shell (F1/F2/F3): a border that stays transparent until the row
  // is the focus (the active bounding box); equal heights — the load rail
  // self-stretches now, so item count no longer drives the row height. The
  // CURRENT block reads as a green-accent fill + the NowRule as its time
  // line (F5) — the marker rides IN the row, never a rule above it (a rule
  // above a row read as belonging to the gap).
  const rowCls = (isFocus, allDone, isNow) =>
    "relative z-[1] w-full flex items-center gap-2 px-2 py-2 text-left "
    + "min-h-[46px] border cursor-pointer transition-colors "
    + (isFocus
      ? "bg-row-active border-resolved "
      : (isNow ? "bg-accent/[0.08] " : "") + "border-transparent hover:bg-row-hover ")
    + (allDone ? "opacity-55" : "");

  return (
    /* F28 + round-2 feedback — the desktop whole-day overview is GONE:
       the spine's rows ARE the day nav, one block is always open, and
       the row tooltips carry what the overview listed (real block name,
       done count, alerts). 200px FIXED — narrower than the old 240, and
       deliberately not content-sized (a shifting center pane on day
       clicks is worse than any width). Mobile keeps its Whole-day
       toggle. */
    <div className="hidden lg:flex flex-col gap-1 w-[200px] shrink-0 border-r border-line bg-bg relative px-2 pt-2">
      {nowEdge === "before" && edgeRule}
      {blocks.map((b) => {
        const isFocus = b.bucket === focus;
        const isNow = nowTime != null && b.bucket === nowBucket;

        if (b.isProject) {
          const free = freeShort(b.who);
          // F9 — the row's fill says planned vs free: the kind tint (the
          // list-group wash every spine row wears) when a step occupies
          // the gap, the blue cross-hatch when it's unbooked. Both are
          // alpha background-IMAGES so the shell's hover/active/now
          // background-color tints still show through.
          // Hatch at 10 (was 16) — round 4: the 12px row text sat on the
          // heavier diagonals and got hard to read in light mode; the
          // rail + badge + "both free" tag carry the free signal, so the
          // row hatch only needs to whisper.
          // Round 6 — an UNPLANNED row that also needs cover wears ONE
          // alternating warn/slate stripe set (stacking the warn hatch
          // over the blue hatch read as mud); a planned row keeps the
          // warn stripes over its flat tint.
          const projFill = b.needsCover
            ? (b.planned
              ? coverWash(kindTint("--c-project"))
              : hatchConflict("--c-project", 14, 10))
            : (b.planned ? kindTint("--c-project") : hatchUnplanned(10));
          return (
            <button
              key={b.bucket}
              type="button"
              onClick={() => onPick(b.bucket)}
              className={rowCls(isFocus, b.allDone, isNow)}
              style={{ backgroundImage: projFill }}
            >
              {/* slate gap rail — full height, saturated like the chore
                  rail; the P badge carries the identity now, so the
                  title is plain text (F10). */}
              <span
                className="w-[5px] self-stretch shrink-0 ring-1 ring-inset ring-project"
                style={{ background: "var(--c-project)", opacity: 0.9 }}
              />
              <BadgeHint
                tip={<>
                  <b className="text-fg">Project</b>
                  {"\n"}{compactRange(b.startMin, b.endMin)}
                  {"\n"}
                  {b.planned
                    ? "planned" + (free ? ` · ${free} free` : "")
                    : free ? `${free} free` : "free"}
                  {b.needsCover && (
                    <span className="block text-warn">needs cover</span>
                  )}
                </>}
              >
                <KindBadge kind="project" size={16} />
              </BadgeHint>
                <span className="flex-1 min-w-0">
                  <span className={SPINE_TITLE_CLS}>
                    Project
                  </span>
                  {/* F5 — the CURRENT block's time line IS the NowRule
                      (dot + "Now · time" + hairline); who's-free rides
                      after the rule as its trailing annotation. */}
                  {isNow ? (
                    <NowRule time={nowTime} size="sm" className="pr-1">
                      {free && (
                        <span className="shrink-0 text-[10px] text-project font-semibold">
                          {free} free
                        </span>
                      )}
                    </NowRule>
                  ) : (
                    <span className="block text-[10px] [font-variant-numeric:tabular-nums] leading-tight">
                      <span className="text-faint">{compactTime(b.startMin)}</span>
                      {free && (
                        <span className="text-project font-semibold"> · {free} free</span>
                      )}
                    </span>
                  )}
                </span>
            </button>
          );
        }

        // F45 — a person's time off rides the spine as a quiet marker
        // row: no kind rail, no fill, a muted out glyph + "«person»
        // out" + the window. It isn't a work segment, so it never
        // takes focus — clicking opens the Availability page.
        if (b.kind === "timeoff") {
          const when = b.allDay
            ? "All day"
            : compactRange(b.startMin, b.endMin);
          return (
            <button
              key={b.bucket}
              type="button"
              onClick={onPickTimeOff}
              className={
                "relative z-[1] w-full flex items-center gap-2 px-2 "
                + "py-2 text-left min-h-[46px] border "
                + "border-transparent cursor-pointer "
                + "transition-colors hover:bg-row-hover"
              }
            >
              {/* hollow rail — the absence keeps the rows' left
                  gutter without claiming a kind color. */}
              <span
                className="w-[5px] self-stretch shrink-0"
                style={{
                  boxShadow:
                    "inset 0 0 0 1px var(--color-line)",
                }}
              />
              <BadgeHint
                tip={<>
                  <b className="text-fg">{b.person} — time off</b>
                  {"\n"}{when}
                  {"\n"}Opens Availability
                </>}
              >
                <UserX size={16} className="shrink-0 text-muted" />
              </BadgeHint>
              <span className="flex-1 min-w-0">
                <span className={SPINE_TITLE_CLS}>
                  {b.person} out
                </span>
                <span className="block text-[10px] [font-variant-numeric:tabular-nums] text-faint leading-tight truncate">
                  {when}
                </span>
              </span>
            </button>
          );
        }

        // Events ride the block list too, where present — a periwinkle E badge
        // + the event title + its start time (a thin periwinkle gap rail).
        if (b.kind === "event") {
          const occ = b.occ;
          return (
              <button
                key={b.bucket}
                type="button"
                onClick={() => onPick(b.bucket)}
                className={rowCls(isFocus, false, isNow)}
                style={{
                  backgroundImage: b.needsCover
                    ? coverWash(kindTint("--c-event"))
                    : kindTint("--c-event"),
                }}
              >
                <span
                  className="w-[5px] self-stretch shrink-0 ring-1 ring-inset ring-event"
                  style={{ background: "var(--c-event)", opacity: 0.9 }}
                />
                {/* Round 6 — the row reads "Event" like chores read
                    "Chores"; the E badge's hover carries the identity:
                    the event's TYPE, NAME, and LOCATION. A location is
                    an object ({ name, address }) — never render it raw. */}
                <BadgeHint
                  tip={<>
                    {occ?.kindLabel && (
                      <span className="block text-faint">
                        {occ.kindLabel}
                      </span>
                    )}
                    <b className="text-fg">{occ?.instanceLabel ?? "Event"}</b>
                    {occ?.location && (
                      <span className="block">
                        {typeof occ.location === "string"
                          ? occ.location
                          : [occ.location.name, occ.location.address]
                            .filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {"\n"}
                    {b.startMin != null
                      ? compactRange(b.startMin, b.endMin) : "All day"}
                  </>}
                >
                  <KindBadge kind="event" size={16} />
                </BadgeHint>
                <span className="flex-1 min-w-0">
                  <span className={SPINE_TITLE_CLS}>
                    Event
                  </span>
                  {isNow ? (
                    <NowRule time={nowTime} size="sm" className="pr-1" />
                  ) : (
                    <span className="block text-[10px] [font-variant-numeric:tabular-nums] text-faint leading-tight truncate">
                      {b.startMin != null ? compactTime(b.startMin) : "All day"}
                    </span>
                  )}
                </span>
              </button>
          );
        }

        // Every remaining block is a chore block. Regular blocks read "Chores"
        // (F12); the overnight wrap reads "Overnight" + a Moon badge on the
        // right edge (teal). The C badge + time carry the identity (F6: no
        // done/count suffix in the title). The tooltip carries what the
        // retired whole-day overview listed: the block's REAL name, the
        // done count, and its alerts.
        const count = b.count ?? 0;
        // F14 — overnight reads "Until <end>" (lead, rode in from yesterday)
        // or "After <start>" (trail, runs into tomorrow); else the start time.
        const timeText = b.isOvernight
          ? (b.side === "lead"
            ? "Until " + compactTime(b.winEnd)
            : "After " + compactTime(b.winStart))
          : compactTime(b.startMin);
        // Tooltips carry the whole window (round 5).
        const rangeText = b.isOvernight
          ? compactRange(b.winStart, b.winEnd)
          : compactRange(b.startMin, b.endMin);
        return (
            <button
              key={b.bucket}
              type="button"
              onClick={() => onPick(b.bucket)}
              className={rowCls(isFocus, b.allDone, isNow)}
              style={{
                backgroundImage: b.needsCover
                  ? coverWash(kindTint("--c-chore"))
                  : kindTint("--c-chore"),
              }}
            >
              {/* identity rail — solid teal, same weight as every kind's
                  rail (the old done-fraction meter is retired; the tooltip
                  carries the count). */}
              <span
                className="w-[5px] self-stretch shrink-0 ring-1 ring-inset ring-chore"
                style={{ background: "var(--c-chore)", opacity: 0.9 }}
              />
              <BadgeHint
                tip={<>
                  <b className="text-fg">
                    {b.isOvernight ? "Overnight" : (b.name ?? "Chores")}
                  </b>
                  {"\n"}{b.done ?? 0} of {count} done · {rangeText}
                  {b.needsCover && (
                    <span className="block text-warn">needs cover</span>
                  )}
                </>}
              >
                <KindBadge kind="chore" size={16} />
              </BadgeHint>
              <span className="flex-1 min-w-0">
                <span className={SPINE_TITLE_CLS}>
                  {b.isOvernight ? "Overnight" : "Chores"}
                </span>
                {isNow ? (
                  <NowRule time={nowTime} size="sm" className="pr-1" />
                ) : (
                  <span className="block text-[10px] [font-variant-numeric:tabular-nums] text-faint leading-tight truncate">
                    {timeText}
                  </span>
                )}
              </span>
              {/* Round 4 — the row-edge glyphs wear the affordance
                  standard too (BadgeHint / cue), not bare icons. */}
              {b.needsCover && (
                <BadgeHint
                  tip={<>
                    <b className="text-fg">Needs cover</b>
                    {"\n"}a time off / event overlaps this block
                  </>}
                >
                  <AlertTriangle size={13} className="shrink-0 text-warn" />
                </BadgeHint>
              )}
              {/* Round 5 — accepted cover reads as the muted circle-
                  alert; hover says what was covered and who accepted. */}
              {!b.needsCover && (b.covered?.length ?? 0) > 0 && (
                <CoveredBadge cue tip={coveredTip(b.covered)} />
              )}
              {/* F24b — the day-load's warn/due ClockAlert repeats on the
                  block that owns the warming chore (count hidden; the row is
                  one block, so the hover detail carries the names). */}
              <WarmingBadge
                warn={b.warn} due={b.due} size={13} showCount={false} cue
              />
              {/* Overnight wrap: a teal Moon on the right edge of the block. */}
              {b.isOvernight && (
                <BadgeHint
                  tip={<>
                    <b className="text-fg">Overnight — wraps past midnight</b>
                    {(b.items ?? []).map((d) => (
                      <span key={d.id} className="block">
                        {d.source_ref?.title ?? "task"}
                      </span>
                    ))}
                  </>}
                >
                  <Moon size={14} className="shrink-0 text-chore" />
                </BadgeHint>
              )}
            </button>
        );
      })}
      {nowEdge === "after" && edgeRule}
    </div>
  );
}

// ── Phone day-strip (the navigable time axis — James's tweak) ───────────
// The columns carry no rest-state fill (the F29 gray "key" fill was
// dropped in 42.3 round 3 — it read as a backdrop, not an affordance);
// the bars themselves + the press tint say "tap me". Shared across the
// chore / project / overnight column variants.
const STRIP_COL_CLS =
  "flex-1 min-w-0 flex flex-col items-center cursor-pointer " +
  "transition-colors hover:bg-row-hover active:bg-row-active pt-1 ";

// A pager slot button (42.3 round 3): the strip shows at most 4 rails at
// a time; arrows page the group with a directional slide.
function StripPagerArrow({ dir, onClick }) {
  const Icon = dir > 0 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir > 0 ? "Later blocks" : "Earlier blocks"}
      className={
        "shrink-0 w-9 self-stretch flex items-center justify-center "
        + "border border-line text-dim cursor-pointer transition-colors "
        + "hover:bg-row-hover active:bg-row-active"
      }
    >
      <Icon size={16} />
    </button>
  );
}

export function DayStrip({
  blocks, focus, nowBucket, nowEdge, summary, onPick, onWholeDay,
}) {
  const max = maxLoad(blocks);
  const overview = focus == null;

  // Pager (42.3 round 3): at most 4 rails at a time. 5 slots total —
  // ≤5 rails shows everything; more pages: one arrow leaves 4 rails, two
  // arrows leave 3. The default page starts at the NOW rail (or the last
  // page when now is past the day). Key the component by day at the call
  // site so a day change resets the page.
  const total = blocks.length;
  const [pageStart, setPageStart] = useState(null); // null = follow now
  const [dir, setDir] = useState(0);
  const nowIdx = blocks.findIndex((b) => b.bucket === nowBucket);
  let s = pageStart
    ?? (nowEdge === "after" ? total - 1 : Math.max(0, nowIdx));
  let winSize = total;
  let hasLeft = false;
  let hasRight = false;
  if (total > 5) {
    s = Math.min(Math.max(s, 0), total - 1);
    hasLeft = s > 0;
    winSize = hasLeft ? (s + 4 >= total ? 4 : 3) : 4;
    if (hasLeft && winSize === 4) s = total - 4;
    hasRight = s + winSize < total;
  } else {
    s = 0;
  }
  const visible = blocks.slice(s, s + winSize);
  const page = (d) => {
    setDir(d);
    setPageStart(Math.max(0, s + d * winSize));
  };

  return (
    <div className="lg:hidden border-b border-line bg-bg">
      {/* Header matches the desktop day-load pane: the same eyebrow + the
          same count line (one shared `summary` node — they can't drift).
          The counts take their own line — the eyebrow + Whole-day toggle
          fill the first, and a phone column can't fit all three. */}
      {/* pt-0 (round 6): the page heading's own margin is the whole gap
          above the day load. */}
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Day load
        </span>
        <button
          type="button"
          onClick={onWholeDay}
          className={
            "shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 "
            + "border cursor-pointer transition-colors "
            + (overview
              ? "border-accent-deep bg-[color:var(--color-row-active)] text-accent"
              : "border-line text-muted hover:text-dim hover:bg-row-hover "
                + "active:bg-row-active")
          }
        >
          <LayoutList size={12} /> Whole day
        </button>
      </div>
      <div className="pb-1 flex font-ui text-[10px] text-faint [font-variant-numeric:tabular-nums]">
        {summary}
      </div>
      {/* pb-3 (round 6): even air on both sides of the divider below —
          the toolbar under it takes the matching mt-3. */}
      <div className="pb-3">
        {/* No baseline border — the day load is chromeless (round 4). */}
        {/* overflow-x-clip: the pager track slides in from ±16px
            (nff-page-from-*), and iOS Safari counts that transformed
            excursion toward the PAGE's scroll bounds — the whole page
            went sideways-scrollable during/after a page (round 4 BUG).
            Clip the strip's own row; horizontal only, so the
            NowEdgeLine's glow dot stays unclipped vertically. */}
        <div className="flex items-stretch gap-1.5 overflow-x-clip px-1 -mx-1 pt-1 -mt-1">
          {nowEdge === "before" && s === 0 && (
            <NowEdgeLine className="my-1" />
          )}
          {hasLeft && <StripPagerArrow dir={-1} onClick={() => page(-1)} />}
          <div
            key={s}
            className="nff-anim-page flex-1 min-w-0 flex items-end gap-1.5"
            style={dir !== 0 ? {
              animation:
                `nff-page-from-${dir > 0 ? "right" : "left"} 140ms ease`,
            } : undefined}
          >
          {visible.map((b) => {
            if (b.isProject) {
              const free = freeShort(b.who);
              const h = projSize(b.durationMin, 14, 40);
              const isFocus = b.bucket === focus;
              const isNow = b.bucket === nowBucket;
              return (
                <button
                  key={b.bucket}
                  type="button"
                  onClick={() => onPick(b.bucket)}
                  title={`Project${free ? " · " + free + " free" : ""}`}
                  className={STRIP_COL_CLS + (b.allDone ? "opacity-60" : "")}
                >
                  <span className="relative w-full h-[56px] flex items-end justify-center">
                    {/* F9 — same planned/unplanned fill as the desktop rows
                        and the LoadSpine bars: solid project wash when a
                        step occupies the gap, blue cross-hatch when free.
                        Focus/now wear the SAME offset inset ring as the
                        chore bars (round 5 — the ring-project recolor
                        didn't read as the active marker). */}
                    <span
                      className="relative w-full"
                      style={{
                        height: h + "px",
                        boxShadow:
                          "inset 0 0 0 1px color-mix(in srgb,"
                          + " var(--c-project) 40%, transparent)",
                        // Round 6 — needs-cover: ONE alternating warn/
                        // slate stripe set at the strip's 45% strength
                        // (same language as the spine rows + day-load).
                        ...(b.needsCover
                          ? { backgroundImage: hatchConflict("--c-project", 45, 45) }
                          : b.planned
                            ? {
                              background:
                                "color-mix(in srgb, var(--c-project) 45%, transparent)",
                            }
                            : { backgroundImage: hatchUnplanned(45) }),
                      }}
                    >
                      {(isNow || isFocus) && (
                        <span
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            boxShadow: isNow
                              ? "inset 0 0 0 calc(2px * var(--inv-zoom)) var(--color-accent-deep), "
                                + "inset 0 0 0 calc(3px * var(--inv-zoom)) var(--color-bg)"
                              : "inset 0 0 0 calc(1px * var(--inv-zoom)) var(--color-accent), "
                                + "inset 0 0 0 calc(2px * var(--inv-zoom)) var(--color-bg)",
                          }}
                        />
                      )}
                    </span>
                  </span>
                  {/* No glyph above the time (round 4) — the kind color
                      on the time + bar carries the identity. */}
                  <StripTime
                    min={b.startMin}
                    className={
                      "mt-0.5 pb-0.5 text-center text-[10.5px] "
                      + "[font-variant-numeric:tabular-nums] "
                      + "border-b-2 text-project font-medium "
                      + (isFocus ? "border-project font-bold" : "border-transparent")
                    }
                  />
                </button>
              );
            }
            if (b.kind === "event") {
              const isFocus = b.bucket === focus;
              const isNow = b.bucket === nowBucket;
              return (
                <button
                  key={b.bucket}
                  type="button"
                  onClick={() => onPick(b.bucket)}
                  title={b.occ?.instanceLabel ?? "Event"}
                  className={STRIP_COL_CLS}
                >
                  <span className="relative w-full h-[56px] flex items-end justify-center">
                    <span
                      className="relative w-full h-[28px]"
                      style={{
                        background:
                          "color-mix(in srgb, var(--c-event) 45%, transparent)",
                        boxShadow:
                          "inset 0 0 0 1px color-mix(in srgb,"
                          + " var(--c-event) 55%, transparent)",
                      }}
                    >
                      {(isNow || isFocus) && (
                        <span
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            boxShadow: isNow
                              ? "inset 0 0 0 calc(2px * var(--inv-zoom)) var(--color-accent-deep), "
                                + "inset 0 0 0 calc(3px * var(--inv-zoom)) var(--color-bg)"
                              : "inset 0 0 0 calc(1px * var(--inv-zoom)) var(--color-accent), "
                                + "inset 0 0 0 calc(2px * var(--inv-zoom)) var(--color-bg)",
                          }}
                        />
                      )}
                    </span>
                  </span>
                  <StripTime
                    min={b.startMin}
                    className={
                      "mt-0.5 pb-0.5 text-center text-[10.5px] "
                      + "[font-variant-numeric:tabular-nums] "
                      + "border-b-2 text-event font-medium "
                      + (isFocus
                        ? "border-event font-bold" : "border-transparent")
                    }
                  />
                </button>
              );
            }
            if (b.isOvernight) {
              const isFocus = b.bucket === focus;
              const isNow = b.bucket === nowBucket;
              return (
                <button
                  key={b.bucket}
                  type="button"
                  onClick={() => onPick(b.bucket)}
                  title={`Overnight · ${b.rangeLabel}`}
                  className={STRIP_COL_CLS + (b.allDone ? "opacity-60" : "")}
                >
                  <span className="relative w-full h-[56px] flex items-end justify-center">
                    <span
                      className="w-full h-[20px]"
                      style={{
                        // alpha lives in the fill, not the element — an
                        // element-level opacity would fade the ring too
                        background:
                          "color-mix(in srgb, var(--color-chore) 55%, transparent)",
                        boxShadow: isNow
                          ? "inset 0 0 0 calc(2px * var(--inv-zoom)) var(--color-accent-deep), "
                            + "inset 0 0 0 calc(3px * var(--inv-zoom)) var(--color-bg)"
                          : isFocus
                            ? "inset 0 0 0 calc(1px * var(--inv-zoom)) var(--color-accent-deep)"
                            : "none",
                      }}
                    />
                  </span>
                  <span className={
                    "mt-0.5 pb-0.5 text-[10.5px] [font-variant-numeric:tabular-nums] "
                    + "border-b-2 truncate max-w-full "
                    + (isFocus ? "text-accent-deep font-bold border-accent-deep"
                      : isNow ? "text-resolved font-bold border-transparent"
                        : "text-faint border-transparent")
                  }>
                    o/n
                  </span>
                </button>
              );
            }
            const isNow = b.bucket === nowBucket;
            const isFocus = b.bucket === focus;
            const h = barSize(b.count, max, 14, 40);
            const fillH = b.count ? Math.round(h * (b.done / b.count)) : 0;
            const remH = b.count ? h - fillH : 0;
            return (
              <button
                key={b.bucket}
                type="button"
                onClick={() => onPick(b.bucket)}
                title={`${b.name} · ${b.done}/${b.count}`}
                className={STRIP_COL_CLS + (b.allDone ? "opacity-60" : "")}
              >
                <span className="relative w-full h-[56px] flex items-end justify-center">
                  <span
                    className="relative w-full flex flex-col-reverse"
                    style={{
                      height: h + "px",
                      background: "var(--color-surface-alt)",
                      boxShadow: "inset 0 0 0 1px var(--color-line)",
                    }}
                  >
                    <span style={{ height: fillH + "px", background: "var(--color-resolved)" }} />
                    {/* remainder in the chore identity teal (F9 — chores
                        don't borrow accent green), matching the desktop
                        rail. Round 6: needs-cover = the SAME alternating
                        warn/teal stripes as the desktop day-load bars
                        (the old warn dot above the rail is gone). */}
                    <span style={{
                      height: remH + "px",
                      ...(b.needsCover
                        ? { backgroundImage: hatchConflict("--c-chore") }
                        : {
                          background: "var(--color-chore)",
                          opacity: 0.85,
                        }),
                    }} />
                    {/* now/focus ring as an INSET overlay painted ABOVE the
                        fills — a box-shadow on the bar itself sits under
                        its children, and an outset ring falsifies the bar's
                        height against its neighbours. Accent is the active-
                        state color, and green-on-teal has no hue contrast,
                        so the ring is OFFSET: a bg-colored separation line
                        between ring and fill does the contrast work
                        (luminance, not saturation) on any fill, any theme.
                        Widths are inverse-zoom-compensated (--inv-zoom) so
                        the ring rasterizes at a true 2px at any density —
                        raw px would paint 2.4px+ and antialias a mud pixel
                        onto one flank. */}
                    {(isNow || isFocus) && (
                      <span
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          boxShadow: isNow
                            ? "inset 0 0 0 calc(2px * var(--inv-zoom)) var(--color-accent-deep), "
                              + "inset 0 0 0 calc(3px * var(--inv-zoom)) var(--color-bg)"
                            : "inset 0 0 0 calc(1px * var(--inv-zoom)) var(--color-accent), "
                              + "inset 0 0 0 calc(2px * var(--inv-zoom)) var(--color-bg)",
                        }}
                      />
                    )}
                  </span>
                </span>
                <StripTime
                  min={b.startMin}
                  className={
                    "mt-0.5 pb-0.5 text-center text-[10.5px] "
                    + "[font-variant-numeric:tabular-nums] "
                    + "border-b-2 transition-colors "
                    + (isFocus
                      ? "text-accent font-bold border-accent"
                      : isNow
                        ? "text-resolved font-bold border-transparent"
                        : "text-faint border-transparent")
                  }
                />
              </button>
            );
          })}
          </div>
          {hasRight && <StripPagerArrow dir={1} onClick={() => page(1)} />}
          {nowEdge === "after" && !hasRight && (
            <NowEdgeLine className="my-1" />
          )}
        </div>
      </div>
    </div>
  );
}

// (Round-3 NO-LEGACY) `WeekList` was deleted — the desktop week sidebar is now
// the one `WeekStrip` (ui.jsx), reading the shared farmLoad week/heat. It folded
// in this pane + the old center `WeekSpines`.
