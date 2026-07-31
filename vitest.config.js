import { defineConfig } from "vitest/config";

// Separate from vite.config.js on purpose: the tests here are pure
// logic (no React render, no DOM) — mostly `src/lib/**`, plus a few
// pure helpers that live beside their component (e.g.
// src/components/animalIcons.test.js). That lets this config skip the
// react()/tailwindcss() plugins entirely and run in plain node —
// faster and free of unrelated build-plugin noise.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
    coverage: {
      // Terminal summary only — no coverage/ artifact tree to
      // ignore, stage by accident, or go stale.
      reporter: ["text-summary"],
      // Coverage is measured on the PURE lib layer only — the code
      // the unit suite is responsible for. The sanctioned impure
      // zones (data/ hooks, browser/) are exercised through the app,
      // not this suite, so counting them would only dilute the
      // signal.
      include: ["src/lib/**/*.js"],
      exclude: [
        "src/lib/**/*.test.js",
        "src/lib/data/**",
        "src/lib/browser/**",
      ],
      // RATCHET thresholds (H5): set just under the 2026-07-31
      // measurement (93.85 / 86.08 / 96.29 / 95.46). When real
      // coverage rises, raise these to just under the new mark —
      // never lower them to make a commit pass. Roadmap 0.5 closed
      // the gap the old numbers had drifted into: they were left
      // 1.5-2 points slack, so an entire module could rot out of
      // coverage without the gate noticing.
      thresholds: {
        statements: 93.8,
        branches: 86,
        functions: 96.2,
        lines: 95.4,
      },
    },
  },
});
