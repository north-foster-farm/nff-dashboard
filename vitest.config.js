import { defineConfig } from "vitest/config";

// Separate from vite.config.js on purpose: the tests here exercise the
// pure `src/lib/**` business-logic layer (no React, no DOM), so this
// config skips the react()/tailwindcss() plugins entirely and runs in
// plain node — faster and free of unrelated build-plugin noise.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
