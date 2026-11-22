import { defineConfig } from "vitest/config";

// Criteria tests written ahead of their implementation (the test agent's
// work; see ~/.claude/CLAUDE.md, "Tests and implementation come from
// different agents"). They fail until the implementation lands, so
// `npm test` (src/** only) leaves them out and the pre-commit hook stays
// green. `npm run test:criteria` runs them. When an implementation makes
// one pass, the implementer moves it into the main suite's include.
export default defineConfig({
  test: {
    environment: "node",
    root: import.meta.dirname,
    include: ["**/*.test.js"],
  },
});
