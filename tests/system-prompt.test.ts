import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT_BASE } from "@/lib/coach/system-prompt";

describe("SYSTEM_PROMPT_BASE — prescription template 📊", () => {
  it("começa a resposta de prescrição com a linha 📊 Último treino", () => {
    expect(SYSTEM_PROMPT_BASE).toContain("📊 Último treino:");
  });

  it("inclui a linha → ajuste:", () => {
    expect(SYSTEM_PROMPT_BASE).toContain("→ ajuste:");
  });

  it("tem fallback para sem treino registado", () => {
    expect(SYSTEM_PROMPT_BASE).toContain("📊 Sem treino recente registado");
  });

  it("o exemplo mostra a linha 📊 preenchida com valores reais (km e pace)", () => {
    // O exemplo concreto ensina o modelo — verifica que está lá
    expect(SYSTEM_PROMPT_BASE).toMatch(/📊 Último treino: \d+\.\d+km a \d+:\d+\/km/);
  });

  it("o exemplo mostra → ajuste preenchido", () => {
    expect(SYSTEM_PROMPT_BASE).toMatch(/→ ajuste: .{20,}/);
  });
});
