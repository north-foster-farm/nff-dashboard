// GitHub as bin/promote main sees it, from recordings only (#75): the
// fake `gh` beside this file, put first on the sandbox's PATH, answers
// from the recorded files a test names under fixtures/github/. The
// recordings are real answers, scrubbed; their one placeholder,
// SANDBOX_HEAD, stands for a commit only the sandbox has, and is filled
// in here with the commit a test names.
//
// The sandbox's env (./sandboxGit.js) is the one every command it runs
// gets, so the changes below reach bin/promote and anything it starts.
// No token and an empty gh config: should anything reach a real gh, it
// is signed in nowhere.

import {
  chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export const PLACEHOLDER = "SANDBOX_HEAD";

const recordingsDir = join(import.meta.dirname, "fixtures", "github");
const fakeGh = join(import.meta.dirname, "fake-gh");

const TOKENS = ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN",
  "GITHUB_ENTERPRISE_TOKEN", "GH_HOST", "GH_REPO"];

export function recordingText(name) {
  const file = join(recordingsDir, `${name}.json`);
  if (!existsSync(file)) {
    throw new Error(`no recording ${name}.json under ${recordingsDir}: ` +
      "the coordinator records it (see fixtures/github/README.md); " +
      "it is never written by hand");
  }
  return readFileSync(file, "utf8");
}

// Answer bin/promote's GitHub calls in `sandbox` with the named
// recordings, SANDBOX_HEAD filled in with `head`. Returns a reader of
// the calls gh was asked, one "METHOD path?query" per line.
export function serveRecordings(sandbox, names, head) {
  const bin = join(sandbox.root, "fake-gh-bin");
  const answers = join(sandbox.root, "fake-gh-answers");
  const config = join(sandbox.root, "fake-gh-config");
  for (const dir of [bin, answers, config]) mkdirSync(dir);
  copyFileSync(fakeGh, join(bin, "gh"));
  chmodSync(join(bin, "gh"), 0o755);
  for (const name of names) {
    writeFileSync(join(answers, `${name}.json`),
      recordingText(name).replaceAll(PLACEHOLDER, head));
  }
  writeFileSync(join(answers, "calls.log"), "");

  for (const token of TOKENS) delete sandbox.env[token];
  Object.assign(sandbox.env, {
    PATH: `${bin}:${sandbox.env.PATH}`,
    FAKE_GH_DIR: answers,
    GH_CONFIG_DIR: config,
    GH_PROMPT_DISABLED: "1",
    GH_NO_UPDATE_NOTIFIER: "1",
  });
  return () => readFileSync(join(answers, "calls.log"), "utf8");
}
