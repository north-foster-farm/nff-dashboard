# Multi-Agent Design Workshop — Playbook

**Purpose:** A reusable method for designing a feature by running several AI agents in parallel, each attacking the problem from a fixed, deliberately different angle, then synthesizing their pitches into one recommendation for James to decide on.

**How to use this file:** Share it with Claude at the start of a feature-design session and say "run the workshop on \<feature\>." Claude reconstructs the setup below, fills in the feature-specific material, runs the agents, and produces the synthesis. This document is the operating manual; it is not specific to any one feature.

**Provenance:** Reverse-engineered from the **chores-overhaul** workshop (session 658a17fb, 2026-05-06), which redesigned the NFF Dashboard chores system. Examples throughout are drawn from that run so the pattern is concrete; treat them as illustrations, not requirements.

---

## 1. What this method is (and when to use it)

The workshop pits **independent design pitches against each other**. Each agent gets the *same* problem and context but a *different lens* (a strong, named bias). They run in parallel and cannot see each other. James reads all the pitches plus a synthesis and decides where to land.

The value is not any single pitch — it's the **spread**. One agent over-builds, one over-cuts, one maps everything to prior art, one changes the underlying ontology. The right answer is almost always a defensible point *between* them, and the disagreements are where the real design decisions surface.

**Use it when:**
- The feature is substantial and under-specified, and the design space is genuinely open.
- There's an existing system to respect/migrate (the tension between "keep what works" and "rethink it" is exactly what the lenses expose).
- You want to surface tradeoffs and failure modes *before* committing, not after.

**Don't bother when:** the change is small, the approach is obvious, or there's really only one sensible design. The overhead isn't worth it.

---

## 2. The shape at a glance

```
                 ┌─────────────────────────────────────────┐
   INPUTS  ──►   │  Shared context block (identical to all) │
                 │  + one distinct LENS per agent           │
                 └─────────────────────────────────────────┘
                                  │
                                  ▼
                 ORCHESTRATOR selects ≤5 lenses for biggest SPREAD
                 (omit inapplicable; the rest become RESERVE lenses)
                                  │  (parallel, blind to each other)
            ┌──────────┬──────────┼──────────┬──────────┐
            ▼          ▼          ▼          ▼
        Agent 1    Agent 2    Agent 3    Agent 4     ...   │  RESERVE
        (selected lenses, max 5)                           │  (e.g. Dad)
            │          │          │          │             │
            └──────────┴────┬─────┴──────────┘             │
                            ▼                              │
                 Each emits a pitch in the SAME fixed format
                            │                              │
                            ▼                              │
                 ORCHESTRATOR synthesizes:                 │
                 contributions • disagreement table •      │
                 unified pitch • open questions • sequencing
                            │                              │
                            ▼                              │
                 RESERVE lenses comment on the synthesis ◄─┘
                            │
                            ▼
                 JAMES decides / pushes back  ──►  requirements doc
```

---

## 3. Roles

### 3.1 The orchestrator (Claude, in the main session)
Does everything except write the pitches:
1. Gathers and writes the **shared context block** (§5).
2. **Selects the lenses** for this specific problem — the ≤5 that produce the biggest spread — and designates the rest as **reserve lenses** (§6).
3. Writes each selected agent's prompt and **dispatches** them in parallel (§7).
4. Reads all returned pitches and writes the **synthesis** (§8).
5. Runs the **reserve-lens commentary round** on the synthesis (§8.1).
6. Hands James a decision surface: a disagreement table, a unified recommendation, reserve commentary, **open questions**, and **proposed sequencing**.

The orchestrator does *not* pre-judge the outcome. It genuinely synthesizes from what came back, and it owns the things the agents were explicitly forbidden from doing (sequencing, final call).

### 3.2 The agents (parallel subagents)
Each one:
- Receives the shared context + its own lens.
- Is told explicitly that other agents exist, run in parallel, and that it cannot see them — and that James will read all pitches side by side. (This frees each agent to commit hard to its bias instead of hedging toward a balanced answer.)
- **Independently verifies reality** — reads the actual source files; does not trust the context summary. (The chores prompts said, verbatim, "do not trust this summary" and "do not bluff.")
- Emits a pitch in the **mandatory shared format** (§9) so the pitches are directly comparable.

