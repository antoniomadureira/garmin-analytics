import { describe, it, expect } from "vitest";
import { riegelMarathon, selectRiegelInput } from "@/lib/analysis/race-prediction";

// ─── riegelMarathon ───────────────────────────────────────────────────────────

describe("riegelMarathon", () => {
  it("10K em 40min (4:00/km) → maratona ≈ 3h04m (Riegel standard)", () => {
    // T2 = 2400 × (42.195/10)^1.06 ≈ 11040s = 3h04m
    const sec = riegelMarathon(10, 40 * 60);
    expect(sec).toBeGreaterThan(3 * 3600);
    expect(sec).toBeLessThan(3 * 3600 + 10 * 60);
  });

  it("quanto maior a distância base, menor a extrapolação relativa", () => {
    // HM a mesmo pace que 10K deve dar previsão mais conservadora (mais longa)
    const pace = 4.5; // min/km
    const secHM = riegelMarathon(21.1, Math.round(pace * 60 * 21.1));
    const sec10K = riegelMarathon(10, Math.round(pace * 60 * 10));
    // Riegel favorece distâncias mais longas como input → previsão mais curta
    expect(secHM).toBeLessThan(sec10K);
  });
});

// ─── selectRiegelInput ────────────────────────────────────────────────────────

const GOAL_3H = 3 * 3600; // 10800s — objetivo sub-3h, goalPace = 4:16/km
// Threshold representatividade: 4.266 × 1.25 × 0.90 ≈ 4.80 min/km

function makeRecord(distanceKm: number, paceMinPerKm: number, daysAgo: number, today = "2026-07-11") {
  const date = new Date(`${today}T00:00:00`);
  date.setDate(date.getDate() - daysAgo);
  return {
    distanceKm,
    durationSec: Math.round(paceMinPerKm * 60 * distanceKm),
    date: date.toISOString().slice(0, 10),
  };
}

const TODAY = "2026-07-11";

describe("selectRiegelInput — regressão produção (2026-07-11)", () => {
  // Records reais do log: 10K 3.77/km há 118d, HM 5.14/km há 69d, Marathon 5.07/km há 76d
  const productionRecords = [
    makeRecord(9.96,  3.77, 118, TODAY), // 10K de prova (sub-4:00)
    makeRecord(21.49, 5.14, 69,  TODAY), // HM a ritmo fácil (não representativa)
    makeRecord(42.49, 5.07, 76,  TODAY), // Maratona a ritmo fácil (não representativa)
  ];

  it("janela 70d → null (10K fora de 70d; HM/Marathon não passam filtro)", () => {
    const result = selectRiegelInput(productionRecords, 70, GOAL_3H, TODAY);
    expect(result).toBeNull();
  });

  it("janela 180d → 10K de prova (único representativo; HM/Marathon rejeitadas)", () => {
    const result = selectRiegelInput(productionRecords, 180, GOAL_3H, TODAY);
    expect(result).not.toBeNull();
    expect(result!.sourceLabel).toBe("10K");
  });

  it("previsão com 10K sub-4:00 → maratona sub-3h (vs 3:45 errado com HM fácil)", () => {
    const result = selectRiegelInput(productionRecords, 180, GOAL_3H, TODAY);
    expect(result!.predictedMarathonSec).toBeLessThan(3 * 3600); // sub-3h
  });
});

describe("selectRiegelInput — filtro de representatividade", () => {
  it("esforço a ritmo fácil (acima do threshold) → rejeitado", () => {
    // pace 5:00/km: threshold para GOAL_3H ≈ 4:48/km → reprovado
    const result = selectRiegelInput(
      [makeRecord(10, 5.0, 10, TODAY)],
      180, GOAL_3H, TODAY,
    );
    expect(result).toBeNull();
  });

  it("esforço de prova (abaixo do threshold) → qualifica", () => {
    // pace 4:30/km: claramente abaixo de 4:48 → passa
    const result = selectRiegelInput(
      [makeRecord(10, 4.3, 10, TODAY)],
      180, GOAL_3H, TODAY,
    );
    expect(result).not.toBeNull();
    expect(result!.sourceLabel).toBe("10K");
  });

  it("threshold escala com o objetivo: objetivo mais lento → threshold mais permissivo", () => {
    // Objetivo 3:30 (3.5h = 12600s) → goalPace ≈ 4:58/km → threshold ≈ 5:35/km
    // Mesmo pace de 5:00/km que acima agora passa
    const GOAL_3H30 = 3.5 * 3600;
    const result = selectRiegelInput(
      [makeRecord(10, 5.0, 10, TODAY)],
      180, GOAL_3H30, TODAY,
    );
    expect(result).not.toBeNull();
  });
});

