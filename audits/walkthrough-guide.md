# Recorded walkthrough audit — field guide (Batch 40.2)

How to record a screen-and-voice walkthrough of the whole app so Claude
can turn it into a triaged findings list. Keep this open on a second
screen / phone while you record.

The pipeline (what makes the narration matter): Claude runs
`scripts/process-audit.sh` → ffmpeg pulls the **audio** (→ whisper.cpp →
a **timestamped transcript**) and a **video frame per transcript
segment**. Claude reads transcript + frame together and writes one
finding per issue (page · your words · the frame · a diagnosis ·
size · checkbox). So: **your voice is the data, the frame is the
evidence.** Narrate accordingly.

---

## 0. Before you hit record

- **Mic on, check the input.** ⌘⇧5 → Options → pick your mic. Do a
  3-second test ("testing, Orders page") and confirm you hear it back.
- **Clean window.** Quit Slack/Mail/notification pop-ups. Use one
  browser window, normal size (don't full-screen a 27" — the frames get
  unreadable when downscaled; ~1280–1440px wide is ideal).
- **Real data, but don't break prod.** It's the live DB. When you reach
  a destructive button, *say* "I'd delete this here" — don't actually
  delete. For create flows, you can make a row and say "I'll clean this
  up" (or just narrate without submitting).
- **One clip per area.** Several short recordings beat one giant file —
  faster to process, and a crash doesn't cost the whole session. Aim
  **≤ ~8 min each.**
- **Naming:** save to `audits/raw/` as `NN-area.mov`, e.g.
  `01-shell.mov`, `02-now.mov`, … (the leading number sets order).
- **Pilot first.** Record just **one** short area (Now or Dashboard,
  ~2–3 min), hand it over, and let Claude process it so you can sanity-
  check the findings format *before* doing the full run. Adjust pace if
  needed.

---

## 1. How to narrate (so the transcript + frame line up)

- **Say the screen when you arrive.** "I'm on the Orders page now." This
  anchors every following finding to the right frame.
- **Point with words, not the cursor.** The frame is a still — "the
  green pill top-right", "this row that says Batch 3", "the third tab".
  A waved cursor doesn't survive to the transcript.
- **One issue at a time, then a beat.** Finish the thought, pause ~1s,
  then the next. Run-on narration smears two findings into one segment.
- **Demonstrate the problem.** Actually click the thing that misbehaves,
  hover the affordance that's unclear, type into the field that's
  awkward. The frame should *show* what you're describing.
- **Rate it as you go.** A quick "this is a nitpick" / "this is
  confusing" / "this is broken" / "this would stop me using it" lets the
  triage pre-sort. Severity in your own words is gold.
- **Praise what works.** "This is exactly right, don't touch it" is a
  finding too — it protects good parts from being churned.
- **Name the fix if you have one,** but don't force it — "I'd want this
  sorted newest-first" is more useful than silence, but "something feels
  off here" still gets diagnosed.

---

## 2. The lenses — what to react to on every screen

You don't have to recite all of these each time; they're a prompt for
"what should I be noticing?"

| Lens | The question to ask out loud |
|------|------------------------------|
| **Purpose** | Do I instantly get what this screen is *for*? |
| **Hierarchy** | Is the most important thing the most prominent? What's my eye drawn to vs what matters? |
| **Friction** | How many taps to the common task? What's annoying or repetitive? |
| **Naming / copy** | Do the labels match how I actually talk about the farm? Any jargon, any wrong words? |
| **Trust** | Do the numbers look *right*? Anything that makes me doubt the data? |
| **Aesthetics** | Does it look good and on-brand, or cluttered / sparse / off? |
| **Missing** | What did I expect that isn't here? What do I keep wishing for? |
| **Flow** | Does the path *between* screens match how a real task unfolds? |
| **Emotion** | Gut reaction — does this delight me or irritate me? |

---

## 3. The traversal route

Cover everything once. Order is chosen so context builds naturally;
follow it or jump around, but tick every box. For each area: **Do** is
the flow to exercise; **Watch for** seeds the narration.

### Clip 01 — Shell & first impressions
**Do:** Sign in (or describe the sign-in screen). Sit on whatever loads
first. Open the sidebar; read the groups top to bottom. Open the top
bar bits — the lightbulb (capture), the bell (inbox), the new **Search
⌘K**, your avatar → Settings. Toggle theme (dark/light) and text
density. Collapse/expand the sidebar.
**Watch for:** First-impression read — does the landing screen feel like
the right "home"? Sidebar grouping + ordering + labels. Anything you'd
reorder or rename. Does the version/brand chrome feel right? Theme +
density: any screen that breaks in the other theme (make a note to
re-check it later in that theme).