---

## 4. The inputs (gather these before writing any prompts)

1. **James's verbatim requirements dump.** The raw, unedited brain-dump that triggered the workshop. Paste it *verbatim* into every agent prompt — do not clean it up or summarize it. The messiness (edge cases, half-formed "maybe we need to separate X and Y?" musings) is signal the agents need.
2. **The current state of the system.** What already exists and ships today, including recent work that might get thrown away. Agents need this to reason about migration and "what breaks if we delete this."
3. **Source material list.** Exact file paths / documents the agents must read to verify reality (code files, schema/migrations, roadmap, prior planning docs). Be specific and point at the real artifacts.
4. **Project/tech context.** Stack, constraints, team size, deployment realities, domain vocabulary that must be used correctly.
5. **Tone constraints.** James's writing preferences (see §10).

---

## 5. The shared context block (identical across all agents)

Every agent prompt opens with the *same* context so the only deliberate variable is the lens. Assemble it from the inputs above, in roughly this order:

1. **The workshop framing** — "You are participating in an N-agent design workshop on \<feature\>. \<N-1\> other agents are running in parallel from different angles; you cannot see them. James will read all pitches plus the orchestrator's synthesis and decide where to land."
2. **PROJECT CONTEXT** — stack, team, repo location, domain-term clarifications, and a bullet list of what the current system already has.
3. **TONE** — the no-buzzwords rule and "lead with the model, not the pitch."
4. **SOURCE MATERIAL TO READ** — the numbered file list, prefixed with "do not skip — verify reality, do not trust this summary."
5. **JAMES'S VERBATIM REQUIREMENTS DUMP** — fenced, unedited.
6. **Permissions/latitude** — e.g. "shipped code is fair game; if your pitch deletes \<recent batch\> entirely, that's allowed — judge on merit."
7. **OUTPUT FORMAT** — the mandatory headings (§9).
8. Closing reminders — "DO NOT include code. DO NOT include batch sequencing — that's the orchestrator's job. DO read the source files; do not bluff."

---

## 6. The lenses (the heart of the method)

Each lens is a **named, committed bias** with: a one-line identity, a starting belief, a concrete task, an explicit list of what it's licensed to do, and — critically — a **counter-pressure** that keeps it honest. The counter-pressure is what stops each agent from becoming a caricature; it forces the cutter to defend a floor and the maximalist to defend each addition's worth.

### Two kinds of counter-pressure
Counter-pressure comes in two forms, and a lens is only safe if it has at least one (ideally both):
- **Internal** — a self-check written into the lens prompt itself (the Cutter's "defend your floor"; the Maximalist's "justify each tier-1"). This protects the lens even when it runs alone.
- **Structural** — an *opposing lens in the same workshop* (Cutter ↔ Maximalist; Conventions ↔ First-principles). This only protects if the opposite is actually selected.

Implication for selection: when you pick a lens whose counter-pressure is mostly structural, **make sure its opposite is in the room** — or rely on its internal check. The opposed pairs are mapped at the end of the library below.

### The lens library

Each lens lists its internal counter-pressure. The first four are the **proven default set** from the chores run; the rest are vetted additions.

**1. Aggressive scope-cutter — "You don't need as much as you think you do."**
- *Starting belief:* the feature is, at its core, one plain sentence; everything beyond that is bloat until proven otherwise.
- *Task:* for every entity/screen/feature, ask: Could this collapse into another thing? Is this a problem the user only *thinks* they have? Is it duplicating something already in the app? If we deleted it, what would actually break on the real farm?
- *Counter-pressure (internal):* aggressive cutting goes too far. **Defend your floor** — name what you would NOT cut and why each survivor earns its keep.

**2. UI Conventions — "Don't invent; borrow."**
- *Starting belief:* every requirement should map to a known UI pattern from a shipped product.
- *Task:* name the product and the pattern for each requirement (e.g. "the persistent category strip from Toast/Square POS," "Strava's log-a-run for quick actions," "Linear's merge dialog for conflicts"). Borrowed patterns come with proven affordances and user expectations.
- *Counter-pressure (internal):* don't force a bad fit. Where no convention fits cleanly, say so rather than jamming the requirement into the nearest pattern.

