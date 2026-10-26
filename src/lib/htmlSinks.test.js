import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// React puts text in the page as text, so a customer's name, a note or
// an address is inert in a view. The ways around that are few: raw HTML,
// a URL taken from data, and code built from a string. This holds every
// one to a short list, so a new one cannot arrive unreviewed (north-
// foster-farm #267). To add one, review it, then add it here.

const SRC = new URL("..", import.meta.url).pathname;

const files = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory()
    ? files(join(dir, e.name))
    : [join(dir, e.name)]))
  .filter((f) => /\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f));

const SOURCES = files(SRC).map((path) => ({
  path: path.slice(SRC.length),
  text: readFileSync(path, "utf8"),
}));

const using = (pattern) => SOURCES
  .filter((s) => pattern.test(s.text))
  .map((s) => s.path)
  .sort();

describe("the views' ways around React's escaping", () => {
  it("keep raw HTML to the Markdown renderer, which sanitizes it", () => {
    expect(using(/dangerouslySetInnerHTML/)).toEqual([
      "components/Markdown.jsx",
    ]);

    const markdown = SOURCES.find((s) => s.path === "components/Markdown.jsx");

    expect(markdown.text).toMatch(/DOMPurify\.sanitize\(/);
  });

  it("never write HTML or run code built from a string", () => {
    for (const pattern of [
      /\.innerHTML\s*=/, /\.outerHTML\s*=/, /insertAdjacentHTML/,
      /document\.write/, /\beval\s*\(/, /new Function\s*\(/,
    ]) {
      expect(using(pattern), String(pattern)).toEqual([]);
    }
  });

  it("put only a checked URL in an href taken from data", () => {
    const hrefs = SOURCES.flatMap((s) => [...s.text.matchAll(/href=\{([^}]*)\}/g)]
      .map((m) => ({ path: s.path, value: m[1] })));

    for (const { path, value } of hrefs) {
      expect(value, `${path}: href={${value}}`).toMatch(/safeHttpUrl\(/);
    }
  });

  it("open a window only from the places that build the URL themselves", () => {
    // App.jsx: a section's own address from the static section list.
    // ProjectBits.jsx, ProjectPage.jsx: a signed storage URL.
    expect(using(/window\.open\(/)).toEqual([
      "App.jsx", "components/ProjectBits.jsx", "pages/ProjectPage.jsx",
    ]);
  });
});
