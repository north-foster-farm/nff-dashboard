# Theme color handoff: missing green step

## Context

The NFF business card back places the chicken mark on a solid field of
turf-green 800 (`#194d37`). The mark should read as a *tonal* element —
visible but quiet — which means a contrast ratio between **3.2:1 and
3.5:1** against that field.

Below 3.0:1 the mark risks disappearing in print (ink spread on
absorbent stock closes fine gaps). Above ~4:1 it stops reading as tonal
and becomes a high-contrast logo.

No existing palette value lands in that window at the correct hue.

## The gap

Contrast of each turf-green stop against turf-green 800 (`#194d37`):

| Stop | Hex | Contrast vs 800 |
|---|---|---|
| 400 | `#65cda2` | 5.01 |
| 500 | `#3ec18a` | 4.26 |
| **— target window —** | | **3.2 – 3.5** |
| 600 | `#329a6f` | 2.77 |
| 700 | `#257453` | 1.72 |

The ramp steps straight over the window. The same is true of the
emerald ramp: emerald 600 (`#28a470`) is 3.07, emerald 500 (`#32cd8c`)
is 4.75.

Across every color in `theme-colors.md`, only four values fall in
3.2–3.5, and three are red, blue, and periwinkle. The single green is
`#21ab4f` (tea-green 600, 3.24) — but it sits at hue 140 against the
card's hue 155, so it is not usable.

## Required change

Add one intermediate stop to the **turf-green** ramp.

```
turf-green 550 = #37ad7c
```

**Derivation.** The dark half of the turf-green ramp is constructed at
fixed hue ~155 and fixed saturation ~68%, stepping HSV value down by
about 15 points per stop:

| Stop | Value |
|---|---|
| 500 | 75.7% |
| 600 | 60.4% |
| 700 | 45.5% |
| 800 | 30.2% |
| 900 | 15.3% |

The midpoint of 500 and 600 is value **68.0%**. At hue 155 / saturation
68% / value 68%, that is `#37ad7c` (measured: hue 155.1, sat 68.2%,
val 67.8%).

So the new stop is not an invention — it is the arithmetic midpoint of
the ramp's own construction, and it happens to land exactly in the
target window.

**Verification: `#37ad7c` on `#194d37` = 3.44:1.**

## Verification the agent should run

Use the WCAG 2.x relative luminance definition:

```
lin(c) = c/12.92                     if c <= 0.03928
       = ((c + 0.055)/1.055) ** 2.4  otherwise      (c = channel / 255)

L = 0.2126*lin(R) + 0.7152*lin(G) + 0.0722*lin(B)

ratio = (max(L1,L2) + 0.05) / (min(L1,L2) + 0.05)
```

Assert:

- `contrast('#37ad7c', '#194d37')` is between 3.35 and 3.50
- hue of `#37ad7c` is within 155 ± 2
- saturation is within 68 ± 2
- the value sits between turf-green 500 and turf-green 600

## Token naming

A `550` key is valid in a custom Tailwind palette but breaks the
conventional 50–950 rhythm. Preferred approach:

1. Add the raw value to the turf-green scale in `src/styles.css` as
   `550`.
2. Expose it through a semantic token in `index.html`, since its
   purpose is specific rather than general-UI:

   ```
   --c-brandmark-inverse: #37ad7c;
   ```

   This is the mark color for use on dark green fields only. It is not
   a general-purpose surface, text, or border color.
3. Mirror into `public/style-guide/assets/ds.css` per the existing
   source-of-truth flow.

If the project prefers not to add off-rhythm scale keys, skip step 1
and define the semantic token directly with a comment noting it sits
between turf-green 500 and 600.

## Rejected alternatives

Recorded so they are not re-litigated:

- **emerald 600 `#28a470`** — 3.07:1. Clears the print floor but sits
  below the tonal window.
- **turf-green 500 `#3ec18a`** — 4.26:1. Currently in use. Reads as a
  logo, not a tonal mark.
- **tea-green 600 `#21ab4f`** — 3.24:1, in window, but hue 140. Would
  be the only off-hue element on the card.
- **Darkening the field to turf-green 950 `#091b13`** and keeping the
  mark at `#1e7b54` — 3.41:1, in window, but reverses a settled design
  decision about the back field.

## Optional housekeeping

Not required for the card. Surfacing because the audit found them.

**Three ramps are exact duplicates.** `frozen-lake` is byte-identical
to `sky-aqua`, `honey-bronze` to `amber-glow`, and `grapefruit-pink`
to `hot-fuchsia`. Either alias them or delete the duplicates — as
written, they will drift.

**The card straddles three ramps.** Its greens come from emerald
(`#1e7b54`, the brand green), turf-green (`#194d37`, `#0c271c`), and
celadon (`#d6f5e0`, the pale footer field). All are hue ~155 except
celadon. Worth documenting which ramp is canonical for brand use, even
if nothing changes.

**The pale footer field is off-hue.** `#d6f5e0` (celadon 100) sits at
hue 139 while everything else on the card is hue 155. At 12.7%
saturation this is nearly invisible. The turf-green equivalent is
turf-green 100 `#d8f3e8` (hue 155.6). Contrast against the footer text
`#194d37` is effectively unchanged: 8.30 versus 8.34. Swapping it puts
the entire card on a single hue.

## Do not change

These are locked by an approved print proof:

| Role | Hex | Origin |
|---|---|---|
| Brand green (all front ink) | `#1e7b54` | emerald 700 |
| Dark green (footer text, back field) | `#194d37` | turf-green 800 |
| Pale footer field | `#d6f5e0` | celadon 100 |