**3. Reframer — "Change the unit of analysis."**
- *Starting belief:* the obvious ontology may be wrong; the data might be telling you to model something else.
- *Task:* look at the seed/real data and find the reframe (in the chores run: chores cluster around physical *places*, so the unit becomes Session × Stop, and tasks become derivative). List the ontology candidates considered, then commit to one and walk every requirement through it.
- *Counter-pressure (internal):* the reframe usually carries the **biggest migration cost** — be honest about it, and about what gets *worse* under the new ontology, not just better.

**4. Maximalist — "What if we do all that, plus…"**
- *Starting belief:* the specs are a floor, not a ceiling.
- *Task:* extrapolate every requirement to its next move; introduce adjacent features that emerge naturally from the requirements. Separate **tier-1** (extensions you'd actually defend building) from **tier-2 moonshots** (flagged for what each needs).
- *Counter-pressure (internal):* you must **defend tier-1 features as worth building** — anything that costs more than it returns gets cut. If everything ends up tier-2, you've failed the assignment.

**5. First-principles — "Ignore all prior art; derive from the constraint."**
- *Starting belief:* conventions may be cargo-cult; derive the design from the hard constraints and the goal, as if no one had built this before.
- *Task:* state the irreducible constraints and the actual goal, then build up the minimal design those force — owing nothing to how it's usually done.
- *Counter-pressure (internal):* prior art often encodes hard-won reasons. After deriving, **check your design against how this is actually done elsewhere and justify each divergence**; if you've reinvented an existing pattern without improving on it, say so. (Structural opposite: UI Conventions.)

**6. Skeptical user / Dad — "What confuses a non-technical operator?"**
- *Starting belief:* the person using this in the field isn't web-native; anything that needs explaining is a defect.
- *Task:* walk the primary flows as the non-technical operator and flag every spot that requires prior knowledge, hidden state, or a mental model the operator doesn't already have.
- *Counter-pressure (internal):* **unfamiliar is not the same as confusing** — an operator can learn a tool. Distinguish durable confusion from first-use friction, and name what's worth keeping even if it costs a one-time learning step. Don't reduce everything to a single button.
- *Note:* this lens is **evaluative, not generative** — it critiques more than it designs. It is the prototypical **reserve lens** (see selection, below): often more valuable commenting on the synthesis than producing a full pitch. (Structural opposite: the power/novelty lenses — Maximalist, First-principles.)

**7. Data-model purist — "Cleanest schema; UX be damned."**
- *Starting belief:* a correct, normalized, future-proof data model is worth more than any individual screen; get the entities and relationships right and the UI follows.
- *Task:* design the schema you'd be proud of in five years — entities, keys, constraints, what's derived vs. stored — independent of how any screen currently wants to render.
- *Counter-pressure (internal):* a schema that can't render the **primary screen in one cheap query** has failed, however elegant. Where the cleanest model makes the most common interaction expensive or awkward, name the cost and propose the denormalization or read-model you'd accept. (Structural opposite: Field-ergonomics.)

**8. Field-ergonomics / interaction-first — "The schema serves the screen."**
- *Starting belief:* the design is judged by the cost of the handful of actions done a hundred times a day — often one-handed, in sun, in gloves, with no signal. Everything else bends to that.
- *Task:* identify the few highest-frequency / worst-conditions interactions and optimize them ruthlessly (tap count, target size, offline behavior, latency); let the rest of the design fall out from serving them.
- *Counter-pressure (internal):* ergonomic shortcuts can corrupt the model (duplicated state, un-queryable logs). Don't buy a tap by making a model that **can't answer next season's question** — name where you're trading data integrity for speed. (Structural opposite: Data-model purist.)
- *Note:* added specifically as the counterweight the Data-model purist otherwise lacks; doubles as a high-value lens for any field/mobile-capture app.

Other candidates worth keeping in mind (write them up with a counter-pressure if selected): **Migration-cost realist** ("cheapest path from today's code" ↔ Reframer), **Performance/offline** ("what survives no signal" — overlaps Field-ergonomics).

### Opposed pairs (for ensuring structural counter-pressure)
- **Cutter ↔ Maximalist** — less vs. more.
- **Conventions ↔ First-principles** — borrow the proven vs. ignore prior art.
- **Conventions ↔ Reframer** — keep the model, restyle it vs. change the model.
- **Data-model purist ↔ Field-ergonomics** — schema-first vs. interaction-first.
- **Dad ↔ Maximalist / First-principles** — simplicity & familiarity vs. power & novelty.

### Lens selection (the orchestrator's first move)

Before writing any agent prompts, the orchestrator surveys the library against *this* problem and chooses the roster.

1. **Select for spread, not coverage.** Pick the lenses that will produce the **most genuinely different and useful designs** for this specific problem. The goal is maximum spread, not running every lens.
2. **Cap at 5 (fewer is fine).** Use as many as add real spread, up to five. If three lenses cover the space, run three — don't pad. More than five makes the synthesis unwieldy and the pitches start to overlap.
3. **Omit the inapplicable.** If a lens has no useful angle on this problem, drop it entirely. (Example: the Reframer is near-useless when the reframe *is* the premise — in the Farm Map work, the place/time reframe is already given.)
4. **Guarantee at least one opposed pair** among the selected, so the workshop has built-in structural counter-pressure. If you select a lens whose counter-pressure is mainly structural, either bring its opposite in or lean on its internal check.
5. **Designate reserve lenses.** Any lens that *could* contribute but didn't make the cut — and any inherently narrow/evaluative lens like **Dad** — becomes a **reserve lens**. Reserve lenses don't pitch; they comment on the synthesis (§8.1). The Dad lens in particular is usually a reserve lens by design: its perspective is narrow enough that a full pitch wastes it, but its read on the *synthesis* is valuable and should always be heard when the feature touches a non-technical operator.
6. **Show your work.** Briefly tell James which lenses you selected, which you put in reserve, and why — a sentence each — before dispatching. He may want to override.

Every selected lens still needs a real counter-pressure (internal, structural, or both), or it produces a useless caricature.

---

## 7. Running the agents

- Dispatch all agents **in parallel** (the chores run used `subagent_type: general-purpose` per agent, dispatched together).
- Give each agent the **same context block + its one lens + the same output format**. The lens is the *only* intended difference.
- Let them work independently. They each read source files themselves and verify reality; the orchestrator does not feed them pre-digested findings.
- Expect each to do real work (the chores agents each ran ~15–17 tool calls reading the codebase before writing). Budget for that.
- Agents return their pitch as text in the fixed format. Keep each agent's handle so you can follow up with a specific one if the synthesis needs a gap filled.

---

## 8. The synthesis (orchestrator's deliverable)

After all pitches return, the orchestrator writes a synthesis with these parts (this structure is proven — reuse it):

1. **What each agent contributed** — one or two lines each, capturing the distinctive move that agent made.
2. **Where they disagreed — and where I came down.** A **decision table**: one row per contested question, one column per agent showing each one's position, and a final "my pick" column with the rationale or the vote tally (e.g. "Yes (3-1)"). This table is the single most useful artifact of the whole workshop — it turns scattered prose into a list of explicit, decided design questions.
3. **The unified pitch** — the recommended design, stated as model (data + entities) then interaction model, in plain prose. Synthesized from the strongest pieces across pitches; it does not have to match any single agent.
4. **Risks (the honest part)** — the real bug surface and design hazards of the unified pitch, not hand-waving.
5. **Things I'm explicitly NOT pulling forward** — what got cut from the maximalist/others and why (deferred vs. rejected).
6. **Open questions for you** — the specific decisions only James can make, asked before drafting final requirements. (The chores synthesis asked six.)
7. **Proposed sequencing** — how the work breaks into shippable increments. **This is the orchestrator's job alone; agents are forbidden from proposing it** so their pitches stay comparable and don't smuggle in scope decisions.
8. A closing **"push back on anything"** invitation that names the 2–3 places the synthesis is least certain.

### 8.1 Reserve-lens commentary round

After the synthesis is written, each **reserve lens** (the applicable lenses that didn't make the workshop cut, plus narrow/evaluative lenses like Dad — see §6 selection) gets a short pass to react to the synthesis *from its point of view*. This surfaces minority perspectives without diluting the main spread, and it's how a narrow lens earns its keep: Dad never has to produce a full pitch, but his read on the recommended design is exactly what you want before committing.

- **Input:** the synthesis (the unified pitch, decisions, risks), not the individual pitches.
- **Bounded format** (keep it short — this is commentary, not a fifth pitch):
  ```
  ### Reserve commentary — <lens name>
  - **Where the synthesis is right (from my angle):** 1–2 bullets.
  - **What worries me most:** 1–3 bullets — the specific thing this lens exists to catch.
  - **One change I'd make:** a single concrete suggestion.
  ```
- The orchestrator appends these under the synthesis as a "Reserve-lens commentary" section. They inform James's decision; they do **not** silently rewrite the unified pitch (if a comment is compelling, the orchestrator flags it for James rather than quietly absorbing it).
- Run a reserve lens only if it has a real angle on this synthesis. A reserve lens with nothing to add is skipped, not padded.

---

## 9. Mandatory pitch output format

Every agent emits exactly these headings, no others. Standardizing the format is what makes very different pitches directly comparable. (The maximalist gets one extra section for moonshots.)

```
## 1. The model in one paragraph
(Plain prose. Data model + interaction model in 5–8 sentences.)

## 2. The UI in one page
(Prose, no code. What the user sees, click by click. Mobile vs. desktop differences.)

## 3. What <recent shipped work> becomes
(One paragraph: each piece of recent work — kept? reshaped? deleted? why?)

## 4. Top 3 tradeoffs
1. (1–2 sentences)
2. (1–2 sentences)
3. (1–2 sentences)

## 5. You'd hate this if...
(Five honest bullets naming when this approach is wrong.)

## 6. Tier-2 moonshots  [MAXIMALIST ONLY]
(6–10 wild ideas, one line each, flagged for what each needs.)
```

Notes on why each section exists:
- **§1 model** forces commitment to entities/schema before any UI hand-waving — "lead with the model, not the pitch."
- **§2 UI in one page** forces a concrete click-by-click walk, including the mobile/desktop split, which is where field-vs-workbench realities bite.
- **§3 "what \<recent work\> becomes"** forces every agent to confront migration honestly — does this design keep, reshape, or delete what was just shipped?
- **§4 tradeoffs** and **§5 "you'd hate this if…"** are the honesty mechanisms. §5 in particular makes each agent name its own failure modes, which feeds the synthesis risk section directly.
- Universal bans: **no code, no batch sequencing** (orchestrator's job), and **no bluffing** (read the real files).

---

## 10. Tone rules (apply to agents and synthesis alike)

- **No marketing buzzwords.** Banned: "seamless," "intuitive," "powerful," "robust," "next-gen," and friends. Plain English only.
- **Concrete examples over abstractions.** Name the real place, the real button, the real failure on the real farm.
- **Lead with the model, not the pitch.** Substance first; no preamble selling.
- **Use domain vocabulary correctly** (e.g. in NFF, "tractor" means *chicken tractor*). Get the nouns right.
- **Be willing to be wrong.** The point is to widen and then narrow the option space, not to win.

---

## 11. Quick-start checklist for the orchestrator

1. [ ] Collect the five inputs (§4): verbatim dump, current state, source-file list, project context, tone.
2. [ ] Write the shared context block once (§5).
3. [ ] **Select lenses for spread** (§6): choose the ≤5 that maximize spread, omit the inapplicable, guarantee one opposed pair, and designate the rest (plus Dad) as **reserve**. Tell James the roster and why before dispatching.
4. [ ] Write each selected lens with a starting belief, a task, latitude, and a **counter-pressure** (internal and/or structural).
5. [ ] Append the mandatory output format (§9) and the universal bans to every agent prompt.
6. [ ] Dispatch all selected agents in parallel (§7); keep their handles.
7. [ ] Read every pitch. Verify they actually read the source (watch for bluffing).
8. [ ] Write the synthesis (§8): contributions, decision table, unified pitch, risks, not-pulling-forward, open questions, sequencing.
9. [ ] Run the **reserve-lens commentary round** on the synthesis (§8.1); append it.
10. [ ] Hand James the open questions (and reserve commentary) and wait for decisions before drafting the final requirements doc.

---

## 12. Adapting this to the Farm Map UI workshop (forward note)

When this method is pointed at the **Farm Map UI overhaul**, the inputs already largely exist in the proposal-capture doc, so the orchestrator's prep is lighter than starting cold. A few feature-specific adjustments worth anticipating:

- **The "verbatim dump" equivalent** is the proposal-capture doc itself plus the original breakthrough description — feed the relevant parts verbatim.
- **The current state** includes the existing sidebar-based dashboard and the v1 SVG asset; the source-file list should point at both.
- **Lens selection (worked example of §6):** the **Reframer** is near-omittable here — the place/time reframe *is* the premise, so there's little ontology left for it to overturn (repurpose it as a "place axis vs. time axis" specialist or drop it). Strong picks given what's already locked: **Field-ergonomics** (the offline/field-conditions priority lives here), **Data-model purist** (the place-registry + offline-sync model needs a clean schema voice — and it pairs structurally with Field-ergonomics), plus **Cutter** and **Maximalist** for the core less/more spread. **Dad** is the obvious **reserve lens** — the rollout's whole point is a non-technical operator, so his commentary on the synthesis is high-value even though a full Dad pitch would be too narrow.
- **Format tweak:** "§3 what \<recent work\> becomes" should target the current sidebar IA and any in-flight rollout work.
- Everything else — parallel dispatch, fixed format, the disagreement table, orchestrator-owned sequencing, the reserve commentary round — applies unchanged.

---

## 13. Seeding the workshop from a reviewed story set (alternative input)

The verbatim-dump-into-every-agent approach (§4–§5) is the default. For a
**large, novel feature** with a wide design space, an equally valid — and
often better — seed is a **reviewed user-story set**: a broad catalog of
"what it is" (user stories) *and* "what it is not" (boundary stories),
generated up front, then walked with James story-by-story before the
workshop. The **Schedule feature (2026-06-24)** used this; recorded here so
it's repeatable.

**1. Generate on both sides of the is/is-not divide.** Write user stories
(behaviors) AND boundary stories (where the feature stops, what it must
never absorb, where adjacent features justify themselves). You need enough
threads on *both* sides or the feature isn't pinned down — too few and
there aren't enough threads falling on each side of the line.

**2. Size by COVERAGE, not a number cap.** Treat any target count as a
**floor, not a ceiling.** Write along dimensions — edge/stress cases, both
personas (solo & together), source-change/lifecycle, mobile/offline,
reminders, looking-back, and each boundary *seam* (vs. each adjacent
subsystem) — until you stop finding genuinely new threads, then dedupe. A
hard cap fails two ways: too low truncates coverage, too high tempts
padding. (Schedule started at a ~50/20 floor; after the first epic landed
clean James doubled the floor to ~100/40; it settled at ~129 story + 44
boundary.)

**3. Ground every story in the real subsystems first.** Read the actual
schema/UI the feature will reference before writing, so boundary stories
are accurate (e.g. "events' this/all-future split already exists";
"project `sort_order` is the global priority"). An Explore agent is good
for this map.

**4. Loop story-by-story: accept / tweak / discard.** Go **epic-by-epic**
in small batches, present each story tersely. Rule: **James speaks only to
stories that need changing — silence = accept.** Revise the doc live;
track **loop state** in the doc header (which epics are reviewed). Stories
surfaced mid-loop get added in place; cuts/deferrals are marked, not
deleted silently.

**5. The reviewed story set IS the behavior description.** Do **not** write
a separate synthesized "Behavior Spec" that re-narrates the stories — it's
redundant, and a polished synthesis **pre-settles** decisions and dulls
the lens spread (same hazard §4 warns about: feeding settled conclusions
to blind agents). Leave the open questions **open** — they're what the
workshop decides.

**6. Wrap it in a lean brief at workshop time.** The story set is the
content; the brief is thin packaging (per
`examples/farm-map/workshop-brief.md`): shared context, source-file list,
a pointer to the verbatim dump, the open questions, and the
fed-to-agents vs. withheld split. Reference the story set; don't rewrite
it.

Everything in §1–§11 (lens selection for spread, parallel blind dispatch,
fixed pitch format, the disagreement table, orchestrator-owned sequencing,
the reserve-lens / Dad commentary round) applies unchanged.
