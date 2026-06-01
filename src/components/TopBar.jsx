import { useEffect, useState } from "react";
import { Sprout, Sun, Moon, LogOut, ALargeSmall, Menu } from "lucide-react";
import UserAvatarMenu from "./UserAvatarMenu.jsx";
import { supabase } from "../lib/supabase.js";
import { useUserPreferences } from "../lib/data/useUserPreferences.js";
import InboxBell from "./InboxBell.jsx";
import OutboxIndicator from "./OutboxIndicator.jsx";

const DENSITY_ORDER = ["compact", "comfortable", "spacious"];

function nextDensity(d) {
  const i = DENSITY_ORDER.indexOf(d);
  return DENSITY_ORDER[(i + 1) % DENSITY_ORDER.length];
}

export default function TopBar({ data, session, onOpenRecords, onToggleNav }) {
  const { theme, density, setTheme, setDensity } = useUserPreferences();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const toggleDensity = () => setDensity(nextDensity(density));
  const handleSignOut = () => {
    supabase.auth.signOut();
    // LoginGate's onAuthStateChange listener handles the re-render.
  };

  return (
    <header className="border-b border-line py-3 px-4 sm:px-6 flex justify-between items-center bg-bg shrink-0 gap-[18px]">
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Phone-only nav hamburger (Batch 17) — the fixed sidebar is
            desktop-only; phones open it as an overlay drawer. */}
        {onToggleNav && (
          <button
            onClick={onToggleNav}
            aria-label="Open navigation"
            className="sm:hidden bg-transparent border-0 text-dim p-1.5 cursor-pointer flex items-center justify-center"
          >
            <Menu size={18} />
          </button>
        )}
        <LogoMark />
        <span className="hidden sm:inline font-ui text-[11px] text-dim uppercase tracking-[0.12em] font-semibold">
          Admin · v{data.meta.version}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {/* Queued / not-synced field writes (Batch 16.2) */}
        <OutboxIndicator className="mr-2" />
        <InboxBell />
        <UserAvatarMenu session={session} onClick={onOpenRecords} />
        <IconButton
          onClick={toggleDensity}
          ariaLabel={`Text density: ${density} (click to cycle)`}
        >
          <ALargeSmall size={16} />
        </IconButton>
        <IconButton
          onClick={toggleTheme}
          ariaLabel={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        <IconButton onClick={handleSignOut} ariaLabel="Sign out">
          <LogOut size={16} />
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({ onClick, ariaLabel, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="bg-transparent border-0 text-dim p-1.5 cursor-pointer flex items-center justify-center"
    >
      {children}
    </button>
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
