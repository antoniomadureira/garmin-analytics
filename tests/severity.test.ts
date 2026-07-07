/**
 * Tabela exaustiva de casos para as funções de severidade de sinais fisiológicos.
 * Cobre direção (RHR positivo = pior, HRV negativo = pior) e fronteiras dos limiares.
 * Cada linha que falhou em produção representa uma regressão bloqueada aqui.
 */
import { describe, it, expect } from "vitest";
import {
  hrvSeverity,
  rhrSeverity,
  bodyBatterySeverity,
  tsbSeverity,
} from "@/lib/ui/signal-severity";

// ─── hrvSeverity ──────────────────────────────────────────────────────────
// pct ≥ -5 → good | ≥ -10 → warn | < -10 → bad

describe("hrvSeverity", () => {
  const cases: [number, "good" | "warn" | "bad"][] = [
    [10, "good"],   // acima da média
    [0, "good"],    // igual à média
    [-5, "good"],   // fronteira superior do good
    [-5.1, "warn"], // just below -5
    [-10, "warn"],  // fronteira inferior do warn
    [-10.1, "bad"], // just below -10
    [-15, "bad"],
    [-25, "bad"],
  ];
  for (const [pct, expected] of cases) {
    it(`hrvSeverity(${pct}) → ${expected}`, () => {
      expect(hrvSeverity(pct)).toBe(expected);
    });
  }
});

// ─── rhrSeverity ──────────────────────────────────────────────────────────
// delta bpm < 2 → good | ≤ 5 → warn | > 5 → bad
// Direcção: delta positivo = FC acima da média = pior.
// Regressão: +2bpm mostrava "good" (verde) quando devia ser "warn".

describe("rhrSeverity", () => {
  const cases: [number, "good" | "warn" | "bad"][] = [
    [-3, "good"],  // abaixo da média (melhor)
    [0, "good"],
    [1, "good"],   // ≤1 bpm = ruído de medição
    [1.9, "good"], // just below 2
    [2, "warn"],   // REGRESSÃO: +2bpm deve ser warn, não good
    [3, "warn"],
    [5, "warn"],   // fronteira superior do warn
    [5.1, "bad"],  // just above 5
    [10, "bad"],
  ];
  for (const [delta, expected] of cases) {
    it(`rhrSeverity(${delta}) → ${expected}`, () => {
      expect(rhrSeverity(delta)).toBe(expected);
    });
  }
});

// ─── bodyBatterySeverity ─────────────────────────────────────────────────
// pct ≥ 70 → good | ≥ 45 → warn | < 45 → bad

describe("bodyBatterySeverity", () => {
  const cases: [number, "good" | "warn" | "bad"][] = [
    [100, "good"],
    [70, "good"],  // fronteira do good
    [69, "warn"],  // just below 70
    [45, "warn"],  // fronteira do warn
    [44, "bad"],   // just below 45
    [37, "bad"],   // caso produção reportado
    [0, "bad"],
  ];
  for (const [pct, expected] of cases) {
    it(`bodyBatterySeverity(${pct}) → ${expected}`, () => {
      expect(bodyBatterySeverity(pct)).toBe(expected);
    });
  }
});

// ─── tsbSeverity ──────────────────────────────────────────────────────────
// tsb > 5 → good | ≥ -10 → warn | < -10 → bad

describe("tsbSeverity", () => {
  const cases: [number, "good" | "warn" | "bad"][] = [
    [20, "good"],
    [6, "good"],    // just above 5
    [5, "warn"],    // fronteira: 5 é warn não good (> 5 é good)
    [0, "warn"],
    [-10, "warn"],  // fronteira do warn
    [-10.1, "bad"], // just below -10
    [-20, "bad"],
  ];
  for (const [tsb, expected] of cases) {
    it(`tsbSeverity(${tsb}) → ${expected}`, () => {
      expect(tsbSeverity(tsb)).toBe(expected);
    });
  }
});
