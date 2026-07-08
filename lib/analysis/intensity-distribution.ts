/** Limiar de % fácil para considerar a semana equilibrada (80/20). */
export const EASY_OK_THRESHOLD = 75;
/** Abaixo deste limiar a semana está "no cinzento"; abaixo de 60 = alerta. */
export const EASY_CAUTION_THRESHOLD = 60;
/** Tempo total em zonas abaixo do qual as percentagens são estatisticamente ruidosas. */
export const LOW_VOLUME_SECONDS = 2 * 3600; // 2 horas

export interface IntensityBuckets {
  easySec: number;      // Z1 + Z2
  moderateSec: number;  // Z3
  strongSec: number;    // Z4 + Z5 + Z6
  totalSec: number;     // Z1..Z6 (Z0 excluído — abaixo de Z1)
  easyPct: number | null;
  moderatePct: number | null;
  strongPct: number | null;
  /** true quando totalSec < LOW_VOLUME_SECONDS — percentagens são ruído */
  lowVolume: boolean;
}

export interface WeeklyIntensityData extends IntensityBuckets {
  /** Segunda-feira da semana (YYYY-MM-DD) */
  weekStart: string;
  /** Rótulo compacto para o eixo X do gráfico (ex: "7/7") */
  weekLabel: string;
}

export type IntensityStatus = "ok" | "caution" | "alert";

/**
 * Agrega tempo em zonas HR de várias atividades em 3 baldes.
 * Cada atividade fornece zoneSeconds[0..6] em segundos.
 * Z0 excluído (abaixo de Z1 — aquecimento/transição sem esforço).
 */
export function aggregateIntensity(
  activities: Array<{ zoneSeconds: number[] }>,
): IntensityBuckets {
  let easySec = 0;
  let moderateSec = 0;
  let strongSec = 0;

  for (const { zoneSeconds } of activities) {
    easySec += (zoneSeconds[1] ?? 0) + (zoneSeconds[2] ?? 0);
    moderateSec += zoneSeconds[3] ?? 0;
    strongSec +=
      (zoneSeconds[4] ?? 0) + (zoneSeconds[5] ?? 0) + (zoneSeconds[6] ?? 0);
  }

  const totalSec = easySec + moderateSec + strongSec;
  const lowVolume = totalSec < LOW_VOLUME_SECONDS;

  return {
    easySec,
    moderateSec,
    strongSec,
    totalSec,
    easyPct: totalSec > 0 ? Math.round((easySec / totalSec) * 1000) / 10 : null,
    moderatePct:
      totalSec > 0 ? Math.round((moderateSec / totalSec) * 1000) / 10 : null,
    strongPct:
      totalSec > 0 ? Math.round((strongSec / totalSec) * 1000) / 10 : null,
    lowVolume,
  };
}

/**
 * Classifica a semana pelo % de tempo fácil.
 * Limiares em constantes nomeadas — não inline.
 */
export function getIntensityStatus(easyPct: number | null): IntensityStatus {
  if (easyPct === null || easyPct < EASY_CAUTION_THRESHOLD) return "alert";
  if (easyPct < EASY_OK_THRESHOLD) return "caution";
  return "ok";
}
