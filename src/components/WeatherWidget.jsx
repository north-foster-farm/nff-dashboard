import { useEffect, useMemo, useState } from "react";
import { CloudSun, Thermometer, ArrowUp, ArrowDown } from "lucide-react";
import { T } from "../theme.js";

// Foster, RI.
const LAT = 41.7948;
const LON = -71.7515;
const CACHE_KEY = "nff-weather-cache-v2";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Map Open-Meteo WMO codes → short conditions label. Reference:
// https://open-meteo.com/en/docs (search "WMO Weather interpretation codes").
function describeCode(code) {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunder";
  return "—";
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.fetchedAt !== "number") return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeCache(payload) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), payload })
    );
  } catch {}
}

// Hook: fetch + cache the current weather payload. Returns { data, error }.
function useCurrentWeather() {
  const [data, setData] = useState(() => readCache());
  const [error, setError] = useState(false);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=1`;
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error("weather fetch failed")))
      .then(j => {
        if (cancelled) return;
        const payload = {
          tempCurrent: Math.round(j.current?.temperature_2m ?? NaN),
          tempHigh: Math.round(j.daily?.temperature_2m_max?.[0] ?? NaN),
          tempLow: Math.round(j.daily?.temperature_2m_min?.[0] ?? NaN),
          code: j.current?.weather_code ?? null,
          isDay: j.current?.is_day === 1
        };
        setData(payload);
        writeCache(payload);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [data]);

  return { data, error };
}

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

  // Card icon matches the rest of the dashboard cards (small icon left of an
  // uppercase title). CloudSun reads as "weather" at small sizes.
  return (
    <section style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      padding: "18px 20px"
    }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <CloudSun size={15} color={T.textDim} style={{ transform: "translateY(2px)" }} />
        <div style={{
          fontFamily: T.uiLabel, fontSize: 12, color: T.text,
          textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700
        }}>
          Current conditions
        </div>
      </header>
      {error || !data ? (
        <div style={{ fontSize: 12, color: T.textDim, fontStyle: "italic" }}>
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
  const labelStyle = {
    fontFamily: T.uiLabel, fontSize: 11, color: T.text,
    textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 400
  };
  return (
    <div
      title={`${label} · ${data.tempCurrent}° (H ${data.tempHigh}° / L ${data.tempLow}°)`}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "8px 16px",
        fontVariantNumeric: "tabular-nums",
        color: T.text
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Thermometer size={13} color={T.textDim} />
          <span style={{ fontWeight: 700, fontSize: 12 }}>{data.tempCurrent}°</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.textDim }}>
          <ArrowUp size={13} color={T.textDim} />
          <span style={{ fontSize: 12 }}>{data.tempHigh}°</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.textDim }}>
          <ArrowDown size={13} color={T.textDim} />
          <span style={{ fontSize: 12 }}>{data.tempLow}°</span>
        </span>
        {" · "}
        <span style={labelStyle}>{label}</span>
      </span>
      <span style={labelStyle}>{dateLabel}</span>
    </div>
  );
}
