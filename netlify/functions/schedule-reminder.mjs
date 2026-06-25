// netlify/functions/schedule-reminder.mjs
//
// S10 / Epic K — the daily build/confirm nudge (S110). A scheduled function
// that fires each morning, checks whether TODAY's schedule has been confirmed
// (a `schedule.confirmed_day` capture for today exists), and if not, pushes a
// single shared "review + confirm today's plan" reminder to every push
// subscription. One nudge, ritual-supporting, not a firehose (BD40); shared /
// role-agnostic like the rest of the app's pushes (S115).
//
// Why server-side: the day's draft is derived on the CLIENT, so the function
// deliberately does NOT recompute the day — it only reads the cheap, durable
// signal "did anyone confirm today?" from the captures table. (S114
// "tomorrow looks heavy" needs the load estimate and is deferred until a
// server-cheap proxy exists; S111 man-down push is client-triggered, separate.)
//
// Required env vars (already set for notify-run-done):
//   SUPABASE_URL (or VITE_SUPABASE_URL) · SUPABASE_SECRET_KEY ·
//   VAPID_PUBLIC_KEY · VAPID_PRIVATE_KEY · VAPID_SUBJECT
//
// Manual test:
//   curl -X POST https://<site>.netlify.app/.netlify/functions/schedule-reminder
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// The farm's local day (Foster, RI) as YYYY-MM-DD — the business day the
// capture's subject_id is keyed on. en-CA formats as ISO; the timeZone keeps
// "today" aligned with the operators' day, not UTC.
function farmTodayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export default async () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!url || !secret || !vapidPublic || !vapidPrivate || !vapidSubject) {
    return json({
      ok: false,
      error: "Missing SUPABASE_URL / SUPABASE_SECRET_KEY / VAPID_*.",
    }, 500);
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const todayISO = farmTodayISO();

  // 1. Already confirmed today? Then the ritual's done — no nudge.
  const confirmed = await supabase
    .from("captures")
    .select("id")
    .eq("schema_id", "schedule.confirmed_day")
    .eq("subject_type", "schedule_day")
    .eq("subject_id", todayISO)
    .limit(1);
  if (confirmed.error) {
    return json({ ok: false, error: confirmed.error.message }, 500);
  }
  if ((confirmed.data ?? []).length > 0) {
    return json({ ok: true, skipped: "already_confirmed", date: todayISO });
  }

  // 2. Recipients = subscriptions whose owner opted in (per-user setting,
  //    on by default) and whose frequency matches today. A user with no
  //    preferences row defaults to enabled/daily so a fresh subscriber is
  //    reminded until they say otherwise.
  const [subsRes, prefsRes] = await Promise.all([
    supabase.from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_email"),
    supabase.from("user_preferences")
      .select("user_email, schedule_reminder_enabled, schedule_reminder_frequency"),
  ]);
  const allSubs = subsRes.data ?? [];
  const prefsByEmail = new Map(
    (prefsRes.data ?? []).map((p) => [p.user_email, p]));
  const isWeekday = !["Sat", "Sun"].includes(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", weekday: "short",
    }).format(new Date()));

  const subscriptions = allSubs.filter((sub) => {
    const p = prefsByEmail.get(sub.user_email);
    const enabled = p ? p.schedule_reminder_enabled : true;
    const freq = p ? p.schedule_reminder_frequency : "daily";
    if (!enabled) return false;
    if (freq === "weekdays" && !isWeekday) return false;
    return true;
  });
  if (subscriptions.length === 0) {
    return json({ ok: true, skipped: "no_recipients", date: todayISO });
  }

  const payload = JSON.stringify({
    title: "Today's schedule",
    body: "Review and confirm today's plan.",
    kind: "confirm_nudge",
    tag: "schedule-nudge",
    url: "/schedule",
  });

  const sent = [];
  const removed = [];
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload, { TTL: 60 * 60 * 4 });
      sent.push(sub.id);
    } catch (err) {
      const code = err?.statusCode;
      if (code === 410 || code === 404) {
        removed.push(sub.id);
        try {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } catch (e) { /* ignore */ }
      } else {
        console.error("[schedule-reminder] push failed", code, err?.body || err);
      }
    }
  }));

  return json({
    ok: true, date: todayISO, sent: sent.length, removed: removed.length,
  });
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Scheduled morning nudge. 11:00 UTC ≈ 7:00a EDT / 6:00a EST — a consistent
// early-morning ritual time year-round (an hour's DST drift is fine for a
// "plan your day" nudge). Netlify cron is always UTC.
export const config = {
  schedule: "0 11 * * *",
};
