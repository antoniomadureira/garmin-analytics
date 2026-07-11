import { describe, it, expect } from "vitest";
import { decouplingInterpretation } from "@/lib/analysis/decoupling";

describe("decouplingInterpretation", () => {
  it("0% → controlo aeróbico sólido", () => {
    expect(decouplingInterpretation(0)).toContain("controlo aeróbico sólido");
  });

  it("3.5% → controlo aeróbico sólido", () => {
    expect(decouplingInterpretation(3.5)).toContain("controlo aeróbico sólido");
  });

  it("4.9% (abaixo do limiar 5) → controlo aeróbico sólido", () => {
    expect(decouplingInterpretation(4.9)).toContain("controlo aeróbico sólido");
  });

  it("5.0% (limiar exato) → algum drift", () => {
    expect(decouplingInterpretation(5.0)).toContain("algum drift");
    expect(decouplingInterpretation(5.0)).toContain("consolidar");
  });

  it("6.5% → algum drift", () => {
    expect(decouplingInterpretation(6.5)).toContain("algum drift");
  });

  it("8.0% (limiar superior exato) → algum drift (inclusive)", () => {
    expect(decouplingInterpretation(8.0)).toContain("algum drift");
  });

  it("8.01% (acima do limiar) → drift acentuado", () => {
    expect(decouplingInterpretation(8.01)).toContain("drift acentuado");
    expect(decouplingInterpretation(8.01)).toContain("desidratação");
  });

  it("12% → drift acentuado", () => {
    expect(decouplingInterpretation(12)).toContain("drift acentuado");
  });
});
