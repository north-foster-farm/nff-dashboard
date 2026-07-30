# Agent integration — design (living doc)

Consolidates the decisions for the **current agent-integration batch**.
Started as the Claude-agent → app bridge (propose-to-inbox MCP); James has
since expanded scope. This is the durable design home; `mcp/README.md`
holds runtime setup, memory `project_agent_mcp` holds the pointer.

_Last updated 2026-07-01 (session 4)._

## The shape of the batch

One batch, five pieces — all reading from **one source of truth** about
what the app can do and what each thing needs (see §5, the contract layer,
which ties them together):

1. **Write via proposals** — SHIPPED (projects slice; migration 0042 on
   prod). Agent tools never touch domain tables; they enqueue an
   `agent_proposals` row → the app's Proposals page → James approves → the
   app runs its REAL create hooks. Extend next: `propose_event`,
   `propose_chore`.
2. **NL Q&A read layer** — ask plain-English questions about app state and
   synthesize answers on demand: "what's our next event at Tilted Barn",
   "how many birds in batch five". Read side, complements the write side.
3. **In-app persistent chat for Jim** — so James's dad benefits without his
   own Anthropic account. A chat component that **persists as he navigates
   the app** (follows him across pages): ask questions, create projects
   (via the proposal rails), and get **linked navigation** to relevant
   pages. App-embedded, server-side Anthropic key — NOT a Claude-client
   MCP.
4. **Coaching / conversational competence** — see §4.
5. **Self-describing model contracts** (the enabling architecture) — §5.

Surfaces stay as decided: Mac (Claude Desktop / Code, stdio) now; hosted
Streamable HTTP + OAuth later for phone. The in-app chat (piece 3) is a
third surface with its own server-side key.

## §4 · Coaching / conversational competence

The agent must be an **expert in the application itself** and able to
handhold whoever is using it, however they need it. Concretely:

- **Multi-step task handling.** "I want to set up a new project" → the
  agent coaches the user through the whole process, not a one-shot form.
- **Required vs optional awareness.** It knows what data a task needs and
  what's optional, and **asks for the required bits** it doesn't have.
- **Soft landing on bad input.** If a request doesn't comport with the
  app's rules (invalid data, an action the domain disallows), it must
  **redirect gracefully** — explain, offer the valid path — never a hard
  error or a silent failure.
- **Whoever, however.** Same competence serves James (power user) and Jim
  (needs more handholding) through the in-app chat.

Implication: the agent needs a reliable, machine-readable description of
each task's rules and fields to coach against — which is exactly §5.

## §5 · Self-describing model contracts (architecture)

**The pattern James wants to establish.** Each screen / "model" (OO sense)
exposes its own **contract** (call it front-matter / interface): a standard
declaration of

- what data it **accepts** — fields, each marked **required or optional**,
- its **rules / constraints** (what a valid request looks like),
- its **capabilities** (what actions can be taken on it).

An **adapter** surfaces these contracts to the Claude agent so it can
**pick up new models without inspecting them**. Responsibility inversion:
**the object exposes its own capabilities** — the agent reads the declared
contract, it does not survey the code.

**Why:** as the app changes over time, the agent must NOT have to
continually survey and re-survey how everything works. The "how it works"
description lives with the thing that does the work; add a model or change
a field and the agent stays current because the contract travels with it.

**Unifying insight:** this contract layer is the single source of truth
all five pieces read from —
- **proposals (1)** validate/construct against a model's contract,
- **NL Q&A (2)** learns what's queryable from the same declarations,
- **in-app chat (3)** discovers what Jim can do from the contracts,
- **coaching (4)** gets its required/optional/rules knowledge from them.

Build them on top of the contract layer, not beside it.

## Open questions / to design

- Contract **format + location**: co-located with each model/hook? A
  generated registry? How does it express rules beyond field presence
  (cross-field, domain invariants like RRULE / chore anchors)?
- How the adapter reaches the agent per surface: MCP tools/resources for
  the stdio+HTTP servers vs. an in-process module for the in-app chat.
- Read layer (2): direct read tools vs. a curated query surface (prod is
  LIVE — read-only is lower risk but still wants scoping).
- In-app chat (3): where server-side key lives (Netlify function?),
  session persistence across navigation, and how "linked navigation" is
  returned (structured nav actions the app executes).
- Coaching (4): how much lives in the model contracts vs. the system
  prompt; how "soft landing" maps onto proposal rejection vs. pre-submit
  validation.

## Cross-refs

- Rails + status: memory `project_agent_mcp`, `mcp/README.md`,
  `.ignored/RESUME.md`.
- Constraints: proposals honor `feedback_no_implicit_ui_changes`; prod is
  LIVE (`feedback_pre_production_migrations`) so the read layer and any new
  tables stay additive + backed up.
