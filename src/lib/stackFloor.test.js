// The stack upgrade is a RATCHET (CLAUDE.md "Quality gates &
// invariants"): 3.1 moved react/react-dom to 19, vite to 8 and
// @vitejs/plugin-react to 6 as one coordinated unit, and the reason
// vite had to move is a security advisory — GHSA-67mh-4wv8-2f99, the
// esbuild dev server answering cross-origin requests, fixed for vite
// consumers in 8.x. `npm audit` catches a regression only when
// somebody runs it with a network; this catches it in the suite.
//
// A floor, not a pin: caret ranges above the floor are the point, so
// only the major is asserted.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));

const declaredRanges = {
  ...manifest.dependencies,
  ...manifest.devDependencies,
};

const majorFloors = {
  react: 19,
  "react-dom": 19,
  vite: 8,
  "@vitejs/plugin-react": 6,
};

// "^8.2.0" -> 8. Every range in this repo is a caret range; anything
// else (a pin, a tag, a git url) should fail loudly rather than parse
// to NaN and silently pass a >= comparison.
function majorOf(range) {
  const major = /^\^(\d+)\./.exec(range);
  expect(major, `"${range}" is not a caret range this test can read`)
    .not.toBeNull();
  return Number(major[1]);
}

describe("stack floor", () => {
  for (const [dependency, floor] of Object.entries(majorFloors)) {
    it(`keeps ${dependency} at major ${floor} or above`, () => {
      const declaredRange = declaredRanges[dependency];
      expect(declaredRange,
        `package.json no longer declares ${dependency}`).toBeDefined();
      expect(majorOf(declaredRange),
        `${dependency} ${declaredRange} is below the 3.1 floor`)
        .toBeGreaterThanOrEqual(floor);
    });
  }
});
