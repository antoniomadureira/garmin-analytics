import { describe, it, expect } from "vitest";
import { selectPlannedWorkout, extractEvaluateVerdict, extractPlanFromMessage, buildReviewContext } from "@/lib/coach/evaluate";
import type { IcuPlannedEvent } from "@/lib/intervals/client";
import { SYSTEM_PROMPT_BASE, SYSTEM_PROMPT_EVALUATE_SUFFIX, SYSTEM_PROMPT_REVIEW_SUFFIX } from "@/lib/coach/system-prompt";
import { secPerKmToMinSec } from "@/lib/coach/workout-history";

const ICU_EVENT: IcuPlannedEvent = {
  id: 1,
  name: "Intervalos 6x1km",
  description: "6x\n- 1km 4:05-4:15/km Pace\n- 2min 5:00-5:15/km Pace",
};

// ─── selectPlannedWorkout — prioridade de fontes ──────────────────────────────

describe("selectPlannedWorkout — prioridade de fontes", () => {
  it("campo manual prevalece sobre evento ICU", () => {
    const plan = selectPlannedWorkout("6x1km @ 4:10", ICU_EVENT);
    expect(plan?.source).toBe("manual");
    expect(plan?.text).toBe("6x1km @ 4:10");
  });

  it("evento ICU usado quando não há campo manual", () => {
    const plan = selectPlannedWorkout(null, ICU_EVENT);
    expect(plan?.source).toBe("icu");
    expect(plan?.name).toBe("Intervalos 6x1km");
    expect(plan?.text).toBe(ICU_EVENT.description);
  });

  it("retorna null quando não há plano em nenhuma fonte (modo prescribe normal)", () => {
    const plan = selectPlannedWorkout(null, null);
    expect(plan).toBeNull();
  });

  it("string vazia no campo manual cai para ICU", () => {
    const plan = selectPlannedWorkout("   ", ICU_EVENT);
    expect(plan?.source).toBe("icu");
  });

  it("string vazia no campo manual sem ICU retorna null", () => {
    const plan = selectPlannedWorkout("   ", null);
    expect(plan).toBeNull();
  });

  it("evento ICU sem description não ativa evaluate mode", () => {
    const noDesc: IcuPlannedEvent = { id: 2, name: "Treino", description: null };
    const plan = selectPlannedWorkout(null, noDesc);
    expect(plan).toBeNull();
  });

  it("evento ICU com description vazia não ativa evaluate mode", () => {
    const emptyDesc: IcuPlannedEvent = { id: 3, name: "Treino", description: "   " };
    const plan = selectPlannedWorkout(null, emptyDesc);
    expect(plan).toBeNull();
  });

  it("manual text guarda name='Plano do dia'", () => {
    const plan = selectPlannedWorkout("corrida fácil 30min", null);
    expect(plan?.name).toBe("Plano do dia");
  });

  it("ICU source usa o nome do evento", () => {
    const plan = selectPlannedWorkout(null, ICU_EVENT);
    expect(plan?.name).toBe("Intervalos 6x1km");
  });
});

// ─── extractEvaluateVerdict — 3 veredictos ───────────────────────────────────

describe("extractEvaluateVerdict — 3 veredictos", () => {
  it("detecta ✅ Cumpre como está", () => {
    const reply = "📊 Último treino: 12km a 4:52/km (2026-07-11)\n→ ajuste: dentro do alvo\n\n✅ Cumpre como está — TSB +2, HRV normal.";
    expect(extractEvaluateVerdict(reply)).toBe("✅");
  });

  it("detecta ⚠️ Ajusta", () => {
    const reply = "📊 Último treino: 12km a 4:52/km\n→ ajuste: 16s mais rápido\n\n⚠️ Ajusta: corta para 4x — TSB −14.";
    expect(extractEvaluateVerdict(reply)).toBe("⚠️");
  });

  it("detecta 🛑 Não faças hoje", () => {
    const reply = "📊 Último treino: 12km a 4:52/km\n→ ajuste: dentro do alvo\n\n🛑 Não faças hoje: AQI 72 — alternativa: 40min Z2 indoor.";
    expect(extractEvaluateVerdict(reply)).toBe("🛑");
  });

  it("retorna null quando nenhum veredicto encontrado", () => {
    const reply = "TSB está em −5, parece razoável para treino moderado.";
    expect(extractEvaluateVerdict(reply)).toBeNull();
  });

  it("🛑 tem prioridade sobre ✅ e ⚠️ se múltiplos presentes", () => {
    const reply = "✅ parece ok... mas 🛑 Não faças hoje: AQI crítico.";
    expect(extractEvaluateVerdict(reply)).toBe("🛑");
  });

  it("⚠️ tem prioridade sobre ✅", () => {
    const reply = "✅ normalmente ok... ⚠️ Ajusta: reduz 2km — fadiga acumulada.";
    expect(extractEvaluateVerdict(reply)).toBe("⚠️");
  });
});

