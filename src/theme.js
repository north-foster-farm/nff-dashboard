// Theme tokens reference CSS custom properties. The active palette is selected
// by the `data-theme` attribute on <html>; values live in index.html.
// Brand anchor: #297D5A (deep forest green).
export const T = {
  bg: "var(--c-bg)",
  surface: "var(--c-surface)",
  surfaceAlt: "var(--c-surface-alt)",
  border: "var(--c-border)",
  text: "var(--c-text)",
  textDim: "var(--c-text-dim)",
  textMuted: "var(--c-text-muted)",
  textFaint: "var(--c-text-faint)",
  accent: "var(--c-accent)",
  accentDeep: "var(--c-accent-deep)",
  accentDim: "var(--c-accent-deep)",
  warn: "var(--c-warn)",
  resolved: "var(--c-resolved)",
  onAccent: "var(--c-on-accent)",
  onCat: "var(--c-on-cat)",
  rowActive: "var(--c-row-active)",
  rowHover: "var(--c-row-hover)",
  rowActiveDim: "var(--c-row-active-dim)",
  cat: {
    farmers_market: "var(--c-cat-fm)",
    popup_event: "var(--c-cat-popup)",
    egg_drop: "var(--c-cat-egg)",
    chore: "var(--c-cat-chore)",
    deliveries: "var(--c-cat-deliveries)",
    farm_visits: "var(--c-cat-farm-visits)",
    pickups: "var(--c-cat-pickups)",
    processing_days: "var(--c-cat-processing)",
    default: "var(--c-cat-default)"
  },
  heading: "'Lora', Georgia, 'Times New Roman', serif",
  body: "'Nacelle', system-ui, -apple-system, 'Segoe UI', sans-serif",
  // Used only for app/section labels (sidebar group headers, top-bar admin pill).
  uiLabel: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
};

// Back-compat aliases — older files may still reference these.
T.serif = T.heading;
T.mono = T.body;
