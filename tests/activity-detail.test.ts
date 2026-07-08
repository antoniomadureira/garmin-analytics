import { describe, it, expect } from "vitest";
import { needsFreddyFetch } from "@/lib/utils/activity-detail";

const base = {
  series: [] as unknown[],
  samplesUnavailable: false,
};

const point = { distanceKm: 0.1, hr: 140, altitude: 10, paceMinPerKm: 6.0, cadence: 180 };

describe("needsFreddyFetch — decisão de fetch de dados ricos no ActivityDetailPanel", () => {
  it("sem initialData → fetch obrigatório", () => {
    expect(needsFreddyFetch(undefined)).toBe(true);
  });

  it("initialData parcial: series vazio, samplesUnavailable false → fetch (cache stale ou dados em falta)", () => {
    expect(needsFreddyFetch({ ...base, series: [], samplesUnavailable: false })).toBe(true);
  });

  it("initialData completo: series não vazio → sem fetch (já temos os dados ricos)", () => {
    expect(needsFreddyFetch({ ...base, series: [point], samplesUnavailable: false })).toBe(false);
  });

  it("initialData com samplesUnavailable true → sem fetch (amostras confirmadamente ausentes, fetch não ajudaria)", () => {
    expect(needsFreddyFetch({ ...base, series: [], samplesUnavailable: true })).toBe(false);
  });
});
