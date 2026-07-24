import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/redis");
vi.mock("@/lib/freddy/client", () => ({ getFreddyClient: vi.fn() }));

import { parseIcuWorkout, loadRecentWorkoutDates } from "@/lib/coach/prescription-store";
import { computeAeroDecoupling, buildExecutionAnalysis, isPaceContinuous, saveExecution } from "@/lib/coach/execution-analysis";
import { formatWorkoutHistory } from "@/lib/coach/workout-history";
import { __reset } from "@/lib/__mocks__/redis";
import type { WorkoutExecution } from "@/lib/types/coach";

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

  it("rawBlock preserva a description original intacta", () => {
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.rawBlock).toBe(SAMPLE_ICU);
  });

  it("rawBlock é string vazia quando a description está vazia", () => {
    const w = parseIcuWorkout("Vazio", "");
    expect(w.rawBlock).toBe("");
  });
});

// ─── parseIcuWorkout — regressão: sufixo "m" de metros tratado como minutos ──
// Fixture sintética: "Limite de Lactato" — 20min aquecimento + 1600m principal +
// 10min retorno. Com o parser bugado: 1600m → 1600 min → 96000s → total 97800s.
// Valor confirmado no Redis: coach:prescribed:2026-07-08 totalDurationSec=97800.

const FIXTURE_LACTATO = readFileSync(
  resolve(process.cwd(), "tests/fixtures-synthetic/icu-workout-limite-lactato.txt"),
  "utf8",
);

describe("parseIcuWorkout — bug regressão: 'm' de metros ≠ 'm' de minutos", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("totalDurationSec soma apenas steps de TEMPO — 20min + 10min = 1800s", () => {
    // antes do fix: 97800s (20min + 1600 tratado como minutos + 10min)
    const w = parseIcuWorkout("Limite de Lactato", FIXTURE_LACTATO);
    expect(w.totalDurationSec).toBe(1800);
  });

  it("step '1600m' reconhecido como distância (distanceM=1600), sem durationSec", () => {
    const w = parseIcuWorkout("Limite de Lactato", FIXTURE_LACTATO);
    const main = w.sections.find((s) => s.name === "Principal");
    const step = main?.steps[0];
    expect(step?.distanceM).toBe(1600);
    expect(step?.durationSec).toBeUndefined();
  });

  it("mainPace 4:00-4:30/km extraído da secção de distância (minSecPerKm=240, max=270)", () => {
    const w = parseIcuWorkout("Limite de Lactato", FIXTURE_LACTATO);
    expect(w.mainPace).toEqual({ minSecPerKm: 240, maxSecPerKm: 270 });
  });

  it("steps de tempo com 'min' explícito continuam corretos (20min→1200s, 10min→600s)", () => {
    const w = parseIcuWorkout("Limite de Lactato", FIXTURE_LACTATO);
    const aquecimento = w.sections.find((s) => s.name === "Aquecimento");
    const retorno = w.sections.find((s) => s.name === "Retorno à calma");
    expect(aquecimento?.steps[0].durationSec).toBe(1200);
    expect(retorno?.steps[0].durationSec).toBe(600);
  });

  it("steps de tempo curtos com 'm' bare ≤50 não regridem (SAMPLE_ICU intacto)", () => {
    // garante que "15m", "2m", "10m" do SAMPLE_ICU ainda são tratados como minutos
    const w = parseIcuWorkout("Intervalos 6x800m", SAMPLE_ICU);
    expect(w.totalDurationSec).toBe(2220); // já coberto noutro teste; repete aqui para isolar
  });
});

// ─── parseIcuWorkout — detector de formato proibido ("m" bare) ───────────────
// "m" sozinho é agora PROIBIDO no system prompt. O parser ainda aceita m>50
// como metros (safety-net), mas loga console.warn — esse warning é o sinal de
// que o modelo regressou ao formato antigo e a prescrição precisa de revisão.

