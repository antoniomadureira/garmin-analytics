"use client";

/**
 * [Certo] Padrão de design correcto para indicadores de estado em
 * dashboards: só aparecem em EXCEPÇÃO. Três bolinhas verdes lado a lado
 * é ruído visual que comunica ansiedade ("porque há 3 estados?") sem
 * acrescentar informação — verde é o estado esperado, não precisa de
 * anúncio. Quando tudo está bem: nada. Quando algo falha: um único
 * aviso âmbar discreto com o detalhe no tooltip.
 */
export function StatusSummary({ sources }: { sources: { label: string; isReal: boolean; error?: string }[] }) {
  const failed = sources.filter((s) => !s.isReal);
  if (failed.length === 0) return null;

  const title = failed
    .map((f) => `${f.label}: ${f.error ?? "dados de exemplo"}`)
    .join("\n");

  return (
    <div
      className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-amber-500/80"
      title={title}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
      {failed.length === sources.length
        ? "Dados de exemplo — fontes indisponíveis"
        : `${failed.length} de ${sources.length} fontes indisponíveis`}
    </div>
  );
}
