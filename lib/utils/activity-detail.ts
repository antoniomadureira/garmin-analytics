/** Interface mínima necessária para a decisão de fetch. */
interface HasRichData {
  series: unknown[];
  samplesUnavailable: boolean;
}

/**
 * Determina se o ActivityDetailPanel precisa de fazer fetch ao Freddy
 * para dados ricos (series, route).
 *
 * - sem initialData → fetch obrigatório
 * - samplesUnavailable=true → confirmado sem amostras, fetch não ajuda
 * - series vazio + samplesUnavailable=false → cache stale ou dados em falta,
 *   fetch tentará obter dados frescos
 */
export function needsFreddyFetch(initialData?: HasRichData): boolean {
  if (!initialData) return true;
  if (initialData.samplesUnavailable) return false;
  return initialData.series.length === 0;
}
