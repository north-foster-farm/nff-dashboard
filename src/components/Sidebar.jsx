import { forwardRef, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronRight, X } from "lucide-react";
import { SECTIONS, findFlyoutParentForChild } from "../sections.jsx";
import RoundsSidebarItem from "./RoundsSidebarItem.jsx";

// Duration of the flyout enter/exit keyframe — must match the animation
// declared in index.html (`nff-flyout-in` / `nff-flyout-out`).
const FLYOUT_ANIM_MS = 140;

export default function Sidebar({ current, onSelect, onOpenRounds, data }) {
  const [openFlyoutId, setOpenFlyoutId] = useState(null);
  const [closing, setClosing] = useState(false);
  const flyoutRef = useRef(null);
  const navRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Schedule a close: run the exit animation, then actually unmount.
  const requestClose = () => {
    if (!openFlyoutId || closing) return;
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setOpenFlyoutId(null);
      setClosing(false);
      closeTimerRef.current = null;
    }, FLYOUT_ANIM_MS);
  };

  // Open / replace the visible flyout, cancelling any pending close.
  const openFlyout = (id) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setClosing(false);
    setOpenFlyoutId(id);
  };

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  // Close on outside-click. We listen for `click` (not `mousedown`) so that a
  // click on a main-content button still receives its own click event before
  // the flyout unmounts and reflows the layout.
  useEffect(() => {
    if (!openFlyoutId || closing) return;
    const onDocClick = (e) => {
      if (flyoutRef.current?.contains(e.target)) return;
      if (navRef.current?.contains(e.target)) return;
      requestClose();
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openFlyoutId, closing]);

  const flyoutParent = findFlyoutParentForChild(current);
  const handleSelect = (id) => {
    onSelect(id);
    requestClose();
  };

  let lastGroup = undefined;
  return (
    <>
      <nav
        ref={navRef}
        className="w-60 border-r border-line shrink-0 bg-surface flex flex-col"
      >
        <div className="py-5 flex-1 overflow-y-auto no-scrollbar">
        {SECTIONS.map((s, idx) => {
          if (s.kind === "spacer") {
            return <div key={`spacer-${idx}`} className="h-3.5" />;
          }
          if (s.kind === "hidden") return null;
          const showHeader = s.group !== lastGroup && s.group !== null;
          lastGroup = s.group;
          if (s.kind === "takeover" && s.id === "rounds") {
            return (
              <div key={s.id}>
                {showHeader && <GroupLabel>{s.group}</GroupLabel>}
                <RoundsSidebarItem onOpen={onOpenRounds} />
              </div>
            );
          }
          // A flyout-parent counts as "active" when one of its children is current.
          const active = s.id === current || (s.kind === "flyout" && flyoutParent?.id === s.id);
          const count = typeof s.getCount === "function" ? s.getCount(data) : null;
          return (
            <div key={s.id}>
              {showHeader && <GroupLabel>{s.group}</GroupLabel>}
              <SidebarItem
                section={s}
                active={active}
                isFlyoutOpen={s.kind === "flyout" && openFlyoutId === s.id}
                anyFlyoutOpen={openFlyoutId !== null}
                count={count}
                onSelect={(id) => {
                  if (s.kind === "flyout") {
                    if (openFlyoutId === s.id) requestClose();
                    else openFlyout(s.id);
                  } else {
                    handleSelect(id);
                  }
                }}
              />
            </div>
          );
        })}
        </div>
      </nav>

      {openFlyoutId && (
        <FlyoutPane
          ref={flyoutRef}
          parent={SECTIONS.find(s => s.id === openFlyoutId)}
          current={current}
          data={data}
          onSelect={handleSelect}
          onClose={requestClose}
          closing={closing}
        />
      )}
    </>
  );
}

function GroupLabel({ children }) {
  return (
    <div className="pt-5 pb-1.5 px-6 font-ui text-[10px] text-muted uppercase tracking-[0.16em] font-semibold">
      {children}
    </div>
  );
}

// Background tint for a sidebar row given (active, dim-active, hover) state.
// Returns a Tailwind class.
function rowBgClass({ isFlyoutOpen, active, dimActive, hover }) {
  if (isFlyoutOpen) return "bg-row-active";
  if (active) return dimActive ? "bg-row-active-dim" : "bg-row-active";
  if (hover) return "bg-row-hover";
  return "bg-transparent";
}

