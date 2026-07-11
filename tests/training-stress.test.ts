import { describe, it, expect } from "vitest";
import {
  computeRampRateStatus,
  computeMonotony,
  monotonyStatusLevel,
  computeWeeklyStressMetrics,
  formatStressContext,
} from "@/lib/analysis/training-stress";
import type { WellnessDay } from "@/lib/freddy/metrics";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWellness(overrides: Partial<WellnessDay>[]): WellnessDay[] {
  return overrides.map((o, i) => ({
    date: `2026-07-${String(10 - i).padStart(2, "0")}`,
    ctl: 50,
    atl: 45,
    atlLoad: null,
    tsb: 5,
    rampRate: 0.8,
    restingHr: 55,
    hrv: 40,
    sleepScore: 75,
    sleepSecs: 28800,
    steps: 8000,
    vo2max: 54,
    readiness: 70,
    ...o,
  }));
}

// ─── computeRampRateStatus ────────────────────────────────────────────────────

describe("computeRampRateStatus", () => {
  it("null → null", () => {
    expect(computeRampRateStatus(null, null)).toBeNull();
  });

  it("<1.0 → ok", () => {
    expect(computeRampRateStatus(0.8, null)).toBe("ok");
    expect(computeRampRateStatus(0.0, 1.8)).toBe("ok");
    expect(computeRampRateStatus(0.99, 2.0)).toBe("ok");
  });

  it("1.0-1.49 → atenção (independente da semana anterior)", () => {
    expect(computeRampRateStatus(1.0, null)).toBe("attention");
    expect(computeRampRateStatus(1.3, 1.5)).toBe("attention");
    expect(computeRampRateStatus(1.49, 2.0)).toBe("attention");
  });

  it("≥1.5 mas semana anterior <1.5 → atenção (não sustentado)", () => {
    expect(computeRampRateStatus(1.5, 0.9)).toBe("attention");
    expect(computeRampRateStatus(1.8, null)).toBe("attention");
    expect(computeRampRateStatus(2.0, 1.4)).toBe("attention");
  });

  it("≥1.5 E semana anterior ≥1.5 → alerta (sustentado 2+ semanas)", () => {
    expect(computeRampRateStatus(1.5, 1.5)).toBe("alert");
    expect(computeRampRateStatus(1.8, 1.6)).toBe("alert");
    expect(computeRampRateStatus(2.1, 2.0)).toBe("alert");
  });
});

// ─── computeMonotony ─────────────────────────────────────────────────────────

describe("computeMonotony — semana uniforme (alta monotonia)", () => {
  // 7 dias com ATL = 50 → mean=50, std≈0 → monotonia undefined (std=0)
  // Na prática: valores muito próximos dão std pequeno e monotonia alta
  // Teste com pequena variação artificial
  const uniform = [50, 50, 51, 49, 50, 50, 50];

  it("semana quase uniforme → monotonia elevada", () => {
    const { monotony, lowData } = computeMonotony(uniform);
    expect(lowData).toBe(false);
    expect(monotony).not.toBeNull();
    expect(monotony!).toBeGreaterThan(2.5); // alerta
  });

  it("strain = weeklyAtlSum × monotony", () => {
    const { monotony, strain, weeklyAtlSum } = computeMonotony(uniform);
    if (monotony !== null && strain !== null && weeklyAtlSum !== null) {
      expect(strain).toBeCloseTo(weeklyAtlSum * monotony, 0);
    }
  });
});

describe("computeMonotony — semana polarizada (baixa monotonia)", () => {
  // 3 dias de treino forte (ATL≈60) e 4 dias de descanso/fácil (ATL≈15)
  // mean ≈ (3×60 + 4×15)/7 ≈ 34.3; std alto → monotonia baixa
  const polarized = [60, 60, 60, 15, 15, 15, 15];

  it("semana polarizada → monotonia baixa (<2.0)", () => {
    const { monotony, lowData } = computeMonotony(polarized);
    expect(lowData).toBe(false);
    expect(monotony).not.toBeNull();
    expect(monotony!).toBeLessThan(2.0);
  });

  it("dias de descanso (baixo ATL) aumentam o desvio-padrão", () => {
    // semana uniforme vs polarizada: a polarizada tem std maior → monotonia menor
    const { monotony: mUniform } = computeMonotony([50, 50, 51, 49, 50, 50, 50]);
    const { monotony: mPolarized } = computeMonotony(polarized);
    expect(mUniform!).toBeGreaterThan(mPolarized!);
  });
});

describe("computeMonotony — lowData", () => {
  it("<4 dias com ATL>0 → lowData:true, sem veredicto", () => {
    const sparse = [50, 50, 0, 0, 0, 0, 0]; // só 2 dias com carga
    const { lowData, monotony, strain } = computeMonotony(sparse);
    expect(lowData).toBe(true);
    expect(monotony).toBeNull();
    expect(strain).toBeNull();
  });

  it("menos de 7 valores → lowData:true", () => {
    const { lowData } = computeMonotony([50, 50, 50]);
    expect(lowData).toBe(true);
  });

  it("7 valores com ≥4 non-zero → lowData:false", () => {
    const { lowData } = computeMonotony([50, 50, 50, 50, 0, 0, 0]);
    expect(lowData).toBe(false);
  });
});

// ─── monotonyStatusLevel ──────────────────────────────────────────────────────

describe("monotonyStatusLevel", () => {
  it("null → null", () => expect(monotonyStatusLevel(null)).toBeNull());
  it("≤2.0 → ok", () => expect(monotonyStatusLevel(1.9)).toBe("ok"));
  it(">2.0 e ≤2.5 → atenção", () => {
    expect(monotonyStatusLevel(2.1)).toBe("attention");
    expect(monotonyStatusLevel(2.5)).toBe("attention");
  });
  it(">2.5 → alerta", () => expect(monotonyStatusLevel(2.6)).toBe("alert"));
});

