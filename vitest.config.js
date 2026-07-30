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
  },
});
