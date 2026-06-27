/**
 * [Certo] Substitui o texto "● dados reais (Freddy)" / "dados de exemplo"
 * por um indicador visual simples: verde = dados reais e atualizados,
 * vermelho = dados de exemplo (fallback). O detalhe do erro fica só no
 * `title` (tooltip ao passar o rato), não no texto visível.
 */
export function DataFreshnessDot({ isReal, error }: { isReal: boolean; error?: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${isReal ? "bg-emerald-400" : "bg-red-500"}`}
      title={isReal ? "Dados reais (Freddy)" : `Dados de exemplo${error ? `: ${error.slice(0, 150)}` : ""}`}
    />
  );
}
