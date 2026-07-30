# NFF Design System

The bounded source of truth for how the app looks and reads, and how its pieces
fit together. It lives here in `public/style-guide/`, so it's served by the app
and versioned with it. Three faces of one system:

- **In-app** — open the app and go to **Style guide** (Other group in the nav).
  It embeds this site (theme-synced to the app); "Open full page" gives the
  standalone view.
- **Standalone visual docs** — open `index.html` in a browser, or visit
  `/style-guide/index.html` on the running app. Pages: Overview + Principles
  (`index.html`), Foundations (`foundations.html`), Components
  (`components.html`), Patterns (`patterns.html`), Tone & voice (`voice.html`;
  raw source `voice-guide.md`). The theme toggle (top-right) re-skins everything
  from the real `--c-*` tokens.
- **Machine reference** — `DESIGN-SYSTEM.md`. The same system in tight markdown;
  this is what Claude reads while building.

Status tags throughout: **Stable** (shipped + ratified), **Converging** (agreed
direction, partly shipped — build toward it), **Proposed** (decided in design,
not built). We iterate aggressively; churn is expected — **when you introduce a
new component or a new variant, update both the matching visual page and
`DESIGN-SYSTEM.md`** (this is a standing rule).

Grounded in the real codebase (`index.html` tokens, `src/styles.css`,
`src/components/ui.jsx`, the pages) and the harvest-remix design bracket
(`docs/workshops/design-bracket/examples/harvest-remix/DESIGN.md`).

`assets/` holds the shared stylesheet (`ds.css`) and shell script (`ds.js`) —
the docs' own chrome, built in the system they document. Verification
screenshots are not kept: they date instantly as the guide changes, so
re-shoot them with the drivers in `.ignored/audit/` when you need them.
