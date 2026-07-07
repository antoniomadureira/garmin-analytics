/**
 * Testa computeHrvDeltaPct e computeHrvDeviation.
 *
 * O teste crítico é o da auto-referência: a regressão original incluía
 * o valor de HOJE na média do baseline, fazendo com que dias com HRV
 * muito baixo aparecessem com desvios menores do que o real.
 *
 * Guard de fonte única: este ficheiro importa computeHrvDeviation de
 * @/lib/utils/hrv — o mesmo módulo usado pelos caminhos do card
 * (getComposedReadinessFromWellness) e do coach (getRecoveryInsights).
 * Se alguém re-introduzir um baseline inline noutro sítio, este teste
 * não vai detectar isso diretamente, mas a divergência de resultados
 * entre os dois UIs voltaria a aparecer no dashboard e seria apanhada
 * pelas asserções de behavioral dos testes de integração futuros.
 */
import { describe, it, expect } from "vitest";
import {
  computeHrvDeltaPct,
  computeHrvDeviation,
} from "@/lib/utils/hrv";

// ─── computeHrvDeltaPct ───────────────────────────────────────────────────

describe("computeHrvDeltaPct", () => {
  it("retorna 0 quando hrv == baseline", () => {
    expect(computeHrvDeltaPct(50, 50)).toBe(0);
  });

  it("retorna positivo quando hrv > baseline", () => {
    expect(computeHrvDeltaPct(55, 50)).toBe(10);
  });

  it("retorna negativo quando hrv < baseline", () => {
    expect(computeHrvDeltaPct(45, 50)).toBe(-10);
  });

  it("arredonda a 1 casa decimal", () => {
    // (37 - 40) / 40 = -0.075 → -7.5%
    expect(computeHrvDeltaPct(37, 40)).toBe(-7.5);
  });
});

// ─── computeHrvDeviation — baseline não auto-referencial ─────────────────

describe("computeHrvDeviation", () => {
  it("extrai o último entry como hrv atual", () => {
    const wellness = [{ hrv: 40 }, { hrv: 42 }, { hrv: 35 }];
    const { hrv } = computeHrvDeviation(wellness);
    expect(hrv).toBe(35);
  });

  it("calcula baseline a partir dos entries ANTERIORES ao último (não auto-referencial)", () => {
    // Baseline deve ser média de [40, 42] = 41, NÃO de [40, 42, 35] = 39
    const wellness = [{ hrv: 40 }, { hrv: 42 }, { hrv: 35 }];
    const { baseline } = computeHrvDeviation(wellness);
    expect(baseline).toBe(41);
  });

  it("deltaPct correto com baseline não auto-referencial", () => {
    // baseline = 40 (avg de [40,40,40]), hoje = 30
    // delta = (30 - 40) / 40 = -25%
    // Com o bug antigo: baseline = (40+40+40+30)/4 = 37.5, delta ≈ -20%
    const wellness = [{ hrv: 40 }, { hrv: 40 }, { hrv: 40 }, { hrv: 30 }];
    const { deltaPct } = computeHrvDeviation(wellness);
    expect(deltaPct).toBe(-25);
  });

  it("ignora entradas com hrv null no baseline", () => {
    const wellness = [
      { hrv: 40 },
      { hrv: null },
      { hrv: 60 },
      { hrv: 35 }, // latest
    ];
    const { baseline } = computeHrvDeviation(wellness);
    // null é excluído: média de [40, 60] = 50
    expect(baseline).toBe(50);
  });

  it("retorna null quando hrv mais recente é null", () => {
    const wellness = [{ hrv: 40 }, { hrv: null }];
    const { hrv, deltaPct } = computeHrvDeviation(wellness);
    expect(hrv).toBeNull();
    expect(deltaPct).toBeNull();
  });

  it("retorna null quando não há entries anteriores suficientes para baseline", () => {
    const wellness = [{ hrv: 40 }]; // só hoje, sem histórico
    const { baseline, deltaPct } = computeHrvDeviation(wellness);
    expect(baseline).toBeNull();
    expect(deltaPct).toBeNull();
  });

  it("retorna tudo null para array vazio", () => {
    const { hrv, baseline, deltaPct } = computeHrvDeviation([]);
    expect(hrv).toBeNull();
    expect(baseline).toBeNull();
    expect(deltaPct).toBeNull();
  });

  // Guard: arredondamento do baseline a 1 decimal
  it("arredonda baseline a 1 decimal", () => {
    // média de [37, 43] = 40.0 (exacto)
    const wellness = [{ hrv: 37 }, { hrv: 43 }, { hrv: 35 }];
    const { baseline } = computeHrvDeviation(wellness);
    expect(baseline).toBe(40);
  });
});