function SidebarItem({ section, active, isFlyoutOpen, anyFlyoutOpen, count, onSelect }) {
  const [hover, setHover] = useState(false);
  const Icon = section.icon;
  const isAction = section.kind === "action";
  const isFlyout = section.kind === "flyout";
  // When a flyout is open, the previously-active page keeps its accent text
  // styling but its background tint switches from green to a neutral gray —
  // the flyout owns the "live" visual focus while remaining clear which page
  // the user will return to on close.
  const dimActive = anyFlyoutOpen && active && !isFlyout && !isFlyoutOpen;
  const bg = rowBgClass({ isFlyoutOpen, active, dimActive, hover });
  const accentEdge = active ? "border-l-accent" : "border-l-transparent";
  const textColor = active ? "text-fg font-semibold" : "text-dim font-normal";

  return (
    <button
      onClick={() => onSelect(section.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={
        `flex items-center gap-2.5 w-full py-1 pl-[19px] pr-[22px] border-0 ` +
        `border-l-[3px] ${accentEdge} ${bg} ${textColor} ` +
        `font-[inherit] text-[13px] cursor-pointer text-left ` +
        `transition-[background-color,color] duration-150`
      }
    >
      <Icon size={14} className={`shrink-0 ${active ? "text-accent" : ""}`} />
      <span className="flex-1 min-w-0 whitespace-nowrap">{section.label}</span>
      <TrailingSlot hover={hover}>
        {isAction && (
          <ArrowRight size={14} className={hover || active ? "text-accent" : "text-muted"} />
        )}
        {isFlyout && (isFlyoutOpen
          ? <X size={14} className="text-accent" />
          : <ChevronRight size={14} className={hover || active ? "text-accent" : "text-muted"} />)}
        {!isAction && !isFlyout && count !== null && (
          <span
            className={
              "text-[12px] leading-none " +
              (count > 0 ? (active ? "text-accent" : "text-dim") : "text-faint")
            }
          >
            {count}
          </span>
        )}
      </TrailingSlot>
    </button>
  );
}

const FlyoutPane = forwardRef(function FlyoutPane({ parent, current, data, onSelect, closing }, ref) {
  const items = (parent.children || []).slice().sort((a, b) => a.label.localeCompare(b.label));
  return (
    <aside
      ref={ref}
      className="w-60 border-r border-line py-5 shrink-0 overflow-y-auto no-scrollbar bg-surface shadow-[2px_0_12px_rgba(0,0,0,0.15)]"
      style={{
        animation: closing
          ? `nff-flyout-out ${FLYOUT_ANIM_MS}ms ease forwards`
          : `nff-flyout-in ${FLYOUT_ANIM_MS}ms ease`
      }}
    >
      <div className="px-6 pb-3 font-ui text-[10px] text-muted uppercase tracking-[0.16em] font-semibold">
        {parent.flyoutTitle || parent.label}
      </div>
      {items.map(child => (
        <FlyoutItem
          key={child.id}
          child={child}
          active={child.id === current}
          count={typeof child.getCount === "function" ? child.getCount(data) : null}
          onSelect={onSelect}
        />
      ))}
    </aside>
  );
});

// Fixed-size trailing slot keeps counts/arrows/chevrons vertically centered
// against the icon column regardless of which one is rendered.
function TrailingSlot({ hover, children }) {
  return (
    <span
      className={
        "shrink-0 w-3.5 h-3.5 inline-flex items-center justify-end " +
        "transition-[color,transform] duration-150 " +
        (hover ? "translate-x-0.5" : "")
      }
    >
      {children}
    </span>
  );
}

function FlyoutItem({ child, active, count, onSelect }) {
  const [hover, setHover] = useState(false);
  const Icon = child.icon;
  const bg = active ? "bg-row-active" : hover ? "bg-row-hover" : "bg-transparent";
  const accentEdge = active ? "border-l-accent" : "border-l-transparent";
  const textColor = active ? "text-fg font-semibold" : "text-dim font-normal";

  return (
    <button
      onClick={() => onSelect(child.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={
        `flex items-center gap-2.5 w-full py-1 pl-[19px] pr-[22px] border-0 ` +
        `border-l-[3px] ${accentEdge} ${bg} ${textColor} ` +
        `font-[inherit] text-[13px] cursor-pointer text-left ` +
        `transition-[background-color,color] duration-150`
      }
    >
      {Icon && <Icon size={14} className={`shrink-0 ${active ? "text-accent" : ""}`} />}
      <span className="flex-1 min-w-0 whitespace-nowrap">{child.label}</span>
      <TrailingSlot hover={hover}>
        {count !== null && (
          <span
            className={
              "text-[12px] leading-none " +
              (count > 0 ? (active ? "text-accent" : "text-dim") : "text-faint")
            }
          >
            {count}
          </span>
        )}
      </TrailingSlot>
    </button>
  );
}
