// Criteria test for nff-dashboard#64 (D5, PR template and pre-push
// hook), criterion 2, word for word: "Pushing a bad migration is
// refused locally. Checked by test." (Criterion 1, the PR template, is
// the reviewer's.)
//
// Written by the test agent from the criterion alone, before the
// implementation. Held out of `npm test` (its include is src/**) until
// the implementation lands; run it with `npm run test:criteria`.
//
// "Bad" is every change D4 (#63) forbids to a migration already on
// origin/main: an edit, a deletion, a renumbering. "Locally" is
// .githooks/pre-push, installed the way `npm install` installs it; the
// push must stop on this machine, so origin never sees the branch.

import { afterEach, describe, expect, it } from "vitest";

import {
  APPLIED, commitChange, edits, makeSandbox, originHas, pushBranch,
} from "./migrationSandbox.js";

const [firstApplied, lastApplied] = Object.keys(APPLIED);

const BAD_MIGRATION_CHANGES = [
  ["edits", firstApplied,
    edits.writeMigration(firstApplied, "drop table first_table;\n")],
  ["deletes", lastApplied, edits.deleteMigration(lastApplied)],
  ["renumbers", lastApplied,
    edits.renameMigration(lastApplied, "0009_second_table.sql")],
];

describe("D5 pre-push hook (#64)", () => {
  const sandboxes = [];
  afterEach(() => sandboxes.splice(0).forEach((s) => s.remove()));

  it("criterion 2: pushing a bad migration is refused locally", () => {
    for (const [verb, migration, change] of BAD_MIGRATION_CHANGES) {
      const sandbox = makeSandbox();
      sandboxes.push(sandbox);
      commitChange(sandbox, `${verb} ${migration}`, change);

      const push = pushBranch(sandbox);

      expect(push.exitCode,
        `git push of a branch that ${verb} the applied ${migration} ` +
        `should be refused; it said: ${push.output}`).not.toBe(0);
      expect(originHas(sandbox, "lane/change"),
        `a branch that ${verb} ${migration} should never reach origin`)
        .toBe(false);
    }
  }, 120_000);
});
