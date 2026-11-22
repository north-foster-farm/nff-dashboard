// Criteria tests for nff-dashboard#63 (D4, migration discipline check),
// one per criterion, each named for its criterion word for word.
//
// Written by the test agent from the criteria alone, before the
// implementation. Held out of `npm test` (its include is src/**) until
// the implementation lands; run them with `npm run test:criteria`.
//
// The check is `node scripts/check-migrations.mjs`, run from the root
// of a clone. "Applied" means on origin/main: production applies what
// main deploys. Each test drives it in a throwaway clone of a
// throwaway origin (./migrationSandbox.js); nothing touches Supabase.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  APPLIED, commitChange, edits, git, makeSandbox, originHas, pushBranch,
  runCheck,
} from "./migrationSandbox.js";

const [firstApplied, lastApplied] = Object.keys(APPLIED);
const CHECK_SCRIPT = join("scripts", "check-migrations.mjs");
const NEXT_NUMBER_MIGRATION = "0003_third_table.sql";
const NEXT_NUMBER_SQL = "create table third_table (id uuid);\n";

describe("D4 migration discipline check (#63)", () => {
  const sandboxes = [];
  const freshSandbox = () => {
    const sandbox = makeSandbox();
    sandboxes.push(sandbox);
    return sandbox;
  };
  afterEach(() => sandboxes.splice(0).forEach((s) => s.remove()));

  // A missing script exits non-zero too; that is not a refusal.
  const expectRefused = (sandbox, what) => {
    expect(existsSync(join(sandbox.clone, CHECK_SCRIPT)),
      `${CHECK_SCRIPT} exists`).toBe(true);
    const check = runCheck(sandbox.clone);
    expect(check.exitCode,
      `the check should fail a branch that ${what}; it said: ` +
      check.output).not.toBe(0);
  };

  it("criterion 1: editing, deleting or renumbering an applied " +
    "migration fails the check", () => {
    const edited = freshSandbox();
    commitChange(edited.clone, "edit an applied migration",
      edits.writeMigration(lastApplied,
        `${APPLIED[lastApplied]}alter table second_table add x int;\n`));
    expectRefused(edited, `edits ${lastApplied}`);

    const deleted = freshSandbox();
    commitChange(deleted.clone, "delete an applied migration",
      edits.deleteMigration(firstApplied));
    expectRefused(deleted, `deletes ${firstApplied}`);

    const renumbered = freshSandbox();
    commitChange(renumbered.clone, "renumber an applied migration",
      edits.renameMigration(lastApplied, "0003_second_table.sql"));
    expectRefused(renumbered, `renumbers ${lastApplied} to 0003`);
  }, 60_000);

  it("criterion 2: a new migration with the next number passes", () => {
    const sandbox = freshSandbox();
    commitChange(sandbox.clone, "add the next migration",
      edits.writeMigration(NEXT_NUMBER_MIGRATION, NEXT_NUMBER_SQL));

    const check = runCheck(sandbox.clone);

    expect(check.exitCode,
      `the check should pass a branch that only adds ` +
      `${NEXT_NUMBER_MIGRATION}; it said: ${check.output}`).toBe(0);
  }, 60_000);

  it("criterion 3: the pre-push hook runs it", () => {
    const bad = freshSandbox();
    commitChange(bad.clone, "edit an applied migration",
      edits.writeMigration(firstApplied, "drop table first_table;\n"));
    const refusedPush = pushBranch(bad.clone);
    expect(refusedPush.exitCode,
      `git push should be refused by the pre-push hook when the branch ` +
      `edits ${firstApplied}; it said: ${refusedPush.output}`).not.toBe(0);
    expect(originHas(bad, "lane/change"),
      "the refused branch should not reach origin").toBe(false);

    const good = freshSandbox();
    commitChange(good.clone, "add the next migration",
      edits.writeMigration(NEXT_NUMBER_MIGRATION, NEXT_NUMBER_SQL));
    const acceptedPush = pushBranch(good.clone);
    expect(acceptedPush.exitCode,
      `git push of a branch that only adds ${NEXT_NUMBER_MIGRATION} ` +
      `should go through; it said: ${acceptedPush.output}`).toBe(0);
    expect(git(good.origin, "rev-parse", "refs/heads/lane/change"),
      "origin should hold the pushed branch")
      .toBe(git(good.clone, "rev-parse", "HEAD"));
  }, 120_000);
});
