/**
 * [Certo] Indicador visual de frescura dos dados — verde = dados reais
 * (Freddy), vermelho = dados de exemplo (fallback). Sem texto visível;
 * o detalhe do erro fica só no `title` (tooltip ao passar o rato).
 */
export function DataFreshnessDot({ isReal, error }: { isReal: boolean; error?: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${isReal ? "bg-emerald-400" : "bg-red-500"}`}
      title={isReal ? "Dados reais (Freddy)" : `Dados de exemplo${error ? `: ${error.slice(0, 150)}` : ""}`}
    />
  );
}
