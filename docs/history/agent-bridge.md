# Agent bridge (MCP)

One idea, held consistently: a Claude chat may **propose** work into the
dashboard, and may never write the app's domain tables itself. Everything
built so far is one slice of that — projects — plus the review inbox the
slice proved out. Everything designed but unbuilt sits on top of it.

## Evolutions

**2026-05-05 — the ancestor: voice / natural-language control.** The
original 22-batch roadmap carried "speech-to-text on device; intent →
tool-call mapping via Claude; confirmation step for state-changing
actions" (`4a8ed2c`, `m2-roadmap.md:290`), **cut** 2026-06-02 (`60c10c8`)
into the graveyard — "doesn't expect to need it at all"
(`ROADMAP.md:4806`). The confirmation-step instinct is the one part that
survived; it became the whole architecture two months later.

**2026-06-03 — the feature-handoff version.** The handoff fold-in
(`87a5178`) recorded a "Claude-powered agent" with two entry points: an
in-app chat window and an email-to-agent address, implemented as the
Anthropic API with tool use "where the tools wrap the app's existing
mutations… State-changing actions confirm before committing"
(`ROADMAP.md:5203`). This is the direct predecessor of what shipped, and
it differs in one decisive way: its tools *were* the mutations, gated by a
confirmation. It was never given a batch number, and it is still the last
word `ROADMAP.md` has on the subject — the MCP work that followed happens
entirely outside the roadmap (`m2-roadmap.md:296`).

**2026-07-01 — the pivot to propose-only, and the shipped projects
slice.** `09194fc` ("feat: agent proposal bridge via MCP (projects
slice)") landed the whole rail end to end: migration 0042, the `mcp/`
stdio server, the Proposals page, and the approve path. The reasoning is
written into the migration header
(`supabase/migrations/0042_agent_proposals.sql:4`): an external agent
"can't and shouldn't write the app's real domain tables directly —
creating a project is a tail-ranked insert, an event is an RRULE +
occurrence tree, a chore fans out across anchors — invariants that live in
the React hooks, not in raw SQL." So the agent inserts a proposal row;
James approves in-app; the app runs its own create path, and "an approved
proposal is indistinguishable from one built by hand."

Three things fall out of that choice, all deliberate. It needs **no app
API** — no surface to authenticate, version, or defend. It stays safe
**even when public**: "the only thing an agent can do is enqueue a row
James must approve" (0042 header; `mcp/README.md:19`). And it satisfies
the house rule against implicit mutation — surface and prompt, never
silent write (design-library "Approval queue" pattern,
`public/style-guide/DESIGN-SYSTEM.md:619`). Note the commit is a plain
`feat:`, not a batch: this feature never entered the batch series.

**2026-07-01, later the same day — scope expands past the bridge.**
Session 4 rewrote the design doc (now
`docs/specs/agent-integration-design.md`, promoted out of `.ignored`
during H1) into **one batch, five pieces**: (1) write-via-proposals, the
shipped part; (2) a natural-language Q&A read layer; (3) a persistent
in-app chat for Jim, who has no Anthropic account, following him across
pages with a server-side key; (4) coaching competence — multi-step
handholding, required-vs-optional awareness, soft landings on bad input;
and (5) **self-describing model contracts**, the enabling architecture.
Piece 5 is the real thesis: each model declares what it accepts, its
rules, and its capabilities, and an adapter surfaces those declarations so
the agent "can pick up new models without inspecting them" — the object
exposes its own capabilities rather than the agent surveying the code
(§5). The other four are meant to be built *on* that contract layer, not
beside it — each reading its rules and required/optional knowledge from
the same declarations.

**2026-07-02 — one real proposal, then silence.** Prod holds exactly one
`agent_proposals` row ever: kind `project`, source `claude-mcp`, title
"Rebuild the layer run", created 2026-07-02T22:35Z, status **rejected**.
That title is verbatim the demo prompt suggested in `mcp/README.md:56`, so
the demo did happen through a registered client. Nothing has been queued
since — the bridge has sat idle for four weeks, and no proposal has ever
been approved.

