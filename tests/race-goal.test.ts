import { describe, it, expect } from "vitest";
import {
  weeksRemaining,
  cyclePhase,
  formatTimeDelta,
  deltaSeverity,
  formatMarathonTime,
} from "@/lib/coach/goal-store";
import { riegelMarathon, selectRiegelInput } from "@/lib/analysis/race-prediction";

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

// ─── Riegel ───────────────────────────────────────────────────────────────────

describe("riegelMarathon", () => {
  it("39:30 no 10K → previsão ~3:02 (entre 3:00 e 3:05)", () => {
    const result = riegelMarathon(10, 2370); // 39:30 = 2370s
    expect(result).toBeGreaterThanOrEqual(10800); // ≥ 3:00:00
    expect(result).toBeLessThan(11100);            // < 3:05:00
  });

  it("distância igual à maratona → devolve a própria duração", () => {
    // T2 = T1 × (42.195/42.195)^1.06 = T1 × 1 = T1
    expect(riegelMarathon(42.195, 10800)).toBe(10800);
  });

  it("esforço mais longo prediz maratona mais rápida (mesmo pace)", () => {
    // HM a pace 4:15/km: 21.0975 × 255 ≈ 5380s
    const fromHm = riegelMarathon(21.0975, 5380);
    // 10K ao mesmo pace: 10 × 255 = 2550s
    const from10k = riegelMarathon(10, 2550);
    // Riegel não é pace-linear — HM prediz maratona mais rápida
    expect(fromHm).toBeLessThan(from10k);
  });
});

describe("selectRiegelInput", () => {
  const today = new Date().toISOString().slice(0, 10);
  const recent = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  it("HM recente → usa HM (label=HM)", () => {
    const result = selectRiegelInput([{ distanceKm: 21.0975, durationSec: 5400, date: recent(10) }]);
    expect(result?.sourceLabel).toBe("HM");
  });

  it("prefere HM a 10K quando ambos disponíveis", () => {
    const result = selectRiegelInput([
      { distanceKm: 10, durationSec: 2370, date: recent(5) },
      { distanceKm: 21.0975, durationSec: 5400, date: recent(10) },
    ]);
    expect(result?.sourceLabel).toBe("HM");
  });

  it("sem HM recente cai para 15K", () => {
    const result = selectRiegelInput([{ distanceKm: 15, durationSec: 3600, date: recent(20) }]);
    expect(result?.sourceLabel).toBe("15K");
  });

  it("sem HM nem 15K cai para 10K", () => {
    const result = selectRiegelInput([{ distanceKm: 10, durationSec: 2370, date: recent(30) }]);
    expect(result?.sourceLabel).toBe("10K");
    expect(result?.predictedMarathonSec).toBeGreaterThan(10800);
  });

  it("registo fora da janela de 90 dias → null", () => {
    const result = selectRiegelInput([{ distanceKm: 10, durationSec: 2370, date: recent(91) }]);
    expect(result).toBeNull();
  });

  it("lista vazia → null", () => {
    expect(selectRiegelInput([])).toBeNull();
  });

  it("escolhe o mais rápido quando há dois 10K recentes", () => {
    const result = selectRiegelInput([
      { distanceKm: 10, durationSec: 2500, date: recent(10) },
      { distanceKm: 10, durationSec: 2370, date: recent(5) }, // mais rápido
    ]);
    expect(result?.predictedMarathonSec).toBe(riegelMarathon(10, 2370));
  });

  it("inclui sourceDate do esforço selecionado", () => {
    const d = recent(15);
    const result = selectRiegelInput([{ distanceKm: 10, durationSec: 2370, date: d }]);
    expect(result?.sourceDate).toBe(d);
  });

  it("hoje está dentro da janela (edge: 0 dias atrás)", () => {
    const result = selectRiegelInput([{ distanceKm: 10, durationSec: 2370, date: today }]);
    expect(result).not.toBeNull();
  });
});
