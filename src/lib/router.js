import { useCallback, useEffect, useMemo, useState } from "react";

// router.js — tiny history-based router for the dashboard (no
// dependency on react-router; the app's navigation model is small
// enough that the History API + one hook covers it).
//
// The app's primary navigation state lives in the URL so that:
//   * reloading reopens the same screen,
//   * the browser back / forward buttons walk real history,
//   * screens can be deep-linked (Netlify already rewrites /* to
//     index.html — see netlify.toml).
//
// URL scheme:
//   /                      → device default (phone: /now, desktop: /map)
//   /now /map /overview …  → sections (section id, underscores → dashes)
//   /chores/<tab>          → Chores page with that tab selected
//   /events/<kind>         → Schedule filtered to that event kind
//   /livestock/<species>   → species record pages
//   /livestock/<species>/<batchId>
//                          → batch lifecycle page (renders inside the
//                            species section)
//   /place/<placeId>       → a place page (renders inside the map section)
//   /rounds[/<blockId>]    → the full-screen Rounds takeover
//
// Modal-ish overlays (EventEditor, records drawer, processing
// workspace) deliberately stay out of the URL.

// ── Path ↔ section-id mapping ─────────────────────────────────────────

export function pathForSection(sectionId) {
  if (!sectionId) return "/";
  if (sectionId.startsWith("events_")) {
    return "/events/" + dashed(sectionId.slice("events_".length));
  }
  if (sectionId.startsWith("livestock_")) {
    return "/livestock/" + dashed(sectionId.slice("livestock_".length));
  }
  return "/" + dashed(sectionId);
}

// Deep link to one batch's lifecycle page (Batch 20).
export function pathForBatch(speciesId, batchId) {
  return "/livestock/" + dashed(speciesId) + "/" + dashed(batchId);
}

function dashed(id) {
  return id.replace(/_/g, "-");
}

function undashed(slug) {
  return (slug ?? "").replace(/-/g, "_");
}

// Parse a pathname into a route descriptor:
//   { kind: "home" }
//   { kind: "rounds", blockId: string|null }
//   { kind: "section", sectionId, placeId: string|null,
//     choresTab: string|null }
export function parseRoute(pathname) {
  const parts = (pathname ?? "/").split("/").filter(Boolean);
  if (parts.length === 0) return { kind: "home" };
  const [head, ...rest] = parts;
  if (head === "rounds") {
    return { kind: "rounds", blockId: rest[0] ?? null };
  }
  if (head === "place" && rest[0]) {
    return section("map", { placeId: rest[0] });
  }
  if (head === "events") {
    return section("events_" + undashed(rest[0] ?? "all"));
  }
  if (head === "livestock" && rest[0]) {
    return section("livestock_" + undashed(rest[0]), {
      batchId: rest[1] ? undashed(rest[1]) : null,
    });
  }
  if (head === "chores") {
    return section("chores", { choresTab: rest[0] ?? null });
  }
  return section(undashed(head));
}

function section(sectionId, extra = {}) {
  return {
    kind: "section",
    sectionId,
    placeId: null,
    choresTab: null,
    batchId: null,
    ...extra,
  };
}

// ── History plumbing ──────────────────────────────────────────────────

// Components subscribed via usePath(); notified on every navigate()
// (popstate has its own listener per hook instance).
const listeners = new Set();

function notify() {
  for (const l of listeners) l();
}

function currentIdx() {
  return typeof window !== "undefined"
    ? window.history.state?.idx ?? 0
    : 0;
}

export function navigate(path, { replace = false } = {}) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === path) return;
  if (replace) {
    window.history.replaceState({ idx: currentIdx() }, "", path);
  } else {
    window.history.pushState({ idx: currentIdx() + 1 }, "", path);
    // New screen → start at the top. Back/forward keep the browser's
    // own scroll restoration.
    window.scrollTo(0, 0);
  }
  notify();
}

// Go back if there is in-app history to go back to (we stamp every
// pushState with an idx); otherwise land on the fallback path. Used by
// takeovers (Rounds, place pages) so their close button behaves like
// the browser back button.
export function navigateBack(fallbackPath) {
  if (typeof window === "undefined") return;
  if (currentIdx() > 0) {
    window.history.back();
  } else {
    navigate(fallbackPath, { replace: true });
  }
}

// Current pathname, kept in sync with pushState/replaceState (via
// notify) and the browser back/forward buttons (via popstate).
export function usePath() {
  const [path, setPath] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname
  );
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    listeners.add(update);
    window.addEventListener("popstate", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return path;
}

export function useRoute() {
  const path = usePath();
  return useMemo(() => parseRoute(path), [path]);
}

// ── Session-scoped UI state ───────────────────────────────────────────

// useState backed by sessionStorage. Used for per-screen UI state
// (selected calendar view, chores sort, map zoom, …) so clicking
// between screens — or reloading — doesn't reset it, without putting
// every toggle in the URL. Session-scoped on purpose: a fresh tab
// starts from the defaults.
export function usePersistedState(key, initialValue) {
  const storageKey = "nff-ui:" + key;
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw != null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const set = useCallback((next) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(resolved));
      } catch {
        // Storage unavailable (private mode quota, etc.) — state still
        // works for this mount.
      }
      return resolved;
    });
  }, [storageKey]);
  return [value, set];
}
