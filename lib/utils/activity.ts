/**
 * Devolve a data ISO da atividade mais recente num array ordenado
 * asc por data, ou null se nenhuma entrada tiver km > 0.
 */
export function getLastActivityDate(
  daily: Array<{ date: string; km: number }>,
): string | null {
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].km > 0) return daily[i].date;
  }
  return null;
}
