#!/usr/bin/env node
// server.mjs — the North Foster Farm dashboard MCP server.
//
// Exposes a handful of tools to any Claude chat (Claude Desktop / Claude
// Code today; a hosted remote for phone / claude.ai later). Write tools
// are PROPOSE-ONLY: they never touch the app's domain tables, they queue
// a row in agent_proposals that James approves in-app. Read tools give
// Claude enough context to propose well (avoid duplicates, reference
// real work). See mcp/README.md for setup + registration.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { restGet, restInsert } from "./supa.mjs";

const server = new McpServer({ name: "nff-dashboard", version: "0.1.0" });

const ok = (text) => ({ content: [{ type: "text", text }] });
const fail = (text) => ({ content: [{ type: "text", text }], isError: true });

// ── propose_project ──────────────────────────────────────────────────
server.registerTool(
  "propose_project",
  {
    title: "Propose a project",
    description:
      "Queue a NEW project for James to approve in the North Foster Farm " +
      "dashboard. This does NOT create the project directly — it lands on " +
      "the Proposals page; when James approves, the app creates it with " +
      "the correct rank/phase/step structure. Use this for an idea that " +
      "should become discrete, time-bound, tracked work. For a quick " +
      "undated thought, that belongs in the Inbox, not a project.",
    inputSchema: {
      title: z
        .string()
        .describe("Short project title, e.g. 'Build a second brooder'."),
      description: z
        .string()
        .optional()
        .describe("One to three sentences of scope / context."),
      steps: z
        .array(z.string())
        .optional()
        .describe("Ordered step titles, if you know them."),
      why: z
        .string()
        .optional()
        .describe(
          "Why you're proposing this / where it came from — shown to " +
            "James on the review card."
        ),
    },
  },
  async ({ title, description, steps, why }) => {
    const t = (title ?? "").trim();
    if (!t) return fail("A project title is required.");
    const cleanSteps = (steps ?? [])
      .map((s) => (s ?? "").trim())
      .filter(Boolean);
    try {
      const row = await restInsert("agent_proposals", {
        source: "claude-mcp",
        kind: "project",
        title: t.length > 120 ? t.slice(0, 117) + "…" : t,
        summary: (why ?? "").trim() || null,
        payload: {
          title: t,
          description: (description ?? "").trim() || null,
          steps: cleanSteps,
        },
      });
      return ok(
        `Queued a project proposal: "${t}"` +
          (cleanSteps.length ? ` with ${cleanSteps.length} step(s)` : "") +
          `. James will see it on the Proposals page and can approve or ` +
          `reject it (proposal id ${row.id}).`
      );
    } catch (e) {
      return fail(`Couldn't queue the proposal: ${e.message}`);
    }
  }
);

// ── list_projects ────────────────────────────────────────────────────
server.registerTool(
  "list_projects",
  {
    title: "List projects",
    description:
      "Read the farm's current projects (the forced-ranked queue plus the " +
      "unprioritized backlog) so you can avoid proposing duplicates and " +
      "reference existing work. Read-only.",
    inputSchema: {
      include_done: z
        .boolean()
        .optional()
        .describe("Include completed / archived projects (default false)."),
    },
  },
  async ({ include_done }) => {
    try {
      const rows = await restGet(
        "projects?select=title,queue_state,sort_order,completed_at," +
          "archived_at&order=queue_state,sort_order"
      );
      const list = rows.filter(
        (r) => include_done || (!r.completed_at && !r.archived_at)
      );
      if (!list.length) return ok("No projects yet.");
      return ok(JSON.stringify(list, null, 2));
    } catch (e) {
      return fail(`Couldn't read projects: ${e.message}`);
    }
  }
);

// ── list_proposals ───────────────────────────────────────────────────
server.registerTool(
  "list_proposals",
  {
    title: "List recent proposals",
    description:
      "See the proposals you've already queued and their status " +
      "(pending / applied / rejected / failed), so you don't re-queue the " +
      "same thing. Read-only.",
    inputSchema: {},
  },
  async () => {
    try {
      const rows = await restGet(
        "agent_proposals?select=title,kind,status,created_at" +
          "&order=created_at.desc&limit=25"
      );
      if (!rows.length) return ok("No proposals queued yet.");
      return ok(JSON.stringify(rows, null, 2));
    } catch (e) {
      return fail(`Couldn't read proposals: ${e.message}`);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
