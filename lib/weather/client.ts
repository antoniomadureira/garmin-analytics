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
}

const DEFAULT_LAT = 41.5454; // Braga
const DEFAULT_LON = -8.4265;

export async function getTodayWeather(): Promise<TodayWeather> {
  const lat = process.env.WEATHER_LAT ?? String(DEFAULT_LAT);
  const lon = process.env.WEATHER_LON ?? String(DEFAULT_LON);

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
  };
}

/**
 * Classifica o impacto do tempo no treino de corrida.
 * [Provável] Limiares baseados em consenso da literatura de fisiologia
 * do exercício: performance degrada-se de forma mensurável acima de
 * ~25°C; acima de 32°C treinos intensos tornam-se arriscados. Frio
 * extremo (<0°C) e vento forte (>40km/h) também condicionam.
 */
export function classifyWeatherImpact(w: TodayWeather): {
  level: "ok" | "caution" | "warning";
  message: string | null;
} {
  if (w.tempMaxC >= 32) {
    return {
      level: "warning",
      message: `${w.tempMaxC}°C hoje — calor extremo. Treina de manhã cedo ou à noite, reduz intensidade, reforça hidratação.`,
    };
  }
  if (w.tempMaxC >= 26) {
    return {
      level: "caution",
      message: `${w.tempMaxC}°C hoje — calor. Prefere horas frescas e ajusta o pace (~10-20s/km mais lento é normal).`,
    };
  }
  if (w.tempMaxC <= 0) {
    return {
      level: "caution",
      message: `${w.tempMaxC}°C hoje — frio. Aquecimento mais longo e camadas.`,
    };
  }
  if (w.windMaxKmh >= 40) {
    return {
      level: "caution",
      message: `Vento forte hoje (${w.windMaxKmh}km/h) — considera percurso protegido.`,
    };
  }
  if (w.precipProbMaxPct >= 80) {
    return {
      level: "caution",
      message: `${w.precipProbMaxPct}% de probabilidade de chuva — piso escorregadio, ajusta o calçado.`,
    };
  }
  return { level: "ok", message: null };
}
