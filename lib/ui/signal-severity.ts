/**
 * Mapeamento de valores de sinais fisiológicos para severidade visual.
 * Limiares nomeados aqui; cores aplicadas via SEVERITY_TEXT no componente.
 */

export type SignalSeverity = "good" | "warn" | "bad";

export const SEVERITY_TEXT: Record<SignalSeverity, string> = {
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-red-400",
};

// HRV: delta em % vs baseline (positivo = acima da média = melhor)
export function hrvSeverity(pct: number): SignalSeverity {
  if (pct >= -5) return "good";   // dentro ou acima da média (±5%)
  if (pct >= -10) return "warn";  // ligeiramente abaixo
  return "bad";                    // abaixo de -10%
}

// FC Repouso: delta em bpm vs baseline (positivo = acima da média = pior)
export function rhrSeverity(deltaBpm: number): SignalSeverity {
  if (deltaBpm <= 2) return "good";
  if (deltaBpm <= 5) return "warn";
  return "bad";
}

// Body Battery: valor máximo do dia (%)
export function bodyBatterySeverity(maxPct: number): SignalSeverity {
  if (maxPct >= 70) return "good";
  if (maxPct >= 45) return "warn";
  return "bad";
}

// TSB: forma = fitness - fadiga (positivo = frescos, muito negativo = overreached)
export function tsbSeverity(tsb: number): SignalSeverity {
  if (tsb > 5) return "good";    // forma em ascensão
  if (tsb >= -10) return "warn"; // neutro / fadiga leve
  return "bad";                   // overreached
}
