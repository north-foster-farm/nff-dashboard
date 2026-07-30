# 2026-06-29 — Harvest-Remix mockup review (Operator vs Systematizer)

_Source: `processed/2026-06-29_21-41-21/transcript.md` (16:00, 144 segments).
James reviewed the two coded Round-2 mockups side by side (Operator left,
Systematizer right) in light + dark. This is a **review→direct** capture: the
output seeds the **next** design-bracket round (Round 3). The binding spec lives
at `…/harvest-remix/ROUND3-BRIEF.md`._

## Headline decision

**Do not pick a winner — build a hybrid.** James likes BOTH. "Both of these
things have big strengths, and the eventual solution needs to be a hybrid of
both." Round 3 = a **continuation of the same workshop**, with **only the
Operator and Systematizer agents**, given full access to their Round-1
wireframes/mockups/thinking, **collaborating** (not competing) toward the
hybrid.

## Likes — carry forward (L)

- **L1** — Operator's **Today** screen + **Rounds** screen: mobile-friendly,
  "very strong," "very much like the UI here." Carry forward.
- **L2** — Schedule **top strip**: temperature + timeline + date. Good because
  checking the schedule happens throughout the day, on a phone. Keep it. (But
  the icon must be Lucide — see C1.)
- **L3** — **Day-load at the top** of schedule: "makes a lot of sense, obvious
  where we're at." Keep. (Must be dynamic — see G1.)
- **L4** — Rounds **open/close flow**: "very good." Keep.
- **L5** — Operator's **should→must conversion shown as a window of time**
  (visual), not the words: "a better way of indicating the same should-to-must
  conversion." This is the preferred treatment — use it instead of the words.
- **L6** — Operator **sidebar**: "nice and clean." Carry forward.
- **L7** — Systematizer **schedule**: "nailed it a little more cleanly"; it hits
  all four areas (Dashboard, Chores, Rounds, Schedule). Carry its component
  vocabulary into a real desktop schedule page.
- **L8** — should-escalation **spelled out** in the UI: likes seeing the signal,
  but it's verbose → relocate (C2).
- **L9** — **Hatched / diagonal-stripe "hole" motif**: likes it in concept; it
  matches the hole language elsewhere. (Not behind text — C4.)
- **L10** — UI **signalling a move from should→must**: good concept (just not the
  words — C3).
- **L11** — Both **light and dark** mode "look great."

## Changes — adapt what exists (C)

- **C1** — Top-strip temperature/timeline **icon → Lucide icon library**, like
  the rest. Good idea, wrong icon source.
- **C2** — "**should escalation**" is too verbose as spelled-out text. Relocate
  the signal: onto the **chore row itself**, or as a **decoration / outline on
  the week-view bar**. Account for **multiple chores sharing the same warming
  curve**.
- **C3** — **Drop the words "should" / "must"** from the UI. Prefer Operator's
  visual window-of-time treatment (L5). Alt phrasings ("do today" / "must do
  today") are **parked for a separate workshop** — not decided here.
- **C4** — The **hatch/diagonal-stripe background can't sit behind body text** —
  contrast kills legibility. Use the motif **only for text-free hole
  indicators**; panes that contain text need a different treatment.
- **C5** — "**Sealed**" / "Completion is the seal" — awkward, eliminate. Use
  **"completed" / "finished."** Note: seal mostly applies to the **whole run**,
  not a bucket/location with subchores.
- **C6** — "**Needs cover**": the data pill is good, but the accompanying **text
  must be emphatic / eye-catching** — it's an emphasize-able message. Add more
  indication.
- **C7** — **Blue background conflicts with chore-time semantics** (blue = chore
  time app-wide). Keep blue usage consistent so **a chore never lands on blue**
  (confusing). Recolor the offending surface or reserve blue for chore-time.
- **C8** — Operator copy "**Yesterday's must. Pressure wash nest boxes is
  overdue.**" → rephrase to omit "yesterday" and "must," e.g. "Pressure-wash
  nest boxes was due yesterday."
- **C9** — **Round screen carries no ancillary/overdue info.** Rounds is an
  **active doing surface**, not an info-checking one. Strip the
  "yesterday's-must / overdue" detail from Rounds.
- **C10** — The **horizontally-scrolling nav bar** (items running off to the
  right) is an accessibility/usability problem. Make nav items **obviously
  navigational**; support quick jumps (coops → tractor → wherever). Redesign it.
- **C11** — "**Heavy day**" / "**light day**" text: good idea but **don't
  integrate.** Drop.

## Gaps — missing, must address in Round 3 (G)

- **G1** — **Day-load must be dynamic.** It currently shows 5 hardcoded buckets.
  It must derive from the **actual user-defined blocks on the Chores page**
  (blocks can be added / changed / removed). Any UI that renders day-load pulls
  from that data directly. (Shared gap — both mockups.)
- **G2** — **Projects aren't surfaced in the day-load bar** — chores only.
  Project blocks assigned for the day must be **revealed in the UI**; the
  day-load component is the right place. (Shared gap.)
- **G3** — **Projects aren't interwoven into the mockups at all.** Round 3 must
  **integrate projects** across the surfaces.
- **G4** — **Systematizer doesn't show how surfaces assemble into a real page**
  (no clear page chrome / nav placement). Round 3 must produce a **real
  assembled desktop Schedule page built on the CURRENT schedule page** (same
  info/data), using systematizer components — "like the operator did, with more
  detail."

## Bugs / CSS (B)

- **B1** — Week-view **center week-spines** bar occasionally **grows past the top
  boundary**. Clarify intent: is it signalling **overbooked / too-dense** (e.g.
  Tuesday), or a **CSS overflow bug**? Resolve either way.
- **B2** — **Day-load bar**: an element **exceeds its border/boundary**
  (overflow). Minor — fix.
- **B3** — **Phone tier, "Dense day" state**: a box overflows. CSS fix.

## The Round-3 mandate (James's words, distilled)

- **Continuation of the same bracket.** Only **Operator + Systematizer**, full
  access to Round-1 artifacts, **collaborating** toward a hybrid.
- **Deliverable: a real, functioning prototype — not static HTML** — of **all
  four pages: Dashboard, Chores, Rounds, Schedule**, built **in the codebase on
  a new git branch**, using **real data**, working on **both desktop and
  mobile**, with **projects integrated**. Roll back / don't merge if it fails.
- **Start with the Schedule page**: rebuild it as a real functioning desktop
  page, Systematizer's components, on top of the current schedule page's data —
  "a good place to start."
- **Hybrid thesis** (matches the gate): Operator's **product shape** (phone-led
  signals, strong mobile Today + Rounds) executed with Systematizer's
  **discipline** (one clean component vocabulary, desktop schedule). Combine the
  clean Operator sidebar with Systematizer's component cleanliness.
