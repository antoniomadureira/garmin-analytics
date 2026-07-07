/**
 * Percentagem de desvio do HRV face ao baseline, com 1 casa decimal.
 * Partilhada pelo contexto do coach e pelo card de readiness.
 */
export function computeHrvDeltaPct(hrv: number, baseline: number): number {
  return Math.round(((hrv - baseline) / baseline) * 1000) / 10;
}

export function formatHrvDeltaPct(hrv: number, baseline: number): string {
  const pct = computeHrvDeltaPct(hrv, baseline);
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export interface HrvDeviationResult {
  hrv: number | null;
  baseline: number | null;
  deltaPct: number | null;
}

/**
 * Fonte única de cálculo do desvio de HRV.
 * "Actual" = último entry COM hrv não-nulo — evita perder o sinal quando
 * hoje ainda não sincronizou (hrv: null) mas ontem tem valor.
 * Baseline = média dos entries ANTERIORES ao actual (não auto-referencial).
 * Janela determinada pelo chamador (usar 30d).
 */
export function computeHrvDeviation(wellness: { hrv: number | null }[]): HrvDeviationResult {
  // Walk backwards to find the most recent entry with a real HRV value
  let latestIdx = -1;
  for (let i = wellness.length - 1; i >= 0; i--) {
    if (wellness[i].hrv !== null) { latestIdx = i; break; }
  }
  if (latestIdx === -1) return { hrv: null, baseline: null, deltaPct: null };
  const hrv = wellness[latestIdx].hrv as number;
  const vals = wellness.slice(0, latestIdx).map((w) => w.hrv).filter((v): v is number => v !== null);
  const baseline = vals.length
    ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
    : null;
  const deltaPct = baseline !== null ? computeHrvDeltaPct(hrv, baseline) : null;
  return { hrv, baseline, deltaPct };
}
