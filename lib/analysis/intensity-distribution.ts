/** Limiar de % fácil para considerar a semana equilibrada (80/20). */
export const EASY_OK_THRESHOLD = 75;
/** Abaixo deste limiar a semana está "no cinzento"; abaixo de 60 = alerta. */
export const EASY_CAUTION_THRESHOLD = 60;
/** Tempo total em zonas abaixo do qual as percentagens são estatisticamente ruidosas. */
export const LOW_VOLUME_SECONDS = 2 * 3600; // 2 horas

export interface IntensityBuckets {
  easySec: number;      // Z1 + Z2 (índices 0+1 do array ICU)
  moderateSec: number;  // Z3 (índice 2)
  strongSec: number;    // Z4 + Z5 + Z6 + Z7 (índices 3-6)
  totalSec: number;     // Z1..Z7 (soma de todos os índices 0-6)
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
 *
 * [Certo] O array ICU é 0-indexado: zones[0]=Z1, zones[1]=Z2, …, zones[6]=Z7.
 * Não existe "Z0 abaixo de Z1" — o índice 0 É Z1. Confirmado nos dados reais
 * de 21-22/07/2026: 4955+4081s de corrida Z1 estavam no índice 0.
 *
 * durationSec é usado apenas para lowVolume (segurança quando as zonas não
 * somam a totalidade da duração — ex: dropouts de GPS).
 */
export function aggregateIntensity(
  activities: Array<{ zoneSeconds: number[]; durationSec?: number }>,
): IntensityBuckets {
  let easySec = 0;
  let moderateSec = 0;
  let strongSec = 0;
  let totalDurationSec = 0;

  for (const { zoneSeconds, durationSec } of activities) {
    easySec += (zoneSeconds[0] ?? 0) + (zoneSeconds[1] ?? 0);   // Z1 + Z2
    moderateSec += zoneSeconds[2] ?? 0;                           // Z3
    strongSec +=
      (zoneSeconds[3] ?? 0) + (zoneSeconds[4] ?? 0) +
      (zoneSeconds[5] ?? 0) + (zoneSeconds[6] ?? 0);             // Z4-Z7
    totalDurationSec += durationSec ?? 0;
  }

  const totalSec = easySec + moderateSec + strongSec;
  // lowVolume: usa durationSec quando disponível; fallback para totalSec
  const weekDurationSec = totalDurationSec > 0 ? totalDurationSec : totalSec;
  const lowVolume = weekDurationSec < LOW_VOLUME_SECONDS;

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
