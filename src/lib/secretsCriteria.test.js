// Criteria tests for #68 (secrets page, rotation log and check), one
// describe per "Done when" box marked "Checked by test", written by a
// test agent from the boxes alone (2026-11-23). Box 3, two-factor
// sign-in, is James's to confirm. rotationLog.test.js beside this is
// the implementer's own test of the check's helpers.
//
// Box 1: "Every credential above has a section and a rotation line."
// The credentials are #68's list, not the page's own table, so one the
// page leaves out fails here. Each is known by the name the docs and
// the log use for it, and by the words that name it in prose; a
// section is a `##` section of docs/secrets.md, other than its table,
// holding its name or all of its words, in any case.
// Box 2: "Adding a secret to the sample without a rotation line fails
// check." The check is run as `npm run check` runs it, on copies of
// the repository's files in a throwaway folder, never on the files
// themselves. This repository is public: names only, never a value.

import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), "utf8");

// #68: "Supabase secret key, VAPID private key, the Google OAuth client
// secret held in Supabase, the publishable key, the C3 caller secret
// and any Healthchecks ping URL from #30."
const CREDENTIALS = [
  { name: "SUPABASE_SECRET_KEY", words: ["supabase", "secret key"] },
  { name: "VAPID_PRIVATE_KEY", words: ["vapid", "private key"] },
  {
    name: "Google OAuth client secret",
    words: ["google", "oauth", "client secret"],
  },
  { name: "VITE_SUPABASE_PUBLISHABLE_KEY", words: ["publishable key"] },
  { name: "PUSH_CALLER_SECRET", words: ["caller secret"] },
  { name: "PROD_AUDIT_PING_URL", words: ["healthchecks", "ping url"] },
];

// The page's `##` sections other than the one holding its table, as
// { heading, text }.
const sectionsOf = (page) => page.split(/^## /m).slice(1)
  .map((section) => ({
    heading: section.slice(0, section.indexOf("\n")),
    text: section,
  }))
  .filter(({ text }) => !/^\|\s*Name\s*\|/im.test(text));

// The first column of every line of the log's table.
const loggedNames = (log) => log.split("\n")
  .map((line) => line.split("|").map((cell) => cell.trim()))
  .filter((cells) => cells.length >= 5)
  .map(([name]) => name);

describe("box 1: every credential has a section and a rotation line", () => {
  it("names each of #68's credentials in a section of its own and "
    + "logs each", () => {
    const sections = sectionsOf(read("docs/secrets.md"));
    const logged = loggedNames(read("docs/rotation-log.md"));
    const names = (text, { name, words }) => text.includes(name)
      || words.every((word) => text.toLowerCase().includes(word));

    const missing = CREDENTIALS.flatMap((credential) => [
      ...sections.some(({ text }) => names(text, credential))
        ? [] : [`${credential.name}: no section`],
      ...logged.includes(credential.name)
        ? [] : [`${credential.name}: no rotation line`],
    ]);

    expect(missing).toEqual([]);
  });
});

describe("box 2: a secret added to the sample without a rotation line "
  + "fails check", () => {
  const ADDED = "NEW_SERVICE_TOKEN";
  const COPIED = ["docs/secrets.md", "docs/rotation-log.md", ".env.example"];

  // Git in the folder sees the folder alone: a git hook sets GIT_DIR
  // and friends, which would point it back at this repository (and
  // `git init` would then re-initialize this one).
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => !name.startsWith("GIT_")));

  // The check as `npm run check` runs it, run in `dir`.
  const CHECK = /node (scripts\/check-rotation-log\.mjs)/;
  const runCheck = (dir) => spawnSync(process.execPath, [
    join(ROOT, CHECK.exec(JSON.parse(read("package.json")).scripts.check)[1]),
  ], { cwd: dir, encoding: "utf8", env });

  it("is part of npm run check", () => {
    expect(JSON.parse(read("package.json")).scripts.check).toMatch(CHECK);
  });

  it("fails naming the added secret, and passes once it has a line", () => {
    const dir = mkdtempSync(join(tmpdir(), "nff-rotation-"));

    try {
      mkdirSync(join(dir, "docs"));
      for (const file of COPIED) copyFileSync(join(ROOT, file), join(dir, file));
      execFileSync("git", ["init", "-q"], { cwd: dir, env });
      appendFileSync(join(dir, ".env.example"), `\n${ADDED}=\n`);

      const without = runCheck(dir);

      appendFileSync(join(dir, "docs/rotation-log.md"),
        `${ADDED} | planned | production | planned, not done | James\n`);

      const withLine = runCheck(dir);

      expect(without.status, "check fails without the line").toBe(1);
      expect(without.stderr, "and names the secret").toContain(ADDED);
      expect(withLine.status, withLine.stderr).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