const TODAY = "2026-07-10";

// ─── computeWeeklyStressMetrics ───────────────────────────────────────────────

describe("computeWeeklyStressMetrics", () => {

  it("wellness vazio → tudo null/lowData", () => {
    const result = computeWeeklyStressMetrics([], TODAY);
    expect(result.rampRate.current).toBeNull();
    expect(result.monotony.lowData).toBe(true);
  });

  it("usa o último registo < today para ramp rate", () => {
    const wellness = makeWellness([
      { date: "2026-07-09", rampRate: 1.2 },
      { date: "2026-07-08", rampRate: 0.9 },
    ]);
    const result = computeWeeklyStressMetrics(wellness, TODAY);
    expect(result.rampRate.current).toBe(1.2);
    expect(result.rampRate.status).toBe("attention");
  });

  it("ramp rate ≥1.5 sustentado → alerta", () => {
    const wellness = [
      ...makeWellness([{ date: "2026-07-09", rampRate: 1.8 }]),
      ...makeWellness([{ date: "2026-07-02", rampRate: 1.6 }]),
    ];
    const result = computeWeeklyStressMetrics(wellness, TODAY);
    expect(result.rampRate.status).toBe("alert");
  });

  it("não inclui o próprio 'today' na análise", () => {
    const wellness = makeWellness([
      { date: TODAY, rampRate: 9.9 }, // deve ser ignorado
      { date: "2026-07-09", rampRate: 0.5 },
    ]);
    const result = computeWeeklyStressMetrics(wellness, TODAY);
    expect(result.rampRate.current).toBe(0.5);
    expect(result.rampRate.status).toBe("ok");
  });

  it("semana 3×descanso+4×treino: atlLoad bruto → monotonia ≈1.15 (fix do falso alerta 10+)", () => {
    // atlLoad real: [0,80,0,90,80,75,0] (sorted desc: more recent first)
    // Regressão anterior (ATL direto): ATL≈44 todos os dias (EWMA suaviza descanso)
    //   → std≈5, monotonia≈8 → falso alerta.
    // Fix (atlLoad): mean=325/7≈46.4, std≈40.4, monotonia≈1.15 → correto.
    const wellness = makeWellness([
      { date: "2026-07-09", atlLoad: 0 },  // descanso
      { date: "2026-07-08", atlLoad: 80 },
      { date: "2026-07-07", atlLoad: 0 },  // descanso
      { date: "2026-07-06", atlLoad: 90 },
      { date: "2026-07-05", atlLoad: 80 },
      { date: "2026-07-04", atlLoad: 75 },
      { date: "2026-07-03", atlLoad: 0 },  // descanso
    ]);
    const result = computeWeeklyStressMetrics(wellness, TODAY);
    expect(result.monotony.lowData).toBe(false); // 4 dias com carga > 0
    expect(result.monotony.monotony).not.toBeNull();
    expect(result.monotony.monotony!).toBeCloseTo(1.15, 1);
  });

  it("atlLoad null em todos os dias → lowData:true", () => {
    const wellness = makeWellness([
      { date: "2026-07-09", atlLoad: null },
      { date: "2026-07-08", atlLoad: null },
      { date: "2026-07-07", atlLoad: null },
      { date: "2026-07-06", atlLoad: null },
      { date: "2026-07-05", atlLoad: null },
      { date: "2026-07-04", atlLoad: null },
      { date: "2026-07-03", atlLoad: null },
    ]);
    const result = computeWeeklyStressMetrics(wellness, TODAY);
    expect(result.monotony.lowData).toBe(true);
    expect(result.monotony.monotony).toBeNull();
  });
});

// ─── formatStressContext ──────────────────────────────────────────────────────

describe("formatStressContext", () => {
  it("tudo ok → string vazia (sem ruído verde)", () => {
    const ctx = formatStressContext({
      rampRate: { current: 0.7, status: "ok" },
      monotony: { monotony: 1.5, strain: 400, weeklyAtlSum: 270, status: "ok", lowData: false },
    });
    expect(ctx).toBe("");
  });

  it("ramp rate em atenção → inclui linha no contexto", () => {
    const ctx = formatStressContext({
      rampRate: { current: 1.3, status: "attention" },
      monotony: { monotony: 1.5, strain: 450, weeklyAtlSum: 300, status: "ok", lowData: false },
    });
    expect(ctx).toContain("1.3");
    expect(ctx).toContain("ATENÇÃO");
  });

  it("ramp rate em alerta → menciona '2+ semanas'", () => {
    const ctx = formatStressContext({
      rampRate: { current: 1.8, status: "alert" },
      monotony: { monotony: null, strain: null, weeklyAtlSum: null, status: null, lowData: true },
    });
    expect(ctx).toContain("ALERTA");
    expect(ctx).toContain("2+ semanas");
  });

  it("monotonia em atenção → inclui linha com valor", () => {
    const ctx = formatStressContext({
      rampRate: { current: 0.8, status: "ok" },
      monotony: { monotony: 2.3, strain: 700, weeklyAtlSum: 300, status: "attention", lowData: false },
    });
    expect(ctx).toContain("2.3");
    expect(ctx).toContain("ATENÇÃO");
  });

  it("lowData → não inclui linha de monotonia mesmo com status alert", () => {
    const ctx = formatStressContext({
      rampRate: { current: 0.8, status: "ok" },
      monotony: { monotony: null, strain: null, weeklyAtlSum: null, status: "alert", lowData: true },
    });
    expect(ctx).toBe("");
  });
});