### Clip 02 — Now (the daily field surface)
**Do:** Read the "Up next" card. Note what's surfaced vs hidden. Imagine
you're standing in the barn at 6am — is this what you'd want?
**Watch for:** Is the right thing up next? Is "nothing overdue" reassuring
or empty? Would this work one-handed (you'll re-test on phone in Clip
14).

### Clip 03 — Farm map & places
**Do:** Look at the whole-farm map. Read the zone labels + the colored
"to do" rollups. Click a zone to zoom; click a structure pin; open a
place page. Use the place search box. Hit **Edit places** → the place
tree.
**Watch for:** Do the labels/zones read clearly (any still overlapping)?
Does the color-coding make sense at a glance? Place page content — useful
or thin? The tree editor: is adding/moving/placing-an-occupant
intuitive? (Note: chicken tractors are now visible + Batch 1 is off the
tractor as of the last fix — confirm that reads right to you.)

### Clip 04 — Dashboard (Overview)
**Do:** Read every card top to bottom: upcoming chores, current
conditions, broilers (weeks-to-processing), schedule-at-a-glance, active
projects, open orders, farm updates, activity feed.
**Watch for:** Is this a good single-glance "state of the farm"? Card
order + which deserve more/less space. The broiler card now shows
"arrives <date>" for future batches — does that read right? Activity
feed wording. Anything you'd add/remove from the dashboard.

### Clip 05 — Metrics
**Do:** Read the broiler batch-comparison table and the layer flock
table. Read the metric-definition explanations at the bottom.
**Watch for:** Most cells are "—" right now because weigh-ins/eggs aren't
logged — narrate "empty because no data" vs "this is wrong". Are these
the right metrics? Is the table readable? Do the definitions help?

### Clip 06 — Planning: Schedule & Events
**Do:** Switch Day / Week / Month / Agenda. Note the chore-block summary
chips (month) and the collapsed block rows (agenda). Open the Events
flyout and visit a couple of kinds (Farmers markets, Processing days).
Open the event editor (don't save). Try dragging an event (then put it
back).
**Watch for:** Does the calendar read clearly with chores collapsed? Is
the agenda the right length now? Event editor friction. Anything about
how recurring vs one-off events show.

### Clip 07 — Planning: Chores, Rounds, Projects, Processes
**Do:** **Chores** — Today tab: the Mine/All + person picker + block
jump-nav; All chores tab; Blocks; Performance; Activity log. **Do
rounds** — open the takeover, read a block, *don't* start one unless you
want to. **Projects** — open a project, look at phases/steps/progress.
**Processes** — read a process template.
**Watch for:** Chores is the densest screen — hierarchy, the person
picker model (acting as James vs Jim), the block structure. Rounds is
the doing-surface — does it feel good? Projects: is the prep-project that
already passed still cluttering anything? Processes: is the
template→expansion idea clear?

### Clip 08 — Products & Sales: catalog, pricing, sell
**Do:** **All products** — Catalog tab (a product card, expand it),
Pricing tab (the grid; set a price if you want), Sell tab (the POS — add
to cart, note the on-hand counts, *don't* record unless cleaning up),
Sales tab (the chart + recent sales). **Point of sale** action from the
sidebar lands on Sell.
**Watch for:** Prices are empty (data-readiness) — narrate that. Is the
catalog→pricing→sell→sales flow coherent? POS friction for a real market
day. Cost-floor reference card — useful?

### Clip 09 — Products & Sales: inventory & orders
**Do:** **Inventory** — the (currently empty) lot list, "Add to
inventory" new-lot form. **Orders** — make a test order (customer +
line + price), walk it open → ready → mark paid → fulfill (note the
shortfall warning since inventory is empty), then a shipping order →
add a shipment → parcel → label → delivered. Open the Shipping settings
panel. **Clean up your test rows or say you'll leave them for Claude.**
**Watch for:** This is the newest area (Batch 29) — heaviest scrutiny.
Order lifecycle clarity, the fulfill confirm panel, the shipment
workflow, the cold-chain allowlist warning. Does it match how you'd
actually take and ship an order?

