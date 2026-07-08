import { describe, it, expect } from "vitest";
import { getPreviousDayWellness } from "@/lib/utils/wellness";

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
    // ontem e anteontem presentes, sem registo hoje
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
