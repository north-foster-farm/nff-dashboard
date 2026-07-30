// ESLint flat config (H5). Two tiers:
//   1. Correctness — @eslint/js recommended + react-hooks; always
//      clean, no waivers. Warnings (exhaustive-deps, react-refresh)
//      are the visible improvement backlog; errors gate commits.
//   2. Size/complexity limits (the Sandi-Metz analogue) — strict for
//      new code (complexity 15); the legacy hotspots measured on
//      2026-07-30 carry explicit bucketed waivers below instead of a
//      silently loosened global limit. RATCHET RULE: when a refactor
//      brings a file under its bucket, MOVE it down a tier or out —
//      never add a new file to any bucket.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// Complexity waiver buckets — generated from the 2026-07-30 baseline
// (worst function per file; bucket = smallest of 25/40/80 that fits).
const LEGACY_COMPLEXITY_25 = [
  "netlify/functions/notify-run-done.mjs",
  "src/App.jsx",
  "src/components/AddToScheduleSearch.jsx",
  "src/components/BatchMetrics.jsx",
  "src/components/CalendarViews.jsx",
  "src/components/ChoreFieldsEditor.jsx",
  "src/components/DateTyperPopover.jsx",
  "src/components/InboxBell.jsx",
  "src/components/PlaceTree.jsx",
  "src/components/RecurrenceEditor.jsx",
  "src/components/ReservationSheet.jsx",
  "src/components/ScheduleEditSheet.jsx",
  "src/components/SellTab.jsx",
  "src/components/Sidebar.jsx",
  "src/components/SitesAdmin.jsx",
  "src/lib/browser/router.js",
  "src/lib/browser/weather.js",
  "src/lib/data/useBufferTemplates.js",
  "src/lib/data/useChoreBlocks.js",
  "src/lib/data/useChoreCompletions.js",
  "src/lib/data/useChoreDefinitions.js",
  "src/lib/data/useChoreRuns.js",
  "src/lib/data/useCustomers.js",
  "src/lib/data/useEventSeries.js",
  "src/lib/data/useOrders.js",
  "src/lib/data/useProcessRunner.js",
  "src/lib/data/useProcesses.js",
  "src/lib/data/useProducts.js",
  "src/lib/data/useProjects.js",
  "src/lib/data/useReferenceData.js",
  "src/lib/processes.js",
  "src/lib/productCatalog.js",
  "src/lib/recurrence.js",
  "src/lib/schedule/deriveDay.js",
  "src/lib/schedule/lookBack.js",
  "src/lib/schedule/partition.js",
  "src/pages/Availability.jsx",
  "src/pages/Calendar.jsx",
  "src/pages/Chores.jsx",
  "src/pages/Now.jsx",
  "src/pages/Overview.jsx",
  "src/pages/PlacePage.jsx",
  "src/pages/Processes.jsx",
  "src/pages/ProjectPage.jsx",
  "src/pages/Projects.jsx",
  "src/pages/Rounds.jsx",
  "src/pages/SpeciesPage.jsx",
];
const LEGACY_COMPLEXITY_40 = [
  "src/components/PricingGrid.jsx",
  "src/components/ui.jsx",
  "src/lib/data/useFeeds.js",
  "src/lib/data/useScheduleDeltas.js",
  "src/lib/feedConsumption.js",
  "src/lib/load/farmLoad.js",
  "src/lib/metrics.js",
  "src/lib/schedule/overrides.js",
  "src/pages/BatchPage.jsx",
  "src/pages/FeedSchedulesPage.jsx",
  "src/pages/Orders.jsx",
  "src/pages/Products.jsx",
];
const LEGACY_COMPLEXITY_80 = [
  "src/components/ChoreCheckRow.jsx",
  "src/components/EventEditor.jsx",
  "src/components/ScheduleSidebars.jsx",
  "src/components/SectionContent.jsx",
  "src/lib/chores.js",
  "src/lib/data/useActivityLog.js",
  "src/lib/data/useSearchIndex.js",
  "src/pages/Schedule.jsx",
];

export default [
  {
    ignores: [
      "dist/",
      "node_modules/",
      ".backups/",
      ".ignored/",
      "public/",
      "audits/",
      "docs/",
    ],
  },
  js.configs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      complexity: ["error", 15],
      "max-depth": ["error", 4],
      "max-params": ["error", 5],
      "no-unused-vars": ["error", {
        args: "after-used",
        argsIgnorePattern: "^_",
        caughtErrors: "none",
        ignoreRestSiblings: true,
      }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      // React-Compiler-era rules (set-state-in-effect, refs,
      // static-components, immutability, preserve-manual-memoization)
      // flag 60+ sites — adopting them is a Roadmap-v2 refactor arc,
      // not lint cleanup. Off until that arc; don't cherry-pick.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // Shared constants/helpers beside components are house layout
      // (ui.jsx et al.); losing HMR on those files is an accepted
      // trade. Visible as warnings, not a gate.
      "react-refresh/only-export-components": "warn",
    },
  },
  {
    // The pure-logic layer holds the densest code — function-length
    // limits bite here. Components are JSX trees; a line cap on them
    // measures markup, not logic. The data/ hooks bundle fetch +
    // shape + mutators in one closure by design, so both stay under
    // complexity caps only.
    files: ["src/lib/**/*.js"],
    ignores: [
      "src/lib/**/*.test.js",
      "src/lib/data/**",
      "src/lib/browser/**",
    ],
    rules: {
      "max-lines-per-function": ["error", {
        max: 120, skipBlankLines: true, skipComments: true,
      }],
    },
  },
  {
    // Remaining legacy-shape waivers, same ratchet rule: these name
    // today's exact overage; a refactor that clears one deletes it.
    files: ["src/lib/chores.js", "src/lib/feedConsumption.js"],
    rules: { "max-depth": ["error", 5] },
  },
  {
    files: ["src/lib/data/useSearchIndex.js"],
    rules: { "max-params": ["error", 6] },
  },
  {
    // farmLoad is audit item 17's headline hotspot — splitting it is
    // a Roadmap-v2 refactor, not lint cleanup.
    files: ["src/lib/load/farmLoad.js"],
    rules: {
      "max-lines-per-function": ["error", {
        max: 240, skipBlankLines: true, skipComments: true,
      }],
    },
  },
  {
    files: LEGACY_COMPLEXITY_25,
    rules: { complexity: ["error", 25] },
  },
  {
    files: LEGACY_COMPLEXITY_40,
    rules: { complexity: ["error", 40] },
  },
  {
    files: LEGACY_COMPLEXITY_80,
    rules: { complexity: ["error", 80] },
  },
];
