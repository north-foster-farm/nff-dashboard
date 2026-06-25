import { useState, useMemo, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

// A reusable search-and-pick overlay. `items` is [{ id, label, sublabel }];
// typing filters by a substring over label + sublabel; picking calls
// onSelect(item). Unlike CommandPalette (which navigates), this just picks,
// so callers (e.g. Schedule's add-a-chore) can act on the choice.
export default function SearchSelector({
  items, onSelect, onClose, placeholder = "Search…",
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? items.filter((it) =>
        (it.label + " " + (it.sublabel ?? "")).toLowerCase().includes(needle))
      : items;
    return list.slice(0, 50);
  }, [items, q]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-line shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
          <Search size={16} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[14px] text-fg placeholder:text-faint outline-none py-1"
          />
          <button type="button" onClick={onClose}
            className="shrink-0 text-faint hover:text-fg" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-dim text-[13px]">No matches.</li>
          ) : results.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onSelect(it)}
                className="w-full text-left px-4 py-2.5 hover:bg-row-hover border-b border-line last:border-b-0"
              >
                <div className="text-[14px] text-fg">{it.label}</div>
                {it.sublabel && (
                  <div className="text-[12px] text-dim">{it.sublabel}</div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
