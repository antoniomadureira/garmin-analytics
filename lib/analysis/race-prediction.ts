export interface RiegelResult {
  predictedMarathonSec: number;
  sourceLabel: string;    // "HM" | "15K" | "10K"
  sourceDate: string;     // YYYY-MM-DD when the source effort was recorded
}

/** T2 = T1 × (D2/D1)^1.06 — expoente empírico de Riegel (1977). */
export function riegelMarathon(distanceKm: number, durationSec: number): number {
  return Math.round(durationSec * Math.pow(42.195 / distanceKm, 1.06));
}

// Longest distances first — HM is a better marathon predictor than 5K.
const CANDIDATES = [
  { label: "HM", minKm: 19, maxKm: 23 },
  { label: "15K", minKm: 12, maxKm: 18 },
  { label: "10K", minKm: 8, maxKm: 12 },
] as const;

/**
 * Selects the best Riegel input from a list of Strava personal records.
 * Prefers longer distances; only considers records within maxAgeDays.
 * Returns null if no qualifying record exists.
 */
export function selectRiegelInput(
  records: { distanceKm: number; durationSec: number; date: string }[],
  maxAgeDays = 90,
): RiegelResult | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  for (const { label, minKm, maxKm } of CANDIDATES) {
    const candidates = records.filter(
      (r) => r.distanceKm >= minKm && r.distanceKm <= maxKm && r.date >= cutoffStr,
    );
    if (candidates.length === 0) continue;
    const best = candidates.reduce((a, b) => (a.durationSec < b.durationSec ? a : b));
    return {
      predictedMarathonSec: riegelMarathon(best.distanceKm, best.durationSec),
      sourceLabel: label,
      sourceDate: best.date,
    };
  }
  return null;
}
