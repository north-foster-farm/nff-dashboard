// Type must survive a cold offline load (1.5). Inter and Lora were
// pulled from the Google Fonts CDN, so two of the three type roles
// fell back to system fonts whenever that host was unreachable — and
// on a farm, offline is the normal case, not the edge one. Nacelle
// was already self-hosted in `public/fonts/` and showed the pattern.
//
// Scope is every DEPLOYED surface, not just the app shell: the five
// style-guide pages ship from `public/` too, and a design library
// that renders in fallback type is not documenting the system it
// claims to. `docs/history/` mockups are frozen narrative and stay
// on the CDN — they are records, not deployed pages.
//
// Two guarantees, and the second is what keeps the first honest: a
// document requesting no external fonts because it requests no fonts
// at all would satisfy the first assertion on its own.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FONT_CDN_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const PUBLIC_ROOT = "public";
const DEPLOYED_STYLESHEET = "public/style-guide/assets/ds.css";
const SELF_HOSTED_FONT_URL = /url\('(\/fonts\/[^']+)'\)/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".html")) out.push(path);
  }
  return out;
}

const deployedSurfaces = [
  "index.html",
  ...walk(PUBLIC_ROOT),
  DEPLOYED_STYLESHEET,
];

const surfaceSources = deployedSurfaces.map((path) => ({
  path,
  source: readFileSync(path, "utf8"),
}));

describe("deployed font loading", () => {
  it("requests no fonts from an external CDN", () => {
    const surfacesOnTheCdn = surfaceSources
      .filter(({ source }) =>
        FONT_CDN_HOSTS.some((host) => source.includes(host)),
      )
      .map(({ path }) => path);

    expect(surfacesOnTheCdn).toEqual([]);
  });

  it("resolves every self-hosted @font-face file", () => {
    const missingFontFiles = surfaceSources
      .flatMap(({ source }) => [...source.matchAll(SELF_HOSTED_FONT_URL)])
      .map(([, url]) => join(PUBLIC_ROOT, url))
      .filter((path) => !existsSync(path));

    expect(missingFontFiles).toEqual([]);
  });
});
