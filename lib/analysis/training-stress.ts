/**
 * Ramp rate e monotonia/strain (Foster) para o card de carga e contexto do coach.
 *
 * Ramp rate: consumido diretamente do campo wellness.rampRate (Intervals.icu),
 * em unidades CTL/semana — não recalculado.
 *
 * Monotonia: usa wellness.atlLoad (impulso diário bruto do Intervals.icu),
 * que já contém 0 nos dias de descanso. Abordagem anterior (inverso EWMA do ATL)
 * foi abandonada: a fórmula ATL do Intervals.icu não é EWMA discreto k=7,
 * logo a inversão produzia L=16 em dias de descanso (devia ser 0) e L=290 no
 * dia mais antigo sem prev — monotonia impossível (10+).
 */

import type { WellnessDay } from "@/lib/freddy/metrics";

export type StressLevel = "ok" | "attention" | "alert";

export interface RampRateMetrics {
  current: number | null;
  /** null se sem dados suficientes */
  status: StressLevel | null;
}

export interface MonotonyMetrics {
  monotony: number | null;
  strain: number | null;
  weeklyAtlSum: number | null;
  status: StressLevel | null;
  /** <4 dias com carga > 0 → sem veredicto */
  lowData: boolean;
}

export interface WeeklyStressMetrics {
  rampRate: RampRateMetrics;
  monotony: MonotonyMetrics;
}

// ─── Ramp rate ───────────────────────────────────────────────────────────────

/**
 * Semáforo de ramp rate (CTL/semana):
 * <1.0 → ok; 1.0-1.5 → atenção; ≥1.5 sustentado 2+ semanas → alerta.
 * "Sustentado" = currentRampRate ≥1.5 E o valor de há ~7 dias também ≥1.5.
 */
export function computeRampRateStatus(
  current: number | null,
  weekAgo: number | null,
): StressLevel | null {
  if (current === null) return null;
  if (current < 1.0) return "ok";
  if (current >= 1.5 && weekAgo !== null && weekAgo >= 1.5) return "alert";
  return "attention";
}

// ─── Monotonia / Strain (Foster) ─────────────────────────────────────────────

/**
 * Recebe cargas diárias dos últimos N dias (zeros explícitos para descanso).
 * Retorna monotony, strain e lowData.
 */
export function computeMonotony(atlValues: number[]): {
  monotony: number | null;
  strain: number | null;
  weeklyAtlSum: number;
  lowData: boolean;
} {
  const nonZeroCount = atlValues.filter((v) => v > 0).length;
  const weeklyAtlSum = atlValues.reduce((s, v) => s + v, 0);

  if (atlValues.length < 7 || nonZeroCount < 4) {
    return { monotony: null, strain: null, weeklyAtlSum, lowData: true };
  }

  const n = atlValues.length;
  const mean = weeklyAtlSum / n;

  if (mean === 0) {
    return { monotony: null, strain: null, weeklyAtlSum: 0, lowData: true };
  }

  const variance = atlValues.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  // std === 0: semana perfeitamente uniforme → monotonia indefinida (sem dias de descanso)
  // Não deve ocorrer em treino real; se ocorrer, é claramente problemático
  const monotony = std === 0 ? null : Math.round((mean / std) * 100) / 100;
  const strain =
    monotony !== null ? Math.round(weeklyAtlSum * monotony * 10) / 10 : null;

  return { monotony, strain, weeklyAtlSum: Math.round(weeklyAtlSum * 10) / 10, lowData: false };
}

export function monotonyStatusLevel(monotony: number | null): StressLevel | null {
  if (monotony === null) return null;
  if (monotony > 2.5) return "alert";
  if (monotony > 2.0) return "attention";
  return "ok";
}

// ─── Combinação com wellness ──────────────────────────────────────────────────

/**
 * Computa ramp rate + monotonia a partir dos dados de wellness.
 * Usa o último registo < today (convenção getDecisionWellness).
 */
