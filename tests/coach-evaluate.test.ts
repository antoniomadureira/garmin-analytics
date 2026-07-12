import { describe, it, expect } from "vitest";
import { selectPlannedWorkout, extractEvaluateVerdict } from "@/lib/coach/evaluate";
import type { IcuPlannedEvent } from "@/lib/intervals/client";
import { SYSTEM_PROMPT_EVALUATE_SUFFIX } from "@/lib/coach/system-prompt";

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
});
