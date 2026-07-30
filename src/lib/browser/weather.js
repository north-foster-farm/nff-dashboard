import { useEffect, useState } from "react";

// Foster, RI.
const LAT = 41.7948;
const LON = -71.7515;
const CACHE_KEY = "nff-weather-cache-v3";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Map Open-Meteo WMO codes → short conditions label. Reference:
// https://open-meteo.com/en/docs (search "WMO Weather interpretation codes").
export function describeCode(code) {
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

// "HH:MM" → minutes since midnight, ceiled up to the next half-hour mark
// (or kept exactly if already :00 / :30). Examples: 18:34 → 19:00,
// 18:01 → 18:30, 18:30 → 18:30. Returns "HH:MM".
export function roundUpToHalfHour(hhmm) {
  if (!hhmm) return null;
  let [h, m] = hhmm.split(":").map(Number);
  if (m === 0 || m === 30) {
    // already aligned
  } else if (m < 30) {
    m = 30;
  } else {
    m = 0;
    h = (h + 1) % 24;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Hook: fetch + cache the current weather payload. Returns { data, error }.
// data shape: { tempCurrent, tempHigh, tempLow, code, isDay, sunsetHHMM,
// sunriseHHMM }. Multiple components can use this hook in parallel — the
// localStorage cache deduplicates network calls within the TTL.
export function useCurrentWeather() {
  const [data, setData] = useState(() => readCache());
  const [error, setError] = useState(false);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${LAT}&longitude=${LON}` +
      "&current=temperature_2m,weather_code,is_day" +
      "&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset" +
      "&temperature_unit=fahrenheit" +
      "&timezone=America%2FNew_York" +
      "&forecast_days=1";
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error("weather fetch failed")))
      .then(j => {
        if (cancelled) return;
        // Open-Meteo returns sunrise/sunset as ISO strings like
        // "2026-05-04T05:42". Strip to HH:MM.
        const isoToHHMM = (iso) => {
          if (!iso) return null;
          const t = iso.split("T")[1];
          return t ? t.slice(0, 5) : null;
        };
        const payload = {
          tempCurrent: Math.round(j.current?.temperature_2m ?? NaN),
          tempHigh: Math.round(j.daily?.temperature_2m_max?.[0] ?? NaN),
          tempLow: Math.round(j.daily?.temperature_2m_min?.[0] ?? NaN),
          code: j.current?.weather_code ?? null,
          isDay: j.current?.is_day === 1,
          sunriseHHMM: isoToHHMM(j.daily?.sunrise?.[0]),
          sunsetHHMM: isoToHHMM(j.daily?.sunset?.[0]),
        };
        setData(payload);
        writeCache(payload);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [data]);

  return { data, error };
}
