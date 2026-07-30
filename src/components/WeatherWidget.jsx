import { useMemo } from "react";
import { CloudSun, Thermometer, ArrowUp, ArrowDown } from "lucide-react";
import { useCurrentWeather, describeCode } from "../lib/browser/weather.js";

// Dashboard card: today's weather + day-of-week. Designed to slot into the
// dashboard alongside the Schedule / Upcoming chores cards.
export default function CurrentConditionsCard() {
  const { data, error } = useCurrentWeather();
  // CSS `text-transform: uppercase` does the casing — keep the source string
  // mixed-case so it's accessible / copy-paste-friendly.
  const dateLabel = useMemo(
    () => new Date()
      .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    []
  );

  return (
    <section className="bg-surface border border-line py-[18px] px-5">
      <header className="flex items-baseline gap-2.5 mb-3.5">
        <CloudSun size={15} className="text-dim translate-y-0.5" />
        <div className="font-ui text-xs text-fg uppercase tracking-[0.14em] font-bold">
          Current conditions
        </div>
      </header>
      {error || !data ? (
        <div className="text-xs text-dim italic">
          {error ? "Weather offline." : "Loading weather…"}
        </div>
      ) : (
        <ConditionsRow data={data} dateLabel={dateLabel} />
      )}
    </section>
  );
}

function ConditionsRow({ data, dateLabel }) {
  const label = describeCode(data.code);
  const labelClass = "font-ui text-[11px] text-fg uppercase tracking-[0.14em] font-normal";
  return (
    <div
      title={`${label} · ${data.tempCurrent}° (H ${data.tempHigh}° / L ${data.tempLow}°)`}
      className="flex items-center justify-between flex-wrap gap-y-2 gap-x-4 [font-variant-numeric:tabular-nums] text-fg"
    >
      <span className="inline-flex items-center flex-wrap gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <Thermometer size={13} className="text-dim" />
          <span className="font-bold text-xs">{data.tempCurrent}°</span>
        </span>
        <span className="inline-flex items-center gap-1 text-dim">
          <ArrowUp size={13} className="text-dim" />
          <span className="text-xs">{data.tempHigh}°</span>
        </span>
        <span className="inline-flex items-center gap-1 text-dim">
          <ArrowDown size={13} className="text-dim" />
          <span className="text-xs">{data.tempLow}°</span>
        </span>
        {" · "}
        <span className={labelClass}>{label}</span>
      </span>
      <span className={labelClass}>{dateLabel}</span>
    </div>
  );
}
