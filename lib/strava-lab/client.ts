/**
 * [Certo] Consome a API do strava-lab (https://strava-lab.vercel.app),
 * uma app separada e independente, já validada end-to-end (OAuth, lock
 * distribuído no Upstash, endpoint protegido por chave). Este ficheiro
 * não faz OAuth nenhum — só chama o endpoint já pronto com a chave
 * partilhada.
 */
export interface StravaLabShoe {
  id: string;
  name: string;
  brand: string;
  model: string;
  distanceKm: number;
  retired: boolean;
}

export interface StravaLabActivity {
  id: string;
  name: string;
  date: string;
  distanceKm: number;
  durationSec: number;
  kudosCount: number;
  achievementCount: number;
  prCount: number;
}

export interface StravaLabActivityDetail {
  segmentEfforts: { segmentName: string; distanceM: number; elapsedTimeSec: number; elevGainM: number }[];
  bestEfforts: { label: string; seconds: number }[];
  prCount: number;
}

function baseUrl(): string {
  const url = process.env.STRAVA_LAB_API_URL;
  if (!url) throw new Error("STRAVA_LAB_API_URL não configurado.");
  return url.replace(/\/$/, "");
}

async function fetchFromStravaLab<T>(path: string): Promise<T> {
  const apiKey = process.env.STRAVA_LAB_API_KEY;
  if (!apiKey) throw new Error("STRAVA_LAB_API_KEY não configurado.");

  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { "x-api-key": apiKey },
    // [Provável] sem cache — dados de calçado/atividades não mudam tão
    // depressa que precisem de ser sempre frescos ao segundo, mas para já
    // mantém-se simples e sem cache, igual ao resto da app.
  });
  if (!res.ok) {
    throw new Error(`Erro do strava-lab (${path}): ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as T & { error?: string; notConnected?: boolean };
  if (data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data;
}

export async function getShoesAndActivities(): Promise<{ shoes: StravaLabShoe[]; activities: StravaLabActivity[] }> {
  return fetchFromStravaLab<{ shoes: StravaLabShoe[]; activities: StravaLabActivity[] }>("/api/data?type=summary");
}

export async function getActivityDetailByStravaId(activityId: string): Promise<StravaLabActivityDetail> {
  return fetchFromStravaLab<StravaLabActivityDetail>(`/api/data?type=activity&id=${activityId}`);
}

/**
 * [Provável] Corresponder uma data do Garmin a uma atividade do Strava —
 * sistemas diferentes, sem ID partilhado. Escolhe a primeira atividade
 * Strava com a mesma data civil. Pode falhar com várias corridas no
 * mesmo dia em ambos os sistemas (mesma limitação já documentada noutros
 * sítios da app para o mesmo cenário).
 */
export async function findStravaActivityIdByDate(date: string): Promise<string | null> {
  const { activities } = await getShoesAndActivities();
  const match = activities.find((a) => a.date === date);
  return match?.id ?? null;
}
