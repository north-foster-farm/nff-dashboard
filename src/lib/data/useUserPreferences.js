import { useCallback, useEffect, useId, useRef, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";

// Per-user preferences. Source-of-truth split:
//   * `localStorage` is the source the boot script reads synchronously
//     in index.html so the very first paint already has the right theme
//     / density. It's always kept in sync with the React state below.
//   * `user_preferences` (DB) is the cross-device source. We read it on
//     mount, push it into localStorage + DOM if it differs, and upsert
//     whenever the user toggles a setting.
//
// Returned shape:
//   { theme, density, setTheme, setDensity, loading, error }
//
// Setters are optimistic — they update React state + localStorage + the
// `data-theme` / `data-density` attributes synchronously, then fire an
// upsert in the background.

const DEFAULT_PREFS = {
  theme: "dark",
  density: "compact",
};

const VALID_THEMES = new Set(["dark", "light"]);
const VALID_DENSITIES = new Set(["compact", "comfortable", "spacious"]);

function readLocalPrefs() {
  if (typeof localStorage === "undefined") return DEFAULT_PREFS;
  const theme = localStorage.getItem("nff-theme");
  const density = localStorage.getItem("nff-density");
  return {
    theme: VALID_THEMES.has(theme) ? theme : DEFAULT_PREFS.theme,
    density: VALID_DENSITIES.has(density) ? density : DEFAULT_PREFS.density,
  };
}

function writeLocalPrefs(prefs) {
  try {
    localStorage.setItem("nff-theme", prefs.theme);
    localStorage.setItem("nff-density", prefs.density);
  } catch {}
}

function applyPrefsToDOM(prefs) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", prefs.theme);
  document.documentElement.setAttribute("data-density", prefs.density);
}

function rowToPrefs(row) {
  return {
    theme: VALID_THEMES.has(row.theme) ? row.theme : DEFAULT_PREFS.theme,
    density: VALID_DENSITIES.has(row.density) ? row.density : DEFAULT_PREFS.density,
  };
}

function prefsToRow(email, prefs) {
  return {
    user_email: email,
    theme: prefs.theme,
    density: prefs.density,
  };
}

export function useUserPreferences() {
  const email = useCurrentUserEmail();
  // Stable per-instance suffix so two hook callers (e.g. TopBar +
  // TodayTab) don't collide on the same `realtime:user_prefs:<email>`
  // channel name — Supabase rejects adding `.on()` to an existing,
  // already-subscribed channel.
  const instanceId = useId();
  const [prefs, setPrefs] = useState(() => readLocalPrefs());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // We bump this on local writes so the realtime subscription doesn't
  // bounce our own change back at us a tick later.
  const localWriteIdRef = useRef(0);

  // Apply on first render so the boot script's defaults get reconciled
  // even before the DB load lands.
  useEffect(() => { applyPrefsToDOM(prefs); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial DB load + ensure-row upsert. If no row exists for this user,
  // we create one seeded from whatever localStorage already had — that
  // way new admins keep the device defaults they were already using.
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error: selectErr } = await supabase
        .from("user_preferences")
        .select("theme, density")
        .eq("user_email", email)
        .maybeSingle();
      if (cancelled) return;
      if (selectErr) {
        setError(selectErr);
        setLoading(false);
        return;
      }
      if (!data) {
        const seed = readLocalPrefs();
        const { error: insertErr } = await supabase
          .from("user_preferences")
          .insert(prefsToRow(email, seed));
        if (cancelled) return;
        if (insertErr && insertErr.code !== "23505") {
          // 23505 = unique violation (race with another tab) — safe to
          // ignore, the row exists.
          setError(insertErr);
        }
        setPrefs(seed);
        applyPrefsToDOM(seed);
        writeLocalPrefs(seed);
        setLoading(false);
        return;
      }
      const next = rowToPrefs(data);
      setPrefs(next);
      applyPrefsToDOM(next);
      writeLocalPrefs(next);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [email]);

  // Realtime: cross-device sync. If the same user updates preferences in
  // another tab / browser / phone, mirror the change here.
  useEffect(() => {
    if (!email) return;
    const channel = realtimeChannel(`user_prefs:${email}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_preferences",
          filter: `user_email=eq.${email}`,
        },
        (payload) => {
          // Skip rebroadcasts of our own writes — heuristic: ignore
          // updates that arrive within 500ms of a local write.
          if (Date.now() - localWriteIdRef.current < 500) return;
          const next = rowToPrefs(payload.new);
          setPrefs(next);
          applyPrefsToDOM(next);
          writeLocalPrefs(next);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [email, instanceId]);

  // Generic setter. Optimistic local write, async DB upsert.
  const update = useCallback(async (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    applyPrefsToDOM(next);
    writeLocalPrefs(next);
    localWriteIdRef.current = Date.now();
    if (!email) return;
    const { error: upsertErr } = await supabase
      .from("user_preferences")
      .upsert(prefsToRow(email, next), { onConflict: "user_email" });
    if (upsertErr) setError(upsertErr);
  }, [email, prefs]);

  const setTheme = useCallback((theme) => update({ theme }), [update]);
  const setDensity = useCallback((density) => update({ density }), [update]);

  return {
    ...prefs,
    setTheme,
    setDensity,
    loading,
    error,
  };
}
