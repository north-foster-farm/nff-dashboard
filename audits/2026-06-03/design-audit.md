# Batch 39 — Design audit (code-side) · 2026-06-03

Claude-led review of the front-end, run after the preliminary
functionality audit (Batch 40.1). Focus per the roadmap: component
architecture, design-system consolidation (spacing, typography, color
tokens, `primitives.jsx` coverage, Tailwind-idiom consistency), and
UI/UX patterns visible from code.

Method: four parallel read-only sweeps of `src/` (class-string
duplication, inline-style idiom, duplicate structural components,
color/token bypasses), synthesized here.

Findings are split into **what this batch fixes** and **what's deferred
to 39.2** (the large, regression-prone migrations).

---

## 1. State of the design system

- **`primitives.jsx` is effectively dead.** It exports `DataField`,
  `Subsection`, `Tile`, `TabStrip`, `Row` — and only `Subsection` is
  imported anywhere (once, by `Threads.jsx`). It's also written in the
  *old* inline-`style={{T.*}}` idiom, so it can't be the home for new
  shared components as-is.
- **Two styling idioms coexist.** Modern: Tailwind utilities + semantic
  tokens (`bg-surface text-fg border-line …`). Legacy: inline
  `style={{ background: T.surface, … }}` referencing `T` from
  `theme.js`. Every `T.*` token has a clean Tailwind equivalent
  (documented in `styles.css`), so the legacy idiom is pure debt.
- **Class strings are copy-pasted, not shared.** `labelCls` is
  byte-identical in 4 files; `inputCls` / `btnAccentCls` /
  `btnGhostCls` are redefined (with small drift) in ~8 files; `Card` is
  reimplemented 4 times.

## 2. Duplication inventory (consolidation targets)

### 2a. Class-string constants
| Family | Where | Notes |
|--------|-------|-------|
| `labelCls` | SellTab:25, Products:324, Inventory:282, Orders:47 | **byte-identical** — trivial extract |
| `inputCls` | SellTab, BatchMetrics, Customers, Products, SpeciesPage, Inventory, Orders, FeedSchedulesPage | two roots (`bg-surface` vs `bg-bg`); minor px/text drift |
| `btnAccentCls` | Products, Orders (+ ~40 inline accent buttons across 20 files) | the primary-button pattern |
| `btnGhostCls` | Products, Inventory, Orders (+ ~20 inline) | secondary outline button |
| ghost-warn button | Orders, SitesAdmin, ChoresBlocksTab | destructive variant |

### 2b. Duplicate structural components
| Component | Implementations | Shared today? |
|-----------|-----------------|---------------|
| `Card` (titled bordered surface) | Overview:907, Metrics:329, BatchMetrics:540, BatchPage:571 | none — 4 near-identical copies |
| Empty states | EmptyState.jsx (shared), + EmptyLine (Overview, PlacePage), EmptyCard (Chores), EmptyState (Inbox, Projects) + ~15 inline | partial |
| Status pills | BatchStatePill, ChoreRemainingPill (shared), + PaymentChip (Orders), sold-out/bundle tags (Products, SellTab), process status (Processing) | partial |
| Summary tiles | `Tile` (primitives), + SummaryStrip (Orders:175, Inventory:115 — near-identical) | partial |
| Segmented controls | TabStrip (primitives), SegmentedControl (Settings), TabBar (Chores), KindChips/RangeChips (Observations) | fragmented |
| Toggle chips | ToggleChip (ProjectPage), SwitcherChip (Rounds) — near-identical | none |
| Confirm-and-delete | **27 bare `window.confirm()` calls** across 20 files | none |

### 2c. Legacy inline-style files (T.* idiom)
| File | Size | Effort |
|------|------|--------|
| Suppliers, Trailers, Machines, Threads | tiny (~25 lines each, same list pattern) | trivial |
| EmptyState.jsx | 12 lines | trivial |
| SectionContent.jsx (`GenericItemList` only) | 1 small fn | trivial |
| primitives.jsx | 57 lines, dead-ish | small |
| PlaceTree.jsx | recursive, 16 blocks | medium |
| LoginGate.jsx | auth-critical, 10 blocks | medium (careful) |
| Chores.jsx | 2051 lines, ~76 style lines | large (regression-prone) |

### 2d. Color / token bypasses
| File:line | Now | Should be |
|-----------|-----|-----------|
| SitesAdmin:305, :526 | `hover:text-red-500` | `hover:text-warn` |
| ChoresBlocksTab:142, :314 | `text-red-500` | `text-warn` |
| Chores.jsx:1738 | `color: "#e25c4a"` | `text-warn` |

Correctly-excluded (not bugs): Google brand SVG colors in LoginGate;
`bg-black/40–60` modal scrims (decorative); `T.cat.*` event-kind colors.

**Token gap (noted, not filled this batch):** no semantic
*warn-subtle background* token — ChoreMessageButton + InboxBell reach
for `bg-amber-glow-*` to signal "needs attention". A `--c-warn-subtle`
pair would close that.

---

## 3. This batch (39.1) — executed

Safe, high-value, screenshot-verifiable:

1. **New `src/components/ui.jsx`** (Tailwind-native shared module):
   class constants `LABEL_CLS`, `INPUT_CLS`, `INPUT_BG_CLS`,
   `BTN_ACCENT`, `BTN_GHOST`, `BTN_GHOST_WARN`; components `Card`,
   `StatusPill`, `StatTile`.
2. **`Card`** adopted in Overview, Metrics, BatchMetrics, BatchPage
   (4 local copies deleted → 1 canonical).
3. **`labelCls`** replaced by `LABEL_CLS` import in the 4 byte-identical
   sites.
4. **`StatusPill`** backs `BatchStatePill` and the Orders `PaymentChip`.
5. **Token-bypass fixes** — the 5 `red-500`/hex sites → `text-warn`.
6. **Legacy migration** of the tiny files: EmptyState, Suppliers,
   Trailers, Machines, Threads, `GenericItemList`. `primitives.jsx`'s
   one live export (`Subsection`) folded in / migrated.

## 4. Deferred to 39.2 (documented, not done)

Each is real but carries broad regression risk that wants its own
focused pass + verification:

- **Button/input constant adoption across all ~40 sites** — normalizing
  the px/text drift is visual churn touching every page; do it page-by-page.
- **`ConfirmDialog` component** to replace the 27 `window.confirm()`
  calls (native dialog → styled, accessible modal).
- **Segmented-control unification** (TabStrip + SegmentedControl + TabBar
  → one component with an underline/pill variant).
- **`SummaryStrip` + `ToggleChip`** extraction.
- **Large legacy-idiom migrations**: Chores.jsx (2051 lines),
  LoginGate.jsx (auth-critical), PlaceTree.jsx (recursive).
- **`--c-warn-subtle` token** + adoption in ChoreMessageButton / InboxBell.
