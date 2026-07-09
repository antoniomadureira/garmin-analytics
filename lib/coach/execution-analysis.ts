import { kv } from "@/lib/redis";
import type { PrescribedWorkout, WorkoutExecution } from "@/lib/types/coach";
import { trackDate } from "@/lib/coach/prescription-store";

const TTL = 90 * 24 * 3600; // 90 dias

// ─── Aerobic decoupling ──────────────────────────────────────────────────────

const MIN_VALID_SAMPLES = 20;

/**
 * Decoupling aeróbico = queda na eficiência cardiovascular (EF = speed/HR)
 * da 1ª para a 2ª metade. Positivo = deriva cardíaca.
 * Retorna null se há menos de MIN_VALID_SAMPLES amostras válidas.
 */
export function computeAeroDecoupling(
  series: Array<{ paceMinPerKm: number | null; hr: number | null }>,
): number | null {
  const valid = series.filter(
    (s): s is { paceMinPerKm: number; hr: number } =>
      s.paceMinPerKm !== null && s.paceMinPerKm > 0 && s.hr !== null && s.hr > 0,
  );
  if (valid.length < MIN_VALID_SAMPLES) return null;

  const mid = Math.floor(valid.length / 2);
  const ef = (half: typeof valid) => {
    // speed (m/s) = 1000 / (pace_min_per_km × 60)
    const avgSpeed = half.reduce((s, p) => s + 1000 / (p.paceMinPerKm * 60), 0) / half.length;
    const avgHr = half.reduce((s, p) => s + p.hr, 0) / half.length;
    return avgSpeed / avgHr;
  };

  const ef1 = ef(valid.slice(0, mid));
  const ef2 = ef(valid.slice(mid));
  if (ef1 === 0) return null;

  return Math.round(((ef1 - ef2) / ef1) * 1000) / 10; // 1 decimal
}

// ─── Continuity heuristic ────────────────────────────────────────────────────

/**
 * Verifica se o pace indica treino contínuo via CV.
 * Usa médias de janelas de ~3min quando há ≥3 janelas completas; amostras
 * brutas caso contrário (treinos curtos ou streams de baixa resolução).
 * [Suposição] Limiar CV=0.15 separa treino contínuo de intervalado.
 */
export function isPaceContinuous(validPaces: number[], cvThreshold = 0.15): boolean {
  if (validPaces.length < 10) return false;

  // Central 80% — ignora variações de pace do aquecimento/arrefecimento
  const start = Math.floor(validPaces.length * 0.1);
  const end = Math.ceil(validPaces.length * 0.9);
  const central = validPaces.slice(start, end);
  if (central.length < 5) return false;

  const windowSize = 180; // ~3 min @ 1Hz
  const windowCount = Math.floor(central.length / windowSize);
  const values =
    windowCount >= 3
      ? Array.from({ length: windowCount }, (_, i) => {
          const w = central.slice(i * windowSize, (i + 1) * windowSize);
          return w.reduce((a, b) => a + b, 0) / w.length;
        })
      : central;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return false;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean < cvThreshold;
}

// ─── Build + compare vs prescription ────────────────────────────────────────

export interface BuildExecutionParams {
  date: string;
  distanceKm: number;
  durationSec: number;
  avgHrBpm: number | null;
  series: Array<{ paceMinPerKm: number | null; hr: number | null }>;
  prescription: PrescribedWorkout | null;
}

export function buildExecutionAnalysis(params: BuildExecutionParams): WorkoutExecution {
  const { date, distanceKm, durationSec, avgHrBpm, series, prescription } = params;

  const validPace = series.filter(
    (s): s is { paceMinPerKm: number; hr: number | null } =>
      s.paceMinPerKm !== null && s.paceMinPerKm > 0,
  );
  const avgPaceMinPerKm =
    validPace.length > 0
      ? validPace.reduce((s, p) => s + p.paceMinPerKm, 0) / validPace.length
      : null;

  // Guardrail: decoupling só é válido para treino contínuo
  // — prescrição com reps > 1 → matchedBlocks false, sem decoupling
  // — sem prescrição → só calcula se CV de pace indicar esforço contínuo
  const hasIntervals = prescription?.sections.some((s) => s.reps > 1) ?? false;
  let aeroDecouplingPct: number | null = null;
  let matchedBlocks: boolean | null = null;

  if (hasIntervals) {
    matchedBlocks = false; // prescrição com repetições → não verificado sem dados de laps
  } else if (prescription) {
    // Prescrição contínua — verifica também a execução: atleta pode ter feito intervalos
    if (isPaceContinuous(validPace.map((s) => s.paceMinPerKm))) {
      aeroDecouplingPct = computeAeroDecoupling(series);
    }
  } else {
    if (isPaceContinuous(validPace.map((s) => s.paceMinPerKm))) {
      aeroDecouplingPct = computeAeroDecoupling(series);
    }
  }

  // Distância total prescrita = soma de distâncias × reps
  const prescribedDistanceM = prescription
    ? (() => {
        const total = prescription.sections.reduce(
          (sum, sec) =>
            sum + sec.steps.reduce((s2, step) => s2 + (step.distanceM ?? 0) * sec.reps, 0),
          0,
        );
        return total > 0 ? total : null;
      })()
    : null;

  const distanceDeltaM =
    prescribedDistanceM !== null ? Math.round(distanceKm * 1000 - prescribedDistanceM) : null;

  const prescribedDurationSec = prescription?.totalDurationSec ?? null;
  const durationDeltaSec =
    prescribedDurationSec !== null ? Math.round(durationSec - prescribedDurationSec) : null;

  let paceVsTargetSecPerKm: number | null = null;
  if (avgPaceMinPerKm !== null && prescription?.mainPace) {
    const targetMid =
      (prescription.mainPace.minSecPerKm + prescription.mainPace.maxSecPerKm) / 2;
    paceVsTargetSecPerKm = Math.round(avgPaceMinPerKm * 60 - targetMid);
  }

  return {
    date,
    distanceKm,
    durationSec,
    avgPaceMinPerKm,
    avgHrBpm,
    aeroDecouplingPct,
    distanceDeltaM,
    durationDeltaSec,
    paceVsTargetSecPerKm,
    matchedBlocks,
  };
}

// ─── Redis persistence ───────────────────────────────────────────────────────

export async function saveExecution(date: string, analysis: WorkoutExecution): Promise<void> {
  await Promise.all([
    kv.set(`coach:executed:${date}`, analysis, { ex: TTL }),
    trackDate(date),
  ]);
}

export async function loadExecution(date: string): Promise<WorkoutExecution | null> {
  return kv.get<WorkoutExecution>(`coach:executed:${date}`);
}
