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
 * Returns human-readable alert strings when sustained patterns are detected
 * over the provided nights. Uses scalars (deepSec/remSec/awakeSec), not
 * phaseBlocks — works even for nights where sleepLevelsMap is absent.
 * Returns [] when no thresholds are exceeded.
 */
export function computeSleepAlerts(
  nights: { deepSec: number; remSec: number; awakeSec: number }[]
): string[] {
  const alerts: string[] = [];

  if (nights.filter((n) => n.deepSec < DEEP_LOW_SEC).length >= NIGHTS_THRESHOLD) {
    alerts.push("sono profundo consistentemente baixo — rever horário/álcool/ecrãs");
  }
  if (nights.filter((n) => n.remSec < REM_LOW_SEC).length >= NIGHTS_THRESHOLD) {
    alerts.push("REM consistentemente baixo — rever horário/álcool/ecrãs");
  }
  if (nights.filter((n) => n.awakeSec > AWAKE_HIGH_SEC).length >= NIGHTS_THRESHOLD) {
    alerts.push("sono fragmentado — acordares frequentes durante a noite");
  }

  return alerts;
}
