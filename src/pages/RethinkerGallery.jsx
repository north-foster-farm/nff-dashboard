import {
  Eyebrow, LoadMeter, LoadTrack, NowRule, SealStamp, RoundsCheckbox,
  DaySilhouette, EventBand, NeedsCoverCard, ConfirmCard, SourceChangeStrip,
  BlockCard, SearchToAdd, OutboxIndicator, DesktopRibbon, WeekSpines,
} from "../components/rethinker/RethinkerKit.jsx";

// Rethinker port gallery — the mockup's components ported 1:1 into our
// architecture, so the whole pattern POOL sits next to our real
// components. The point is NOT to ship these; it's to study them here and
// map each onto our own schedule UI (DESIGN-SYSTEM.md). Best viewed in the
// DARK theme (we're matching the dark mockup first).
//
// Each specimen notes "→ maps to" — where in our app the pattern wants to
// land.

function Specimen({ n, title, mapsTo, wide = false, children }) {
  return (
    <div className={"border border-line bg-surface " + (wide ? "lg:col-span-2" : "")}>
      <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 border-b border-line">
        <span className="flex items-baseline gap-2.5 min-w-0">
          <Eyebrow className="text-faint text-[10px] shrink-0">{n}</Eyebrow>
          <span className="font-heading text-[16px] font-semibold text-fg truncate">{title}</span>
        </span>
        {mapsTo && (
          <span className="font-ui text-[11px] text-muted shrink-0">→ {mapsTo}</span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function RethinkerGallery() {
  return (
    <div className="max-w-[1120px] mx-auto pb-24">
      <div className="mb-2">
        <Eyebrow className="text-cat-fm">Design bracket · ported pool</Eyebrow>
      </div>
      <h2 className="font-heading text-[30px] font-bold text-fg leading-tight m-0">
        Rethinker — ported components
      </h2>
      <p className="text-[14px] text-dim mt-2 mb-7 max-w-[680px] leading-relaxed">
        Every component from the mockup, rebuilt in our architecture (React +
        our tokens). The pool we draw from to restyle the real Schedule —
        study each, then marry it to our own components. View in dark theme.
      </p>

      <div className="grid lg:grid-cols-2 gap-5">
        <Specimen n="01" title="Load-meter lane" mapsTo="block load / Rounds progress">
          <LoadMeter lanes={[
            { name: "Jim", meta: "2/8", segments: [
              { kind: "done", pct: 22 }, { kind: "committed", pct: 30 }, { kind: "open", pct: 26 }] },
            { name: "James", meta: "mkt", metaFaint: true, segments: [{ kind: "event", pct: 74 }] },
            { name: "James", meta: "hole", metaTone: "warn", segments: [
              { kind: "committed", pct: 34 }, { kind: "hole", pct: 30 }] },
          ]} />
        </Specimen>

        <Specimen n="02" title="Now-marker (hairline)" mapsTo="schedule 'now' divider">
          <NowRule label="NOW · 9:40A — FORWARD FOCUS" />
        </Specimen>

        <Specimen n="03" title="Needs-cover card" mapsTo="'Fill waterers needs cover' row">
          <NeedsCoverCard />
        </Specimen>

        <Specimen n="04" title="Confirm card" mapsTo="confirm-the-day banner">
          <ConfirmCard />
        </Specimen>

        <Specimen n="05" title="Source-change strip" mapsTo="'N changes since you confirmed'">
          <SourceChangeStrip />
        </Specimen>

        <Specimen n="06" title="Event band" mapsTo="event rows on the day">
          <EventBand title="Farmers market"
            time="9:00a"
            sub="Setup buffer reserved · James off-site → 1:00p · crates, cash-box" />
        </Specimen>

        <Specimen n="07" title="Block card — states" mapsTo="spine block cards">
          <div className="flex flex-col gap-2.5">
            <BlockCard name="Morning" state="sealed" />
            <BlockCard name="Midmorning" note="now" state="now">
              <LoadMeter lanes={[
                { name: "Jim", meta: "2/8", segments: [
                  { kind: "done", pct: 22 }, { kind: "committed", pct: 30 }, { kind: "open", pct: 26 }] },
              ]} />
            </BlockCard>
            <BlockCard name="Late afternoon" note="4 PM" />
          </div>
        </Specimen>

        <Specimen n="08" title="Rounds checkbox + seal" mapsTo="ChoreCheckRow / block seal">
          <div className="flex flex-col gap-3">
            <RoundsCheckbox defaultChecked label="Fill waterer" />
            <RoundsCheckbox label="Fill feeder" />
            <div className="pt-1"><SealStamp /></div>
          </div>
        </Specimen>

        <Specimen n="09" title="Day-load silhouette" mapsTo="day-bar / week mini-spines">
          <DaySilhouette blocks={[
            { title: "Morning", top: { kind: "done", h: 18 }, bottom: { kind: "done", h: 7 } },
            { title: "Midmorning", top: { kind: "committed", h: 21 }, bottom: { kind: "event", h: 14 } },
            { title: "Early afternoon", top: { kind: "committed", h: 24 }, bottom: { kind: "hole", h: 9 } },
            { title: "Late afternoon", top: { kind: "committed", h: 19 }, bottom: { kind: "committed", h: 13 } },
            { title: "End of day", top: { kind: "committed", h: 13 }, bottom: { kind: "committed", h: 13 } },
          ]} />
        </Specimen>

        <Specimen n="10" title="Segment legend" mapsTo="(reference key)">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {[["done", "done"], ["committed", "committed"], ["open", "open / should"],
              ["event", "event"], ["hole", "hole — needs cover"]].map(([kind, label]) => (
              <span key={kind} className="inline-flex items-center gap-1.5">
                <span className="w-6 shrink-0"><LoadTrack segments={[{ kind, pct: 100 }]} height={11} /></span>
                <span className="font-ui text-[11px] text-dim">{label}</span>
              </span>
            ))}
          </div>
        </Specimen>

        <Specimen n="11" title="Search-to-add" mapsTo="Add-chore / CommandPalette">
          <div className="max-w-[360px]"><SearchToAdd /></div>
        </Specimen>

        <Specimen n="12" title="Outbox indicator" mapsTo="offline / queued writes">
          <OutboxIndicator count={1} />
        </Specimen>

        <Specimen n="13" title="Desktop two-lane ribbon" mapsTo="desktop Schedule (wide tier)" wide>
          <DesktopRibbon />
        </Specimen>

        <Specimen n="14" title="Week mini-spines + should-heat" mapsTo="the week pane" wide>
          <WeekSpines />
        </Specimen>
      </div>
    </div>
  );
}