### Clip 10 — Animals
**Do:** **Layers**, **Broilers**, **Sheep** species pages (Groups /
Feed schedule / Chores / Automations / Activity / More info tabs). Open
a **batch page** (e.g. Batch 3 — active; Batch 1 — processed, in "Past
batches"; a future batch — "Arriving"). **Manage feed** schedules.
**Watch for:** Do the three lifecycle states (on farm / arriving /
processed) read clearly now? Batch page hierarchy — milestones, metrics,
weigh-in capture. Is "Past batches" the right home for processed ones?
Feed-schedule editor clarity.

### Clip 11 — CRM
**Do:** **Customers** directory — search, open/edit a customer, the
archived toggle. **Lists** — open a list, membership. **Add new
customer** form.
**Watch for:** Search quality, the row layout, what's missing from a
customer record (note: there's no per-customer detail page yet — does
that bother you?). Lists usefulness.

### Clip 12 — Resources & Communication
**Do:** **Feed** (types, reorder projection — note on-hand is unset),
**Suppliers**, **Machinery**, **Trailers**, **Places** (already covered
— skim), **Equipment** (placeholder). **Farm updates** + **Content
calendar** (both placeholders).
**Watch for:** The placeholders — do you want to describe what each
*should* become (feeds future batches)? The resource list pages are
plain — enough, or too plain? Feed reorder projection value.

### Clip 13 — Other & Settings
**Do:** **Inbox** (capture a thought via the lightbulb, pin/archive it),
**What's coming** (roadmap), **Activity**, **Observations**, **Notes**,
**Threads**, **Settings** (theme/density/notifications/sign-out).
**Watch for:** Capture friction (it should be frictionless). Activity vs
Observations vs Notes vs Threads — are the boundaries between these four
clear, or do they blur? Settings completeness.

### Clip 14 — Mobile pass (phone, separate recording)
**Do:** On your actual phone (screen-record via Control Center, mic on),
re-walk the surfaces you'd use *in the field*: **Now**, **Do rounds**
(actually run a round if you can), **capture a thought**, **Chores
Today**, **the cmd-K search** (tap the search icon), and glance at
**Dashboard** + **Orders**. Try the **install prompt** if it appears
(Add to Home Screen).
**Watch for:** One-handed use, thumb reach, tap-target size, anything
that's fine on desktop but cramped on the phone. This is the highest-
value mobile signal — the field surfaces are where the phone matters.

### Clip 15 — Cross-cutting (optional, short)
**Do:** Exercise the new **⌘K search** across types (a page, a batch, a
customer, a place). Note anything you searched for that *didn't* turn up.
Mention any whole-app patterns — consistency of buttons, empty states,
loading, error messages — that struck you across the run.
**Watch for:** Search hit/miss quality; cross-screen inconsistencies you
noticed but couldn't pin to one screen.

---

## 4. What you can skip / not re-report

The automated functionality audit (40.1) + the design/mobile/search
batches already shipped fixes. **Don't spend breath on these** (they're
done or already tracked):

- Negative "week -N" numbers on future batches; processed batches
  showing as live; chicken tractors missing from Places — **fixed**.
- Theme not loading app-wide; order-line price wipe; project-count
  mismatch; activity-feed UUIDs; unknown-URL handling; the inbox
  "lightbulb" copy; month/agenda chore-block clutter — **fixed**.
- Most horizontal-scroll-on-mobile issues — **fixed** (two tiny slivers
  remain on Schedule/Processes, already noted).
- **Known-empty by design, not bugs:** catalog prices, inventory lots,
  feed on-hand, and Batch 1–2 arrival dates are unset until you enter
  real numbers. Narrate "empty because no data," not "broken."
- **Known placeholders:** Farm updates, Content calendar, Equipment are
  intentional ComingSoon stubs.

Focus the voice on **subjective UX, workflow fit, naming, hierarchy, and
"this doesn't match how I work"** — the stuff a script can't see.

---

## 5. The handoff (what happens after you record)

1. Drop the `.mov` files in `audits/raw/`.
2. Claude runs `scripts/process-audit.sh` (ffmpeg + whisper.cpp, all
   local — nothing leaves the machine) → per-clip transcript + frames.
3. Claude writes `audits/<date>/findings.md`: one entry per issue —
   page, your words (quoted), the frame, a diagnosis (file/component +
   proposed fix), a size estimate, a checkbox.
4. **Triage together (~15 min):** fix misreads, kill non-issues, set
   priority, pre-authorize the fix list.
5. Claude executes top-down while you're at the farm — each finding its
   own `fix:` commit (pre-authorized at triage).

---

## Quick pre-flight checklist

- [ ] Mic selected + tested
- [ ] Notifications quiet, single clean browser window (~1280–1440px)
- [ ] `audits/raw/` exists
- [ ] Pilot clip recorded (one area, 2–3 min) and processed first
- [ ] Then: clips 01–13 desktop, clip 14 on the phone, clip 15 optional
- [ ] Narrate the screen name on arrival; one issue at a time; praise
      what works; don't actually delete prod rows
