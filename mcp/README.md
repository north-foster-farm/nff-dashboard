# nff-dashboard MCP server

Lets you chat with a Claude agent and have it **propose actions** into the
North Foster Farm dashboard — "make a project for building a second
brooder," "here's the plan for the fall pasture rotation" — without
exposing an app API or letting the agent touch live data directly.

## How it works

The agent's write tools are **propose-only**. `propose_project` inserts a
row into the `agent_proposals` table (using the Supabase **service key**,
which bypasses RLS — same as `scripts/backup-db.mjs`). Nothing is created
yet. The proposal shows up on the dashboard's **Proposals** page, where
James approves or rejects it. On approve, the app runs the *same* create
path an in-app "New project" uses, so the result is correct by
construction (tail-ranked, proper phase/step structure). On reject, it's
discarded.

Because the only thing the agent can do is **enqueue a row you must
approve**, this stays safe even when it's later exposed to the phone /
claude.ai as a hosted remote server.

Read tools (`list_projects`, `list_proposals`) are read-only and just give
the agent context to propose well.

## Setup

```sh
cd mcp
npm install
```

Credentials come from the repo's `.env.local` (`SUPABASE_URL` +
`SUPABASE_SECRET_KEY`) at runtime — nothing is hardcoded and nothing new to
configure.

## Register it with a Claude client

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) and add:

```json
{
  "mcpServers": {
    "nff-dashboard": {
      "command": "node",
      "args": ["/Users/james/Code/nff-dashboard/mcp/server.mjs"]
    }
  }
}
```

Restart Claude Desktop. In a chat you'll now see the `nff-dashboard` tools
(a plug / hammer icon). Try: *"Propose a project for rebuilding the layer
run, with steps for teardown, framing, and hardware cloth."*

### Claude Code

```sh
claude mcp add nff-dashboard -- node /Users/james/Code/nff-dashboard/mcp/server.mjs
```

(or add the same `mcpServers` block to a project `.mcp.json`).

## Tools

| Tool | Kind | What it does |
| --- | --- | --- |
| `propose_project` | write (propose) | Queue a new project (title, description, ordered steps, why) for in-app approval. |
| `list_projects` | read | The current ranked queue + backlog, so you don't propose duplicates. |
| `list_proposals` | read | Recent proposals and their status. |

## Roadmap

- **Phase 1 (this):** stdio server on the Mac (Desktop / Code), projects only.
- **Next:** `propose_event`, `propose_chore` (same rails, more card types).
- **Phase 2:** wrap these tools in Streamable HTTP + OAuth and deploy on
  Netlify → phone / claude.ai. Same code; the propose-only design keeps a
  public endpoint low-risk.
