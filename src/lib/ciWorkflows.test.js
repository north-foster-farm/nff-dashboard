// A workflow that triggers on unscoped `push` runs twice for every
// pull request — once for the branch push, once for the PR event —
// so every PR burns double the CI minutes and shows two entries per
// commit in the Actions tab (Roadmap 0.1). Only `main` needs a
// standalone push run: it auto-deploys, so a commit reaching it must
// be checked even though no PR event fires for the merge.
//
// This is a repo invariant rather than a lib test — the same shape as
// pathCitations/libPurity — so it grows with the workflow directory
// instead of pinning one file by name.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";

const WORKFLOW_DIR = ".github/workflows";
const WORKFLOW_FILE = /\.ya?ml$/;

const workflows = readdirSync(WORKFLOW_DIR)
  .filter((name) => WORKFLOW_FILE.test(name))
  .map((name) => ({
    name,
    triggers: load(readFileSync(join(WORKFLOW_DIR, name), "utf8")).on,
  }));

describe("CI workflow triggers", () => {
  it("scopes every push trigger to a branch list", () => {
    const pushWorkflows = workflows.filter((w) => "push" in w.triggers);
    const unscoped = pushWorkflows
      .filter((w) => !w.triggers.push?.branches?.length)
      .map((w) => w.name);
    expect(unscoped, "workflows triggering on unscoped push — these" +
      " run a second time on every PR branch push; scope them to" +
      " `branches: [main]`").toEqual([]);
  });
});