// ─── SYSTEM_PROMPT_EVALUATE_SUFFIX — conteúdo obrigatório ────────────────────

describe("SYSTEM_PROMPT_EVALUATE_SUFFIX — conteúdo obrigatório", () => {
  it("inclui os 3 emojis de veredicto", () => {
    expect(SYSTEM_PROMPT_EVALUATE_SUFFIX).toContain("✅");
    expect(SYSTEM_PROMPT_EVALUATE_SUFFIX).toContain("⚠️");
    expect(SYSTEM_PROMPT_EVALUATE_SUFFIX).toContain("🛑");
  });

  it("inclui exemplo com 📊 e veredicto ⚠️ preenchido", () => {
    expect(SYSTEM_PROMPT_EVALUATE_SUFFIX).toContain("📊");
    expect(SYSTEM_PROMPT_EVALUATE_SUFFIX).toMatch(/⚠️ Ajusta:/);
  });

  it("proíbe explicitamente o bloco ---ICU_WORKOUT--- no modo evaluate", () => {
    expect(SYSTEM_PROMPT_EVALUATE_SUFFIX).toContain("---ICU_WORKOUT---");
  });

  it("inclui a palavra PLANO DO DIA para marcação no contexto", () => {
    expect(SYSTEM_PROMPT_EVALUATE_SUFFIX).toContain("[PLANO DO DIA]");
  });

  it("não prescreve treino novo (instrução explícita)", () => {
    expect(SYSTEM_PROMPT_EVALUATE_SUFFIX).toMatch(/não.*prescrever|NÃO prescrever/i);
  });

  it("inclui regra de duração prescrita = todos os blocos (Bug 2b)", () => {
    expect(SYSTEM_PROMPT_EVALUATE_SUFFIX).toMatch(/aquecimento.*sessão.*arrefecimento|todos os blocos/i);
  });
});

// ─── Bug 1: pace format — 4.88 min/km → "4:53", nunca "4:88" ─────────────────

describe("secPerKmToMinSec — formato min:sec correto", () => {
  it("4.88 min/km → '4:53' (decimais convertidos, não '4:88')", () => {
    // Bug: .toFixed(2) produzia "4.88min/km"; LLM formatava como "4:88"
    // Fix: secPerKmToMinSec(Math.round(4.88 * 60)) = secPerKmToMinSec(293)
    expect(secPerKmToMinSec(Math.round(4.88 * 60))).toBe("4:53");
  });

  it("5.0 min/km → '5:00'", () => {
    expect(secPerKmToMinSec(Math.round(5.0 * 60))).toBe("5:00");
  });

  it("4.0 min/km → '4:00'", () => {
    expect(secPerKmToMinSec(Math.round(4.0 * 60))).toBe("4:00");
  });

  it("4.5 min/km → '4:30'", () => {
    expect(secPerKmToMinSec(Math.round(4.5 * 60))).toBe("4:30");
  });
});

// ─── Bug 2a: extractPlanFromMessage — auto-deteção de plano ──────────────────

describe("extractPlanFromMessage — auto-deteção de plano na mensagem", () => {
  it("'o plano era 6x1km @ 4:10/km' → não null", () => {
    expect(extractPlanFromMessage("o plano era 6x1km @ 4:10/km")).not.toBeNull();
  });

  it("'corri 8x1000m @ 3:55/km' → não null (padrão Nx)", () => {
    expect(extractPlanFromMessage("corri 8x1000m @ 3:55/km, como estou?")).not.toBeNull();
  });

  it("'o prescrito era 10km Z2' → não null", () => {
    expect(extractPlanFromMessage("o prescrito era 10km Z2")).not.toBeNull();
  });

  it("'@4:10/km' pattern → não null", () => {
    expect(extractPlanFromMessage("estava previsto @4:10/km e corri mais rápido")).not.toBeNull();
  });

  it("mensagem genérica → null (não activa evaluate)", () => {
    expect(extractPlanFromMessage("que treino devo fazer hoje?")).toBeNull();
  });

  it("pergunta de prontidão → null", () => {
    expect(extractPlanFromMessage("estou apto para treinar amanhã?")).toBeNull();
  });

  it("retorna o texto trimmed quando detectado", () => {
    const input = "  6x1km @ 4:10/km  ";
    const result = extractPlanFromMessage(input);
    expect(result).toBe("6x1km @ 4:10/km");
  });
});

// ─── Bug 3: buildReviewContext — comparação pré-calculada ────────────────────

const REVIEW_PLAN_ICU = { source: "icu" as const, name: "Intervalos 6x1km", text: "" };
const REVIEW_PLAN_MANUAL = { source: "manual" as const, name: "Plano do dia", text: "6x1km @ 4:10" };

