/**
 * Ramp rate e monotonia/strain (Foster) para o card de carga e contexto do coach.
 *
 * Ramp rate: consumido diretamente do campo wellness.rampRate (Intervals.icu),
 * em unidades CTL/semana — não recalculado.
 *
 * Monotonia: [Suposição] usa ATL diário como proxy de carga diária — é uma
 * aproximação do modelo Foster (que usa session RPE × duração), dado que
 * não temos o impulso diário bruto da API. ATL decai nos dias de descanso
 * (contribui para maior desvio-padrão, menor monotonia) o que preserva o
 * mecanismo de proteção essencial do modelo.
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
  /** <4 dias com ATL não-nulo → sem veredicto */
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
 * Recebe os valores de ATL dos últimos N dias (com zeros explícitos para
 * dias sem dados/descanso completo). Retorna monotony, strain e lowData.
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

  // ── Monotonia: últimos 7 dias de ATL ──────────────────────────────────────
  const last7 = sorted.slice(0, 7);
  // Rest days (ATL null) contam como 0 — é o que baixa a monotonia
  const atlValues = last7.map((w) => w.atl ?? 0);

  const { monotony, strain, weeklyAtlSum, lowData } = computeMonotony(atlValues);

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
