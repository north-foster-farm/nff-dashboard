import { createClient } from "@supabase/supabase-js";

// Single Supabase client for the entire app. Consumers import `supabase`
// directly rather than threading it through React context — it's a
// long-lived singleton with its own session cache, and there's only ever
// one Supabase project per build.
//
// Keys come from Vite env vars (.env.local for dev, Netlify dashboard for
// prod). The publishable key (sb_publishable_...) is the 2025-era
// replacement for the legacy "anon" JWT. It's designed to ship in the
// client bundle; every actual access check lives in Postgres RLS policies.
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  // Fail loudly at import time rather than with cryptic network errors.
  // This catches the common "forgot to create .env.local" footgun.
  throw new Error(
    "Supabase env vars missing. Copy .env.example to .env.local and fill " +
      "in VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY."
  );
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    // PKCE is the default for the JS client but we set it explicitly so the
    // behaviour is obvious to future readers — the OAuth redirect lands
    // with a `?code=` query param that the client library automatically
    // exchanges for a session on page load (see `detectSessionInUrl`).
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true
  }
});

// Realtime channel factory for the data hooks. realtime-js dedupes
// channels by topic and throws if `postgres_changes` callbacks are
// added to a channel that has already subscribed — exactly what
// happens when two mounted components run the same data hook at once
// (e.g. MapPage keeps its hooks mounted while rendering PlacePage on
// top of itself). The counter suffix makes every call's topic unique,
// so each mount gets its own channel. Cleanup is unchanged:
// supabase.removeChannel(channel).
let channelSeq = 0;
export function realtimeChannel(topic) {
  channelSeq += 1;
  return supabase.channel(`${topic}:${channelSeq}`);
}
