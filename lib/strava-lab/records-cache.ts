import "server-only";
import { cache } from "react";
import { kv } from "@/lib/redis";
import { getPersonalRecords, getShoesAndActivities, type StravaLabRecord } from "./client";

const RECORDS_KEY = "stravalab:records:v1";
const LATEST_KEY = "stravalab:records:latest-activity";

// [Certo] cache() from React deduplicates across RSC instances in the same
// request — MonthlySection, StatsSection e RecordsSection partilham o
// resultado do summary sem um segundo pedido ao strava-lab.
export const getShoesAndActivitiesCached = cache(getShoesAndActivities);

export async function getCachedPersonalRecords(): Promise<StravaLabRecord[]> {
  const { activities } = await getShoesAndActivitiesCached();
  const latestId = activities[0]?.id ?? "";

  if (latestId) {
    const [cachedLatestId, cachedRecords] = await Promise.all([
      kv.get<string>(LATEST_KEY),
      kv.get<StravaLabRecord[]>(RECORDS_KEY),
    ]);
    if (cachedLatestId === latestId && Array.isArray(cachedRecords)) {
      return cachedRecords;
    }
  }

  const records = await getPersonalRecords();

  if (latestId) {
    // [Suposição] Dois sets independentes — pipeline não disponível no
    // cliente REST. Falha silenciosa: a próxima visita volta a buscar.
    try {
      await Promise.all([
        kv.set(RECORDS_KEY, records, { ex: 86400 }),
        kv.set(LATEST_KEY, latestId, { ex: 86400 }),
      ]);
    } catch { /* cache write failure */ }
  }

  return records;
}
