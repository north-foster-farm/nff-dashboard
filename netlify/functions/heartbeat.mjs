// Scheduled Netlify function — keeps the Supabase project alive.
//
// Supabase's free tier auto-pauses a project after roughly 7 days with no
// database activity. This function runs once a day, upserts the single
// `heartbeat` row, and resets that inactivity timer. Daily is overkill
// (twice-weekly would suffice) but it's free, leaves a comfortable margin
// for any one-off Netlify outage, and the cron expression is trivial.
//
// Schedule is declared inline via the Functions 2.0 `config` export so
// the cadence lives next to the code rather than in netlify.toml.
//
// Env vars required (set in the Netlify site dashboard, NOT committed):
//   SUPABASE_SECRET_KEY  — secret API key (sb_secret_...). The 2025-era
//                          replacement for the legacy service_role JWT;
//                          bypasses RLS so the upsert works without a
//                          logged-in user. Never prefix with VITE_; that
//                          would bake it into the client bundle.
//   SUPABASE_URL         — same URL the frontend uses. Optional; falls
//                          back to VITE_SUPABASE_URL if only that one is
//                          set, since it's already configured for the
//                          build.
//
// Manual invocation for testing:
//   curl -X POST https://<site>.netlify.app/.netlify/functions/heartbeat
import { createClient } from "@supabase/supabase-js";

const HEARTBEAT_ID = 1; // Single-row table; id=1 is the only row we touch.

export default async () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    // Fail loudly so a misconfigured deploy shows up in Netlify logs
    // instead of silently letting the project drift toward suspension.
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing SUPABASE_URL or SUPABASE_SECRET_KEY env var"
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  // Secret-key client is created fresh per invocation — no session
  // persistence, no token refresh, no realtime. This is a one-shot call.
  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { error } = await supabase
    .from("heartbeat")
    .upsert({ id: HEARTBEAT_ID, last_ping: new Date().toISOString() });

  if (error) {
    console.error("heartbeat upsert failed:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, pingedAt: new Date().toISOString() }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};

// Netlify scheduled-function config. `@daily` runs once every 24h at a
// time of Netlify's choosing (no UTC alignment guarantee). For a liveness
// ping that's exactly what we want — we don't care when it runs, only
// that it runs often enough to reset Supabase's inactivity counter.
export const config = {
  schedule: "@daily"
};
