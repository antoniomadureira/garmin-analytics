import { describe, it, expect } from "vitest";
import {
  aggregateIntensity,
  getIntensityStatus,
  EASY_OK_THRESHOLD,
  EASY_CAUTION_THRESHOLD,
  LOW_VOLUME_SECONDS,
} from "@/lib/analysis/intensity-distribution";

// ─── aggregateIntensity ───────────────────────────────────────────────────────
// [Certo] O array ICU é 0-indexado: zones[0]=Z1, zones[1]=Z2, zones[2]=Z3,
// zones[3..6]=Z4..Z7. Confirmado nos dados reais de 21-22/07/2026.

describe("aggregateIntensity", () => {
  it("semana polarizada — ~85% fácil, lowVolume false", () => {
    // Z1=4000, Z2=4000, Z3=900, Z4=400, Z5=100, Z6=0, Z7=0 → total=9400
    const result = aggregateIntensity([
      { zoneSeconds: [4000, 4000, 900, 400, 100, 0, 0] },
    ]);
    expect(result.easySec).toBe(8000);     // Z1+Z2
    expect(result.moderateSec).toBe(900);  // Z3
    expect(result.strongSec).toBe(500);    // Z4+Z5
    expect(result.totalSec).toBe(9400);
    expect(result.easyPct).toBeCloseTo(85.1, 0);
    expect(result.lowVolume).toBe(false); // 9400s > 7200s
  });

  it("semana cinzenta — ~60% fácil (duas atividades)", () => {
    // Atividade 1: Z1=1000, Z2=1000, Z3=1500, Z4=400
    // Atividade 2: Z1=1000, Z2=1000, Z3=500, Z4=100
    // easy=4000, moderate=2000, strong=500, total=6500 → 61.5% fácil
    const result = aggregateIntensity([
      { zoneSeconds: [1000, 1000, 1500, 400, 0, 0, 0] },
      { zoneSeconds: [1000, 1000, 500, 100, 0, 0, 0] },
    ]);
    expect(result.easySec).toBe(4000);
    expect(result.moderateSec).toBe(2000);
    expect(result.strongSec).toBe(500);
    expect(result.easyPct).toBeCloseTo(61.5, 0);
    expect(result.lowVolume).toBe(true); // 6500s < LOW_VOLUME_SECONDS (7200s)
  });

  it("semana vazia — array vazio → lowVolume true + percentagens null", () => {
    const result = aggregateIntensity([]);
    expect(result.easySec).toBe(0);
    expect(result.totalSec).toBe(0);
    expect(result.easyPct).toBeNull();
    expect(result.moderatePct).toBeNull();
    expect(result.strongPct).toBeNull();
    expect(result.lowVolume).toBe(true);
  });

  it("semana com dados insuficientes → lowVolume true", () => {
    // 1100s < LOW_VOLUME_SECONDS (7200s)
    const result = aggregateIntensity([
      { zoneSeconds: [500, 500, 100, 0, 0, 0, 0] },
    ]);
    expect(result.lowVolume).toBe(true);
  });

  it("índice 0 é Z1 (fácil) — incluído em easySec", () => {
    // [Certo] zones[0]=Z1: confirmar que não é excluído
    const result = aggregateIntensity([
      { zoneSeconds: [3600, 0, 0, 0, 0, 0, 0] }, // só Z1
    ]);
    expect(result.easySec).toBe(3600);
    expect(result.totalSec).toBe(3600);
    expect(result.easyPct).toBe(100);
    expect(result.lowVolume).toBe(true); // 3600s < 7200s, sem durationSec → fallback totalSec
  });

  it("percentagens somam ~100%", () => {
    const result = aggregateIntensity([
      { zoneSeconds: [3600, 3600, 1800, 900, 300, 0, 0] },
    ]);
    const total = (result.easyPct ?? 0) + (result.moderatePct ?? 0) + (result.strongPct ?? 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it("Z4+Z5+Z6+Z7 todos contribuem para strongSec (índices 3-6)", () => {
    const result = aggregateIntensity([
      { zoneSeconds: [0, 0, 0, 600, 300, 100, 50] },
    ]);
    expect(result.strongSec).toBe(1050);
    expect(result.easySec).toBe(0);
    expect(result.moderateSec).toBe(0);
  });

  it("array de atividades — soma correcta entre atividades", () => {
    const result = aggregateIntensity([
      { zoneSeconds: [1800, 0, 0, 0, 0, 0, 0] }, // Z1
      { zoneSeconds: [1800, 0, 0, 0, 0, 0, 0] }, // Z1
      { zoneSeconds: [0, 3600, 0, 0, 0, 0, 0] }, // Z2
    ]);
    // Z1: 1800+1800=3600; Z2: 3600 → easy = 7200
    expect(result.easySec).toBe(7200);
  });

  it("caso real 21-22/07/2026 — >90% fácil (regressão do mapeamento ICU)", () => {
    // Dados reais do Freddy confirmados 2026-07-24:
    // 22/07: {"zones":[4081,39,0,0,0,0,0]} — 1h09 a 100% Z1
    // 21/07: {"zones":[4955,187,57,96,237,47,0]} — 1h33, maioria Z1
    const result = aggregateIntensity([
      { zoneSeconds: [4081, 39, 0, 0, 0, 0, 0], durationSec: 4120 },
      { zoneSeconds: [4955, 187, 57, 96, 237, 47, 0], durationSec: 5579 },
    ]);
    expect(result.easySec).toBe(4081 + 39 + 4955 + 187);  // 9262
    expect(result.moderateSec).toBe(57);
    expect(result.strongSec).toBe(96 + 237 + 47);          // 380
    expect(result.totalSec).toBe(9699);
    expect(result.easyPct).toBeGreaterThan(90); // >90% fácil
    expect(result.lowVolume).toBe(false);
  });

  it("durationSec ausente → fallback totalSec para lowVolume (retrocompat.)", () => {
    // Sem durationSec: totalDurationSec=0 → fallback para totalSec
    const result = aggregateIntensity([
      { zoneSeconds: [500, 500, 100, 0, 0, 0, 0] }, // totalSec=1100
    ]);
    expect(result.lowVolume).toBe(true); // 1100s < 7200s
  });

  it("durationSec > totalSec (GPS dropout) → lowVolume usa durationSec", () => {
    // Treino com 3h de duração mas apenas 90min de dados de zona (GPS dropout)
    const result = aggregateIntensity([
      { zoneSeconds: [3600, 1800, 0, 0, 0, 0, 0], durationSec: 10800 }, // 3h real
    ]);
    expect(result.totalSec).toBe(5400);    // 90min em zona
    expect(result.lowVolume).toBe(false);  // durationSec=10800 > 7200
  });
});

// ─── getIntensityStatus ───────────────────────────────────────────────────────

describe("getIntensityStatus — limiares nomeados", () => {
  it(`≥ EASY_OK_THRESHOLD (${EASY_OK_THRESHOLD}%) → ok`, () => {
    expect(getIntensityStatus(EASY_OK_THRESHOLD)).toBe("ok");
    expect(getIntensityStatus(80)).toBe("ok");
    expect(getIntensityStatus(100)).toBe("ok");
  });

  it(`[EASY_CAUTION_THRESHOLD, EASY_OK_THRESHOLD) → caution`, () => {
    expect(getIntensityStatus(EASY_OK_THRESHOLD - 0.1)).toBe("caution");
    expect(getIntensityStatus(70)).toBe("caution");
    expect(getIntensityStatus(EASY_CAUTION_THRESHOLD)).toBe("caution");
  });

  it(`< EASY_CAUTION_THRESHOLD (${EASY_CAUTION_THRESHOLD}%) → alert`, () => {
    expect(getIntensityStatus(EASY_CAUTION_THRESHOLD - 0.1)).toBe("alert");
    expect(getIntensityStatus(50)).toBe("alert");
    expect(getIntensityStatus(0)).toBe("alert");
  });

  it("null → alert (sem dados)", () => {
    expect(getIntensityStatus(null)).toBe("alert");
  });
});

// ─── LOW_VOLUME_SECONDS sanity ────────────────────────────────────────────────

describe("LOW_VOLUME_SECONDS", () => {
  it("é exactamente 2 horas em segundos", () => {
    expect(LOW_VOLUME_SECONDS).toBe(7200);
  });
});
