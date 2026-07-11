export interface RiegelResult {
  predictedMarathonSec: number;
  sourceLabel: "HM" | "10K" | "5K";
  sourceDate: string;     // YYYY-MM-DD when the source effort was recorded
}

/** T2 = T1 × (D2/D1)^1.06 — expoente empírico de Riegel (1977). */
export function riegelMarathon(distanceKm: number, durationSec: number): number {
  return Math.round(durationSec * Math.pow(42.195 / distanceKm, 1.06));
}

// Longest distances first — HM is a better marathon predictor than shorter efforts.
// 15K omitted: FreddyDataService.getPersonalRecords only tracks 5K/10K/HM/Marathon.
const CANDIDATES = [
  { label: "HM", minKm: 19, maxKm: 23 },
  { label: "10K", minKm: 8, maxKm: 12 },
  { label: "5K",  minKm: 4, maxKm: 6  },
] as const;

/**
 * Selects the best Riegel input from a list of personal records.
 *
 * Filtering:
 *  1. Record must be within maxAgeDays of today.
 *  2. Representativeness: pace must be < goalPace × 1.25 × 0.90.
 *     (goalPace × 1.25 ≈ Z2/easy pace; × 0.90 = clearly faster than easy → race effort).
 *     Eliminates controlled training runs logged at easy pace.
 *
 * Selection (from qualifying records):
 *  3. Prefer longest distance (HM > 10K > 5K) — better marathon predictor.
 *  4. Recency penalty: if the longest-distance effort is >45 days older than the
 *     next-longest, prefer the more recent one — better reflection of current form.
 *
 * Returns null when nothing qualifies (card should prompt for a control race).
 */
export function selectRiegelInput(
  records: { distanceKm: number; durationSec: number; date: string }[],
  maxAgeDays: number,
  goalMarathonSec: number,
  today: string = new Date().toISOString().slice(0, 10),
): RiegelResult | null {
  // Representativeness threshold: goal pace × 1.25 (Z2 proxy) × 0.90
  const goalPaceMinPerKm = goalMarathonSec / 60 / 42.195;
  const representativeThreshold = goalPaceMinPerKm * 1.25 * 0.90;

  const cutoff = new Date(`${today}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  type Candidate = { label: "HM" | "10K" | "5K"; distanceKm: number; durationSec: number; date: string };
  const qualified: Candidate[] = [];

  for (const { label, minKm, maxKm } of CANDIDATES) {
    const inWindow = records.filter((r) => {
      const paceMinPerKm = r.durationSec / 60 / r.distanceKm;
      return (
        r.distanceKm >= minKm &&
        r.distanceKm <= maxKm &&
        r.date >= cutoffStr &&
        paceMinPerKm < representativeThreshold
      );
    });
    if (inWindow.length === 0) continue;
    // Best = fastest (lowest durationSec for the distance)
    const best = inWindow.reduce((a, b) => (a.durationSec < b.durationSec ? a : b));
    qualified.push({ label, distanceKm: best.distanceKm, durationSec: best.durationSec, date: best.date });
  }

  if (qualified.length === 0) return null;

  // qualified is already HM→10K→5K (CANDIDATES order = longest first).
  // Recency penalty: if the top (longest distance) is >45 days older than the
  // next qualifier, swap — a recent 10K reflects current form better than an old HM.
  if (qualified.length >= 2) {
    const daysOlderThanNext = Math.round(
      (new Date(qualified[1].date).getTime() - new Date(qualified[0].date).getTime()) / 86_400_000,
    );
    if (daysOlderThanNext > 45) {
      [qualified[0], qualified[1]] = [qualified[1], qualified[0]];
    }
  }

  const winner = qualified[0];
  return {
    predictedMarathonSec: riegelMarathon(winner.distanceKm, winner.durationSec),
    sourceLabel: winner.label,
    sourceDate: winner.date,
  };
}