describe("parseIcuWorkout — detector de formato proibido ('m' bare)", () => {
  it("'60m' (m>50, formato proibido) → distanceM=60 e console.warn disparado", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warn.mockClear(); // vitest reutiliza o mesmo spy; limpar chamadas acumuladas de testes anteriores
    const w = parseIcuWorkout("Detector", "Main\n- 60m 4:00/km");
    const step = w.sections[0]?.steps[0];
    expect(step?.distanceM).toBe(60);
    expect(step?.durationSec).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("60m"));
    warn.mockRestore();
  });

  it("'15m' (m≤50, tolerado como tempo) → durationSec=900 SEM warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warn.mockClear(); // limpa chamadas acumuladas de testes anteriores (sem clearMocks na config)
    const w = parseIcuWorkout("Detector", "Main\n- 15m Z1");
    const step = w.sections[0]?.steps[0];
    expect(step?.durationSec).toBe(900);
    expect(step?.distanceM).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
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

// ─── saveExecution → trackDate ───────────────────────────────────────────────
// saveExecution agora chama trackDate: qualquer execução entra no índice,
// mesmo sem prescrição correspondente (execuções "órfãs" ficam visíveis).

const BASE_EXECUTION: WorkoutExecution = {
  date: "2026-07-07",
  distanceKm: 12.3,
  durationSec: 3900,
  avgPaceMinPerKm: 5.28,
  avgHrBpm: 142,
  aeroDecouplingPct: 3.2,
  distanceDeltaM: null,
  durationDeltaSec: null,
  paceVsTargetSecPerKm: null,
  matchedBlocks: null,
};

describe("saveExecution — trackDate via execução", () => {
  beforeEach(() => __reset());

  it("saveExecution adiciona a data ao índice coach:workout-dates", async () => {
    await saveExecution("2026-07-07", BASE_EXECUTION);
    const dates = await loadRecentWorkoutDates(10);
    expect(dates).toContain("2026-07-07");
  });

  it("execução órfã reindexada aparece em loadRecentWorkoutDates após re-save", async () => {
    // Simula estado pós-diagnóstico: data não estava no índice
    // Chamar saveExecution reindexada deve torná-la visível
    const before = await loadRecentWorkoutDates(10);
    expect(before).not.toContain("2026-07-07");

    await saveExecution("2026-07-07", BASE_EXECUTION);

    const after = await loadRecentWorkoutDates(10);
    expect(after).toContain("2026-07-07");
  });
});

// ─── formatWorkoutHistory — 3 estados ────────────────────────────────────────

const EXEC_SAMPLE: WorkoutExecution = {
  date: "2026-07-07",
  distanceKm: 12.3,
  durationSec: 3900,
  avgPaceMinPerKm: 5.28,
  avgHrBpm: 142,
  aeroDecouplingPct: 3.2,
  distanceDeltaM: null,
  durationDeltaSec: null,
  paceVsTargetSecPerKm: -8,
  matchedBlocks: null,
};

const PRESC_SAMPLE = parseIcuWorkout(
  "Rolante Z2",
  "Principal\n- 60min 65-70% HR",
);

describe("formatWorkoutHistory — 3 estados", () => {
  it("string vazia quando lista está vazia", () => {
    expect(formatWorkoutHistory([])).toBe("");
  });

  it("estado 1 — par completo: inclui nome, prescrito, executado", () => {
    // PRESC_SAMPLE é treino por tempo/FC (sem mainPace) → sem linha de desvio
    const result = formatWorkoutHistory([{ date: "2026-07-07", prescribed: PRESC_SAMPLE, executed: EXEC_SAMPLE }]);
    expect(result).toContain("Rolante Z2");
    expect(result).toContain("prescrito: 60min");
    expect(result).toContain("executado 12.3km em 65min");
    // instrução reforçada presente
    expect(result).toContain("DEVES referir explicitamente");
  });

  it("estado 2 — só executado: prefixo 'treino sem prescrição:' e dados da execução", () => {
    const result = formatWorkoutHistory([{ date: "2026-07-07", prescribed: null, executed: EXEC_SAMPLE }]);
    expect(result).toContain("treino sem prescrição:");
    expect(result).toContain("12.3km em 65min");
    expect(result).toContain("decoupling 3.2% (estável)");
    // NÃO deve conter "executado" como prefixo nem "prescrição" como campo
    expect(result).not.toContain("prescrito:");
  });

  it("estado 3 — só prescrito: 'sem execução registada'", () => {
    const result = formatWorkoutHistory([{ date: "2026-07-07", prescribed: PRESC_SAMPLE, executed: null }]);
    expect(result).toContain("Rolante Z2");
    expect(result).toContain("sem execução registada");
    // linha de dados não tem prefix "executado X km" nem "treino sem prescrição"
    expect(result).not.toContain("treino sem prescrição");
    expect(result).not.toMatch(/executado \d/); // "executado Nkm" ausente na linha de dados
  });

  it("par sem nenhum lado é filtrado (linha ausente)", () => {
    const result = formatWorkoutHistory([{ date: "2026-07-07", prescribed: null, executed: null }]);
    expect(result).toBe("");
  });
});

// ─── formatWorkoutHistory — desvio de pace ────────────────────────────────────

describe("formatWorkoutHistory — desvio de pace (texto direcional)", () => {
  // 5:00-5:15/km = 300-315 sec/km; 4:44/km = 284 sec/km → 16s mais rápido
  const PRESC_PACE = parseIcuWorkout("Corrida Fácil", "Principal\n- 10km 5:00-5:15/km Pace");

  function makeExec(avgPaceMinPerKm: number): WorkoutExecution {
    return {
      ...EXEC_SAMPLE,
      avgPaceMinPerKm,
      paceVsTargetSecPerKm: null, // campo legado ignorado
    };
  }

  it("4:44 vs 5:00-5:15 → '16s mais rápido que o alvo'", () => {
    const result = formatWorkoutHistory([
      { date: "2026-07-09", prescribed: PRESC_PACE, executed: makeExec(284 / 60) },
    ]);
    expect(result).toContain("16s mais rápido que o alvo");
  });

  it("5:20 vs 5:00-5:15 → '5s mais lento que o alvo'", () => {
    // 5:20 = 320 sec/km; maxSecPerKm = 315; 320 - 315 = 5s
    const result = formatWorkoutHistory([
      { date: "2026-07-09", prescribed: PRESC_PACE, executed: makeExec(320 / 60) },
    ]);
    expect(result).toContain("5s mais lento que o alvo");
  });

  it("5:07 vs 5:00-5:15 → 'dentro do alvo'", () => {
    // 5:07 = 307 sec/km; 300 ≤ 307 ≤ 315 → dentro do alvo
    const result = formatWorkoutHistory([
      { date: "2026-07-09", prescribed: PRESC_PACE, executed: makeExec(307 / 60) },
    ]);
    expect(result).toContain("dentro do alvo");
  });

  it("prescrição sem mainPace (FC only) → sem tokens direcionais na linha de dados", () => {
    // "desvio" aparece no cabeçalho da instrução — verifica só os tokens direcionais
    const result = formatWorkoutHistory([
      { date: "2026-07-09", prescribed: PRESC_SAMPLE, executed: makeExec(284 / 60) },
    ]);
    expect(result).not.toContain("mais rápido");
    expect(result).not.toContain("mais lento");
    expect(result).not.toContain("dentro do alvo");
  });
});

// ─── formatWorkoutHistory — filtro de atividades fantasma ────────────────────

describe("formatWorkoutHistory — atividades fantasma ignoradas", () => {
  function makeGhostByDist(): WorkoutExecution {
    return { ...EXEC_SAMPLE, distanceKm: 0.1, durationSec: 3540, avgPaceMinPerKm: 589 };
  }
  function makeGhostByPace(): WorkoutExecution {
    return { ...EXEC_SAMPLE, distanceKm: 2.0, durationSec: 3600, avgPaceMinPerKm: 30 };
  }

  it("execução fantasma por distância (<1km) com prescrição → 'sem execução registada'", () => {
    const result = formatWorkoutHistory([
      { date: "2026-07-23", prescribed: PRESC_SAMPLE, executed: makeGhostByDist() },
    ]);
    expect(result).toContain("sem execução registada");
    expect(result).not.toContain("0.1km");
  });

  it("execução fantasma por pace (>15:00/km) com prescrição → 'sem execução registada'", () => {
    const result = formatWorkoutHistory([
      { date: "2026-07-23", prescribed: PRESC_SAMPLE, executed: makeGhostByPace() },
    ]);
    expect(result).toContain("sem execução registada");
    expect(result).not.toContain("30:");
  });

  it("execução fantasma sem prescrição → par filtrado (string vazia)", () => {
    const result = formatWorkoutHistory([
      { date: "2026-07-23", prescribed: null, executed: makeGhostByDist() },
    ]);
    expect(result).toBe("");
  });
});