**2026-07-29 — H1 promotion.** The living design doc moved from
`.ignored/agent-integration/design.md` to `docs/specs/` (`063ffb7`,
rationale at `m3-ignored.md:315`). It is the only durable design artifact
this feature has.

## Current state

**The server** (`mcp/`, five tracked files). `mcp/server.mjs` builds one
`McpServer` named `nff-dashboard` v0.1.0 on `StdioServerTransport`
(`@modelcontextprotocol/sdk` ^1.19.1, 1.29.0 installed; `zod` for input
schemas). It exposes exactly **three** tools:

- `propose_project` — the only write, and it writes only
  `agent_proposals`: `source: "claude-mcp"`, `kind: "project"`, title
  truncated at 120 chars, `summary` = the agent's "why", `payload` =
  `{ title, description, steps[] }`. Its description tells the agent this
  does *not* create a project, and that undated thoughts belong in the
  Inbox instead.
- `list_projects` — read-only; selects title / queue_state / sort_order /
  completed_at / archived_at and filters completed and archived out unless
  `include_done`. Exists to prevent duplicate proposals.
- `list_proposals` — read-only; the last 25 proposals with status.

`mcp/supa.mjs` is a hand-rolled PostgREST client (`restGet` / `restInsert`
over `fetch`) that parses `.env.local` for `SUPABASE_URL` +
`SUPABASE_SECRET_KEY` and uses the service key, bypassing RLS the same way
`scripts/backup-db.mjs` does. No `supabase-js` — deliberately, to avoid
the hang noted in `scripts/prod-read.sh`. There is **no**
`propose_event`, **no** `propose_chore`, and no HTTP transport.

**The table** (`supabase/migrations/0042_agent_proposals.sql`, applied to
prod). `agent_proposals` = id / created_at / source / kind / title /
summary / payload jsonb / status / applied_ref / error / reviewed_by /
reviewed_at / review_note. The `kind` check constraint **already allows
`project | event | chore`**, explicitly so later slices need no migration;
`status` is `pending | applied | rejected | failed`. A partial index
covers the pending queue, RLS restricts both read and write to
`current_user_is_admin()`, and the table is added to the
`supabase_realtime` publication so a proposal queued from a phone appears
instantly.

**The app.** `src/pages/Proposals.jsx` renders Pending / History tabs over
`ProposalCard`s; `src/lib/data/useAgentProposals.js` subscribes to
realtime and exposes `pending`, `history`, `pendingCount`, `markApplied`,
`markFailed`, `reject`, `retry`. The nav entry is `src/sections.jsx:135`
(group "Other"), with `getCount: () => null` — **no pending-count badge**,
despite the hook already computing one. Non-project kinds render "aren't
approvable in-app yet" and approving one throws, moving the row to
`failed` with the error retained for retry.

**Where the code is softer than the dossiers claim.** Approve calls
`useProjects().createProjectTree` (`src/lib/data/useProjects.js:386`), a
*sibling* of `createProject`, not a call into it. It reuses the same
invariant helpers — `slugify` + `takenSlugs`, `rankedTailSort` — but
duplicates the insert, hard-codes `queue_state: "ranked"`, and puts every
proposed step under one phase literally titled "Steps". So "runs the app's
real create hooks" (`m1-commits.md` §1.11) is true at the invariant level
and inside the real hook module, but it is not the function the in-app
New-project button calls — worth knowing before `propose_event` tempts a
second such sibling against the far more intricate event tree.

**Wiring — the dossiers are out of date here.** Memory and
`m4-audits-memory.md:486` and `:584` both list "register server in Claude
clients" and "live demo" as open. Both are **done**: the server is
registered in Claude Code at the top level of `~/.claude.json` (user
scope, so it loads in every project) *and* in Claude Desktop's
`claude_desktop_config.json`, and the 2026-07-02 prod row is the demo.
The real gap is different and less flattering: registration and demo are
complete, and the bridge is simply **unused**.

**Pieces 2–5 do not exist.** No Anthropic SDK or API call appears anywhere
in `src/` or `netlify/`; there is no chat component, no read layer, and no
contract declaration on any model.

## Unresolved threads

