import { useState } from "react";
import {
  Check, Pencil, Plus, Trash2, Wheat, X,
} from "lucide-react";
import { useFeedSchedules } from "../lib/data/useFeedSchedules.js";
import { describeConsumption } from "../lib/feedConsumption.js";
import { BTN_ACCENT } from "../components/ui.jsx";

// The feed schedule editor (Batch 25.2) — replaces the "Manage feed"
// coming-soon placeholder. Every batch of animals is on a feed
// program; this page is where those programs get written down:
// per-species schedules made of stages (day ranges anchored to
// arrival), each stage naming a feed type and a metered daily amount.
//
// These numbers are what the Feed page's reorder projections run on —
// a free-choice or TBD stage can't be projected, so the editor nudges
// toward metered amounts.

export default function FeedSchedulesPage({ data }) {
  const db = useFeedSchedules();
  const species = data.livestock?.species ?? [];
  const feeds = data.feeds ?? [];
  const [creatingFor, setCreatingFor] = useState(null); // speciesId | null

  if (db.loading) {
    return <div className="text-[12px] text-dim italic">Loading…</div>;
  }

  return (
    <div className="max-w-[860px] flex flex-col gap-6">
      <div className="text-[11px] text-muted leading-relaxed max-w-[700px]">
        Feed programs by species: what each assigned group eats, how
        much per day, and when the amounts change as the animals age.
        Day ranges count from the group&rsquo;s arrival date. The Feed
        page&rsquo;s reorder projections run on these numbers — metered
        amounts project; free-choice and TBD stages can&rsquo;t.
      </div>

      {species.map(sp => {
        const schedules = db.schedules.filter(s => s.speciesId === sp.id);
        return (
          <section key={sp.id} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-3">
              <h3 className="font-ui text-[11px] uppercase tracking-[0.16em] font-semibold text-muted m-0">
                {sp.name}
              </h3>
              <button
                onClick={() => setCreatingFor(
                  creatingFor === sp.id ? null : sp.id
                )}
                className="bg-transparent border-0 p-0 font-[inherit] text-[11px] text-accent-deep hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <Plus size={11} /> New schedule
              </button>
            </div>

            {creatingFor === sp.id && (
              <NewScheduleForm
                species={sp}
                db={db}
                onDone={() => setCreatingFor(null)}
              />
            )}

            {schedules.length === 0 && creatingFor !== sp.id ? (
              <div className="border border-line px-5 py-6 text-center">
                <Wheat size={18} className="text-faint mx-auto mb-2" />
                <div className="text-[12px] text-muted">
                  No feed schedule for {sp.name.toLowerCase()} yet.
                </div>
              </div>
            ) : (
              schedules.map(schedule => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  species={sp}
                  feeds={feeds}
                  db={db}
                />
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}

// ── schedule card ─────────────────────────────────────────────────────
function ScheduleCard({ schedule, species, feeds, db }) {
  const [addingStage, setAddingStage] = useState(false);

  return (
    <section className="border border-line">
      <ScheduleHeader schedule={schedule} species={species} db={db} />

      {/* stages */}
      <div className="flex flex-col gap-px bg-line border-t border-line">
        {schedule.stages.map(stage => (
          <StageRow
            key={stage.id}
            stage={stage}
            feeds={feeds}
            db={db}
          />
        ))}
        {schedule.stages.length === 0 && (
          <div className="bg-surface px-4 py-4 text-[12px] text-muted italic">
            No stages yet — add the first one below.
          </div>
        )}
      </div>

      {/* add stage */}
      <div className="border-t border-line">
        {addingStage ? (
          <StageEditor
            feeds={feeds}
            onSave={async (fields) => {
              await db.createStage(schedule.id, fields);
              setAddingStage(false);
            }}
            onCancel={() => setAddingStage(false)}
          />
        ) : (
          <button
            onClick={() => setAddingStage(true)}
            className="w-full flex items-center gap-1.5 px-4 py-2.5 bg-transparent border-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg cursor-pointer"
          >
            <Plus size={12} /> Add stage
          </button>
        )}
      </div>
    </section>
  );
}

function ScheduleHeader({ schedule, species, db }) {
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(schedule.name);

  const saveName = async () => {
    setEditingName(false);
    const next = draft.trim();
    if (!next || next === schedule.name) { setDraft(schedule.name); return; }
    await db.updateSchedule(schedule.id, { name: next }).catch(() => {
      setDraft(schedule.name);
    });
  };

  const toggleGroup = async (groupId) => {
    const current = schedule.assignedGroupIds;
    const next = current.includes(groupId)
      ? current.filter(id => id !== groupId)
      : [...current, groupId];
    await db.updateSchedule(schedule.id, { assignedGroupIds: next })
      .catch(() => {});
  };

  return (
    <header className="px-4 py-3.5 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        {editingName ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
              if (e.key === "Escape") {
                setDraft(schedule.name);
                setEditingName(false);
              }
            }}
            className="font-heading text-[16px] font-semibold text-fg bg-transparent border-0 border-b border-accent outline-none p-0 flex-1 min-w-0"
          />
        ) : (
          <>
            <span className="font-heading text-[16px] font-semibold text-fg">
              {schedule.name}
            </span>
            <button
              onClick={() => setEditingName(true)}
              title="Rename"
              className="bg-transparent border-0 p-1 text-muted hover:text-fg cursor-pointer"
            >
              <Pencil size={12} />
            </button>
          </>
        )}
        <button
          onClick={() => {
            if (!window.confirm(
              `Delete "${schedule.name}" and its ` +
              `${schedule.stages.length} stages? The Feed page loses ` +
              "these projections."
            )) return;
            db.removeSchedule(schedule.id).catch(() => {});
          }}
          title="Delete schedule"
          className="ml-auto bg-transparent border-0 p-1 text-muted hover:text-warn cursor-pointer"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {schedule.description && (
        <div className="text-[12px] text-dim leading-relaxed">
          {schedule.description}
        </div>
      )}

      {/* assigned groups */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] text-faint uppercase tracking-[0.12em]">
          Applies to
        </span>
        {(species.groups ?? []).map(g => {
          const assigned = schedule.assignedGroupIds.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() => toggleGroup(g.id)}
              className={
                "font-[inherit] text-[11px] px-2.5 py-1 border " +
                "cursor-pointer inline-flex items-center gap-1.5 " +
                (assigned
                  ? "bg-surface-alt border-accent text-fg"
                  : "bg-transparent border-line text-dim hover:text-fg")
              }
            >
              {assigned && <Check size={11} className="text-accent-deep" />}
              {g.label}
            </button>
          );
        })}
        {(species.groups ?? []).length === 0 && (
          <span className="text-[11px] text-faint italic">
            no groups yet — add one on the {species.name} page
          </span>
        )}
      </div>
    </header>
  );
}

// ── stages ────────────────────────────────────────────────────────────
function StageRow({ stage, feeds, db }) {
  const [editing, setEditing] = useState(false);
  const feed = feeds.find(f => f.id === stage.feedTypeId);

  if (editing) {
    return (
      <StageEditor
        stage={stage}
        feeds={feeds}
        onSave={async (fields) => {
          await db.updateStage(stage.id, fields);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
        onDelete={async () => {
          if (!window.confirm(`Delete the "${stage.name}" stage?`)) return;
          await db.removeStage(stage.id);
        }}
      />
    );
  }

  const dayRange = stage.endDay == null
    ? `Day ${stage.startDay ?? 0}+`
    : `Days ${stage.startDay ?? 0}–${stage.endDay}`;
  const metered = stage.consumption?.type === "metered";

  return (
    <div
      className="bg-surface px-4 py-3 flex items-baseline gap-3 flex-wrap cursor-pointer hover:bg-row-hover group/stage"
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
    >
      <span className="text-[13px] font-medium text-fg min-w-[120px]">
        {stage.name}
      </span>
      <span className="text-[11px] text-muted uppercase tracking-[0.08em] min-w-[90px]">
        {dayRange}
      </span>
      <span className="text-[12px] text-fg">
        {feed?.name ?? (
          <span className="text-faint italic">no feed picked</span>
        )}
      </span>
      <span
        className={
          "text-[12px] " + (metered ? "text-accent" : "text-dim italic")
        }
      >
        {describeConsumption(stage.consumption)}
      </span>
      <Pencil
        size={12}
        className="ml-auto shrink-0 text-muted opacity-0 group-hover/stage:opacity-100"
      />
    </div>
  );
}

// Inline stage editor — used for both editing an existing stage and
// creating a new one (no `stage` prop).
function StageEditor({ stage = null, feeds, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(stage?.name ?? "");
  const [startDay, setStartDay] = useState(
    stage?.startDay != null ? String(stage.startDay) : "0"
  );
  const [endDay, setEndDay] = useState(
    stage?.endDay != null ? String(stage.endDay) : ""
  );
  const [feedTypeId, setFeedTypeId] = useState(stage?.feedTypeId ?? "");
  const [kind, setKind] = useState(stage?.consumption?.type ?? "metered");
  const [amount, setAmount] = useState(
    stage?.consumption?.amount != null
      ? String(stage.consumption.amount) : ""
  );
  const [unit, setUnit] = useState(stage?.consumption?.unit ?? "lb");
  const [basis, setBasis] = useState(stage?.consumption?.basis ?? "batch");
  const [notes, setNotes] = useState(stage?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const submit = async () => {
    setPending(true);
    setErrorMsg(null);
    const consumption =
      kind === "metered"
        ? {
          type: "metered", amount: Number(amount), unit,
          per: "day", basis,
        }
        : { type: kind };
    try {
      await onSave({
        name,
        startDay: startDay === "" ? 0 : Number(startDay),
        endDay: endDay === "" ? null : Number(endDay),
        feedTypeId: feedTypeId || null,
        consumption,
        notes,
      });
    } catch (err) {
      setErrorMsg(err.message ?? String(err));
      setPending(false);
    }
  };

  const valid = name.trim() &&
    (kind !== "metered" || Number(amount) > 0);

  return (
    <div className="bg-surface-alt px-4 py-4 flex flex-col gap-3">
      <div className="flex items-end gap-4 flex-wrap">
        <Field label="Stage name">
          <input
            autoFocus={!stage}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Week 3"
            className={inputCls + " w-[160px]"}
          />
        </Field>
        <Field label="From day">
          <input
            type="number"
            min={0}
            value={startDay}
            onChange={(e) => setStartDay(e.target.value)}
            className={inputCls + " w-[80px]"}
          />
        </Field>
        <Field label="To day (blank = ongoing)">
          <input
            type="number"
            min={0}
            value={endDay}
            onChange={(e) => setEndDay(e.target.value)}
            placeholder="∞"
            className={inputCls + " w-[80px]"}
          />
        </Field>
        <Field label="Feed">
          <select
            value={feedTypeId}
            onChange={(e) => setFeedTypeId(e.target.value)}
            className={inputCls}
          >
            <option value="">—</option>
            {feeds.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* consumption */}
      <div className="flex items-end gap-4 flex-wrap">
        <Field label="Consumption">
          <div className="flex">
            {[
              ["metered", "Metered"],
              ["free_choice", "Free choice"],
              ["tbd", "TBD"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setKind(value)}
                className={
                  "font-[inherit] text-[11px] px-3 py-1.5 border " +
                  "cursor-pointer -ml-px first:ml-0 " +
                  (kind === value
                    ? "bg-surface border-accent text-fg relative z-10"
                    : "bg-transparent border-line text-dim hover:text-fg")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        {kind === "metered" && (
          <>
            <Field label="Amount / day">
              <input
                type="number"
                min={0}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputCls + " w-[90px]"}
              />
            </Field>
            <Field label="Unit">
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="lb"
                className={inputCls + " w-[70px]"}
              />
            </Field>
            <Field label="Basis">
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
                className={inputCls}
              >
                <option value="batch">Whole batch / group</option>
                <option value="bird">Per bird</option>
              </select>
            </Field>
          </>
        )}
      </div>
      {kind !== "metered" && (
        <div className="text-[11px] text-faint italic leading-relaxed">
          Heads up: {kind === "free_choice" ? "free-choice" : "TBD"} stages
          can&rsquo;t be projected — the Feed page won&rsquo;t know when
          to reorder from this stage.
        </div>
      )}

      <Field label="Notes">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
          className={inputCls + " w-full max-w-[440px]"}
        />
      </Field>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={submit}
          disabled={pending || !valid}
          className={BTN_ACCENT + " disabled:cursor-not-allowed"}
        >
          <Check size={12} /> {pending ? "Saving…" : "Save stage"}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 bg-transparent text-dim border border-line font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer hover:text-fg"
        >
          <X size={12} /> Cancel
        </button>
        {onDelete && (
          <button
            onClick={() => onDelete().catch(() => {})}
            className="ml-auto inline-flex items-center gap-1.5 bg-transparent text-muted border-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-2 py-1.5 cursor-pointer hover:text-warn"
          >
            <Trash2 size={12} /> Delete stage
          </button>
        )}
        {errorMsg && (
          <span className="text-[11px] text-warn">{errorMsg}</span>
        )}
      </div>
    </div>
  );
}

// ── new schedule ──────────────────────────────────────────────────────
function NewScheduleForm({ species, db, onDone }) {
  const [name, setName] = useState(`${species.name} feed schedule`);
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const submit = async () => {
    setPending(true);
    setErrorMsg(null);
    try {
      await db.createSchedule({
        name,
        speciesId: species.id,
        description,
        // New schedules apply to every current group by default —
        // narrowing is one click per group on the card.
        assignedGroupIds: (species.groups ?? []).map(g => g.id),
      });
      onDone();
    } catch (err) {
      setErrorMsg(err.message ?? String(err));
      setPending(false);
    }
  };

  return (
    <div className="border border-line px-4 py-4 flex items-end gap-4 flex-wrap">
      <Field label="Schedule name">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className={inputCls + " w-[240px]"}
        />
      </Field>
      <Field label="Description">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional"
          className={inputCls + " w-[280px]"}
        />
      </Field>
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={pending || !name.trim()}
          className={BTN_ACCENT}
        >
          {pending ? "Creating…" : "Create"}
        </button>
        <button
          onClick={onDone}
          className="bg-transparent text-dim border border-line font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer hover:text-fg"
        >
          Cancel
        </button>
      </div>
      {errorMsg && (
        <span className="text-[11px] text-warn">{errorMsg}</span>
      )}
    </div>
  );
}

// ── shared bits ───────────────────────────────────────────────────────
const inputCls =
  "bg-surface border border-line px-2 py-1.5 text-[13px] text-fg " +
  "font-[inherit] outline-none focus:border-accent";

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[9px] text-faint uppercase tracking-[0.12em] mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
