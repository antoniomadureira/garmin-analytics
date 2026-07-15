interface SleepLevelInterval {
  startTimeInSeconds: number;
  endTimeInSeconds: number;
}

export interface SleepLevelsMap {
  rem?: SleepLevelInterval[];
  deep?: SleepLevelInterval[];
  awake?: SleepLevelInterval[];
  light?: SleepLevelInterval[];
}

export interface SleepPhaseBlock {
  phase: "deep" | "light" | "rem" | "awake";
  startOffsetSec: number;
  durationSec: number;
}

export interface SleepAlert {
  id: "deep_low" | "rem_low" | "fragmented";
  summary: string;
  detail: string;
}

const PHASE_ORDER: Array<SleepPhaseBlock["phase"]> = ["deep", "light", "rem", "awake"];

/**
 * Converts a Garmin sleepLevelsMap (absolute epoch intervals) into phase
 * blocks expressed as offsets from sleep onset. Returns null if there is no
 * interval data (empty map or missing field).
 */
export function parseSleepPhaseBlocks(
  startEpochSec: number | null | undefined,
  sleepLevelsMap: SleepLevelsMap | null | undefined
): SleepPhaseBlock[] | null {
  if (startEpochSec == null || !sleepLevelsMap) return null;

  const result: SleepPhaseBlock[] = [];
  for (const phase of PHASE_ORDER) {
    for (const interval of sleepLevelsMap[phase] ?? []) {
      result.push({
        phase,
        startOffsetSec: interval.startTimeInSeconds - startEpochSec,
        durationSec: interval.endTimeInSeconds - interval.startTimeInSeconds,
      });
    }
  }

  if (result.length === 0) return null;
  result.sort((a, b) => a.startOffsetSec - b.startOffsetSec);
  return result;
}

// Thresholds for deterministic alerts — NUNCA texto do LLM
const DEEP_LOW_SEC = 60 * 60;   // 60 min
const REM_LOW_SEC = 90 * 60;    // 90 min
const AWAKE_HIGH_SEC = 45 * 60; // 45 min
const NIGHTS_THRESHOLD = 3;

/**
 * Returns SleepAlert objects when sustained patterns are detected over the
 * provided nights. Uses scalars (deepSec/remSec/awakeSec), not phaseBlocks —
 * works even for nights where sleepLevelsMap is absent.
 * Each alert has: id for keying, summary (first line), detail (second sentence
 * with interpolated real averages). Returns [] when no thresholds are exceeded.
 */
export function computeSleepAlerts(
  nights: { deepSec: number; remSec: number; awakeSec: number }[]
): SleepAlert[] {
  if (nights.length === 0) return [];

  const n = nights.length;
  const avgDeepMin = Math.round(nights.reduce((s, x) => s + x.deepSec, 0) / n / 60);
  const avgRemMin = Math.round(nights.reduce((s, x) => s + x.remSec, 0) / n / 60);
  const avgAwakeMin = Math.round(nights.reduce((s, x) => s + x.awakeSec, 0) / n / 60);

  const alerts: SleepAlert[] = [];

  if (nights.filter((x) => x.deepSec < DEEP_LOW_SEC).length >= NIGHTS_THRESHOLD) {
    alerts.push({
      id: "deep_low",
      summary: "sono profundo consistentemente baixo — rever horário/álcool/ecrãs",
      detail: `Profundo médio ${avgDeepMin}min vs 60min recomendados — restaura músculo e sistema imunitário; ocorre nas primeiras horas. Ações: horário regular de deitar, temperatura do quarto amena, evitar exercício intenso 3h antes.`,
    });
  }
  if (nights.filter((x) => x.remSec < REM_LOW_SEC).length >= NIGHTS_THRESHOLD) {
    alerts.push({
      id: "rem_low",
      summary: "REM consistentemente baixo — rever horário/álcool/ecrãs",
      detail: `REM médio ${avgRemMin}min vs 90min recomendados — consolida memória e recuperação cognitiva; concentra-se no fim da noite, por isso acordar cedo corta-o primeiro. Ações: horário de deitar regular, evitar álcool 3h antes, e se possível +30min de sono total.`,
    });
  }
  if (nights.filter((x) => x.awakeSec > AWAKE_HIGH_SEC).length >= NIGHTS_THRESHOLD) {
    alerts.push({
      id: "fragmented",
      summary: "sono fragmentado — acordares frequentes durante a noite",
      detail: `Acordado médio ${avgAwakeMin}min por noite — fragmentação reduz profundo e REM das fases seguintes. Ações: rever ambiente (temperatura, ruído, luz), limitar líquidos 2h antes, investigar apneia se persistir.`,
    });
  }

  return alerts;
}