export function computeWeeklyStressMetrics(
  wellness: WellnessDay[],
  today: string,
): WeeklyStressMetrics {
  const sorted = [...wellness]
    .filter((w) => w.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    return {
      rampRate: { current: null, status: null },
      monotony: { monotony: null, strain: null, weeklyAtlSum: null, status: null, lowData: true },
    };
  }

  // ── Ramp rate ──────────────────────────────────────────────────────────────
  const decisionDay = sorted[0];
  const currentRampRate = decisionDay.rampRate;

  // Entrada mais próxima de há 7 dias — UTC para evitar drift de timezone
  const [y, m, d] = decisionDay.date.split("-").map(Number);
  const weekAgoDate = new Date(Date.UTC(y, m - 1, d) - 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const weekAgoEntry = sorted.find((w) => w.date <= weekAgoDate);
  const weekAgoRampRate = weekAgoEntry?.rampRate ?? null;

  // ── Monotonia: atlLoad bruto (Intervals.icu) ─────────────────────────────
  // atlLoad = impulso diário antes de EWMA; 0 nos dias de descanso.
  const last7 = sorted.slice(0, 7);
  const dailyLoads = last7.map((w) => w.atlLoad ?? 0);

  const { monotony, strain, weeklyAtlSum, lowData } = computeMonotony(dailyLoads);

  return {
    rampRate: {
      current: currentRampRate,
      status: computeRampRateStatus(currentRampRate, weekAgoRampRate),
    },
    monotony: {
      monotony,
      strain,
      weeklyAtlSum,
      status: monotonyStatusLevel(monotony),
      lowData,
    },
  };
}

// ─── Interpretação em linguagem natural (UI) ────────────────────────────────
//
// Texto gerado por limiares em código — nunca pelo LLM.
// Cada frase: o que significa + o que fazer.

const RAMP_RATE_THRESHOLDS = {
  CONSERVATIVE: 1.0, // < → progressão conservadora
  FAST: 1.5,         // >= → a subir depressa
  AGGRESSIVE: 2.0,   // >= → subida agressiva
} as const;

const MONOTONY_THRESHOLDS = {
  VARIED: 1.5,  // < → bem variado
  UNIFORM: 2.0, // >= → alguma uniformidade (atenção)
  HIGH: 2.5,    // >= → alta monotonia (alerta)
} as const;

export function rampRateInterpretation(current: number): string {
  if (current < RAMP_RATE_THRESHOLDS.CONSERVATIVE)
    return "progressão conservadora — há margem para aumentar";
  if (current < RAMP_RATE_THRESHOLDS.FAST)
    return "progressão saudável";
  if (current < RAMP_RATE_THRESHOLDS.AGGRESSIVE)
    return "a subir depressa — mantém se a próxima semana estabilizar";
  return "subida agressiva — risco se mantida; considera uma semana de consolidação";
}

export function monotonyInterpretation(monotony: number): string {
  if (monotony < MONOTONY_THRESHOLDS.VARIED)
    return "treino bem variado";
  if (monotony < MONOTONY_THRESHOLDS.UNIFORM)
    return "alguma uniformidade — ok";
  if (monotony < MONOTONY_THRESHOLDS.HIGH)
    return "treinos demasiado parecidos — mete um dia claramente fácil ou de descanso para quebrar a monotonia";
  return "monotonia alta — risco; varia intensidade e inclui descanso";
}

/** Linha de síntese quando ramp E monotonia estão simultaneamente em atenção/alerta. */
export function stressSynthesisLine(
  rampStatus: StressLevel | null,
  monotonyStatus: StressLevel | null,
): string | null {
  if (
    (rampStatus === "attention" || rampStatus === "alert") &&
    (monotonyStatus === "attention" || monotonyStatus === "alert")
  ) {
    return "a subir carga depressa e de forma uniforme — o padrão de maior risco; prioriza variar e descansar";
  }
  return null;
}

// ─── Formatação para contexto do coach ──────────────────────────────────────

/**
 * Linha de contexto para o coach quando há atenção/alerta.
 * Retorna string vazia quando tudo está ok (sem ruído verde).
 */
export function formatStressContext(metrics: WeeklyStressMetrics): string {
  const parts: string[] = [];

  if (metrics.rampRate.status === "alert" || metrics.rampRate.status === "attention") {
    const level = metrics.rampRate.status === "alert" ? "ALERTA" : "ATENÇÃO";
    const sustained = metrics.rampRate.status === "alert" ? " há 2+ semanas" : "";
    parts.push(`ramp rate ${metrics.rampRate.current?.toFixed(1)}/sem${sustained} [${level}] — modera a progressão de carga`);
  }

  if (!metrics.monotony.lowData && (metrics.monotony.status === "alert" || metrics.monotony.status === "attention")) {
    const level = metrics.monotony.status === "alert" ? "ALERTA" : "ATENÇÃO";
    parts.push(`monotonia ${metrics.monotony.monotony?.toFixed(1)} esta semana [${level}] — treino demasiado uniforme, adicionar variação de intensidade`);
  }

  if (parts.length === 0) return "";
  return `[CARGA — ${parts.join("; ")}]`;
}