- **`propose_event` / `propose_chore`.** 0042 already permits the kinds
  and the page already has a placeholder body, so the work is: a tool per
  kind, an approve handler, and a card body. Decide first whether approve
  calls the real event/chore creation path or spawns another
  `createProjectTree`-style sibling — for RRULE trees and chore anchors
  the second option is a correctness trap.
- **The approve path has never run in prod.** Zero `applied` rows. Queue
  a throwaway proposal, approve it, verify the project tree, then delete
  by exact id (`feedback_test_data_in_prod`) before building on it.
- **Nav pending-count badge** — `src/sections.jsx:135` returns null;
  `useAgentProposals().pendingCount` is ready. Small, and the reason a
  queued proposal is currently invisible until you open the page.
- **Phase 2 transport: Streamable HTTP + OAuth on Netlify**
  (`mcp/README.md:79`). Unanswered: where the service key lives when a
  Netlify function can't read `.env.local`; what identity OAuth binds to
  and who is authorized; and rate limiting, since a public enqueue
  endpoint can be spammed even though it can't corrupt.
- **The five design-doc open questions are all still open**
  (`docs/specs/agent-integration-design.md`, "Open questions / to
  design"): contract format and location, how the adapter reaches each
  surface, read-layer scoping against a LIVE prod, the in-app chat's key
  location and structured nav actions, and how much coaching lives in
  contracts vs the system prompt. Piece 5 is the dependency under 2–4 —
  scheduling any of them first means building beside the contract layer
  rather than on it.
- **`propose_attachment`** was floated (`m4-audits-memory.md:584`,
  against the live-doc attachments shipped as batch 42.8, `828088c`, in
  the as-shipped table in `m1-commits.md` §2) and never designed.
- **ProposalCard no-legacy debt** — it locally reimplements Tab,
  EmptyState, and StatusPill, the same duplication as `Inbox.jsx`
  (`DESIGN-SYSTEM.md:488`). Fold onto the canonical primitives when the
  pill/tab consolidation happens.
- **`ROADMAP.md` has no agent-bridge entry at all.** Roadmap v2 must
  create the section from scratch; the only roadmap text on the subject
  describes the superseded tools-are-mutations design
  (`ROADMAP.md:5203`).
- **Email-to-agent** from the 2026-06-03 handoff is still unscheduled and
  still blocked on inbound email parse. Decide explicitly whether the
  proposal rail supersedes it or whether email becomes a fourth surface.
- **Is this feature wanted?** Four weeks idle, one proposal, rejected.
  Before spending a batch on `propose_event`, ask whether the bridge earns
  it or whether piece 3 (chat for Jim) is the part with real pull.

## E-commerce relevance

Real, and mostly cautionary.

- **Reuse the rail, not the reflex.** Propose-only is the right precedent
  for any commerce write an agent touches: enqueue, human approves, the
  app's own path writes. Do not build a commerce tool that writes
  `products`, `product_prices`, `orders`, or `product_sales` directly, no
  matter how convenient a confirmation dialog looks.
- **Distinguish what is safe to propose from what is not.** Catalog and
  content drafts, market/pop-up events, restock reminders — reversible,
  inspected before write, fine. **Prices and orders are not.** A price is
  money: `product_prices` is append-only with cost-floor margin math
  (`m1-commits.md` §4) and a pricing worksheet exists precisely to hold
  the reasoning an agent would skip. Orders drag customer PII into
  `payload` and into a model's context window; payment, fulfillment, and
  refund state should be out of agent reach entirely, even propose-only —
  a queue of order edits invites approval fatigue, and approval fatigue is
  how this rail fails.
- **The read side is the sharper risk than the write side.** A chat that
  can read prices will quote them to a customer. Any `list_products` /
  `list_prices` tool must return the live current price with its
  effective date, or must not exist.
- **A public endpoint changes the threat model.** Propose-only bounds
  corruption, not enqueue-spam or PII-in-payload. Scope OAuth to James
  (and Jim) before any commerce tool ships behind it.
- **Piece 3 is the one worth wanting for e-commerce.** At a market,
  "what's the price of a half chicken" answered from live data beats a
  printed sheet — and that is a *read* need. It argues for building the
  Q&A read layer before extending the propose surface.
