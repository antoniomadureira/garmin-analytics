import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/redis");
vi.mock("@/lib/freddy/client", () => ({ getFreddyClient: vi.fn() }));

import { parseIcuWorkout } from "@/lib/coach/prescription-store";
import { computeAeroDecoupling, buildExecutionAnalysis, isPaceContinuous } from "@/lib/coach/execution-analysis";

// ─── parseIcuWorkout ─────────────────────────────────────────────────────────

const SAMPLE_ICU = `Warmup
- 15m 65-70% HR

6x
- 800mtr 3:50-4:00/km Pace
- 2m Z1

Cooldown
- 10m 60-65% HR`;

describe("parseIcuWorkout — ICU workout parsing", () => {
  it("extrai 3 secções (Warmup, Main, Cooldown)", () => {
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.sections).toHaveLength(3);
    expect(w.sections[0].name).toBe("Warmup");
    expect(w.sections[1].name).toBe("Main");
    expect(w.sections[2].name).toBe("Cooldown");
  });

  it("secção de repetições tem reps=6", () => {
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.sections[1].reps).toBe(6);
  });

  it("extrai duração em segundos (15m → 900s)", () => {
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.sections[0].steps[0].durationSec).toBe(900);
  });

  it("extrai cooldown duration (10m → 600s)", () => {
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.sections[2].steps[0].durationSec).toBe(600);
  });

  it("extrai distância em metros (800mtr → 800)", () => {
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.sections[1].steps[0].distanceM).toBe(800);
  });

  it("extrai pace target — 3:50 → 230s/km, 4:00 → 240s/km", () => {
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.sections[1].steps[0].paceMin).toBe(230);
    expect(w.sections[1].steps[0].paceMax).toBe(240);
  });

  it("extrai HR ceiling do warmup (65-70% HR → 70)", () => {
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.sections[0].steps[0].hrCeilingPct).toBe(70);
  });

  it("extrai zona Z1 do passo de recuperação", () => {
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.sections[1].steps[1].zone).toBe("Z1");
  });

  it("mainPace aponta para o alvo de pace da secção principal", () => {
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.mainPace).toEqual({ minSecPerKm: 230, maxSecPerKm: 240 });
  });

  it("totalDurationSec = 15min + 6×2min + 10min = 2220s", () => {
    // warmup 15m → 900s, main 2m × 6 → 720s, cooldown 10m → 600s
    // 800mtr são distância (sem durationSec) → não contribuem
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.totalDurationSec).toBe(2220);
  });

  it("guarda o nome original no workout", () => {
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.name).toBe("Intervalos 6x800m");
  });

  it("km é convertido para metros (1.6km → 1600m)", () => {
    const w = parseIcuWorkout("Test", "Main\n- 1.6km 4:30-4:40/km Pace");
    expect(w.sections[0].steps[0].distanceM).toBe(1600);
  });

  it("description em branco devolve zero secções e nulls", () => {
    const w = parseIcuWorkout("Vazio", "");
    expect(w.sections).toHaveLength(0);
    expect(w.mainPace).toBeNull();
    expect(w.totalDurationSec).toBeNull();
  });
});

// ─── computeAeroDecoupling ────────────────────────────────────────────────────

function makeSeries(n: number, paceMinPerKm: number, hr: number) {
  return Array.from({ length: n }, () => ({ paceMinPerKm, hr }));
}

