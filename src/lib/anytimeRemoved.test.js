// F30 (06-28 audit) removed "Anytime" as a concept the app offers.
// Half of that shipped in 1d1ad4a — a user chore now requires a block
// — and half did not, which is the worst state: the Schedule's add
// bar and edit sheet still offered "Anytime" as a destination, and
// four surfaces still named an unresolved block that way.
//
// What deliberately SURVIVES is the lowercase `anytime` bucket KEY.
// 1d1ad4a kept it on purpose: it is orphan tolerance, so a delta
// whose block_id no longer resolves lands somewhere visible instead
// of vanishing from the day. The key is internal plumbing; the label
// is not. This test pins the half that was removed — nothing shipped
// under src/ renders an Anytime bucket to the user.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC_ROOT = "src";

// Only text that REACHES the user counts: a quoted label literal, or
// JSX element text. An identifier like `isAnytime` in chores.js names
// a live rule (S38 — a block-less chore is valid in every block) and
// is not a rendered label; prose in a comment is not either.
const QUOTED_LABEL = /["'`]Anytime\b/;
const JSX_TEXT = />\s*(Anytime|—\s*anytime\s*—)\s*</;
const isComment = (line) => /^(\/\/|\/?\*)/.test(line.trim());

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.jsx?$/.test(name) && !name.endsWith(".test.js"))
      out.push(path);
  }
  return out;
}

const shippedSources = walk(SRC_ROOT);

describe("the Anytime bucket is gone from every surface (F30)", () => {
  it("renders no Anytime label anywhere under src/", () => {
    const offenders = [];
    for (const file of shippedSources) {
      readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        if (isComment(line)) return;
        if (QUOTED_LABEL.test(line) || JSX_TEXT.test(line))
          offenders.push(`${file}:${i + 1} ${line.trim()}`);
      });
    }
    expect(offenders, "surfaces still rendering an Anytime bucket —" +
      " name the block-less bucket with NO_BLOCK_LABEL, and offer it" +
      " as a destination nowhere")
      .toEqual([]);
  });
});
