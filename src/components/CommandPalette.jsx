import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, CornerDownLeft, ArrowRight, Bird, FolderKanban, MapPin,
  Users, Tag, Store, Cog, Truck, MessageCircleQuestion, Receipt, X,
} from "lucide-react";
import { SECTIONS } from "../sections.jsx";
import { iconForSpecies } from "./animalIcons.jsx";
import { navigate, pathForSection } from "../lib/browser/router.js";
import { useSearchIndex, SEARCH_TYPE_LABEL } from "../lib/data/useSearchIndex.js";

// App-wide command palette (Batch 33) — cmd/ctrl-K opens a single
// search box over every page and entity. Pages come from the static
// SECTIONS list (always available); entities come from useSearchIndex.
// Substring-token matching (every whitespace token must appear),
// ranked so label-prefix hits beat mid-string and keyword hits.
// Keyboard-first: ↑/↓ move, Enter opens, Esc closes.

const TYPE_ICON = {
  page: ArrowRight, batch: Bird, project: FolderKanban, place: MapPin,
  customer: Users, product: Tag, supplier: Store, machine: Cog,
  trailer: Truck, thread: MessageCircleQuestion, order: Receipt,
};

const MAX_RESULTS = 30;

// Flatten SECTIONS into navigable page entries (flyout parents expand
// into their children; the bare flyout container isn't a real page).
function pageEntries() {
  const out = [];
  const add = (s, groupLabel) => {
    out.push({
      id: `page:${s.id}`,
      type: "page",
      label: s.label,
      sublabel: groupLabel,
      path: pathForSection(s.id),
      icon: s.icon,
      keywords: `${s.label ?? ""} ${s.description ?? ""} ${groupLabel ?? ""}`
        .toLowerCase(),
    });
  };
  for (const s of SECTIONS) {
    if (s.kind === "flyout") {
      for (const c of s.children ?? []) add(c, s.flyoutTitle ?? "Events");
    } else if (s.label) {
      add(s, s.group ?? null);
    }
  }
  return out;
}

// Rank: lower is better. Prefix-of-label beats word-prefix beats
// substring beats keyword-only.
function score(entry, tokens) {
  const label = entry.label.toLowerCase();
  let s = 0;
  for (const tok of tokens) {
    if (!entry.keywords.includes(tok)) return Infinity;
    if (label.startsWith(tok)) s += 0;
    else if (label.includes(` ${tok}`)) s += 1;
    else if (label.includes(tok)) s += 2;
    else s += 4; // matched only via sublabel/keywords
  }
  // Prefer pages slightly so "ord" surfaces the Orders page above an
  // individual order row.
  if (entry.type === "page") s -= 0.5;
  return s;
}

export default function CommandPalette({ open, onClose, data }) {
  const { entries } = useSearchIndex(data);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const pages = useMemo(() => pageEntries(), []);
  const all = useMemo(() => [...pages, ...entries], [pages, entries]);

  const results = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      // Empty query: offer the top-level pages as a launcher.
      return pages.slice(0, 12);
    }
    return all
      .map((e) => ({ e, s: score(e, tokens) }))
      .filter((x) => x.s !== Infinity)
      .sort((a, b) => a.s - b.s || a.e.label.localeCompare(b.e.label))
      .slice(0, MAX_RESULTS)
      .map((x) => x.e);
  }, [query, all, pages]);

  // Reset on open; focus the input.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus after paint
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  // Keep the active row in view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const pick = (entry) => {
    if (!entry) return;
    navigate(entry.path);
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] bg-surface border border-line shadow-[0_16px_48px_rgba(0,0,0,0.4)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        {/* input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line">
          <Search size={16} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, batches, customers, places…"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[14px] text-fg font-[inherit]"
          />
          <kbd className="hidden sm:inline text-[10px] text-faint border border-line px-1.5 py-0.5 uppercase tracking-[0.1em]">
            Esc
          </kbd>
          {/* Phones don't show the Esc hint and the backdrop tap isn't
              obvious — give an explicit close (F2). */}
          <button type="button" onClick={onClose} aria-label="Close"
            className="sm:hidden shrink-0 text-faint hover:text-fg p-0.5 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-dim">
              Nothing matches &ldquo;{query}&rdquo;.
            </div>
          ) : (
            results.map((entry, i) => {
              // A batch draws its species glyph (F27); everything else
              // uses its section icon or the per-type default.
              const Icon = entry.icon
                ?? (entry.type === "batch" && entry.speciesId
                  ? iconForSpecies(entry.speciesId)
                  : TYPE_ICON[entry.type])
                ?? ArrowRight;
              const isActive = i === active;
              return (
                <button
                  key={entry.id}
                  data-idx={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => pick(entry)}
                  className={
                    "w-full flex items-center gap-3 px-4 py-2.5 bg-transparent " +
                    "border-0 cursor-pointer text-left font-[inherit] " +
                    (isActive ? "bg-row-hover" : "")
                  }
                >
                  <Icon size={15} className="shrink-0 text-muted" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-fg truncate">
                      {entry.label}
                    </span>
                    {entry.sublabel && (
                      <span className="block text-[11px] text-faint truncate">
                        {entry.sublabel}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-faint border border-line px-1.5 py-0.5">
                    {entry.type === "page" ? "Page" : SEARCH_TYPE_LABEL(entry.type)}
                  </span>
                  {isActive && (
                    <CornerDownLeft size={13} className="shrink-0 text-dim" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
