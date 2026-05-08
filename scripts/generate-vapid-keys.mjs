// One-time setup helper for Batch 11.3 — Web push.
//
// Generates a fresh VAPID keypair and prints the env-var lines you
// should drop into:
//
//   * .env.local                  (your dev shell — VITE_VAPID_PUBLIC_KEY only)
//   * Netlify site env vars       (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//                                   VAPID_SUBJECT)
//
// Usage:
//   node scripts/generate-vapid-keys.mjs
//
// Treat the private key like a password — it identifies your server
// to push services. Rotating it invalidates every existing
// subscription (clients will need to re-subscribe), so generate once
// per project and keep it stable.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

process.stdout.write(
  "# ── Frontend (.env.local) ─────────────────────────────────────────────\n" +
  `VITE_VAPID_PUBLIC_KEY=${publicKey}\n` +
  "\n" +
  "# ── Netlify site env vars ─────────────────────────────────────────────\n" +
  `VAPID_PUBLIC_KEY=${publicKey}\n` +
  `VAPID_PRIVATE_KEY=${privateKey}\n` +
  "VAPID_SUBJECT=mailto:you@example.com\n"
);
