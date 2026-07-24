import { describe, it, expect } from "vitest";
import { getLastActivityDate } from "@/lib/utils/activity";

describe("getLastActivityDate", () => {
  it("múltiplas datas — devolve a mais recente com km > 0", () => {
    const daily = [
      { date: "2026-07-01", km: 10 },
      { date: "2026-07-02", km: 0 },
      { date: "2026-07-03", km: 8 },
      { date: "2026-07-04", km: 0 },
    ];
    expect(getLastActivityDate(daily)).toBe("2026-07-03");
  });

  it("todos km=0 → null (nenhuma atividade nos 7 dias)", () => {
    expect(
      getLastActivityDate([
        { date: "2026-07-01", km: 0 },
        { date: "2026-07-02", km: 0 },
        { date: "2026-07-07", km: 0 },
      ]),
    ).toBeNull();
  });

  it("array vazio → null", () => {
    expect(getLastActivityDate([])).toBeNull();
  });

  it("último elemento tem km=0 mas há entrada anterior com km > 0", () => {
    const daily = [
      { date: "2026-07-05", km: 12 },
      { date: "2026-07-06", km: 0 },
      { date: "2026-07-07", km: 0 },
    ];
    expect(getLastActivityDate(daily)).toBe("2026-07-05");
  });

  it("atividade fantasma (0.1km) seguida de real (15km) → devolve a real", () => {
    const daily = [
      { date: "2026-07-22", km: 15 },
      { date: "2026-07-23", km: 0.1 },
    ];
    expect(getLastActivityDate(daily)).toBe("2026-07-22");
  });

  it("apenas atividades fantasma → null (sem treino recente)", () => {
    const daily = [
      { date: "2026-07-21", km: 0.1 },
      { date: "2026-07-22", km: 0.05 },
    ];
    expect(getLastActivityDate(daily)).toBeNull();
  });
});
