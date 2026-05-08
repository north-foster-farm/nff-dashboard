import { useState } from "react";
import {
  Plus, X, Pencil, Check, Sunrise, Sunset, Clock,
} from "lucide-react";
import {
  useChoreBlocks,
  formatMinutesOfDay,
  parseMinutesOfDay,
  minutesOfDayToTimeInput,
  nowAsTimeInput,
  validateBlockWindow,
  displayBlockSide,
} from "../lib/data/useChoreBlocks.js";

// Chores → Blocks tab. Named windows of the day. Each block has a
// start (a fixed clock time, sunrise, or sunset) and a duration; the
// end is derived. Sunrise / sunset starts resolve to actual local
// times via SunCalc when rendered.

export default function ChoresBlocksTab() {
  const {
    blocks, blocksOrdered, loading,
    createBlock, updateBlock, deleteBlock,
  } = useChoreBlocks();
  const [creating, setCreating] = useState(false);

  const active = blocksOrdered.filter(b => b.isActive);
  const archived = blocksOrdered.filter(b => !b.isActive);

  if (loading) {
    return (
      <div className="bg-surface border border-line py-8 text-center text-[12px] text-muted uppercase tracking-[0.16em]">
        Loading blocks…
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <p className="text-[12px] text-dim m-0 max-w-[560px] leading-relaxed">
          Time blocks are named windows of the day chores get grouped
          into. Pick a start (clock time or sun event) and a duration;
          end is derived. Editing a block propagates to every chore in
          it.
        </p>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold px-3 py-1.5 cursor-pointer uppercase tracking-[0.12em] leading-none"
          >
            <Plus size={13} className="shrink-0" /> New block
          </button>
        )}
      </div>

      {creating && (
        <NewBlockForm
          allBlocks={blocks}
          onCancel={() => setCreating(false)}
          onCreate={async (input) => {
            await createBlock(input);
            setCreating(false);
          }}
        />
      )}

      {active.length === 0 && !creating ? (
        <div className="bg-surface border border-line py-10 px-6 text-center">
          <div className="text-[13px] text-muted font-medium mb-1">No time blocks yet</div>
          <div className="text-[12px] text-faint leading-relaxed max-w-[420px] mx-auto">
            Create a block to group chores by time of day. Once created,
            chores can be assigned to a block and their schedule will
            inherit the window.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {active.map(b => (
            <BlockCard
              key={b.id}
              block={b}
              allBlocks={blocks}
              onUpdate={updateBlock}
              onDelete={deleteBlock}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <details className="mt-4">
          <summary className="text-[11px] text-faint cursor-pointer">
            {archived.length} archived
          </summary>
          <div className="flex flex-col gap-1 mt-2">
            {archived.map(b => (
              <div
                key={b.id}
                className="flex items-center gap-2 px-3 py-1.5 text-faint text-[11px] bg-surface border border-line"
              >
                <span className="line-through flex-1">
                  {b.name} · {displayBlockSide(b.startKind, b.startMinutes)}
                  {" for "}
                  {formatDuration(b.durationMinutes)}
                </span>
                <button
                  onClick={() => updateBlock(b.id, { isActive: true })}
                  className="text-[11px] text-dim hover:text-fg border-0 bg-transparent cursor-pointer uppercase tracking-[0.12em] font-semibold"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function BlockCard({ block, allBlocks, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="bg-surface border border-line flex items-center gap-3 px-3 py-2.5">
        <span className="text-[14px] font-semibold text-fg flex-1">{block.name}</span>
        <SideBadge kind={block.startKind} minutes={block.startMinutes} />
        <span className="text-[11px] text-faint">for</span>
        <DurationBadge minutes={block.durationMinutes} />
        <button
          onClick={() => setEditing(true)}
          className="text-faint hover:text-fg border-0 bg-transparent cursor-pointer p-1"
          title="Edit"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDelete(block.id)}
          className="text-faint hover:text-red-500 border-0 bg-transparent cursor-pointer p-1"
          title="Archive"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <BlockEditor
      block={block}
      allBlocks={allBlocks}
      onCancel={() => setEditing(false)}
      onSave={async (patch) => {
        await onUpdate(block.id, patch);
        setEditing(false);
      }}
    />
  );
}

// Pill that shows either a clock time or a "Sunrise" / "Sunset" badge.
function SideBadge({ kind, minutes }) {
  if (kind === "sunrise") {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-dim">
        <Sunrise size={12} className="shrink-0" />
        <span>Sunrise</span>
      </span>
    );
  }
  if (kind === "sunset") {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-dim">
        <Sunset size={12} className="shrink-0" />
        <span>Sunset</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-dim">
      <Clock size={11} className="shrink-0" />
      <span>{formatMinutesOfDay(minutes)}</span>
    </span>
  );
}

function DurationBadge({ minutes }) {
  return (
    <span className="text-[12px] text-dim">{formatDuration(minutes)}</span>
  );
}

// "1h 30m" / "45m" / "2h" — short, glanceable.
function formatDuration(minutes) {
  if (typeof minutes !== "number" || Number.isNaN(minutes) || minutes <= 0) {
    return "—";
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Shared editor for create + edit. Start is a sun-or-clock segmented
// control; duration is a number-of-minutes input.
function BlockEditor({ block, allBlocks, onCancel, onSave }) {
  const [name, setName] = useState(block?.name ?? "");
  const [startKind, setStartKind] = useState(block?.startKind ?? "fixed");
  const [startTime, setStartTime] = useState(
    block?.startKind === "fixed" && typeof block?.startMinutes === "number"
      ? minutesOfDayToTimeInput(block.startMinutes)
      : ""
  );
  const [durationStr, setDurationStr] = useState(
    typeof block?.durationMinutes === "number"
      ? String(block.durationMinutes)
      : "120"
  );
  const [errorMsg, setErrorMsg] = useState(null);

  // When toggling start from sun-event to fixed, default to "now"
  // so the input never opens with an empty value.
  const setStartKindAndDefault = (k) => {
    setStartKind(k);
    if (k === "fixed" && !startTime) setStartTime(nowAsTimeInput());
  };

  const submit = async () => {
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg("Block needs a name.");
      return;
    }
    let startMinutes = null;
    if (startKind === "fixed") {
      startMinutes = parseMinutesOfDay(startTime);
      if (startMinutes === null) {
        setErrorMsg("Start time isn't valid.");
        return;
      }
    }
    const durationMinutes = parseInt(durationStr, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setErrorMsg("Duration needs to be a positive number of minutes.");
      return;
    }
    const valid = validateBlockWindow({
      id: block?.id ?? null,
      startKind, startMinutes, durationMinutes,
      allBlocks,
    });
    if (!valid.ok) {
      setErrorMsg(valid.reason);
      return;
    }
    const patch = {
      name: name.trim(),
      startKind,
      startMinutes,
      durationMinutes,
    };
    try {
      await onSave(patch);
    } catch (err) {
      setErrorMsg(err?.message ?? "Save failed.");
    }
  };

  return (
    <div className="bg-surface-alt border border-line p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Block name (e.g. Morning, Mid-day)"
          className="flex-1 bg-surface text-fg border border-line px-2 py-1.5 outline-none focus:border-accent text-[13px] font-[inherit]"
        />
        <button
          onClick={submit}
          className="text-muted hover:text-accent p-1 cursor-pointer bg-transparent border-0"
          aria-label="Save"
        >
          <Check size={14} />
        </button>
        <button
          onClick={onCancel}
          className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SideEditor
          label="Start"
          kind={startKind}
          time={startTime}
          onKind={setStartKindAndDefault}
          onTime={setStartTime}
        />
        <DurationEditor
          minutesStr={durationStr}
          onChange={setDurationStr}
        />
      </div>

      {errorMsg && (
        <div className="text-[11px] text-red-500">{errorMsg}</div>
      )}
    </div>
  );
}

// Start side of a block. A small segmented control chooses between
// Time / Sunrise / Sunset; a time input shows when kind is 'fixed'
// and disappears for sunrise / sunset.
function SideEditor({ label, kind, time, onKind, onTime }) {
  const options = [
    { id: "fixed",   icon: Clock,   label: "Time" },
    { id: "sunrise", icon: Sunrise, label: "Sunrise" },
    { id: "sunset",  icon: Sunset,  label: "Sunset" },
  ];
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.12em] text-faint font-semibold">
        {label}
      </span>
      <div className="inline-flex border border-line">
        {options.map((o, i) => {
          const Icon = o.icon;
          const active = kind === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onKind(o.id)}
              className={
                "inline-flex items-center gap-1 px-2 py-1 text-[10px] " +
                "uppercase tracking-[0.12em] font-semibold cursor-pointer " +
                "border-0 transition-colors duration-100 " +
                (active
                  ? "bg-row-active text-fg"
                  : "bg-transparent text-dim hover:bg-row-hover hover:text-fg") +
                (i > 0 ? " border-l border-line" : "")
              }
              aria-pressed={active}
              title={o.label}
            >
              <Icon size={11} className="shrink-0" />
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
      {kind === "fixed" && (
        <input
          type="time"
          value={time}
          onChange={(e) => onTime(e.target.value)}
          className="bg-surface border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent font-[inherit]"
        />
      )}
    </div>
  );
}

// Duration side of a block. Plain integer input + "min" suffix —
// fine-grained enough that anyone can express any window length
// without an h/m parser to maintain.
function DurationEditor({ minutesStr, onChange }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.12em] text-faint font-semibold">
        Duration
      </span>
      <input
        type="number"
        min="1"
        max="1440"
        step="5"
        value={minutesStr}
        onChange={(e) => onChange(e.target.value)}
        className="w-[80px] bg-surface border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent font-[inherit]"
      />
      <span className="text-[11px] text-faint">min</span>
    </div>
  );
}

function NewBlockForm({ allBlocks, onCancel, onCreate }) {
  return (
    <div className="mb-3">
      <BlockEditor
        block={null}
        allBlocks={allBlocks}
        onCancel={onCancel}
        onSave={onCreate}
      />
    </div>
  );
}
