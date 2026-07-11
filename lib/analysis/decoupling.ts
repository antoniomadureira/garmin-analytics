// Interpretação do decoupling aeróbico em linguagem natural.
// Texto gerado por limiares em código — nunca pelo LLM.

const DECOUPLING_THRESHOLDS = {
  STABLE: 5,   // < → controlo aeróbico sólido
  MODERATE: 8, // <= → algum drift; > → drift acentuado
} as const;

export function decouplingInterpretation(pct: number): string {
  if (pct < DECOUPLING_THRESHOLDS.STABLE)
    return "controlo aeróbico sólido no longo";
  if (pct <= DECOUPLING_THRESHOLDS.MODERATE)
    return "algum drift — base aeróbica a consolidar";
  return "drift acentuado — treino longo demais para a forma atual, ou desidratação/calor";
}
