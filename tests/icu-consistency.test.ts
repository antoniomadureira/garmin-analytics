import { describe, it, expect } from "vitest";
import { parseIcuBlockStats, extractTextTotalDistance, checkIcuConsistency } from "@/lib/coach/icu-consistency";

// ─── Fixture: caso real 2026-07-09 ─────────────────────────────────────────
// Texto: treino contínuo mencionando 13.5km
// Bloco ICU: warmup 15min + 10km main + recuperação 3min + cooldown 10min
// → dois problemas: distância divergente E recuperação espúria

const REAL_CASE_ICU = `Warmup
- 15min 65-70% HR

Main Set
- 10km 4:45-5:00/km Pace

Recovery
- 3min Z1 HR

Cooldown
- 10min 60-65% HR`;

const REAL_CASE_TEXT = `📊 Último treino: 18.7km a 4:46/km (2026-07-07)
→ ajuste: Volume alto ontem — hoje baixo volume e pace controlado.

### 🏃 Corrida Fácil
TSB favorável; bom momento para consolidar a base aeróbica com 13.5km a pace confortável.

**Aquecimento:** 15min a pace fácil (FC < 140bpm)
**Sessão Principal:** 10km a 4:45-5:00/km (FC < 150bpm)
**Arrefecimento:** 10min a pace fácil (FC < 130bpm)

**🎯 Objetivo:** base aeróbica, acumulação de volume
**💡 Pós-Treino:** hidratação e 10min de alongamentos`;

// ─── Fixture: treino de intervalos correto (pace numérico em todos os steps) ─
const INTERVALS_ICU = `Warmup
- 2km 5:30-6:00/km Pace

6x
- 800mtr 3:50-4:00/km Pace
- 2min 5:30-6:00/km Pace

Cooldown
- 1.5km 5:30-6:00/km Pace`;

const INTERVALS_TEXT = `📊 Último treino: 14.2km a 4:52/km (2026-07-07)
→ ajuste: Pace controlado ontem confirma recuperação — hoje subo ao limiar.

### ⚡ Corrida de Intervalos
6× 800mtr com recuperação ativa — total ~8.3km incluindo aquecimento e arrefecimento.

**Aquecimento:** 2km a 5:30-5:45/km (FC < 140bpm)
**Sessão Principal:** 6× 800mtr a 3:50-4:00/km (FC < 175bpm), recuperação 2min Z1 HR
**Arrefecimento:** 1.5km a 6:00/km (FC < 130bpm)`;

// ─── parseIcuBlockStats ───────────────────────────────────────────────────

describe("parseIcuBlockStats — caso real (inconsistência)", () => {
  it("soma corretamente a distância explícita (só o passo de 10km)", () => {
    const stats = parseIcuBlockStats(REAL_CASE_ICU);
    expect(stats.totalDistanceKm).toBe(10);
  });

  it("soma os passos de duração (15+3+10 = 28min)", () => {
    const stats = parseIcuBlockStats(REAL_CASE_ICU);
    expect(stats.totalDurationMin).toBe(28);
  });

  it("detecta recuperação espúria (secção Recovery sem repetições)", () => {
    const stats = parseIcuBlockStats(REAL_CASE_ICU);
    expect(stats.hasSpuriousRecovery).toBe(true);
  });

  it("não marca como treino de intervalos", () => {
    const stats = parseIcuBlockStats(REAL_CASE_ICU);
    expect(stats.hasIntervals).toBe(false);
  });
});

