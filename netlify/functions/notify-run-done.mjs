// netlify/functions/notify-run-done.mjs
//
// Trigger for Batch 11.3 — Web push when a chore_run flips to 'done'.
// Posted to from the client via useChoreRuns.endRun(). The function
// re-reads the run with the secret key (RLS bypass), claims the
// notified_at marker atomically (so concurrent end-clicks only
// produce one push), computes payload, and fans out a VAPID-signed
// push to every push_subscriptions row.
//
// Idempotency: the UPDATE … WHERE notified_at IS NULL is the lock —
// only the first call wins, subsequent calls return { skipped: true }.
// Stale subscriptions (HTTP 410 Gone, 404 Not Found) get cleaned up
// in the same pass.
//
// Required env vars (set in Netlify):
//   SUPABASE_URL          (or VITE_SUPABASE_URL fallback)
//   SUPABASE_SECRET_KEY   sb_secret_... — bypasses RLS
//   VAPID_PUBLIC_KEY      pair to VITE_VAPID_PUBLIC_KEY shipped client-side
//   VAPID_PRIVATE_KEY     keep secret. Generated via
//                         `node scripts/generate-vapid-keys.mjs`
//   VAPID_SUBJECT         "mailto:you@example.com" or a https:// URL.
//                         Push services use this as the "who is sending
//                         this push" hint.
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import SunCalc from "suncalc";

// Foster, RI — same coordinates the dashboard uses everywhere else
// for sun events. Hardcoded to match.
const FARM_LAT = 41.7948;
const FARM_LON = -71.7515;

export default async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "POST only" }, 405);
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!url || !secret || !vapidPublic || !vapidPrivate || !vapidSubject) {
    return json({
      ok: false,
      error: "Missing one of SUPABASE_URL / SUPABASE_SECRET_KEY / " +
        "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.",
    }, 500);
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }
  const runId = body?.runId;
  if (!runId || typeof runId !== "string") {
    return json({ ok: false, error: "runId required" }, 400);
  }

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Atomically claim the row. Only fires once even if the client
  //    posts twice — the WHERE notified_at IS NULL is the lock.
  const claim = await supabase
    .from("chore_runs")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("state", "done")
    .is("notified_at", null)
    .select("id, block_id, run_date, started_at, ended_at")
    .single();
  if (claim.error || !claim.data) {
    // Either the run isn't done yet, doesn't exist, or someone else
    // already claimed it. Either way, this call is a no-op.
    return json({ ok: true, skipped: true });
  }
  const run = claim.data;

  // 2. Fetch block + every active subscription.
  const [blockRes, subsRes] = await Promise.all([
    supabase.from("chore_blocks")
      .select("id, name, start_kind, start_minutes, duration_minutes")
      .eq("id", run.block_id)
      .single(),
    supabase.from("push_subscriptions")
      .select("id, endpoint, p256dh, auth"),
  ]);
  if (blockRes.error) {
    return json({ ok: false, error: blockRes.error.message }, 500);
  }
  const block = blockRes.data;
  const subscriptions = subsRes.data ?? [];

  // 3. Compute payload (on-time vs overran).
  const payload = buildPayload(run, block);
  const dataString = JSON.stringify(payload);

  // 4. Fan out. 410 Gone / 404 Not Found = subscription is stale,
  //    so delete it. Other errors are logged but the response stays
  //    successful — partial delivery is normal.
  const sent = [];
  const removed = [];
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, dataString, { TTL: 60 * 10 });
      sent.push(sub.id);
    } catch (err) {
      const code = err?.statusCode;
      if (code === 410 || code === 404) {
        removed.push(sub.id);
        try {
          await supabase.from("push_subscriptions")
            .delete().eq("id", sub.id);
        } catch (e) { /* ignore */ }
      } else {
        console.error("[notify-run-done] push failed", code, err?.body || err);
      }
    }
  }));

  return json({
    ok: true,
    runId,
    sent: sent.length,
    removed: removed.length,
    payload,
  });
};

// ── Payload + math ────────────────────────────────────────────────────
function buildPayload(run, block) {
  const startedAt = run.started_at ? new Date(run.started_at) : null;
  const endedAt = run.ended_at ? new Date(run.ended_at) : null;
  const durationMin = (startedAt && endedAt)
    ? Math.max(0, Math.floor((endedAt - startedAt) / 60_000))
    : null;
  const overranMin = computeOverrunMinutes(run, block);
  const blockName = block?.name ?? "Rounds";
  let title;
  let body;
  if (overranMin && overranMin > 0) {
    title = `${blockName} rounds done`;
    body = `${formatDuration(durationMin)}, overran ${formatDuration(overranMin)}`;
  } else {
    title = `${blockName} rounds done`;
    body = formatDuration(durationMin);
  }
  return {
    title, body,
    runId: run.id,
    blockName,
    durationMinutes: durationMin,
    overranMinutes: overranMin ?? 0,
    kind: overranMin && overranMin > 0 ? "overran" : "on_time",
  };
}

function computeOverrunMinutes(run, block) {
  if (!run?.ended_at || !block) return null;
  const ended = new Date(run.ended_at);
  const endedMin = ended.getHours() * 60 + ended.getMinutes();
  const date = parseRunDate(run.run_date);
  if (!date) return null;
  let start;
  if (block.start_kind === "fixed") {
    start = block.start_minutes;
  } else {
    const times = SunCalc.getTimes(date, FARM_LAT, FARM_LON);
    const t = times[block.start_kind];
    if (!(t instanceof Date) || Number.isNaN(t.getTime())) return null;
    start = t.getHours() * 60 + t.getMinutes();
  }
  const end = start + (block.duration_minutes ?? 0);
  return endedMin > end ? endedMin - end : 0;
}

function parseRunDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function formatDuration(minutes) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0) {
    return "—";
  }
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      // Same-site only — the trigger comes from our own client.
      "access-control-allow-origin": "*",
    },
  });
}
