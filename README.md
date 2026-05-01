# North Foster Farm — Admin Dashboard

Custom internal admin app for North Foster Farm (Foster, RI). See `nff-handoff.md` and `nff-scope.md` for full context.

## Stack

- **Vite** + **React 18** (SPA, plain JS)
- **lucide-react** for icons
- Inline styles + central `theme.js` (no CSS framework)
- Fonts loaded via Google Fonts in `index.html`

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
npm run preview
```

## Layout

```text
src/
├── main.jsx            entry
├── App.jsx             root component, routing
├── theme.js            design tokens
├── sections.jsx        sidebar/section registry
├── data/nff-data.json  single source of truth for seed data
├── lib/                pure helpers (dates, recurrence, feed cost)
├── components/         chrome (TopBar, Sidebar, SectionHeader, etc.)
└── pages/              per-section views
```

Data is imported directly from `src/data/nff-data.json`. All other mutations pass through React state. No backend yet.