describe("parseIcuBlockStats — intervalos corretos (pace-only)", () => {
  it("soma distâncias: 2km + 6×0.8km + 1.5km = 8.3km", () => {
    const stats = parseIcuBlockStats(INTERVALS_ICU);
    expect(stats.totalDistanceKm).toBeCloseTo(8.3, 1);
  });

  it("soma durações: 6×2min = 12min", () => {
    const stats = parseIcuBlockStats(INTERVALS_ICU);
    expect(stats.totalDurationMin).toBe(12);
  });

  it("marca como treino de intervalos (6x)", () => {
    const stats = parseIcuBlockStats(INTERVALS_ICU);
    expect(stats.hasIntervals).toBe(true);
  });

  it("não marca recuperação espúria (a recuperação está dentro do bloco 6x)", () => {
    const stats = parseIcuBlockStats(INTERVALS_ICU);
    expect(stats.hasSpuriousRecovery).toBe(false);
  });

  it("não tem métricas mistas (tudo Pace)", () => {
    const stats = parseIcuBlockStats(INTERVALS_ICU);
    expect(stats.hasMixedMetrics).toBe(false);
  });

  it("não tem zona de pace — tudo pace numérico", () => {
    const stats = parseIcuBlockStats(INTERVALS_ICU);
    expect(stats.hasZonePace).toBe(false);
  });
});

describe("parseIcuBlockStats — casos básicos", () => {
  it("bloco só de mtr: 800mtr = 0.8km", () => {
    const stats = parseIcuBlockStats("Main\n- 800mtr 4:00/km Pace");
    expect(stats.totalDistanceKm).toBeCloseTo(0.8, 2);
  });

  it("bloco vazio → tudo zero", () => {
    const stats = parseIcuBlockStats("");
    expect(stats.totalDistanceKm).toBe(0);
    expect(stats.totalDurationMin).toBe(0);
    expect(stats.hasIntervals).toBe(false);
    expect(stats.hasSpuriousRecovery).toBe(false);
    expect(stats.hasMixedMetrics).toBe(false);
    expect(stats.hasZonePace).toBe(false);
  });

  it("recuperação dentro de repetições NÃO é espúria", () => {
    const desc = `Main\n\n3x\n- 1km 4:30/km Pace\n- 2min Z1 Pace\n\nCooldown\n- 1km Z1 Pace`;
    const stats = parseIcuBlockStats(desc);
    expect(stats.hasIntervals).toBe(true);
    expect(stats.hasSpuriousRecovery).toBe(false);
  });
});

// ─── hasMixedMetrics ──────────────────────────────────────────────────────

describe("parseIcuBlockStats — hasMixedMetrics", () => {
  it("só Pace → sem mistura", () => {
    const icu = `Warmup\n- 2km Z1 Pace\n\nMain Set\n- 10km 5:00-5:15/km Pace\n\nCooldown\n- 2km Z1 Pace`;
    expect(parseIcuBlockStats(icu).hasMixedMetrics).toBe(false);
  });

  it("só HR → sem mistura", () => {
    const icu = `Warmup\n- 15min 60-65% HR\n\nMain Set\n- 10min Z2 HR\n\nCooldown\n- 10min 60-65% HR`;
    expect(parseIcuBlockStats(icu).hasMixedMetrics).toBe(false);
  });

  it("warmup em HR + main em Pace → mistura detectada", () => {
    const icu = `Warmup\n- 15min 60-65% HR\n\nMain Set\n- 10km 5:00-5:15/km Pace\n\nCooldown\n- 10min 60-65% HR`;
    expect(parseIcuBlockStats(icu).hasMixedMetrics).toBe(true);
  });

  it("recuperação em Z1 HR dentro de bloco Nx com Pace → mistura detectada", () => {
    const icu = `Warmup\n- 2km Z1 Pace\n\n6x\n- 800mtr 3:50-4:00/km Pace\n- 2min Z1 HR\n\nCooldown\n- 1.5km Z1 Pace`;
    expect(parseIcuBlockStats(icu).hasMixedMetrics).toBe(true);
  });

  it("REAL_CASE_ICU (HR warmup/cooldown + Pace main) → mistura detectada", () => {
    expect(parseIcuBlockStats(REAL_CASE_ICU).hasMixedMetrics).toBe(true);
  });
});

// ─── hasZonePace ─────────────────────────────────────────────────────────

