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

/**
 * Alias semântico de getPreviousDayWellness para todos os consumidores
 * de DECISÃO (readiness, carga de treino, recovery card, coach context).
 *
 * Porquê não usar o registo de hoje:
 * O coach faz push de treinos planeados ao Intervals.icu antes de
 * qualquer treino acontecer — isso altera ATL/TSB/CTL de HOJE sem que
 * haja carga real. O registo de hoje está contaminado por planeamento
 * futuro e é inapropriado para julgar prontidão ou fadiga actual.
 * O último registo com date < hoje (ontem) representa a carga real
 * acumulada e é a base correcta para decisões de treino.
 *
 * Acesso directo ao último elemento do array (wellness.at(-1)) fica
 * reservado a código que precisa explicitamente do registo de hoje —
 * se esse caso existir deve ser justificado com comentário.
 */
export function getDecisionWellness<T extends { date: string }>(
  wellness: T[],
  todayStr = new Date().toISOString().slice(0, 10),
): T | undefined {
  return getPreviousDayWellness(wellness, todayStr);
}
