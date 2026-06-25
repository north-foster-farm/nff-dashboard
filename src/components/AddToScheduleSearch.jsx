import { useState, useMemo, useEffect, useRef } from "react";
import { Search, X, ChevronRight, Plus, Check } from "lucide-react";
import { obligationPlaceIds, describeChoreAnchor } from "../lib/chores.js";

// The Schedule's add-to-day search (S33) — the mockup's Hero 4. One field,
// categorised results:
//   • Chores — deduped by title. A chore that fans out to several places
//     appears ONCE ("N places · pick one") and a tap narrows to the place;
//     a single-place chore adds in one tap.
//   • One-off task — turns the raw query into a commitment.
// Picking a place (or a single-place chore) writes the same chore_completion
// path as Rounds. Project nodes share this list in a later slice.
export default function AddToScheduleSearch({
  chores, choreCtx, onAddChore, onAddTask, onClose,
}) {
  const [q, setQ] = useState("");
  // The chore being place-narrowed (step 2), or null (step 1).
  const [narrow, setNarrow] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { if (narrow) setNarrow(null); else onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, narrow]);

  const ctx = choreCtx ?? {};

  // Group chores by title; each group carries the (chore, place) pairs it
  // expands to, so a name shows once across its places.
  const groups = useMemo(() => {
    const byTitle = new Map();
    for (const c of chores) {
      const pids = obligationPlaceIds(c, ctx);
      const list = pids.length ? pids : [null];
      const g = byTitle.get(c.title) ?? {
        title: c.title, sublabel: describeChoreAnchor(c, ctx) || null,
        places: [],
      };
      for (const pid of list) {
        g.places.push({
          choreId: c.id,
          placeId: pid,
          name: pid == null ? null : (ctx.placesById?.get(pid)?.name ?? null),
          kindTag: pid == null ? null : (ctx.placesById?.get(pid)?.kindTag ?? null),
        });
      }
      byTitle.set(c.title, g);
    }
    return [...byTitle.values()];
  }, [chores, ctx]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return groups.slice(0, 50);
    return groups
      .filter((g) =>
        (g.title + " " + (g.sublabel ?? "")).toLowerCase().includes(needle))
      .slice(0, 50);
  }, [groups, q]);

  const pickGroup = (g) => {
    if (g.places.length <= 1) {
      const p = g.places[0];
      onAddChore(p.choreId, p.placeId);
      onClose();
    } else {
      setNarrow(g);
    }
  };

  const placeLabel = (p) =>
    p.name ?? (narrow?.sublabel ?? "Anywhere");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-line shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {narrow ? (
          /* ── Step 2 — narrow to a place ────────────────────────────── */
          <>
            <div className="px-4 pt-3 pb-3 border-b border-line">
              <button
                type="button"
                onClick={() => setNarrow(null)}
                className="flex items-center gap-1.5 text-[12px] text-dim mb-3 hover:text-fg"
              >
                <ChevronRight size={13} className="rotate-180" /> Back
              </button>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 bg-resolved border-2 border-resolved text-on-accent inline-flex items-center justify-center shrink-0">
                  <Check size={15} strokeWidth={3} />
                </span>
                <div>
                  <div className="text-[15px] font-medium text-fg">
                    {narrow.title}
                  </div>
                  <div className="text-[12px] text-faint">Which place?</div>
                </div>
              </div>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    for (const p of narrow.places) onAddChore(p.choreId, p.placeId);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-line hover:bg-row-hover"
                >
                  <Plus size={15} className="shrink-0 text-faint" />
                  <span className="text-[14px] text-fg flex-1">
                    All {narrow.places.length} places
                  </span>
                </button>
              </li>
              {narrow.places.map((p, i) => (
                <li key={p.choreId + "|" + (p.placeId ?? "") + "|" + i}>
                  <button
                    type="button"
                    onClick={() => { onAddChore(p.choreId, p.placeId); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-line last:border-b-0 hover:bg-row-hover"
                  >
                    <span className="text-[14px] text-fg flex-1">
                      {placeLabel(p)}
                    </span>
                    {p.kindTag && (
                      <span className="text-[12px] text-faint">{p.kindTag}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 border-t border-line text-[12px] text-dim">
              Adds to today — the same write as Rounds.
            </div>
          </>
        ) : (
          /* ── Step 1 — type → categorised results ───────────────────── */
          <>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
              <Search size={16} className="shrink-0 text-faint" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search chores to add…"
                className="flex-1 bg-transparent text-[14px] text-fg placeholder:text-faint outline-none py-1"
              />
              <button type="button" onClick={onClose}
                className="shrink-0 text-faint hover:text-fg" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto">
              <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
                Chores
              </div>
              {results.length === 0 ? (
                <div className="px-4 py-4 text-center text-dim text-[13px]">
                  No matching chores.
                </div>
              ) : (
                <ul>
                  {results.map((g) => {
                    const multi = g.places.length > 1;
                    const single = g.places.length === 1 ? g.places[0] : null;
                    return (
                      <li key={g.title}>
                        <button
                          type="button"
                          onClick={() => pickGroup(g)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-line hover:bg-row-hover"
                        >
                          <span className="w-7 h-7 border-2 border-line shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-medium text-fg truncate">
                              {g.title}
                            </div>
                            <div className="text-[12px] text-faint truncate">
                              {multi
                                ? `${g.places.length} places · pick one`
                                : (single?.name ?? g.sublabel ?? "anytime")}
                            </div>
                          </div>
                          {multi && (
                            <>
                              <span className="shrink-0 text-[11px] font-medium text-accent">
                                Narrow
                              </span>
                              <ChevronRight size={13} className="shrink-0 text-accent" />
                            </>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {q.trim() && (
                <>
                  <div className="px-4 py-1.5 mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
                    One-off task
                  </div>
                  <button
                    type="button"
                    onClick={() => { onAddTask(q.trim()); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-line hover:bg-row-hover"
                  >
                    <Plus size={16} className="shrink-0 text-faint" />
                    <span className="flex-1 text-[14px] text-fg truncate">
                      Add “{q.trim()}” as a task
                    </span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
