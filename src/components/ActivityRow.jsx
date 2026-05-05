import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";

// Single activity-feed row with hover-revealed edit + delete affordances.
// Used by both the dashboard's "Activity" card and the full Activity page;
// the only thing that varies between consumers is the time-column shape
// (compact "10:14 AM" vs. stacked date+time), so the time renderer is
// passed in via `renderTime`.
//
// Props:
//   entry       — the full UIEntry from useActivityLog
//   ownerEmail  — current user's email; controls whether edit/delete
//                 affordances are shown (you can only mutate your own
//                 entries)
//   onEdit      — async (entryId, newSummary) => void (from useActivityLog)
//   onDelete    — async (entryId) => void           (from useActivityLog)
//   renderTime  — (logTime: string) => JSX        time column renderer
//   compact     — when true, uses the smaller dashboard density
export default function ActivityRow({
  entry, ownerEmail, onEdit, onDelete, renderTime, compact = false,
  wrapperClass = ""
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.summary);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const inputRef = useRef(null);

  // Reset draft if the underlying entry's summary changes from elsewhere
  // (e.g. realtime UPDATE) and we're not actively editing.
  useEffect(() => {
    if (!editing) setDraft(entry.summary);
  }, [entry.summary, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const isOwner = !!ownerEmail && entry.ownerEmail === ownerEmail;
  const showActions = isOwner && hover && !editing;

  const startEdit = () => { setDraft(entry.summary); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraft(entry.summary); };
  const saveEdit = async () => {
    const next = draft.trim();
    if (next === (entry.summary ?? "").trim()) { setEditing(false); return; }
    setBusy(true);
    try {
      await onEdit(entry.id, next);
      setEditing(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[activity] edit failed", err);
      alert("Couldn't save the edit. See console for details.");
    } finally {
      setBusy(false);
    }
  };
  const handleKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
    else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  };
  const handleDelete = async () => {
    if (!confirm("Delete this activity entry? This can't be undone.")) return;
    setBusy(true);
    try { await onDelete(entry.id); }
    catch (err) {
      // eslint-disable-next-line no-console
      console.error("[activity] delete failed", err);
      alert("Couldn't delete. See console for details.");
      setBusy(false);
    }
  };

  const fontSize = compact ? "text-xs" : "text-[13px]";

  return (
    <li
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`flex gap-2.5 ${fontSize} group relative ${wrapperClass}`}
    >
      <div className="[font-variant-numeric:tabular-nums] text-dim shrink-0 min-w-[68px]">
        {renderTime(entry.logTime)}
      </div>

      <div className="flex-1 min-w-0 text-fg">
        <span className="text-dim">{entry.actor}</span>{" "}
        {editing ? (
          <span className="inline-flex items-center gap-1 align-baseline">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKey}
              disabled={busy}
              className="bg-surface-alt text-fg border border-line px-1.5 py-0.5 outline-none focus:border-accent text-[inherit] font-[inherit] min-w-[160px] max-w-full"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={saveEdit}
              disabled={busy}
              title="Save (Enter)"
              aria-label="Save edit"
              className="p-1 text-muted hover:text-accent cursor-pointer bg-transparent border-0"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancelEdit}
              disabled={busy}
              title="Cancel (Esc)"
              aria-label="Cancel edit"
              className="p-1 text-muted hover:text-fg cursor-pointer bg-transparent border-0"
            >
              <X size={12} />
            </button>
          </span>
        ) : (
          <span>
            {entry.summary}
            {entry.edited && (
              <span
                className="ml-1.5 text-faint text-[10px] uppercase tracking-[0.12em]"
                title="Edited"
              >
                edited
              </span>
            )}
          </span>
        )}
      </div>

      {showActions && (
        <span className="shrink-0 inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={startEdit}
            title="Edit"
            aria-label="Edit"
            className="p-1 text-muted hover:text-fg cursor-pointer bg-transparent border-0"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            title="Delete"
            aria-label="Delete"
            className="p-1 text-muted hover:text-warn cursor-pointer bg-transparent border-0"
          >
            <Trash2 size={12} />
          </button>
        </span>
      )}
    </li>
  );
}