describe("selectRiegelInput — preferência de distância e penalização de antiguidade", () => {
  it("HM e 10K ambos representativos e recentes → HM vence (melhor preditor)", () => {
    const records = [
      makeRecord(21.1, 4.5, 20, TODAY), // HM representativa há 20d
      makeRecord(10,   4.0, 10, TODAY), // 10K representativo há 10d
    ];
    const result = selectRiegelInput(records, 180, GOAL_3H, TODAY);
    expect(result!.sourceLabel).toBe("HM");
  });

  it("HM representativa mas >45d mais velha que 10K → 10K vence (recência)", () => {
    const records = [
      makeRecord(21.1, 4.5, 80, TODAY), // HM há 80d
      makeRecord(10,   4.0, 20, TODAY), // 10K há 20d — gap = 60d > 45d → troca
    ];
    const result = selectRiegelInput(records, 180, GOAL_3H, TODAY);
    expect(result!.sourceLabel).toBe("10K");
  });

  it("HM representativa mas ≤45d mais velha que 10K → HM mantém-se (gap insuficiente)", () => {
    const records = [
      makeRecord(21.1, 4.5, 50, TODAY), // HM há 50d
      makeRecord(10,   4.0, 10, TODAY), // 10K há 10d — gap = 40d ≤ 45d → sem troca
    ];
    const result = selectRiegelInput(records, 180, GOAL_3H, TODAY);
    expect(result!.sourceLabel).toBe("HM");
  });

  it("swap ocorre só entre os dois primeiros: 3 candidatos, topo antigo → segundo vence, terceiro ignorado", () => {
    const records = [
      makeRecord(21.1, 4.5, 100, TODAY), // HM há 100d (antiga)
      makeRecord(10,   4.0, 20,  TODAY), // 10K há 20d — gap=80d → HM troca com 10K
      makeRecord(5,    4.2, 5,   TODAY), // 5K há 5d — não entra na troca
    ];
    const result = selectRiegelInput(records, 180, GOAL_3H, TODAY);
    expect(result!.sourceLabel).toBe("10K"); // 10K ganhou a troca
  });
});

describe("selectRiegelInput — edge cases", () => {
  it("sem records → null", () => {
    expect(selectRiegelInput([], 180, GOAL_3H, TODAY)).toBeNull();
  });

  it("records fora da janela de tempo → null", () => {
    const result = selectRiegelInput(
      [makeRecord(10, 4.0, 200, TODAY)], // 200d > 180d maxAgeDays
      180, GOAL_3H, TODAY,
    );
    expect(result).toBeNull();
  });

  it("só um candidato qualifica → devolvido sem tentativa de swap", () => {
    const result = selectRiegelInput(
      [makeRecord(10, 4.0, 10, TODAY)],
      180, GOAL_3H, TODAY,
    );
    expect(result).not.toBeNull();
    expect(result!.sourceLabel).toBe("10K");
  });

  it("sem HM nem 10K representativos → cai para 5K", () => {
    const result = selectRiegelInput(
      [makeRecord(5, 4.0, 15, TODAY)], // 5K representativo
      180, GOAL_3H, TODAY,
    );
    expect(result).not.toBeNull();
    expect(result!.sourceLabel).toBe("5K");
    expect(result!.predictedMarathonSec).toBeGreaterThan(3 * 3600);
  });

  it("15K fora das categorias → ignorado, null", () => {
    const result = selectRiegelInput(
      [makeRecord(15, 4.0, 10, TODAY)], // 15K: nenhuma categoria cobre 12-18km
      180, GOAL_3H, TODAY,
    );
    expect(result).toBeNull();
  });

  it("dois 10K → escolhe o mais rápido", () => {
    const result = selectRiegelInput([
      makeRecord(10, 4.2, 20, TODAY), // mais lento
      makeRecord(10, 3.9, 10, TODAY), // mais rápido
    ], 180, GOAL_3H, TODAY);
    expect(result!.predictedMarathonSec).toBe(riegelMarathon(10, Math.round(3.9 * 60 * 10)));
  });
});