describe("computeAeroDecoupling — aerobic decoupling", () => {
  it("retorna ≈0% para esforço completamente estável (mesmo pace e HR)", () => {
    const series = makeSeries(100, 5.0, 140);
    const pct = computeAeroDecoupling(series);
    expect(pct).not.toBeNull();
    expect(Math.abs(pct!)).toBeLessThan(0.5);
  });

  it("detecta deriva cardíaca clara (>8%) quando HR sobe e speed cai na 2ª metade", () => {
    // 1ª metade: speed ≈ 3.0 m/s @ 140bpm → EF = 0.02143
    // 2ª metade: speed ≈ 2.7 m/s @ 155bpm → EF = 0.01742
    // decoupling = (0.02143 - 0.01742) / 0.02143 ≈ 18.7%
    const paceFirst = 1000 / (3.0 * 60);  // ≈ 5.56 min/km
    const paceSecond = 1000 / (2.7 * 60); // ≈ 6.17 min/km
    const series = [
      ...Array.from({ length: 50 }, () => ({ paceMinPerKm: paceFirst, hr: 140 })),
      ...Array.from({ length: 50 }, () => ({ paceMinPerKm: paceSecond, hr: 155 })),
    ];
    const pct = computeAeroDecoupling(series);
    expect(pct).not.toBeNull();
    expect(pct!).toBeGreaterThan(8);
  });

  it("retorna null sem lançar para streams muito curtos (<20 amostras válidas)", () => {
    const series = makeSeries(9, 5.0, 140);
    expect(() => computeAeroDecoupling(series)).not.toThrow();
    expect(computeAeroDecoupling(series)).toBeNull();
  });

  it("ignora amostras com paceMinPerKm null ou hr null", () => {
    // 50 + 2 inválidas + 50 válidas → 100 válidas, esforço estável
    const series: Array<{ paceMinPerKm: number | null; hr: number | null }> = [
      ...Array.from({ length: 50 }, () => ({ paceMinPerKm: 5.0 as number | null, hr: 140 as number | null })),
      { paceMinPerKm: null, hr: 140 },
      { paceMinPerKm: 5.0, hr: null },
      ...Array.from({ length: 50 }, () => ({ paceMinPerKm: 5.0 as number | null, hr: 140 as number | null })),
    ];
    expect(() => computeAeroDecoupling(series)).not.toThrow();
    const pct = computeAeroDecoupling(series);
    expect(pct).not.toBeNull();
    expect(Math.abs(pct!)).toBeLessThan(1);
  });

  it("retorna null para array vazio", () => {
    expect(computeAeroDecoupling([])).toBeNull();
  });

  it("decoupling positivo = deriva cardíaca (EF1 > EF2)", () => {
    // EF1 > EF2 → (EF1 - EF2) / EF1 > 0
    const first = Array.from({ length: 50 }, () => ({ paceMinPerKm: 4.0, hr: 130 }));
    const second = Array.from({ length: 50 }, () => ({ paceMinPerKm: 4.5, hr: 150 }));
    const pct = computeAeroDecoupling([...first, ...second]);
    expect(pct).toBeGreaterThan(0);
  });
});

// ─── isPaceContinuous ─────────────────────────────────────────────────────────

describe("isPaceContinuous — heurística de continuidade de pace", () => {
  it("pace constante → contínuo", () => {
    const paces = Array.from({ length: 100 }, () => 5.0);
    expect(isPaceContinuous(paces)).toBe(true);
  });

  it("alternância clara 4.0/7.0 min/km → não contínuo (CV ≈ 0.27)", () => {
    const paces = [
      ...Array.from({ length: 50 }, () => 4.0),
      ...Array.from({ length: 50 }, () => 7.0),
      ...Array.from({ length: 50 }, () => 4.0),
      ...Array.from({ length: 50 }, () => 7.0),
    ];
    expect(isPaceContinuous(paces)).toBe(false);
  });

  it("variação suave (±0.3 min/km) → contínuo", () => {
    // drift ligeiro num fartlek suave — CV deve ficar abaixo de 0.15
    const base = 5.0;
    const paces = Array.from({ length: 100 }, (_, i) => base + (i % 5) * 0.05);
    expect(isPaceContinuous(paces)).toBe(true);
  });

  it("array curto (<10) → false sem lançar", () => {
    expect(() => isPaceContinuous([5.0, 5.0, 5.0])).not.toThrow();
    expect(isPaceContinuous([5.0, 5.0, 5.0])).toBe(false);
  });

  it("array vazio → false", () => {
    expect(isPaceContinuous([])).toBe(false);
  });
});

