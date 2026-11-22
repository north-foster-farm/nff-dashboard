// Criteria tests for nff-dashboard#75 (F2.1, branch flow): the approval
// bin/promote main must check before it moves main. The criterion, word
// for word from the security review of #103 (issuecomment-7080998118
// and 7081504509): bin/promote main "should require an open PR from
// this repo's staging into main, with that commit as its head, LGTM
// still on, and the newest label later than the push to staging, with
// sandboxed criteria tests for each refusal." It is a port of the
// site's approval() in north-foster-farm's bin/promote.mjs.
//
// One test per refusal, and one for the accepted case, written by the
// test agent before the implementation. Held out of `npm test` (its
// include is src/**); run with `npm run test:criteria`.
//
// Each test runs bin/promote main in a git sandbox (./gitSandbox.js,
// through ./sandboxGit.js) where staging is one fast-forward ahead of
// main, so only the approval can stop it. GitHub's answers are
// recordings (./fakeGitHub.js, fixtures/github/README.md). The
// accepted case serves one consistent set; each refusal swaps the
// recordings that differ for it, so the approval alone is what
// changes.

import { afterEach, describe, expect, it } from "vitest";

import { headOf, makeSandbox, pushNewCommit, runPromote }
  from "./gitSandbox.js";
import { serveRecordings } from "./fakeGitHub.js";

const APPROVED = {
  pulls: "pulls-staging-lgtm",
  timeline: "timeline-lgtm",
  activity: "activity-staging-push",
};

const recordingsOf = (swaps = {}) =>
  Object.values({ ...APPROVED, ...swaps });

describe("F2.1 bin/promote main checks the approval (#75)", () => {
  const sandboxes = [];
  afterEach(() => sandboxes.splice(0).forEach((s) => s.remove()));

  // staging holds a candidate one commit ahead of an earlier one, both
  // ahead of main: a fast-forward bin/promote would make unasked.
  function candidateOnStaging() {
    const sandbox = makeSandbox();
    sandboxes.push(sandbox);
    const earlier = pushNewCommit(sandbox, sandbox.farm, "staging",
      "earlier-on-staging");
    const candidate = pushNewCommit(sandbox, sandbox.farm, "staging",
      "candidate-on-staging");
    return { sandbox, earlier, candidate };
  }

  function promoteMain(sandbox, recordings, prHead) {
    const callsToGitHub = serveRecordings(sandbox, recordings, prHead);
    const mainBefore = headOf(sandbox, "main");
    const promotion = runPromote(sandbox, "main");
    return { promotion, mainBefore, callsToGitHub };
  }

  function expectRefused(sandbox, { promotion, mainBefore, callsToGitHub },
    why) {
    expect(callsToGitHub(),
      "bin/promote main should ask GitHub for the approval").not.toBe("");
    expect(promotion.exitCode,
      `bin/promote main should refuse ${why}; it said: ` +
      promotion.output).not.toBe(0);
    expect(headOf(sandbox, "main"), "main should be left where it was")
      .toBe(mainBefore);
  }

  it("refuses when no pull request from staging into main is open", () => {
    const { sandbox, candidate } = candidateOnStaging();
    const run = promoteMain(sandbox,
      recordingsOf({ pulls: "pulls-none-from-staging" }), candidate);
    expectRefused(sandbox, run,
      "with no open pull request from staging into main");
  }, 60_000);

  // Each wrong pull request carries its own LGTM timeline, so a port
  // that skips the head check would find an approval and promote,
  // rather than be stopped by a call the fake has no answer for.
  it("refuses a pull request from a fork or another head branch", () => {
    const fork = candidateOnStaging();
    expectRefused(fork.sandbox, promoteMain(fork.sandbox, recordingsOf({
      pulls: "pulls-fork-staging", timeline: "timeline-fork-lgtm",
    }), fork.candidate),
    "a pull request from a fork's staging branch");

    const otherBranch = candidateOnStaging();
    expectRefused(otherBranch.sandbox, promoteMain(otherBranch.sandbox,
      recordingsOf({
        pulls: "pulls-other-branch",
        timeline: "timeline-other-branch-lgtm",
      }), otherBranch.candidate),
    "a pull request into main from a branch other than staging");
  }, 120_000);

  it("refuses when the pull request's head is not the commit being " +
    "promoted", () => {
    const { sandbox, earlier } = candidateOnStaging();
    const run = promoteMain(sandbox, recordingsOf(), earlier);
    expectRefused(sandbox, run,
      "a pull request whose head is an earlier staging commit");
  }, 60_000);

  it("refuses a pull request with no LGTM label", () => {
    const { sandbox, candidate } = candidateOnStaging();
    const run = promoteMain(sandbox, recordingsOf({
      pulls: "pulls-staging-no-lgtm", timeline: "timeline-no-lgtm",
    }), candidate);
    expectRefused(sandbox, run, "a pull request never labeled LGTM");
  }, 60_000);

  it("refuses a pull request whose LGTM label was removed", () => {
    const { sandbox, candidate } = candidateOnStaging();
    const run = promoteMain(sandbox, recordingsOf({
      pulls: "pulls-staging-no-lgtm", timeline: "timeline-lgtm-removed",
    }), candidate);
    expectRefused(sandbox, run,
      "a pull request whose LGTM label was taken off");
  }, 60_000);

  it("refuses when the newest LGTM label is older than the push to " +
    "staging", () => {
    const { sandbox, candidate } = candidateOnStaging();
    const run = promoteMain(sandbox, recordingsOf({
      activity: "activity-staging-push-after-label",
    }), candidate);
    expectRefused(sandbox, run,
      "a label put on before the push that brought the commit to staging");
  }, 60_000);

  it("accepts an open staging pull request with the commit as its head " +
    "and LGTM on since the push", () => {
    const { sandbox, candidate } = candidateOnStaging();
    const { promotion } = promoteMain(sandbox, recordingsOf(), candidate);
    expect(promotion.exitCode,
      "bin/promote main should fast-forward main to the approved commit; " +
      `it said: ${promotion.output}`).toBe(0);
    expect(headOf(sandbox, "main"),
      "main should now hold the approved commit").toBe(candidate);
  }, 60_000);
});
