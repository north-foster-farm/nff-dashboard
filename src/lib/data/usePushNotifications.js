import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";

// Web push subscription state for the Settings page.
//
// State machine:
//   support     'unsupported' | 'ok'   — feature detection
//   permission  'default' | 'granted' | 'denied' | 'unsupported'
//   subscribed  boolean — does an active push subscription exist?
//   pending     boolean — true while a subscribe / unsubscribe is in flight
//   error       Error  | null
//
// The hook also surfaces:
//   needsInstall   true on iOS Safari when the page hasn't been installed
//                  to the home screen yet — push only works in the
//                  installed-PWA context on iOS.
//   missingVapid   true when VITE_VAPID_PUBLIC_KEY is unset; surfaces a
//                  "set up VAPID keys" hint in Settings.
//
// Actions:
//   enable()       request permission + register SW + subscribe + persist row.
//   disable()      unsubscribe + delete row.
//
// We persist the subscription under the current user's email — the
// Netlify function later reads with the secret key (RLS bypass) to
// fan out across every device.

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "").trim();

export function usePushNotifications() {
  const email = useCurrentUserEmail();
  const [support, setSupport] = useState(() => detectSupport());
  const [permission, setPermission] = useState(() => readPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  // Initial sync — does this device already have an active subscription?
  useEffect(() => {
    if (support !== "ok") return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(!!sub);
      } catch (e) {
        if (!cancelled) setError(e);
      }
    })();
    return () => { cancelled = true; };
  }, [support]);

  const enable = useCallback(async () => {
    if (support !== "ok") return;
    if (!VAPID_PUBLIC_KEY) {
      setError(new Error("VAPID public key not configured."));
      return;
    }
    if (!email) {
      setError(new Error("Not signed in."));
      return;
    }
    setPending(true);
    setError(null);
    try {
      // 1. Permission.
      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
      }
      setPermission(perm);
      if (perm !== "granted") {
        setPending(false);
        return;
      }
      // 2. Register the SW (idempotent).
      const reg = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
      // 3. Subscribe via PushManager.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      // 4. Persist (upsert by endpoint).
      const row = subscriptionToRow(sub, email);
      const { error: upErr } = await supabase
        .from("push_subscriptions")
        .upsert(row, { onConflict: "endpoint" });
      if (upErr) throw upErr;
      setSubscribed(true);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }, [support, email]);

  const disable = useCallback(async () => {
    if (support !== "ok") return;
    setPending(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try {
          await supabase.from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        } catch (e) { /* best-effort cleanup */ }
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }, [support]);

  return {
    support,
    permission,
    subscribed,
    pending,
    error,
    needsInstall: needsInstallForPush(),
    missingVapid: !VAPID_PUBLIC_KEY,
    enable,
    disable,
  };
}

// ── Feature detection ─────────────────────────────────────────────────
function detectSupport() {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator)) return "unsupported";
  if (!("PushManager" in window)) return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return "ok";
}

function readPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

// iOS Safari only delivers web push to PWAs added to the home screen.
// Detect: iOS device + not running in standalone (display-mode: standalone
// or navigator.standalone for older iOS).
function needsInstallForPush() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  if (!isIOS) return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches
    || navigator.standalone === true;
  return !standalone;
}

// ── Encoding helpers ──────────────────────────────────────────────────
// VAPID public keys are urlBase64-encoded; PushManager.subscribe() wants
// a Uint8Array. The conversion is the standard base64url → bytes recipe.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    s += String.fromCharCode(bytes[i]);
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function subscriptionToRow(subscription, email) {
  const json = subscription.toJSON?.() ?? {};
  const p256dh = json.keys?.p256dh
    ?? arrayBufferToBase64Url(subscription.getKey("p256dh"));
  const auth = json.keys?.auth
    ?? arrayBufferToBase64Url(subscription.getKey("auth"));
  return {
    user_email: email,
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    last_seen_at: new Date().toISOString(),
  };
}
