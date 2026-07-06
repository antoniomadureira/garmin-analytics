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
 * Baseline = média dos dias ANTERIORES ao último (exclui hoje para não
 * ser auto-referencial). Janela determinada pelo chamador (usar 30d).
 */
export function computeHrvDeviation(wellness: { hrv: number | null }[]): HrvDeviationResult {
  const latest = wellness.length ? wellness[wellness.length - 1] : null;
  const hrv = latest?.hrv ?? null;
  const prevEntries = wellness.slice(0, -1);
  const vals = prevEntries.map((w) => w.hrv).filter((v): v is number => v !== null);
  const baseline = vals.length
    ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
    : null;
  const deltaPct = hrv !== null && baseline !== null ? computeHrvDeltaPct(hrv, baseline) : null;
  return { hrv, baseline, deltaPct };
}