describe("parseIcuBlockStats — hasZonePace", () => {
  it("pace numérico → sem zona de pace", () => {
    const icu = `Main Set\n- 10km 5:00-5:15/km Pace`;
    expect(parseIcuBlockStats(icu).hasZonePace).toBe(false);
  });

  it("Z1 Pace (sem numérico) → zona de pace detectada", () => {
    const icu = `Warmup\n- 2km Z1 Pace`;
    expect(parseIcuBlockStats(icu).hasZonePace).toBe(true);
  });

  it("Z2 Pace na recuperação → zona de pace detectada", () => {
    const icu = `Main\n\n4x\n- 1km 4:15-4:25/km Pace\n- 2min Z2 Pace`;
    expect(parseIcuBlockStats(icu).hasZonePace).toBe(true);
  });

  it("Z2-Z3 Pace (range de zonas) → zona de pace detectada", () => {
    const icu = `Main Set\n- 15min Z2-Z3 Pace`;
    expect(parseIcuBlockStats(icu).hasZonePace).toBe(true);
  });

  it("pace numérico com referência a zona em texto ('Z2') sem 'Zx Pace' → não detecta", () => {
    // Zx aparece em texto descritivo, não como target
    const icu = `Main Set\n- 10km 4:45-5:00/km Pace`;
    expect(parseIcuBlockStats(icu).hasZonePace).toBe(false);
  });
});

// ─── checkIcuConsistency — métricas mistas ───────────────────────────────

describe("checkIcuConsistency — métricas mistas", () => {
  it("workout com HR e Pace gera warning de mistura", () => {
    const icu = `Warmup\n- 15min 60-65% HR\n\nMain Set\n- 10km 5:00-5:15/km Pace`;
    const result = checkIcuConsistency("treino de 10km", icu);
    expect(result.warning).not.toBeNull();
    expect(result.warning).toContain("Pace e de HR");
  });

  it("workout pace-only (numérico) não gera warning de mistura", () => {
    const icu = `Warmup\n- 2km 5:30-6:00/km Pace\n\nMain Set\n- 10km 5:00-5:15/km Pace\n\nCooldown\n- 2km 5:30-6:00/km Pace`;
    const result = checkIcuConsistency("treino de 14km", icu);
    expect(result.warning).toBeNull();
  });

  it("workout HR-only não gera warning de mistura", () => {
    const icu = `Warmup\n- 15min 65-70% HR\n\nMain Set\n- 30min Z2 HR\n\nCooldown\n- 10min 60-65% HR`;
    const result = checkIcuConsistency("treino de 45min", icu);
    expect(result.warning).toBeNull();
  });
});

// ─── checkIcuConsistency — hasIntervals propagado para resultado ─────────

describe("checkIcuConsistency — hasIntervals no ConsistencyResult", () => {
  it("intervalos (6x) → hasIntervals true", () => {
    const result = checkIcuConsistency(INTERVALS_TEXT, INTERVALS_ICU);
    expect(result.hasIntervals).toBe(true);
  });

  it("treino contínuo (sem Nx) → hasIntervals false", () => {
    const result = checkIcuConsistency(REAL_CASE_TEXT, REAL_CASE_ICU);
    expect(result.hasIntervals).toBe(false);
  });
});

// ─── checkIcuConsistency — zona de pace ──────────────────────────────────

describe("checkIcuConsistency — hasZonePace", () => {
  it("workout com 'Z1 Pace' gera warning de zona sem numérico", () => {
    const icu = `Warmup\n- 2km Z1 Pace\n\nMain Set\n- 10km 5:00-5:15/km Pace\n\nCooldown\n- 2km Z1 Pace`;
    const result = checkIcuConsistency("treino de 14km", icu);
    expect(result.warning).not.toBeNull();
    expect(result.warning).toContain("null-null");
  });

  it("workout com pace numérico em todos os steps não gera warning de zona", () => {
    const icu = `Warmup\n- 2km 5:30-6:00/km Pace\n\nMain Set\n- 10km 5:00-5:15/km Pace\n\nCooldown\n- 2km 5:30-6:00/km Pace`;
    const result = checkIcuConsistency("treino de 14km", icu);
    expect(result.warning).toBeNull();
  });
});

