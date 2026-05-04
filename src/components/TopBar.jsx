import { useEffect, useState } from "react";
import { Sprout, Sun, Moon, LogOut } from "lucide-react";
import { T } from "../theme.js";
import UserAvatarMenu from "./UserAvatarMenu.jsx";
import { supabase } from "../lib/supabase.js";

function getInitialTheme() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export default function TopBar({ data, session, onOpenSettings }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("nff-theme", theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));
  const handleSignOut = () => {
    supabase.auth.signOut();
    // LoginGate's onAuthStateChange listener handles the re-render.
  };

  return (
    <header style={{ borderBottom: `1px solid ${T.border}`, padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: T.bg, flexShrink: 0, gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <LogoMark />
        <span style={{ fontFamily: T.uiLabel, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>
          Admin · v{data.meta.version}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <UserAvatarMenu session={session} onClick={onOpenSettings} />
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
      style={{
        background: "transparent",
        border: "none",
        color: T.textDim,
        padding: 6,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
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

  if (failed) return <Sprout size={28} color={T.accent} strokeWidth={2} />;
  if (!resolved) return <span style={{ display: "inline-block", height: LOGO_HEIGHT, width: LOGO_HEIGHT }} aria-hidden />;

  return (
    <span
      role="img"
      aria-label="North Foster Farm logo"
      style={{
        display: "inline-block",
        height: LOGO_HEIGHT,
        width: resolved.width,
        backgroundColor: T.accent,
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
