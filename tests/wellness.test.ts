import { describe, it, expect } from "vitest";
import { getPreviousDayWellness, getDecisionWellness } from "@/lib/utils/wellness";

interface W { date: string; atl: number; }

describe("getPreviousDayWellness", () => {
  const wellness: W[] = [
    { date: "2026-07-06", atl: 45 },
    { date: "2026-07-07", atl: 52 },
    { date: "2026-07-08", atl: 99 }, // hoje — inflacionado pelo push do coach
  ];

  it("devolve o último registo ANTES de hoje, não o de hoje", () => {
    const result = getPreviousDayWellness(wellness, "2026-07-08");
    expect(result?.date).toBe("2026-07-07");
    expect(result?.atl).toBe(52); // normal, não inflacionado
  });

  it("ignora entradas de hoje (date === todayStr)", () => {
    const single: W[] = [{ date: "2026-07-08", atl: 99 }];
    expect(getPreviousDayWellness(single, "2026-07-08")).toBeUndefined();
  });

  it("array vazio → undefined", () => {
    expect(getPreviousDayWellness([], "2026-07-08")).toBeUndefined();
  });

  it("todos os registos no futuro → undefined", () => {
    const future: W[] = [{ date: "2026-07-09", atl: 10 }];
    expect(getPreviousDayWellness(future, "2026-07-08")).toBeUndefined();
  });

  it("devolve o mais recente entre vários elegíveis", () => {
    const past: W[] = [
      { date: "2026-07-05", atl: 40 },
      { date: "2026-07-06", atl: 48 },
      { date: "2026-07-07", atl: 55 },
    ];
    const result = getPreviousDayWellness(past, "2026-07-08");
    expect(result?.date).toBe("2026-07-07");
    expect(result?.atl).toBe(55);
  });
});

// ─── getDecisionWellness — um teste por consumidor migrado ───────────────────
// Fixture partilhada: hoje (2026-07-08) está contaminado pelo push do coach
// (atl e tsb inflacionados); ontem (2026-07-07) representa a carga real.

interface WDecision {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  restingHr: number;
  sleepScore: number;
}

const TODAY = "2026-07-08";
const contaminated: WDecision[] = [
  { date: "2026-07-05", ctl: 48, atl: 44, tsb:  4.0, restingHr: 56, sleepScore: 80 },
  { date: "2026-07-06", ctl: 49, atl: 46, tsb:  3.0, restingHr: 55, sleepScore: 78 },
  { date: "2026-07-07", ctl: 50, atl: 52, tsb: -15.8, restingHr: 54, sleepScore: 59 }, // ontem — real
  { date: "2026-07-08", ctl: 50, atl: 99, tsb:  -5.9, restingHr: 48, sleepScore: 76 }, // hoje — contaminado
];

describe("getDecisionWellness — hoje contaminado", () => {
  it("loadTrainingLoad: CTL/ATL/TSB vêm de ontem, não de hoje", () => {
    const r = getDecisionWellness(contaminated, TODAY);
    expect(r?.date).toBe("2026-07-07");
    expect(r?.tsb).toBe(-15.8);   // hoje teria -5.9 (inflacionado)
    expect(r?.atl).toBe(52);      // hoje teria 99 (contaminado)
    expect(r?.ctl).toBe(50);
  });

  it("getRecoveryInsightsFromWellness: restingHr vem de ontem, não de hoje", () => {
    const r = getDecisionWellness(contaminated, TODAY);
    expect(r?.restingHr).toBe(54); // hoje teria 48 (Garmin pode não ter sincronizado ainda)
  });

  it("getComposedReadinessFromWellness: sleepScore vem de ontem, não de hoje", () => {
    const r = getDecisionWellness(contaminated, TODAY);
    expect(r?.sleepScore).toBe(59); // hoje teria 76 — esta era a divergência "sono 59 vs 76"
  });

  it("coach context (buildContextSummary): usa dados de ontem", () => {
    // O coach passa todayStr explicitamente — comportamento idêntico
    const r = getDecisionWellness(contaminated, TODAY);
    expect(r?.date).toBe("2026-07-07");
    expect(r?.tsb).toBe(-15.8);
  });

  it("sem registo anterior a hoje → undefined (sem crash)", () => {
    const onlyToday = [contaminated[contaminated.length - 1]]; // só hoje
    expect(getDecisionWellness(onlyToday, TODAY)).toBeUndefined();
  });
});
