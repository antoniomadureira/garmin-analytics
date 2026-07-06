/**
 * [Certo] Open-Meteo: API meteorológica gratuita, sem API key, sem
 * registo — alinhada com a restrição de custo zero do projecto.
 * Docs: https://open-meteo.com/en/docs
 *
 * Localização por env vars WEATHER_LAT/WEATHER_LON, com default Braga
 * (base do utilizador). Cache de 30 min via next fetch revalidate.
 */

export interface TodayWeather {
  tempMaxC: number;
  tempMinC: number;
  tempNowC: number;
  humidityNowPct: number;
  windMaxKmh: number;
  precipProbMaxPct: number;
  locationName: string;
}

export interface AirQuality {
  europeanAqi: number;
  pm25: number;
  ozone: number;
}

// [Certo] Cadeia de localização: cookie geo (GPS do browser) → env vars
// (override manual) → geo-IP Vercel → Porto (último recurso).
// A cadeia é resolvida em page.tsx e chega aqui já resolvida em geo.lat/lon.
const DEFAULT_LAT = 41.1579; // Porto
const DEFAULT_LON = -8.6291;
const DEFAULT_LOCATION_NAME = "região do Porto";

export interface GeoHint {
  lat?: string | null;
  lon?: string | null;
  city?: string | null;
  source?: string;
}

export async function getTodayWeather(geo?: GeoHint): Promise<TodayWeather> {
  const lat = geo?.lat ?? process.env.WEATHER_LAT ?? String(DEFAULT_LAT);
  const lon = geo?.lon ?? process.env.WEATHER_LON ?? String(DEFAULT_LON);
  const locationName = geo?.city
    ? decodeURIComponent(geo.city)
    : process.env.WEATHER_LOCATION_NAME ?? DEFAULT_LOCATION_NAME;

  console.log(JSON.stringify({ evt: "weather_geo", source: geo?.source ?? "default", lat, lon }));

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m` +
    `&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,precipitation_probability_max` +
    `&forecast_days=1&timezone=auto`;

  const res = await fetch(url, { next: { revalidate: 1800 } }); // cache 30 min
  if (!res.ok) throw new Error(`Open-Meteo: ${res.status}`);
  const data = (await res.json()) as {
    current: { temperature_2m: number; relative_humidity_2m: number };
    daily: {
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      wind_speed_10m_max: number[];
      precipitation_probability_max: number[];
    };
  };

  return {
    tempMaxC: Math.round(data.daily.temperature_2m_max[0]),
    tempMinC: Math.round(data.daily.temperature_2m_min[0]),
    tempNowC: Math.round(data.current.temperature_2m),
    humidityNowPct: Math.round(data.current.relative_humidity_2m),
    windMaxKmh: Math.round(data.daily.wind_speed_10m_max[0]),
    precipProbMaxPct: Math.round(data.daily.precipitation_probability_max[0] ?? 0),
    locationName,
  };
}

/**
 * [Suposição] open-meteo air-quality API: europeanAqi é um índice 0-500
 * (boa < 20, boa→média < 40, média 40-60, má > 60). Valores acima de 80
 * implicam AQI "muito má" mas o threshold de decisão de treino mantém-se
 * em 60 (mesmo limiar da OMS para exposição moderada a PM2.5).
 */
export async function getAirQuality(lat: string, lon: string): Promise<AirQuality> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=european_aqi,pm2_5,ozone`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Open-Meteo AQ: ${res.status}`);
  const data = (await res.json()) as {
    current: { european_aqi: number; pm2_5: number; ozone: number };
  };
  return {
    europeanAqi: Math.round(data.current.european_aqi),
    pm25: Math.round(data.current.pm2_5 * 10) / 10,
    ozone: Math.round(data.current.ozone),
  };
}

/**
 * Classifica o impacto combinado de temperatura/vento/chuva e qualidade
 * do ar no treino de corrida. O nível mais severo dos dois prevalece;
 * as mensagens são concatenadas quando ambos têm algo a dizer.
 *
 * [Provável] Limiares de temperatura baseados em consenso da literatura
 * de fisiologia do exercício (>25°C degrada performance de forma mensurável,
 * >32°C torna treinos intensos arriscados). Limiares AQI seguem a escala
 * europeia da EEA (European Environment Agency).
 */
export function classifyWeatherImpact(
  w: TodayWeather,
  aq?: AirQuality | null,
): { level: "ok" | "caution" | "warning"; message: string | null } {
  // — Tempo —
  let weatherLevel: "ok" | "caution" | "warning" = "ok";
  let weatherMessage: string | null = null;

  if (w.tempMaxC >= 32) {
    weatherLevel = "warning";
    weatherMessage = `${w.tempMaxC}°C hoje — calor extremo. Treina de manhã cedo ou à noite, reduz intensidade, reforça hidratação.`;
  } else if (w.tempMaxC >= 26) {
    weatherLevel = "caution";
    weatherMessage = `${w.tempMaxC}°C hoje — calor. Prefere horas frescas e ajusta o pace (~10-20s/km mais lento é normal).`;
  } else if (w.tempMaxC <= 0) {
    weatherLevel = "caution";
    weatherMessage = `${w.tempMaxC}°C hoje — frio. Aquecimento mais longo e camadas.`;
  } else if (w.windMaxKmh >= 40) {
    weatherLevel = "caution";
    weatherMessage = `Vento forte hoje (${w.windMaxKmh}km/h) — considera percurso protegido.`;
  } else if (w.precipProbMaxPct >= 80) {
    weatherLevel = "caution";
    weatherMessage = `${w.precipProbMaxPct}% de probabilidade de chuva — piso escorregadio, ajusta o calçado.`;
  }

  // — Qualidade do ar —
  let aqLevel: "ok" | "caution" | "warning" = "ok";
  let aqMessage: string | null = null;

  if (aq) {
    if (aq.europeanAqi > 60) {
      aqLevel = "warning";
      aqMessage = `qualidade do ar má (AQI ${aq.europeanAqi}) — treino indoor ou adiar`;
    } else if (aq.europeanAqi >= 40) {
      aqLevel = "caution";
      aqMessage = `AQI ${aq.europeanAqi} — evita séries intensas, treino fácil ok`;
    }
  }

  // Merge: nível mais grave + mensagens combinadas
  const severity: Record<"ok" | "caution" | "warning", number> = { ok: 0, caution: 1, warning: 2 };
  const level: "ok" | "caution" | "warning" =
    severity[weatherLevel] >= severity[aqLevel] ? weatherLevel : aqLevel;
  const msgs = [weatherMessage, aqMessage].filter((m): m is string => m !== null);
  return { level, message: msgs.length > 0 ? msgs.join(" · ") : null };
}
