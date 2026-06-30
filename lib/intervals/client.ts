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
  return { id: data.id, url: `https://intervals.icu/calendar?eventId=${data.id}` };
}
