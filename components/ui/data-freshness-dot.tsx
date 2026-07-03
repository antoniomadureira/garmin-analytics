/**
 * [Certo] Padrão excepção-apenas (mesmo método do painel Prontidão
 * Diária): quando os dados são reais, não renderiza NADA — verde
 * permanente é ruído a anunciar o estado esperado. Só aparece quando
 * algo falhou: linha âmbar discreta com o detalhe no tooltip.
 */
export function DataFreshnessDot({ isReal, error }: { isReal: boolean; error?: string }) {
  if (isReal) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] text-amber-500/80"
      title={`Dados de exemplo${error ? `: ${error.slice(0, 200)}` : ""}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
      dados de exemplo
    </span>
  );
}
