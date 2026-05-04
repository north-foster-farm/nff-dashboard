import { forwardRef, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronRight, X } from "lucide-react";
import { T } from "../theme.js";
import { SECTIONS, findFlyoutParentForChild } from "../sections.jsx";

const SIDEBAR_WIDTH = 240;

// Duration of the flyout enter/exit keyframe — must match the animation
// declared in index.html (`nff-flyout-in` / `nff-flyout-out`).
const FLYOUT_ANIM_MS = 140;

export default function Sidebar({ current, onSelect, data }) {
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
        style={{
          width: SIDEBAR_WIDTH, borderRight: `1px solid ${T.border}`,
          flexShrink: 0, background: T.surface,
          // Flex column so the sign-in footer pins to the bottom; the inner
          // list scrolls independently if the sections overflow vertically.
          display: "flex", flexDirection: "column"
        }}
      >
        <div style={{ padding: "20px 0", flex: 1, overflowY: "auto" }}>
        {SECTIONS.map((s, idx) => {
          if (s.kind === "spacer") {
            return <div key={`spacer-${idx}`} style={{ height: 14 }} />;
          }
          if (s.kind === "hidden") return null;
          const showHeader = s.group !== lastGroup && s.group !== null;
          lastGroup = s.group;
          // A flyout-parent counts as "active" when one of its children is current.
          const active = s.id === current || (s.kind === "flyout" && flyoutParent?.id === s.id);
          const count = typeof s.getCount === "function" ? s.getCount(data) : null;
          return (
            <div key={s.id}>
              {showHeader && (
                <div style={{ padding: "20px 24px 6px", fontFamily: T.uiLabel, fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 600 }}>
                  {s.group}
                </div>
              )}
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
  const bg = isFlyoutOpen
    ? T.rowActive
    : active
      ? (dimActive ? T.rowActiveDim : T.rowActive)
      : hover
        ? T.rowHover
        : "transparent";

  return (
    <button
      onClick={() => onSelect(section.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "6px 22px",
        background: bg,
        border: "none",
        borderLeft: `3px solid ${active ? T.accent : "transparent"}`,
        color: active ? T.text : T.textDim,
        fontFamily: "inherit", fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: "pointer", textAlign: "left",
        transition: "background-color 140ms ease, color 140ms ease"
      }}
    >
      <Icon size={14} color={active ? T.accent : "currentColor"} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap" }}>{section.label}</span>
      <TrailingSlot hover={hover}>
        {isAction && (
          <ArrowRight size={14} color={hover || active ? T.accent : T.textMuted} />
        )}
        {isFlyout && (isFlyoutOpen
          ? <X size={14} color={T.accent} />
          : <ChevronRight size={14} color={hover || active ? T.accent : T.textMuted} />)}
        {!isAction && !isFlyout && count !== null && (
          <span style={{
            fontSize: 11, lineHeight: 1,
            color: count > 0 ? (active ? T.accent : T.textDim) : T.textFaint
          }}>{count}</span>
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
      style={{
        width: SIDEBAR_WIDTH,
        borderRight: `1px solid ${T.border}`,
        padding: "20px 0",
        flexShrink: 0,
        overflowY: "auto",
        background: T.surface,
        boxShadow: "2px 0 12px rgba(0, 0, 0, 0.15)",
        animation: closing
          ? `nff-flyout-out ${FLYOUT_ANIM_MS}ms ease forwards`
          : `nff-flyout-in ${FLYOUT_ANIM_MS}ms ease`
      }}
    >
      <div style={{ padding: "0 24px 12px", fontFamily: T.uiLabel, fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 600 }}>
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
    <span style={{
      flexShrink: 0,
      width: 14, height: 14,
      display: "inline-flex", alignItems: "center", justifyContent: "flex-end",
      transition: "color 140ms ease, transform 140ms ease",
      transform: hover ? "translateX(2px)" : "none"
    }}>{children}</span>
  );
}

function FlyoutItem({ child, active, count, onSelect }) {
  const [hover, setHover] = useState(false);
  const Icon = child.icon;
  const bg = active ? T.rowActive : hover ? T.rowHover : "transparent";
  return (
    <button
      onClick={() => onSelect(child.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "6px 22px",
        background: bg,
        border: "none",
        borderLeft: `3px solid ${active ? T.accent : "transparent"}`,
        color: active ? T.text : T.textDim,
        fontFamily: "inherit", fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: "pointer", textAlign: "left",
        transition: "background-color 140ms ease, color 140ms ease"
      }}
    >
      {Icon && <Icon size={14} color={active ? T.accent : "currentColor"} style={{ flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap" }}>{child.label}</span>
      <TrailingSlot hover={hover}>
        {count !== null && (
          <span style={{
            fontSize: 11, lineHeight: 1,
            color: count > 0 ? (active ? T.accent : T.textDim) : T.textFaint
          }}>{count}</span>
        )}
      </TrailingSlot>
    </button>
  );
}

