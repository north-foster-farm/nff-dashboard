// stylelint (H5). Scope: the two hand-maintained sheets —
// src/styles.css (Tailwind 4 entry + tokens) and the style-guide's
// ds.css. Tailwind's at-rules are declared, not ignored wholesale,
// so a typoed at-rule still fails.
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "at-rule-no-unknown": [true, {
      ignoreAtRules: [
        "import",
        "theme",
        "layer",
        "custom-variant",
        "apply",
        "utility",
        "variant",
      ],
    }],
    // Token names mirror src/theme.js camelCase-derived names and
    // Tailwind's own generated properties — not kebab-case.
    "custom-property-pattern": null,
    // The house sheets keep related one-liner rules compact.
    "declaration-block-single-line-max-declarations": 3,
    // The sheets are sectioned by concern (base typography vs the
    // density-zoom block both style `body`, each under its own
    // narrative comment) — re-selecting is the house structure.
    "no-duplicate-selectors": null,
    // Tailwind's @utility IS a scoping root for `&`; stylelint
    // doesn't know that.
    "nesting-selector-no-missing-scoping-root": null,
    // The inverse-zoom factors (0.8333333 = 1/1.2) are precise on
    // purpose — truncating drifts hairline widths off device pixels.
    "number-max-precision": 7,
  },
};
