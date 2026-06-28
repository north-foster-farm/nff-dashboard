import LoadMeter, { LoadTrack } from "./LoadMeter.jsx";

// A temporary design specimen for the Rethinker refactor (Phase 0). It
// renders the LoadMeter primitive with the mockup's own sample day so we
// can react to the component in the live app (dark theme) before wiring
// it into the Schedule's IA. Not real data — remove once the spine
// adopts the component.

const BLOCKS = [
  {
    title: "Morning",
    note: "sealed · Jim 6:08–8:10 · 7/7",
    lanes: [
      { name: "Jim", meta: "7/7", segments: [{ kind: "done", pct: 78 }] },
      { name: "James", meta: "prep", metaFaint: true,
        segments: [{ kind: "done", pct: 30 }] },
    ],
  },
  {
    title: "Midmorning",
    note: "now",
    lanes: [
      { name: "Jim", meta: "2/8", segments: [
        { kind: "done", pct: 22 }, { kind: "committed", pct: 30 },
        { kind: "open", pct: 26 },
      ] },
      { name: "James", meta: "mkt", metaFaint: true,
        segments: [{ kind: "event", pct: 74 }] },
    ],
  },
  {
    title: "Early afternoon",
    note: "man-down",
    lanes: [
      { name: "Jim", meta: "0/4", segments: [{ kind: "committed", pct: 58 }] },
      { name: "James", meta: "hole", segments: [
        { kind: "committed", pct: 34 }, { kind: "hole", pct: 30 },
      ] },
    ],
  },
];

const LEGEND = [
  { kind: "done", label: "done (ticked)" },
  { kind: "committed", label: "committed (locked)" },
  { kind: "open", label: "open / should" },
  { kind: "event", label: "event reservation" },
  { kind: "hole", label: "hole — needs cover" },
];

export default function LoadMeterSpecimen() {
  return (
    <div className="border border-line bg-surface mb-6">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
        <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Design specimen · load-meter
        </span>
        <span className="font-ui text-[10px] text-muted">Rethinker · Phase 0</span>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {BLOCKS.map((b) => (
          <div key={b.title}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="font-heading text-[16px] font-semibold text-fg -tracking-[0.01em]">
                {b.title}
              </span>
              <span className="font-ui text-[10px] uppercase tracking-[0.12em] text-muted">
                {b.note}
              </span>
            </div>
            <LoadMeter lanes={b.lanes} />
          </div>
        ))}
      </div>

      {/* Legend — the load bar encodes a lot, so it earns a key. */}
      <div className="px-4 py-3 border-t border-line flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Reading the bar
        </span>
        {LEGEND.map((l) => (
          <span key={l.kind} className="inline-flex items-center gap-1.5">
            <span className="w-6 shrink-0">
              <LoadTrack segments={[{ kind: l.kind, pct: 100 }]} height={11} />
            </span>
            <span className="font-ui text-[11px] text-dim">{l.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
