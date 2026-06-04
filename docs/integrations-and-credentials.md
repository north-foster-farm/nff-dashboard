# Integrations & credentials — setup walkthrough

Every external account / API key the dashboard needs — what's already
wired, what's coming, and how to set each up. Work top-down; the
**Recommended order** section sequences them by how much they unblock.

This is a checklist you (James) drive — most steps are "create an
account, make a key, paste it where it goes." Claude can do the code
wiring once a credential exists, but creating accounts / accepting ToS /
entering billing is yours.

---

## Where secrets live in this project

Three stores, by audience:

| Store | What goes here | Notes |
|-------|----------------|-------|
| **`.env.local`** (gitignored) | Local-dev copies of everything | Never committed. `VITE_`-prefixed vars are **bundled into the client** (so only *publishable* keys get that prefix); everything else is local-only and not actually used server-side in dev. |
| **Netlify → Site settings → Environment variables** | The **production** secrets — build-time (`VITE_*`) and serverless-function runtime (everything the `netlify/functions/*` code reads) | This is the real home for production server secrets. Stripe/Shippo/SendGrid/Anthropic/etc. secret keys live here, **without** a `VITE_` prefix so they never reach the browser. |
| **Supabase** (Auth provider config; DB secrets if edge functions ever used) | The Google OAuth client id/secret are entered in the Supabase dashboard (Auth → Providers). This project runs serverless on **Netlify functions**, not Supabase edge functions, so most server secrets go to Netlify, not Supabase. |

**The one rule that matters:** a *secret* key never gets a `VITE_`
prefix and never appears in client code. Only **publishable/public**
keys (Supabase publishable, Stripe `pk_`, VAPID public, MapKit/Google
Maps *browser* key with referrer restriction) are safe client-side.

---

## Recommended order

Sequenced by leverage (what each unblocks) and by roadmap need:

1. **Transactional email** (SendGrid/Mailgun) — unblocks the *most*:
   notification email channel, guest magic-links, the Claude agent's
   email channel, and Batch 32 farm-update blasts. Do this first.
2. **Anthropic / Claude API** — the Claude agent + wish-list image
   help. Cheap, fast to set up.
3. **YoLink** — thermometers → freezer/brooder temp + alerts; ties to
   cold-chain. Free, ~10 min.
4. **Maps / traffic** (Google Routes) — the event travel-time feature.
5. **Commerce (Batch 30):** Stripe → Shippo → QuickBooks (Venmo is a
   caveat, see below). Bigger lift; gated on the e-comm push.
6. **File storage** (S3-compatible + Google Drive) — when the file
   features get scheduled.
7. **Google Calendar API** (Batch 31) — when GCal push gets scheduled.

You don't need all of these at once — set each up when its batch comes
up. The table at the bottom is the at-a-glance index.

---

## 0. Already set up (for reference)

These exist and work; listed so the picture is complete.

