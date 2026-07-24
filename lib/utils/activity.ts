/** Mínimo de distância para uma atividade ser considerada treino real. */
export const MIN_REAL_ACTIVITY_KM = 1;

/**
 * Devolve a data ISO da atividade mais recente num array ordenado
 * asc por data, ou null se nenhuma entrada atingir MIN_REAL_ACTIVITY_KM.
 * Atividades fantasma (GPS ligado por engano, < 1 km) são ignoradas.
 */
export function getLastActivityDate(
  daily: Array<{ date: string; km: number }>,
): string | null {
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].km >= MIN_REAL_ACTIVITY_KM) return daily[i].date;
  }
  return null;
}
