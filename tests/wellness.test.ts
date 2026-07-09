import { describe, it, expect } from "vitest";
import { getPreviousDayWellness, getDecisionWellness, getMorningWellness } from "@/lib/utils/wellness";

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

// ─── getMorningWellness ───────────────────────────────────────────────────────
// Devolve o último registo com sono/HRV/RHR (tipicamente hoje, sem restrição
// de date < hoje). Dados de manhã não são contaminados pelo push do coach.

interface WMorning {
  date: string;
  sleepScore: number | null;
  hrv: number | null;
  restingHr: number | null;
  tsb: number; // só para o teste de integração
}

const morningFixture: WMorning[] = [
  { date: "2026-07-06", sleepScore: 70, hrv: 55, restingHr: 57, tsb:  3.0 },
  { date: "2026-07-07", sleepScore: 59, hrv: 48, restingHr: 54, tsb: -15.8 }, // ontem — TSB real
  { date: "2026-07-08", sleepScore: 76, hrv: 61, restingHr: 50, tsb:  -5.9 }, // hoje — sono fresco, TSB contaminado
];

describe("getMorningWellness", () => {
  it("devolve o último registo com sono/HRV (hoje, não ontem)", () => {
    const r = getMorningWellness(morningFixture);
    expect(r?.date).toBe("2026-07-08");
    expect(r?.sleepScore).toBe(76);
  });

  it("array vazio → undefined", () => {
    expect(getMorningWellness([])).toBeUndefined();
  });

  it("ignora entradas onde os três campos são null/undefined", () => {
    const sparse: WMorning[] = [
      { date: "2026-07-06", sleepScore: 65, hrv: 50, restingHr: 56, tsb: 2 },
      { date: "2026-07-07", sleepScore: null, hrv: null, restingHr: null, tsb: -10 },
    ];
    const r = getMorningWellness(sparse);
    expect(r?.date).toBe("2026-07-06"); // salta 07-07 (tudo null) e devolve 07-06
  });

  it("aceita registo de hoje (sem restrição date < today)", () => {
    // contraste com getDecisionWellness que excluiria hoje
    const withToday: WMorning[] = [
      { date: "2026-07-07", sleepScore: 59, hrv: 48, restingHr: 54, tsb: -15.8 },
      { date: "2026-07-09", sleepScore: 80, hrv: 65, restingHr: 49, tsb: 1 },
    ];
    expect(getMorningWellness(withToday)?.date).toBe("2026-07-09");
    expect(getDecisionWellness(withToday, "2026-07-09")?.date).toBe("2026-07-07");
  });

  it("integração: sono de hoje (getMorning) vs TSB de ontem (getDecision) — sinais independentes", () => {
    const morning = getMorningWellness(morningFixture);
    const decision = getDecisionWellness(morningFixture, "2026-07-08");

    // sono fresco da noite passada (registo de hoje)
    expect(morning?.sleepScore).toBe(76);
    expect(morning?.date).toBe("2026-07-08");

    // TSB real de ontem (antes de qualquer push do coach)
    expect(decision?.tsb).toBe(-15.8);
    expect(decision?.date).toBe("2026-07-07");
  });
});
