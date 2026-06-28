import { useEffect, useState } from "react";
import { Sprout, Menu, Search } from "lucide-react";
import UserAvatarMenu from "./UserAvatarMenu.jsx";
import InboxBell from "./InboxBell.jsx";
import ThoughtCapture from "./ThoughtCapture.jsx";
import OutboxIndicator from "./OutboxIndicator.jsx";

// Slimmed in the 2026-06 chore-ux fixes: text size, theme, and sign
// out all live on the Settings page now (avatar click goes there);
// the hamburger works on desktop too (collapses the sidebar).

export default function TopBar({
  data, session, onOpenSettings, onToggleNav, onOpenSearch, onHome,
}) {
  return (
    <header className="border-b border-line py-3 px-4 sm:px-6 flex justify-between items-center bg-bg shrink-0 gap-[18px]">
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Nav hamburger: phones open the overlay drawer; desktop
            collapses / restores the fixed sidebar. */}
        {onToggleNav && (
          <button
            onClick={onToggleNav}
            aria-label="Toggle navigation"
            title="Toggle navigation"
            className="bg-transparent border-0 text-dim hover:text-fg p-1.5 cursor-pointer flex items-center justify-center"
          >
            <Menu size={18} />
          </button>
        )}
        {/* The logo goes home — a convention people expect (F8). */}
        {onHome ? (
          <button
            type="button"
            onClick={onHome}
            aria-label="Home"
            title="Home"
            className="bg-transparent border-0 p-0 cursor-pointer flex items-center"
          >
            <LogoMark />
          </button>
        ) : (
          <LogoMark />
        )}
        <span className="hidden sm:inline font-ui text-[11px] text-dim uppercase tracking-[0.12em] font-semibold">
          Admin · v{data.meta.version}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {/* App-wide search / command palette (Batch 33) — cmd-K still works;
            the toolbar just shows the magnifying-glass icon on every size, no
            "Search" word or ⌘K chrome (F6). */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            aria-label="Search"
            title="Search (⌘K)"
            className="bg-transparent border-0 text-dim hover:text-fg p-1.5 cursor-pointer flex items-center justify-center"
          >
            <Search size={18} />
          </button>
        )}
        {/* Queued / not-synced field writes (Batch 16.2) */}
        <OutboxIndicator className="mr-2" />
        {/* "Just a thought…" capture (Batch 21) */}
        <ThoughtCapture />
        <InboxBell />
        <UserAvatarMenu session={session} onClick={onOpenSettings} />
      </div>
    </header>
  );
}

const LOGO_HEIGHT = 32;

function LogoMark() {
  // Tries /logo.svg, then /logo.png, then falls back to the Sprout icon.
  // The resolved logo is rendered via CSS mask so the fill follows the active
  // theme accent (var(--c-accent)) automatically.
  const [resolved, setResolved] = useState(null); // { src, width }
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tryLoad = async () => {
      for (const src of ["/logo.svg", "/logo.png"]) {
        const r = await new Promise((res) => {
          const im = new Image();
          im.onload = () => {
            const aspect = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1;
            res({ ok: true, width: Math.round(LOGO_HEIGHT * aspect) });
          };
          im.onerror = () => res({ ok: false });
          im.src = src;
        });
        if (cancelled) return;
        if (r.ok) { setResolved({ src, width: r.width }); return; }
      }
      if (!cancelled) setFailed(true);
    };
    tryLoad();
    return () => { cancelled = true; };
  }, []);

  if (failed) return <Sprout size={28} className="text-accent" strokeWidth={2} />;
  if (!resolved) return <span className="inline-block h-8 w-8" aria-hidden />;

  return (
    <span
      role="img"
      aria-label="North Foster Farm logo"
      className="inline-block bg-accent"
      style={{
        height: LOGO_HEIGHT,
        width: resolved.width,
        WebkitMaskImage: `url("${resolved.src}")`,
        maskImage: `url("${resolved.src}")`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain"
      }}
    />
  );
}