// ─── buildExecutionAnalysis — guardrails de decoupling ───────────────────────

const INTERVAL_SERIES = [
  ...Array.from({ length: 50 }, () => ({ paceMinPerKm: 4.0, hr: 160 })),
  ...Array.from({ length: 50 }, () => ({ paceMinPerKm: 7.0, hr: 130 })),
  ...Array.from({ length: 50 }, () => ({ paceMinPerKm: 4.0, hr: 162 })),
  ...Array.from({ length: 50 }, () => ({ paceMinPerKm: 7.0, hr: 128 })),
];
const STEADY_SERIES = Array.from({ length: 100 }, () => ({ paceMinPerKm: 5.0, hr: 140 }));

const BASE_PARAMS = {
  date: "2024-01-06",
  distanceKm: 10,
  durationSec: 3600,
  avgHrBpm: 145,
};

describe("buildExecutionAnalysis — guardrails de decoupling", () => {
  it("prescription com reps>1 → matchedBlocks false + decoupling null", () => {
    const prescription = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    const result = buildExecutionAnalysis({ ...BASE_PARAMS, series: INTERVAL_SERIES, prescription });
    expect(result.matchedBlocks).toBe(false);
    expect(result.aeroDecouplingPct).toBeNull();
  });

  it("prescription com reps>1 + série contínua → decoupling null na mesma (guardrail é na prescrição)", () => {
    const prescription = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    const result = buildExecutionAnalysis({ ...BASE_PARAMS, series: STEADY_SERIES, prescription });
    expect(result.matchedBlocks).toBe(false);
    expect(result.aeroDecouplingPct).toBeNull();
  });

  it("prescription contínua (só reps=1) + execução contínua → decoupling calculado", () => {
    const continuousPrescription = parseIcuWorkout("Rolante Z2",
      "Aquecimento\n- 5m 60-65% HR\n\nPrincipal\n- 30m 65-75% HR\n\nArrefecimento\n- 5m 60-65% HR");
    const result = buildExecutionAnalysis({ ...BASE_PARAMS, series: STEADY_SERIES, prescription: continuousPrescription });
    expect(result.matchedBlocks).toBeNull();
    expect(result.aeroDecouplingPct).not.toBeNull();
  });

  it("prescription contínua + execução intervalada → decoupling null (atleta divergiu)", () => {
    const continuousPrescription = parseIcuWorkout("Rolante Z2",
      "Aquecimento\n- 5m 60-65% HR\n\nPrincipal\n- 30m 65-75% HR\n\nArrefecimento\n- 5m 60-65% HR");
    const result = buildExecutionAnalysis({ ...BASE_PARAMS, series: INTERVAL_SERIES, prescription: continuousPrescription });
    expect(result.matchedBlocks).toBeNull(); // prescrição sem reps → matchedBlocks null
    expect(result.aeroDecouplingPct).toBeNull(); // execução intervalada → null
  });

  it("sem prescrição + série intervalada → decoupling null (heurística CV)", () => {
    const result = buildExecutionAnalysis({ ...BASE_PARAMS, series: INTERVAL_SERIES, prescription: null });
    expect(result.aeroDecouplingPct).toBeNull();
  });

  it("sem prescrição + série contínua → decoupling calculado", () => {
    const result = buildExecutionAnalysis({ ...BASE_PARAMS, series: STEADY_SERIES, prescription: null });
    expect(result.aeroDecouplingPct).not.toBeNull(); // ≥ 20 amostras, contínuo → calculado
  });

  it("sem prescrição + série curta → decoupling null sem throw", () => {
    const shortSeries = Array.from({ length: 5 }, () => ({ paceMinPerKm: 5.0, hr: 140 }));
    expect(() => buildExecutionAnalysis({ ...BASE_PARAMS, series: shortSeries, prescription: null })).not.toThrow();
    const result = buildExecutionAnalysis({ ...BASE_PARAMS, series: shortSeries, prescription: null });
    expect(result.aeroDecouplingPct).toBeNull();
  });
});
