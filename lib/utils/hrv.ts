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
