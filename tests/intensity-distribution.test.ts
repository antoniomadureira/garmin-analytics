import { describe, it, expect } from "vitest";
import {
  aggregateIntensity,
  getIntensityStatus,
  EASY_OK_THRESHOLD,
  EASY_CAUTION_THRESHOLD,
  LOW_VOLUME_SECONDS,
} from "@/lib/analysis/intensity-distribution";

// ─── aggregateIntensity ───────────────────────────────────────────────────────

describe("aggregateIntensity", () => {
  it("semana polarizada — ~85% fácil, lowVolume false", () => {
    // Z0=0, Z1=4000, Z2=4000, Z3=900, Z4=400, Z5=100, Z6=0 → total=9400
    const result = aggregateIntensity([
      { zoneSeconds: [0, 4000, 4000, 900, 400, 100, 0] },
    ]);
    expect(result.easySec).toBe(8000);
    expect(result.moderateSec).toBe(900);
    expect(result.strongSec).toBe(500);
    expect(result.totalSec).toBe(9400);
    expect(result.easyPct).toBeCloseTo(85.1, 0);
    expect(result.lowVolume).toBe(false); // 9400s > 7200s
  });

  it("semana cinzenta — ~60-75% fácil (duas atividades)", () => {
    // Atividade 1: Z1=1000, Z2=1000, Z3=1500, Z4=400
    // Atividade 2: Z1=1000, Z2=1000, Z3=500, Z4=100
    // easy=4000, moderate=2000, strong=500, total=6500 → 61.5% fácil
    const result = aggregateIntensity([
      { zoneSeconds: [0, 1000, 1000, 1500, 400, 0, 0] },
      { zoneSeconds: [0, 1000, 1000, 500, 100, 0, 0] },
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
      { zoneSeconds: [0, 500, 500, 100, 0, 0, 0] },
    ]);
    expect(result.lowVolume).toBe(true);
  });

  it("Z0 é excluído do total", () => {
    // Mesmo Z0 gigante, não deve contar
    const result = aggregateIntensity([
      { zoneSeconds: [99999, 4000, 4000, 900, 400, 100, 0] },
    ]);
    expect(result.totalSec).toBe(9400); // sem Z0
    expect(result.easySec).toBe(8000);
  });

  it("percentagens somam ~100%", () => {
    const result = aggregateIntensity([
      { zoneSeconds: [0, 3600, 3600, 1800, 900, 300, 0] },
    ]);
    const total = (result.easyPct ?? 0) + (result.moderatePct ?? 0) + (result.strongPct ?? 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it("Z4+Z5+Z6 todos contribuem para strongSec", () => {
    const result = aggregateIntensity([
      { zoneSeconds: [0, 0, 0, 0, 600, 300, 100] },
    ]);
    expect(result.strongSec).toBe(1000);
    expect(result.easySec).toBe(0);
    expect(result.moderateSec).toBe(0);
  });

  it("array de atividades — soma correcta entre atividades", () => {
    const result = aggregateIntensity([
      { zoneSeconds: [0, 1800, 0, 0, 0, 0, 0] },
      { zoneSeconds: [0, 1800, 0, 0, 0, 0, 0] },
      { zoneSeconds: [0, 0, 3600, 0, 0, 0, 0] },
    ]);
    // Z1: 1800+1800=3600; Z2: 3600 → easy = 7200
    expect(result.easySec).toBe(7200);
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