- **Supabase** — project URL + publishable key (`sb_publishable_…`,
  client-safe) + secret key (`sb_secret_…`, server-only). In
  `.env.local` as `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and mirrored in Netlify env.
- **Google OAuth** (sign-in) — a Web OAuth 2.0 client in Google Cloud
  Console; client id/secret entered in **Supabase → Auth → Providers →
  Google**. The client-secret JSON is stashed in `.ignored/`.
- **Web Push / VAPID** — a self-generated keypair
  (`scripts/generate-vapid-keys.mjs`). Public → `VITE_VAPID_PUBLIC_KEY`;
  private stays server-side. No third-party account.
- **Netlify** — hosting, the build, `netlify/functions/*` serverless +
  scheduled functions, and the production env-var store.

---

## 1. Transactional email — SendGrid **or** Mailgun

**Unblocks:** notification email channel · guest magic-link emails ·
the Claude agent's *email-to-app* channel (inbound parse) · Batch 32
farm-update blasts.

Pick **one** provider (both fine; Mailgun's routes are slightly nicer
for inbound, SendGrid's free tier is generous). You need **three**
things from whichever you pick:

1. **An outbound API key** — to send mail.
2. **A verified sending domain** — DNS records (SPF + DKIM, ideally
   DMARC) on a domain you control, so mail isn't spam-filtered. You'll
   need access to **wherever northfosterfarm.com DNS is hosted** (find
   this out first — Netlify DNS? a registrar? Google?).
3. **Inbound parse routing** — an address (e.g. `do@…` or
   `agent@…northfosterfarm.com`) whose mail is POSTed to a webhook
   (a Netlify function) — this is what makes "email the app" work.

### SendGrid
- Create account at app.sendgrid.com.
- **Settings → API Keys →** create a key (Restricted Access → *Mail
  Send* is enough for outbound; add more if needed). Copy it once.
- **Settings → Sender Authentication → Authenticate Your Domain →**
  follow the CNAME records it gives you, add them to DNS, verify.
- **Settings → Inbound Parse →** add a hostname (e.g.
  `parse.northfosterfarm.com`), set its **MX** record, point it at your
  webhook URL.
- Free tier ~100 emails/day; paid scales up.

### Mailgun (alternative)
- Create account at mailgun.com.
- **Sending → Domains → Add domain** (e.g. `mg.northfosterfarm.com`),
  add the SPF/DKIM/MX/CNAME records it lists, verify.
- **API key:** Settings → API Keys.
- **Inbound:** Receiving → Routes → match the agent address → forward
  (POST) to your webhook URL.
- Pay-as-you-go (~$0.80/1000).

**Secrets →** Netlify env (e.g. `SENDGRID_API_KEY` /
`MAILGUN_API_KEY` + `MAILGUN_DOMAIN`), server-only, no `VITE_`.

---

## 2. Anthropic / Claude API

**Unblocks:** the Claude-powered agent (chat + email) · wish-list
image/description help.

- Sign in at console.anthropic.com.
- **Settings → API Keys → Create Key** (`sk-ant-…`). Copy once.
- Add a payment method / credits (Billing). Usage-based; the agent's
  cost is per-message and modest at two-operator scale.
- Use the **latest Claude model** (the SDK names move forward; pick the
  current best when building).

**Secrets →** Netlify env `ANTHROPIC_API_KEY`, **server-only** — the
agent runs in a Netlify function; the key must never reach the browser.

**Note on wish-list images:** Claude reasons over text/vision but
doesn't *generate* images. So: a product **URL** → just unfurl its
Open-Graph image (no API needed); a **plain-text** item → Claude can
propose a search query, but actually fetching a photo needs an image
source (a stock/image-search API, or manual upload). Decide at build
time; manual-upload fallback always exists.

---

## 3. YoLink (smart thermometers)

**Unblocks:** freezer / brooder temperature readings + threshold
alerts; feeds the cold-chain + lots/bins work.

- In the **YoLink mobile app**: ☰ → **Account → Advanced Settings →
  User Access Credentials → (generate)**. You get a **UAID** and a
  **Secret Key**.
- The **YoLink Cloud API**: POST UAID + secret to the token endpoint →
  an access token; then call the HTTP API (or subscribe via MQTT) for
  device state/history.
- Free — it's your own devices/account.

**Secrets →** Netlify env `YOLINK_UAID` + `YOLINK_SECRET`, server-only
(a Netlify scheduled function polls or an MQTT bridge subscribes).

---

## 4. Maps / traffic — event travel time

**Unblocks:** the event-time-footprint travel lookups (predicted ETA to
and home from markets / processing days; "leave by" + alerts).

Recommended: **Google Maps Platform — Routes API** (supports a *future*
`departure_time` with live/predictive traffic, which is the whole point).

- console.cloud.google.com → (the existing project is fine) → **APIs &
  Services → Enable APIs →** enable **Routes API** (and/or Directions
  API).
- **Credentials → Create credentials → API key.** **Restrict it**: by
  API (Routes/Directions only) and by IP (your Netlify function) since
  it's called server-side.
- **Billing must be enabled** (there's a monthly free credit; the
  scheduled-lookup cadence — create / T-1d / T-3h / T-30m — keeps call
  volume low).

Alternative: **Apple MapKit JS** (developer.apple.com → Certificates,
IDs & Profiles → MapKit JS key → a JWT) — free, but the future-traffic
prediction story is weaker than Google's. Go Google unless you have a
reason not to.

**Secrets →** Netlify env `GOOGLE_MAPS_API_KEY`, server-only (route
lookups happen in a function so the key isn't exposed and you control
restriction). You'll also need the **farm's coordinates** (origin) and
**routable locations on events** (destinations) — see the event-
footprint roadmap entry's data-audit note.

---

## 5. Commerce (Batch 30)

The live carrier + payments + accounting layer. Bigger lift; gated on
the e-commerce push. Use **test mode** for all of these until the flow
is solid.

### Stripe (card payments)
- dashboard.stripe.com → **Developers → API keys**: publishable
  (`pk_live_…`, client-safe) + secret (`sk_live_…`, server-only).
- **Developers → Webhooks → Add endpoint** (a Netlify function URL) for
  payment events → copy the **signing secret** (`whsec_…`).
- Fees ~2.9% + 30¢. Start in **Test mode** (`pk_test_`/`sk_test_`).
- **Secrets →** Netlify env: `VITE_STRIPE_PUBLISHABLE_KEY` (the *only*
  one that may be `VITE_`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

### Shippo (carrier labels / rates / tracking — cold-chain shipping)
- goshippo.com → **Settings → API → generate token** (Test + Live).
- For tracking updates: register a **webhook** → a Netlify function.
- Cost: per-label fee (~$0.05) on top of postage.
- **Secrets →** Netlify env `SHIPPO_API_TOKEN`, server-only.

### QuickBooks (accounting sync)
- developer.intuit.com → **create an app** → **OAuth 2.0** keys
  (client id + secret) + a **sandbox** company for testing.
- OAuth flow with token refresh + the company **realm id**.
- **Secrets →** Netlify env `QUICKBOOKS_CLIENT_ID` /
  `QUICKBOOKS_CLIENT_SECRET` (+ stored per-connection tokens), server-only.

### Venmo — reality check
There is **no general Venmo API** for programmatically accepting
arbitrary payments (PayPal owns Venmo; access is via **PayPal /
Braintree Checkout** with Venmo as a funding source, for business
accounts). Options: (a) accept Venmo *through* PayPal Braintree, or
(b) keep recording Venmo payments **manually** (the Orders flow already
supports a "Venmo" payment method). Recommend (b) until volume
justifies the PayPal Braintree integration. No standalone Venmo key to
get.

---

## 6. File storage (S3-compatible + Google Drive)

**Unblocks:** cut sheets on processing events, product media, social/
content-calendar media, brand assets. (The app already uses Supabase
Storage for product photos + project files; this generalizes it.)

### Object storage — pick one S3-compatible provider
- **Cloudflare R2** (recommended — no egress fees): dash.cloudflare.com
  → **R2 → Create bucket** → **Manage R2 API Tokens → Create** → an
  **Access Key ID + Secret Access Key** + the S3 endpoint URL.
- Alternatives: **Backblaze B2**, **AWS S3**, **DO Spaces** — all
  S3-API compatible; same shape of credential.
- **Secrets →** Netlify env: `S3_ENDPOINT`, `S3_BUCKET`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, server-only. Client
  uploads via **presigned URLs** minted in a function — keys never
  client-side.

### Google Drive (pull-in)
- console.cloud.google.com → enable **Google Drive API** → OAuth
  consent + a **Web OAuth client** (can share the existing project) →
  client id/secret.
- Scope: `drive.readonly` (or `drive.file`) for importing.
- **Secrets →** Netlify env `GOOGLE_DRIVE_CLIENT_ID` /
  `…_SECRET` (+ stored user tokens), server-only.

---

## 7. Google Calendar API (Batch 31)

**Unblocks:** push-only GCal sync (watch `event_occurrences` → emit
create/update/cancel).

- console.cloud.google.com (existing project) → enable **Google
  Calendar API**.
- Auth: a **service account** (with domain-wide delegation to write the
  farm calendar) *or* OAuth. Download the credentials JSON.
- **Secrets →** Netlify env (the function that pushes), server-only.
- Logs land in the existing `gcal_pushes` table (schema-only from 0013).

---

## At-a-glance index

| Integration | For (feature / batch) | Account | Key(s) | Lives in |
|-------------|----------------------|---------|--------|----------|
| Supabase ✅ | the whole app | done | publishable + secret | `.env.local` + Netlify |
| Google OAuth ✅ | sign-in | done | client id/secret | Supabase Auth |
| Web Push / VAPID ✅ | round-done push | self-gen | public + private | `.env.local` + Netlify |
| Netlify ✅ | hosting + functions + env | done | — | — |
| **Transactional email** | notifications · guest magic-link · agent email · Batch 32 | SendGrid **or** Mailgun | API key + domain DNS + inbound route | Netlify |
| **Anthropic / Claude** | Claude agent · wish-list images | console.anthropic.com | `sk-ant-…` | Netlify (server-only) |
| **YoLink** | thermometers + alerts | YoLink app | UAID + secret | Netlify |
| **Maps / traffic** | event travel time | Google Maps Platform | API key (restricted) | Netlify |
| Stripe | card payments (Batch 30) | dashboard.stripe.com | `pk_` + `sk_` + `whsec_` | Netlify (+ `pk_` client) |
| Shippo | labels/tracking (Batch 30) | goshippo.com | API token | Netlify |
| QuickBooks | accounting (Batch 30) | developer.intuit.com | OAuth client + realm | Netlify |
| Venmo | payments (Batch 30) | — | none (via PayPal/Braintree or manual) | — |
| File storage | files cross-cutting | R2 / B2 / S3 | access key id + secret | Netlify (presigned) |
| Google Drive | file pull-in | Google Cloud | OAuth client | Netlify |
| Google Calendar | GCal push (Batch 31) | Google Cloud | service account / OAuth | Netlify |

**First DNS task** (blocks transactional email + Drive/Calendar verify):
confirm where `northfosterfarm.com` DNS is managed so domain-verification
records can be added.
