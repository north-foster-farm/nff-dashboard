import { useEffect, useRef } from "react";
import { X, Settings, ArrowRight } from "lucide-react";
import { RECORDS_GROUPS } from "../sections.jsx";

// The records drawer (Batch 18.2) — a thin admin/records panel that
// slides in from the right when the header avatar is clicked. Holds
// everything that's a pure record (products, sales, CRM, comms,
// animals, resource lists) plus Settings, so the sidebar stays focused
// on the spatial/temporal surfaces (Now · Map · Schedule · Rounds).
export default function RecordsDrawer({
  open, current, data, session, onSelect, onClose,
}) {
  const panelRef = useRef(null);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const meta = session?.user?.user_metadata ?? {};
  const displayName =
    meta.full_name || meta.name || session?.user?.email || "";
  const email = session?.user?.email ?? "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={
          "h-full w-[300px] max-w-[85vw] bg-surface border-l border-line " +
          "flex flex-col shadow-[-2px_0_24px_rgba(0,0,0,0.4)]"
        }
        role="dialog"
        aria-label="Records and settings"
      >
        {/* Header: who you are + settings + close */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-fg truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-muted truncate">{email}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-0 text-dim p-1.5 cursor-pointer hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-3">
          <DrawerItem
            section={{ id: "settings", label: "Settings", icon: Settings }}
            active={current === "settings"}
            onSelect={onSelect}
          />
          {RECORDS_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="pt-5 pb-1.5 px-5 font-ui text-[10px] text-muted uppercase tracking-[0.16em] font-semibold">
                {group.title}
              </div>
              {group.items.map((item) => (
                <DrawerItem
                  key={item.id}
                  section={item}
                  active={current === item.id}
                  count={
                    typeof item.getCount === "function"
                      ? item.getCount(data)
                      : null
                  }
                  onSelect={onSelect}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DrawerItem({ section, active, count, onSelect }) {
  const Icon = section.icon;
  const isAction = section.kind === "action";
  return (
    <button
      onClick={() => onSelect(section.id)}
      className={
        "flex items-center gap-2.5 w-full py-1.5 pl-[17px] pr-5 border-0 " +
        "border-l-[3px] font-[inherit] text-[13px] cursor-pointer " +
        "text-left transition-[background-color,color] duration-150 " +
        (active
          ? "border-l-accent bg-row-active text-fg font-semibold"
          : "border-l-transparent bg-transparent text-dim hover:bg-row-hover")
      }
    >
      {Icon && (
        <Icon
          size={14}
          className={"shrink-0 " + (active ? "text-accent" : "")}
        />
      )}
      <span className="flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
        {section.label}
      </span>
      {isAction && (
        <ArrowRight size={13} className="shrink-0 text-muted" />
      )}
      {!isAction && count != null && count > 0 && (
        <span className="shrink-0 text-[12px] leading-none text-dim">
          {count}
        </span>
      )}
    </button>
  );
}
