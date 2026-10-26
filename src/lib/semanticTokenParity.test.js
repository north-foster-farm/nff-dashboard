// Semantic `--c-*` token parity, sibling to styleGuideRamps.test.js one
// layer down: that file guards the Tailwind `--color-*` ramps, this one
// the semantic tokens the app actually paints with. Four blocks declare
// the set independently — a dark and a light theme in each of
// `index.html` (inline, so a theme lands before React boots) and
// `public/style-guide/assets/ds.css`, whose own comment calls itself
// "mirrored from index.html". Nothing checked the mirror was true, and
// it wasn't: the guide face was four tokens short and painted one
// swatch with a `--c-line` that has never existed.
//
// Parity is checked per theme, not per file. A token defined in only
// one theme is the same defect as one missing from a face — it renders
// unstyled the moment the user flips the toggle.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const GUIDE_DIR = "public/style-guide";

const appFace = readFileSync("index.html", "utf8");
const guideFace = readFileSync(`${GUIDE_DIR}/assets/ds.css`, "utf8");
const guidePages = readdirSync(GUIDE_DIR)
  .filter((name) => name.endsWith(".html"))
  .map((name) => readFileSync(`${GUIDE_DIR}/${name}`, "utf8"));

// A token is DEFINED by a custom-property declaration and REFERENCED by
// a var() lookup; only the declaration carries a trailing colon. Theme
// blocks hold nothing but declarations, so they end at the first brace.
const DEFINITION = /--(c-[a-z0-9-]+)\s*:/g;
const REFERENCE = /var\(\s*--(c-[a-z0-9-]+)/g;
const THEME_BLOCK = /data-theme="(dark|light)"\]\s*\{([^}]*)\}/g;

function tokensMatching(pattern, source) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

const uniq = (tokens) => [...new Set(tokens)].sort();

function tokensByTheme(source) {
  return Object.fromEntries([...source.matchAll(THEME_BLOCK)]
    .map(([, theme, body]) => [theme, uniq(tokensMatching(
      DEFINITION, body))]));
}

const appThemes = tokensByTheme(appFace);
const guideThemes = tokensByTheme(guideFace);

const CANONICAL_BLOCK = "index.html dark";
const canonicalTokens = appThemes.dark ?? [];

const everyBlock = [
  [CANONICAL_BLOCK, canonicalTokens],
  ["index.html light", appThemes.light ?? []],
  ["assets/ds.css dark", guideThemes.dark ?? []],
  ["assets/ds.css light", guideThemes.light ?? []],
];

const definedInGuide = uniq(Object.values(guideThemes).flat());
const paintedInGuide = uniq([...guidePages, guideFace]
  .flatMap((source) => tokensMatching(REFERENCE, source)));

describe("semantic token parity", () => {
  it("resolves every --c-* the style guide paints with", () => {
    const unresolved = paintedInGuide
      .filter((token) => !definedInGuide.includes(token));
    expect(unresolved, "the style guide paints with these --c-* tokens" +
      " but assets/ds.css defines none of them").toEqual([]);
  });

  it("defines one --c-* set across both themes of both faces", () => {
    for (const [blockName, tokens] of everyBlock) {
      const missing = canonicalTokens
        .filter((token) => !tokens.includes(token));
      expect(missing, `${blockName} is missing --c-* tokens that` +
        ` ${CANONICAL_BLOCK} defines`).toEqual([]);

      const stranded = tokens
        .filter((token) => !canonicalTokens.includes(token));
      expect(stranded, `${blockName} defines --c-* tokens that` +
        ` ${CANONICAL_BLOCK} does not`).toEqual([]);
    }
  });
});
