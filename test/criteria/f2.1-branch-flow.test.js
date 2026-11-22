// Criteria test for nff-dashboard#75 (F2.1, branch flow), criterion 1,
// word for word: "A push to `next` runs `check`, and `staging` and
// `main` refuse a push that is not a fast-forward from the previous
// stage. Checked by test."
//
// Written by the test agent from the criterion alone, before the
// implementation. Held out of `npm test` (its include is src/**) until
// the implementation lands; run it with `npm run test:criteria`.
//
// It reads the three places the flow lives: check.yml's triggers, the
// ruleset JSON under .github/rulesets/ (as GitHub exports a ruleset),
// and bin/promote, run in a throwaway git sandbox with no remote
// service.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  headOf, hermeticEnv, makeSandbox, pushNewCommit,
} from "./gitSandbox.js";
import { pushStartsWorkflow } from "./workflowTriggers.js";

const repoRoot = join(import.meta.dirname, "..", "..");
const checkWorkflow = join(repoRoot, ".github", "workflows", "check.yml");
const rulesetsDir = join(repoRoot, ".github", "rulesets");
const promote = join(repoRoot, "bin", "promote");

const REQUIRED_CHECK = "check";
const PREVIOUS_STAGE = { staging: "next", main: "staging" };
// A push that is not a fast-forward is refused outright (no force-push,
// no deletion), and the commit must have passed `check`, which only a
// commit that already went through the previous stage has.
const REFUSING_RULES = ["non_fast_forward", "deletion"];

function readRulesets() {
  if (!existsSync(rulesetsDir)) return [];
  return readdirSync(rulesetsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(join(rulesetsDir, file), "utf8")))
    .map((json) => json.ruleset ?? json);
}

function targets(ruleset, branch) {
  const include = ruleset.conditions?.ref_name?.include ?? [];
  const exclude = ruleset.conditions?.ref_name?.exclude ?? [];
  const names = (list) => list.map((ref) =>
    ref === "~DEFAULT_BRANCH" ? "refs/heads/main" : ref);
  const ref = `refs/heads/${branch}`;
  return names(include).includes(ref) && !names(exclude).includes(ref);
}

// What GitHub enforces on `branch`: every active branch ruleset that
// names it, with no one allowed to bypass.
function enforcedOn(rulesets, branch) {
  const binding = rulesets.filter((ruleset) =>
    ruleset.target === "branch" &&
    ruleset.enforcement === "active" &&
    (ruleset.bypass_actors ?? []).length === 0 &&
    targets(ruleset, branch));
  const rules = binding.flatMap((ruleset) => ruleset.rules ?? []);
  const requiredChecks = rules
    .filter((rule) => rule.type === "required_status_checks")
    .flatMap((rule) => rule.parameters?.required_status_checks ?? [])
    .map((check) => check.context);
  return { ruleTypes: rules.map((rule) => rule.type), requiredChecks };
}

function runPromote(sandbox, stage) {
  const result = spawnSync(promote, [stage], {
    cwd: sandbox.farm,
    env: hermeticEnv,
    stdio: "pipe",
    timeout: 30_000,
  });
  const output = `${result.stdout}${result.stderr}`;
  return { exitCode: result.status, output };
}

function expectPromotionRefused(sandbox, stage) {
  const stageBefore = headOf(sandbox, stage);
  const promotion = runPromote(sandbox, stage);
  expect(promotion.exitCode, `bin/promote ${stage} should refuse a ` +
    `${stage} that is not behind ${PREVIOUS_STAGE[stage]}; it said: ` +
    promotion.output).not.toBe(0);
  expect(headOf(sandbox, stage), `${stage} should be left where it was`)
    .toBe(stageBefore);
}

function expectPromotionMoves(sandbox, stage) {
  const previousHead = headOf(sandbox, PREVIOUS_STAGE[stage]);
  const promotion = runPromote(sandbox, stage);
  expect(promotion.exitCode, `bin/promote ${stage} should fast-forward ` +
    `it to ${PREVIOUS_STAGE[stage]}; it said: ${promotion.output}`).toBe(0);
  expect(headOf(sandbox, stage),
    `${stage} should now hold ${PREVIOUS_STAGE[stage]}'s commit`)
    .toBe(previousHead);
}

describe("F2.1 branch flow (#75)", () => {
  const sandboxes = [];
  const freshSandbox = () => {
    const sandbox = makeSandbox();
    sandboxes.push(sandbox);
    return sandbox;
  };
  afterEach(() => sandboxes.splice(0).forEach((s) => s.remove()));

  it("criterion 1: a push to next runs check, and staging and main " +
    "refuse a push that is not a fast-forward from the previous stage",
  () => {
    const checkYml = readFileSync(checkWorkflow, "utf8");
    expect(pushStartsWorkflow(checkYml, "next"),
      "a push to next should start check.yml").toBe(true);

    const rulesets = readRulesets();
    expect(rulesets.length, `rulesets exported under ${rulesetsDir}`)
      .toBeGreaterThan(0);
    for (const stage of Object.keys(PREVIOUS_STAGE)) {
      const enforced = enforcedOn(rulesets, stage);
      for (const rule of REFUSING_RULES) {
        expect(enforced.ruleTypes,
          `an active, unbypassable ruleset on ${stage} has ${rule}`)
          .toContain(rule);
      }
      expect(enforced.requiredChecks,
        `an active, unbypassable ruleset on ${stage} requires ` +
        REQUIRED_CHECK).toContain(REQUIRED_CHECK);
    }

    expect(existsSync(promote), "bin/promote exists").toBe(true);

    // Forward, one stage at a time: staging takes next's commit, and
    // main takes staging's, not next's newer one.
    const forward = freshSandbox();
    pushNewCommit(forward.farm, "next", "on-next");
    expectPromotionMoves(forward, "staging");
    pushNewCommit(forward.farm, "next", "newer-on-next");
    expectPromotionMoves(forward, "main");

    // Someone pushed straight to a stage, so it is no longer behind
    // the stage before it: promoting onto it would not be a
    // fast-forward, and bin/promote refuses.
    const divergedStaging = freshSandbox();
    pushNewCommit(divergedStaging.farm, "next", "on-next");
    pushNewCommit(divergedStaging.elsewhere, "staging", "straight-to-staging");
    expectPromotionRefused(divergedStaging, "staging");

    const divergedMain = freshSandbox();
    pushNewCommit(divergedMain.farm, "staging", "on-staging");
    pushNewCommit(divergedMain.elsewhere, "main", "straight-to-main");
    expectPromotionRefused(divergedMain, "main");
  }, 60_000);
});
