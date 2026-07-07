export interface PrescribedStep {
  label: string;
  durationSec?: number;
  distanceM?: number;
  /** Pace mais rápido do alvo (sec/km) — ex: 3:50/km → 230 */
  paceMin?: number;
  /** Pace mais lento do alvo (sec/km) — ex: 4:00/km → 240 */
  paceMax?: number;
  /** Extremo superior do alvo de HR em % (ex: "65-70% HR" → 70) */
  hrCeilingPct?: number;
  zone?: string; // "Z1", "Z2", ...
}

export interface PrescribedSection {
  name: string;
  reps: number; // 1 para secções simples, N para "Nx"
  steps: PrescribedStep[];
}

export interface PrescribedWorkout {
  name: string;
  sections: PrescribedSection[];
  /** Soma de todas as durações × reps; null quando só há passos de distância */
  totalDurationSec: number | null;
  /** Alvo de pace da secção principal (1ª passo com pace explícito) */
  mainPace: { minSecPerKm: number; maxSecPerKm: number } | null;
}

export interface WorkoutExecution {
  date: string;
  distanceKm: number;
  durationSec: number;
  avgPaceMinPerKm: number | null;
  avgHrBpm: number | null;
  aeroDecouplingPct: number | null;
  // vs prescrição (null quando não há prescrição)
  distanceDeltaM: number | null;
  durationDeltaSec: number | null;
  /** Pace real (sec/km) − ponto médio do alvo; negativo = mais rápido que o prescrito */
  paceVsTargetSecPerKm: number | null;
  /** null em v1 (sem matching lap-a-lap) */
  matchedBlocks: boolean | null;
}
