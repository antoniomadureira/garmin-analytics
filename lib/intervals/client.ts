/**
 * [Certo] Endpoint e autenticação confirmados na documentação/fórum
 * oficial do Intervals.icu: POST /api/v1/athlete/{id}/events, Basic Auth
 * com username "API_KEY" e password = chave pessoal do utilizador
 * (gerada em intervals.icu > Settings > Developer Settings). Esta é uma
 * chamada DIRETA à API do Intervals.icu, separada do Freddy MCP (que só
 * lê dados, não escreve treinos).
 */
const INTERVALS_API_BASE = "https://intervals.icu/api/v1";

export interface PushWorkoutResult {
  id: number;
  url: string;
}

export async function pushWorkoutToIntervals(params: {
  name: string;
  description: string;
  dateStr: string; // YYYY-MM-DD
  durationSec?: number;
}): Promise<PushWorkoutResult> {
  const apiKey = process.env.INTERVALS_ICU_API_KEY;
  const athleteId = process.env.INTERVALS_ICU_ATHLETE_ID;
  if (!apiKey || !athleteId) {
    throw new Error("INTERVALS_ICU_API_KEY/INTERVALS_ICU_ATHLETE_ID não configurados.");
  }

  const auth = Buffer.from(`API_KEY:${apiKey}`).toString("base64");
  const res = await fetch(`${INTERVALS_API_BASE}/athlete/${athleteId}/events`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      category: "WORKOUT",
      type: "Run",
      start_date_local: `${params.dateStr}T00:00:00`,
      name: params.name,
      description: params.description,
      ...(params.durationSec ? { moving_time: params.durationSec } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Falha ao criar treino no Intervals.icu: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: number };
  return { id: data.id, url: `https://intervals.icu/calendar` };
}

// [Suposição] Shape baseado na documentação da comunidade do Intervals.icu.
// A secção "pace" pode estar ausente se o atleta não configurou zonas de
// corrida; tratado defensivamente como resultado vazio.
export interface IcuPaceZone {
  id: number;
  name: string;
  // [Suposição] min = extremo rápido (menor seg/km), max = extremo lento
  // (maior seg/km), consistente com a convenção matemática onde min < max.
  minSecPerKm: number | null;
  maxSecPerKm: number | null;
}

export interface IcuPaceZones {
  thresholdSecPerKm: number | null;
  zones: IcuPaceZone[];
}

export async function getIcuPaceZones(): Promise<IcuPaceZones> {
  const apiKey = process.env.INTERVALS_ICU_API_KEY;
  const athleteId = process.env.INTERVALS_ICU_ATHLETE_ID;
  if (!apiKey || !athleteId)
    throw new Error("INTERVALS_ICU_API_KEY/INTERVALS_ICU_ATHLETE_ID não configurados.");

  const auth = Buffer.from(`API_KEY:${apiKey}`).toString("base64");
  const res = await fetch(`${INTERVALS_API_BASE}/athlete/${athleteId}/zones`, {
    headers: { Authorization: `Basic ${auth}` },
    next: { revalidate: 3600 }, // zonas raramente mudam
  });
  if (!res.ok) throw new Error(`ICU zones: ${res.status}`);

  const data = (await res.json()) as {
    pace?: {
      threshold?: number | null;
      zones?: Array<{ id?: number; name?: string; min?: number | null; max?: number | null }>;
    };
  };

  const paceData = data?.pace;
  if (!paceData?.zones?.length) return { thresholdSecPerKm: null, zones: [] };

  return {
    thresholdSecPerKm: paceData.threshold ?? null,
    zones: paceData.zones.map((z, i) => ({
      id: z.id ?? i + 1,
      name: z.name ?? `Z${i + 1}`,
      minSecPerKm: z.min ?? null,
      maxSecPerKm: z.max ?? null,
    })),
  };
}