describe("buildReviewContext — comparação execução vs plano", () => {
  it("inclui distância e tempo executados", () => {
    const exec = { distanceKm: 8.2, durationSec: 2100, paceMinPerKm: 4.3 };
    const result = buildReviewContext(exec, REVIEW_PLAN_ICU, null);
    expect(result).toContain("8.2km");
    expect(result).toContain("35min");
  });

  it("pace dentro do alvo → 'dentro do alvo'", () => {
    // 4:18/km = 258s; alvo 4:10-4:20/km = 250-260s
    const exec = { distanceKm: 8.2, durationSec: 2100, paceMinPerKm: 258 / 60 };
    const mainPace = { minSecPerKm: 250, maxSecPerKm: 260 };
    const result = buildReviewContext(exec, REVIEW_PLAN_ICU, mainPace);
    expect(result).toContain("dentro do alvo");
  });

  it("pace mais rápido → 'Xs mais rápido que o alvo'", () => {
    // 4:00/km = 240s; alvo 4:10-4:20 = 250-260; 250-240 = 10s mais rápido
    const exec = { distanceKm: 8.0, durationSec: 1920, paceMinPerKm: 240 / 60 };
    const mainPace = { minSecPerKm: 250, maxSecPerKm: 260 };
    const result = buildReviewContext(exec, REVIEW_PLAN_ICU, mainPace);
    expect(result).toContain("10s mais rápido que o alvo");
  });

  it("pace mais lento → 'Xs mais lento que o alvo'", () => {
    // 4:25/km = 265s; alvo 4:10-4:20 = 250-260; 265-260 = 5s mais lento
    const exec = { distanceKm: 8.0, durationSec: 2120, paceMinPerKm: 265 / 60 };
    const mainPace = { minSecPerKm: 250, maxSecPerKm: 260 };
    const result = buildReviewContext(exec, REVIEW_PLAN_ICU, mainPace);
    expect(result).toContain("5s mais lento que o alvo");
  });

  it("plano manual sem mainPace → sem tokens de desvio de pace", () => {
    const exec = { distanceKm: 8.2, durationSec: 2100, paceMinPerKm: 4.3 };
    const result = buildReviewContext(exec, REVIEW_PLAN_MANUAL, null);
    expect(result).not.toContain("mais rápido");
    expect(result).not.toContain("mais lento");
    expect(result).not.toContain("dentro do alvo");
    expect(result).toContain("8.2km");
  });

  it("pace null → mostra '—' em vez de erro", () => {
    const exec = { distanceKm: 8.2, durationSec: 2100, paceMinPerKm: null };
    const result = buildReviewContext(exec, REVIEW_PLAN_ICU, null);
    expect(result).toContain("—");
    expect(result).not.toThrow;
  });

  it("SYSTEM_PROMPT_REVIEW_SUFFIX inclui os 3 veredictos de execução", () => {
    expect(SYSTEM_PROMPT_REVIEW_SUFFIX).toContain("✅");
    expect(SYSTEM_PROMPT_REVIEW_SUFFIX).toContain("⚠️");
    expect(SYSTEM_PROMPT_REVIEW_SUFFIX).toContain("🛑");
  });

  it("SYSTEM_PROMPT_REVIEW_SUFFIX proíbe ICU_WORKOUT", () => {
    expect(SYSTEM_PROMPT_REVIEW_SUFFIX).toContain("---ICU_WORKOUT---");
  });

  it("SYSTEM_PROMPT_REVIEW_SUFFIX inclui regra de duração total", () => {
    expect(SYSTEM_PROMPT_REVIEW_SUFFIX).toMatch(/aquecimento.*sessão.*arrefecimento|todos os blocos/i);
  });
});

// ─── SYSTEM_PROMPT_BASE — regra 80/20 na linha → ajuste ──────────────────────

describe("SYSTEM_PROMPT_BASE — regra 80/20 na linha → ajuste", () => {
  it("instrução → ajuste tem 3 casos explícitos (a) (b) (c)", () => {
    expect(SYSTEM_PROMPT_BASE).toContain("(a)");
    expect(SYSTEM_PROMPT_BASE).toContain("(b)");
    expect(SYSTEM_PROMPT_BASE).toContain("(c)");
  });

  it("proíbe comparação de treino fácil contra pace de maratona (80/20)", () => {
    expect(SYSTEM_PROMPT_BASE).toMatch(/80\/20/);
    expect(SYSTEM_PROMPT_BASE).toMatch(/NUNCA comparares contra o pace de maratona/);
  });

  it("inclui exemplo de treino fácil/volume com caracterização qualitativa", () => {
    expect(SYSTEM_PROMPT_BASE).toContain("pace de volume correto para o dia seguinte");
  });

  it("caso (b) menciona 'treino sem prescrição' como sub-caso", () => {
    expect(SYSTEM_PROMPT_BASE).toContain("treino sem prescrição");
  });
});
