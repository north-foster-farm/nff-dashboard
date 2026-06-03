import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

// PWA "Add to Home Screen" prompt (Batch 35). Two paths:
//   - Chrome / Edge / Android fire `beforeinstallprompt`; we stash the
//     event and trigger the native installer on tap.
//   - iOS Safari never fires it and only installs via the Share sheet,
//     so there we show a short instruction instead.
// Hidden when already installed (standalone display-mode) or once the
// user dismisses it (persisted, so it doesn't nag every load).

const DISMISS_KEY = "nff-install-dismissed";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    // iOS Safari exposes navigator.standalone instead.
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    && !/crios|fxios/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return undefined;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch {}
    if (dismissed) return undefined;

    // Chrome / Android path.
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS path: no event — show the Share-sheet hint on a phone-sized
    // Safari that isn't already installed.
    if (isIOS()) {
      setIosHint(true);
      setShow(true);
    }

    // Clean up once installed.
    const onInstalled = () => setShow(false);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] sm:left-auto sm:right-4 sm:max-w-[360px]">
      <div className="bg-surface border border-accent shadow-[0_8px_28px_rgba(0,0,0,0.3)] p-3.5 flex items-start gap-3">
        <Download size={18} className="text-accent-deep shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-fg">
            Install North Foster Farm
          </div>
          {iosHint ? (
            <div className="text-[11px] text-dim leading-relaxed mt-1">
              Tap <Share size={11} className="inline -translate-y-px" /> in
              Safari&rsquo;s toolbar, then <span className="text-fg">Add to
              Home Screen</span> for a full-screen, offline-ready app.
            </div>
          ) : (
            <div className="text-[11px] text-dim leading-relaxed mt-1">
              Add it to your home screen for full-screen, offline-ready
              access.
            </div>
          )}
          {!iosHint && (
            <button
              onClick={install}
              className="mt-2 inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
            >
              <Download size={13} /> Install
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="bg-transparent border-0 text-dim hover:text-fg p-0.5 cursor-pointer shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