// ─── extractTextTotalDistance ─────────────────────────────────────────────

describe("extractTextTotalDistance", () => {
  it("extrai 13.5km do caso real", () => {
    expect(extractTextTotalDistance(REAL_CASE_TEXT)).toBeCloseTo(13.5, 1);
  });

  it("aceita km com vírgula (13,5km)", () => {
    expect(extractTextTotalDistance("treino de 13,5km hoje")).toBeCloseTo(13.5, 1);
  });

  it("ignora distâncias < 3km (passos individuais)", () => {
    expect(extractTextTotalDistance("aquecimento de 1km e 800mtr de series")).toBeNull();
  });

  it("retorna null se não há menção de km", () => {
    expect(extractTextTotalDistance("treino de 45min fácil")).toBeNull();
  });
});

// ─── checkIcuConsistency ──────────────────────────────────────────────────

describe("checkIcuConsistency — caso real", () => {
  it("detecta inconsistência de distância (texto 13.5km vs ICU 10km)", () => {
    const result = checkIcuConsistency(REAL_CASE_TEXT, REAL_CASE_ICU);
    expect(result.warning).not.toBeNull();
    expect(result.warning).toContain("13.5km");
    expect(result.warning).toContain("10.0km");
  });

  it("também detecta recuperação espúria no mesmo warning", () => {
    const result = checkIcuConsistency(REAL_CASE_TEXT, REAL_CASE_ICU);
    expect(result.warning).toContain("Recuperação");
  });

  it("reporta textDistanceKm e icuDistanceKm", () => {
    const result = checkIcuConsistency(REAL_CASE_TEXT, REAL_CASE_ICU);
    expect(result.textDistanceKm).toBeCloseTo(13.5, 1);
    expect(result.icuDistanceKm).toBe(10);
  });
});

describe("checkIcuConsistency — sem inconsistência (estado: consistente)", () => {
  it("intervalos corretos não geram warning nem unverifiable", () => {
    const result = checkIcuConsistency(INTERVALS_TEXT, INTERVALS_ICU);
    expect(result.warning).toBeNull();
    expect(result.unverifiable).toBe(false);
  });

  it("treino só de duração (sem distância em nenhum lado) — não é unverifiable porque ICU também não tem distância", () => {
    const text = "### 🏃 Corrida Fácil\n45min fácil a ritmo conversacional.";
    const icu = "Main\n- 45min 65-70% HR";
    const result = checkIcuConsistency(text, icu);
    expect(result.warning).toBeNull();
    expect(result.unverifiable).toBe(false);
  });

  it("diferença de <20% ou <1km não gera warning", () => {
    const text = "treino de 10km confortável";
    const icu = "Main\n- 9.5km 5:00/km Pace";
    const result = checkIcuConsistency(text, icu);
    // 0.5km / 10km = 5% < 20% → sem warning
    expect(result.warning).toBeNull();
    expect(result.unverifiable).toBe(false);
  });
});

describe("checkIcuConsistency — estado unverifiable", () => {
  it("ICU com distância e texto sem distância extraível → unverifiable", () => {
    const text = "### 🏃 Corrida Fácil\nTreino aeróbico de recuperação activa a ritmo muito fácil.";
    const icu = "Main\n- 10km 5:30-5:45/km Pace";
    const result = checkIcuConsistency(text, icu);
    expect(result.warning).toBeNull();
    expect(result.unverifiable).toBe(true);
    expect(result.icuDistanceKm).toBe(10);
    expect(result.textDistanceKm).toBeNull();
  });

  it("unverifiable é false quando há warning (problema encontrado, não ambiguidade)", () => {
    const result = checkIcuConsistency(REAL_CASE_TEXT, REAL_CASE_ICU);
    expect(result.warning).not.toBeNull();
    expect(result.unverifiable).toBe(false);
  });
});
