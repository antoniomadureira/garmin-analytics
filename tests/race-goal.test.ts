import { describe, it, expect } from "vitest";
import {
  weeksRemaining,
  cyclePhase,
  formatTimeDelta,
  deltaSeverity,
  formatMarathonTime,
} from "@/lib/coach/goal-store";
import { riegelMarathon } from "@/lib/analysis/race-prediction";

describe("weeksRemaining", () => {
  const RACE = "2026-10-10";

  it("mesmo dia que a prova → 0", () => {
    expect(weeksRemaining(RACE, "2026-10-10")).toBe(0);
  });

  it("exatamente 7 dias antes → 1 semana", () => {
    expect(weeksRemaining(RACE, "2026-10-03")).toBe(1);
  });

  it("exatamente 84 dias antes → 12 semanas", () => {
    // 2026-07-18 → 2026-10-10: Jul(13)+Ago(31)+Set(30)+Out(10) = 84 dias
    expect(weeksRemaining(RACE, "2026-07-18")).toBe(12);
  });

  it("85 dias antes → 12 semanas (floor, não 13)", () => {
    expect(weeksRemaining(RACE, "2026-07-17")).toBe(12);
  });

  it("exatamente 91 dias antes → 13 semanas", () => {
    expect(weeksRemaining(RACE, "2026-07-11")).toBe(13);
  });

  it("prova no passado → 0 (não negativo)", () => {
    expect(weeksRemaining("2026-01-01", "2026-07-09")).toBe(0);
  });
});

describe("cyclePhase", () => {
  it("13 semanas → base (>12)", () => expect(cyclePhase(13)).toBe("base"));
  it("12 semanas (fronteira) → especifico", () => expect(cyclePhase(12)).toBe("especifico"));
  it("7 semanas → especifico", () => expect(cyclePhase(7)).toBe("especifico"));
  it("3 semanas (fronteira) → especifico", () => expect(cyclePhase(3)).toBe("especifico"));
  it("2 semanas → taper (<3)", () => expect(cyclePhase(2)).toBe("taper"));
  it("0 semanas (dia de prova) → taper", () => expect(cyclePhase(0)).toBe("taper"));
});

describe("formatTimeDelta", () => {
  it("+0:00 quando igual ao objetivo", () => {
    expect(formatTimeDelta(0)).toBe("+0:00");
  });
  it("+5:00 para exatamente 5 minutos acima", () => {
    expect(formatTimeDelta(300)).toBe("+5:00");
  });
  it("+7:03 para 423s acima", () => {
    expect(formatTimeDelta(423)).toBe("+7:03");
  });
  it("−1:30 para 90s abaixo do objetivo", () => {
    expect(formatTimeDelta(-90)).toBe("−1:30");
  });
});

describe("deltaSeverity", () => {
  it("−1s → verde (mais rápido que o objetivo)", () => expect(deltaSeverity(-1)).toBe("green"));
  it("0s → verde (igual ao objetivo)", () => expect(deltaSeverity(0)).toBe("green"));
  it("1s → âmbar", () => expect(deltaSeverity(1)).toBe("amber"));
  it("300s → âmbar (fronteira 5min)", () => expect(deltaSeverity(300)).toBe("amber"));
  it("301s → vermelho (acima de 5min)", () => expect(deltaSeverity(301)).toBe("red"));
});

describe("formatMarathonTime", () => {
  it("10800s → 3:00:00", () => expect(formatMarathonTime(10800)).toBe("3:00:00"));
  it("10643s → 2:57:23", () => {
    // 2h57m23s = 2*3600 + 57*60 + 23 = 7200 + 3420 + 23 = 10643
    expect(formatMarathonTime(10643)).toBe("2:57:23");
  });
  it("11223s → 3:07:03", () => {
    // 3h7m3s = 3*3600 + 7*60 + 3 = 10800 + 420 + 3 = 11223
    expect(formatMarathonTime(11223)).toBe("3:07:03");
  });
});

// ─── Riegel — testes básicos (cobertura de selectRiegelInput em race-prediction.test.ts) ──

describe("riegelMarathon", () => {
  it("39:30 no 10K → previsão ~3:02 (entre 3:00 e 3:05)", () => {
    const result = riegelMarathon(10, 2370); // 39:30 = 2370s
    expect(result).toBeGreaterThanOrEqual(10800); // ≥ 3:00:00
    expect(result).toBeLessThan(11100);            // < 3:05:00
  });

  it("distância igual à maratona → devolve a própria duração", () => {
    expect(riegelMarathon(42.195, 10800)).toBe(10800);
  });

  it("esforço mais longo prediz maratona mais rápida (mesmo pace)", () => {
    const fromHm = riegelMarathon(21.0975, 5380);
    const from10k = riegelMarathon(10, 2550);
    expect(fromHm).toBeLessThan(from10k);
  });
});
