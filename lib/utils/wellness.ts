/**
 * Devolve o último registo de wellness com date < todayStr.
 * Tipicamente = ontem. O registo de hoje é excluído porque pode
 * ser contaminado por treinos planeados (push do coach ao Intervals.icu
 * altera ATL/TSB sem treino real feito).
 */
export function getPreviousDayWellness<T extends { date: string }>(
  wellness: T[],
  todayStr = new Date().toISOString().slice(0, 10),
): T | undefined {
  for (let i = wellness.length - 1; i >= 0; i--) {
    if (wellness[i].date < todayStr) return wellness[i];
  }
  return undefined;
}
