import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseSleepPhaseBlocks, computeSleepAlerts } from "@/lib/analysis/sleep-phases";
import { parseQueryMetricsText } from "@/lib/freddy/data-adapter";

const SYNTH = path.join(process.cwd(), "tests/fixtures-synthetic");
const synthSleepLevels = readFileSync(path.join(SYNTH, "sleep-levels.txt"), "utf8");

// ─── parseSleepPhaseBlocks ───────────────────────────────────────────────────

describe("parseSleepPhaseBlocks", () => {
  it("retorna null quando sleepLevelsMap é null", () => {
    expect(parseSleepPhaseBlocks(1000000, null)).toBeNull();
  });

  it("retorna null quando sleepLevelsMap é undefined", () => {
    expect(parseSleepPhaseBlocks(1000000, undefined)).toBeNull();
  });

  it("retorna null quando startEpochSec é null", () => {
    expect(parseSleepPhaseBlocks(null, { deep: [{ startTimeInSeconds: 100, endTimeInSeconds: 200 }] })).toBeNull();
  });

  it("retorna null para sleepLevelsMap vazio {} (sem fases)", () => {
    expect(parseSleepPhaseBlocks(1000000, {})).toBeNull();
  });

  it("calcula startOffsetSec correto (offset = start - sleepStart)", () => {
    const T = 1000000;
    const blocks = parseSleepPhaseBlocks(T, {
      deep: [{ startTimeInSeconds: T + 1800, endTimeInSeconds: T + 7200 }],
    });
    expect(blocks).not.toBeNull();
    expect(blocks![0].startOffsetSec).toBe(1800);
    expect(blocks![0].durationSec).toBe(5400);
    expect(blocks![0].phase).toBe("deep");
  });

  it("calcula durationSec correto", () => {
    const T = 1000000;
    const blocks = parseSleepPhaseBlocks(T, {
      rem: [{ startTimeInSeconds: T + 7800, endTimeInSeconds: T + 13200 }],
    });
    expect(blocks![0].durationSec).toBe(5400); // 90 min
  });

  it("ordena blocos por startOffsetSec (várias fases intercaladas)", () => {
    const T = 1000000;
    // light 0-30, deep 30-120, awake 120-130, rem 130-220
    const blocks = parseSleepPhaseBlocks(T, {
      light: [{ startTimeInSeconds: T, endTimeInSeconds: T + 1800 }],
      deep: [{ startTimeInSeconds: T + 1800, endTimeInSeconds: T + 7200 }],
      awake: [{ startTimeInSeconds: T + 7200, endTimeInSeconds: T + 7800 }],
      rem: [{ startTimeInSeconds: T + 7800, endTimeInSeconds: T + 13200 }],
    });
    expect(blocks).toHaveLength(4);
    expect(blocks![0].phase).toBe("light");
    expect(blocks![0].startOffsetSec).toBe(0);
    expect(blocks![1].phase).toBe("deep");
    expect(blocks![1].startOffsetSec).toBe(1800);
    expect(blocks![2].phase).toBe("awake");
    expect(blocks![2].startOffsetSec).toBe(7200);
    expect(blocks![3].phase).toBe("rem");
    expect(blocks![3].startOffsetSec).toBe(7800);
  });

  it("fixture sintética 2024-01-08 — 5 blocos com offsets corretos", () => {
    // T=1000000; light 0-30, deep 30-120, awake 120-130, rem 130-220, light 220-290
    const parsed = parseQueryMetricsText(synthSleepLevels) as Record<
      string,
      { startTimeInSeconds: number; sleepLevelsMap: Record<string, unknown> }
    >;
    const night = parsed["2024-01-08"];
    const blocks = parseSleepPhaseBlocks(night.startTimeInSeconds, night.sleepLevelsMap as never);
    expect(blocks).not.toBeNull();
    expect(blocks).toHaveLength(5);
    expect(blocks![0].phase).toBe("light");
    expect(blocks![0].startOffsetSec).toBe(0);
    expect(blocks![1].phase).toBe("deep");
    expect(blocks![1].startOffsetSec).toBe(1800);
    expect(blocks![1].durationSec).toBe(5400); // 90 min
    expect(blocks![2].phase).toBe("awake");
    expect(blocks![3].phase).toBe("rem");
    expect(blocks![3].durationSec).toBe(5400); // 90 min
    expect(blocks![4].phase).toBe("light");
  });

  it("fixture sintética 2024-01-01 — sleepLevelsMap:{} devolve null", () => {
    const parsed = parseQueryMetricsText(synthSleepLevels) as Record<
      string,
      { startTimeInSeconds: number; sleepLevelsMap: Record<string, unknown> }
    >;
    const night = parsed["2024-01-01"];
    const blocks = parseSleepPhaseBlocks(night.startTimeInSeconds, night.sleepLevelsMap as never);
    expect(blocks).toBeNull();
  });
});

// ─── computeSleepAlerts ──────────────────────────────────────────────────────

// 8 noites da fixture sintética (valores escalares)
const NIGHTS_8 = [
  { deepSec: 5400, remSec: 5400, awakeSec: 600 }, // 2024-01-08 — deep ok, rem ok
  { deepSec: 3000, remSec: 4200, awakeSec: 600 }, // 2024-01-07 — deep low, rem low
  { deepSec: 3000, remSec: 4200, awakeSec: 600 }, // 2024-01-06 — deep low, rem low
  { deepSec: 3000, remSec: 4200, awakeSec: 600 }, // 2024-01-05 — deep low, rem low
  { deepSec: 5400, remSec: 4200, awakeSec: 600 }, // 2024-01-04 — rem low only
  { deepSec: 5400, remSec: 5400, awakeSec: 600 }, // 2024-01-03 — ok
  { deepSec: 5400, remSec: 5400, awakeSec: 600 }, // 2024-01-02 — ok
  { deepSec: 4800, remSec: 4800, awakeSec: 900 }, // 2024-01-01 — sem sleepLevelsMap (escalares presentes)
];

describe("computeSleepAlerts", () => {
  it("dispara deepLow com 3 noites deep<60min", () => {
    const alerts = computeSleepAlerts(NIGHTS_8);
    expect(alerts.some((a) => a.includes("sono profundo"))).toBe(true);
  });

  it("dispara remLow com 5 noites rem<90min", () => {
    const alerts = computeSleepAlerts(NIGHTS_8);
    expect(alerts.some((a) => a.includes("REM"))).toBe(true);
  });

  it("NÃO dispara fragmentado (0 noites awake>45min)", () => {
    const alerts = computeSleepAlerts(NIGHTS_8);
    expect(alerts.some((a) => a.includes("fragmentado"))).toBe(false);
  });

  it("deepLow NÃO dispara com apenas 2 noites (threshold=3)", () => {
    const nights = [
      { deepSec: 3000, remSec: 5400, awakeSec: 600 },
      { deepSec: 3000, remSec: 5400, awakeSec: 600 },
      { deepSec: 5400, remSec: 5400, awakeSec: 600 },
    ];
    const alerts = computeSleepAlerts(nights);
    expect(alerts.some((a) => a.includes("sono profundo"))).toBe(false);
  });

  it("fragmentado dispara com 3 noites awake>45min", () => {
    const nights = [
      { deepSec: 5400, remSec: 5400, awakeSec: 3000 }, // 50min acordado
      { deepSec: 5400, remSec: 5400, awakeSec: 3000 },
      { deepSec: 5400, remSec: 5400, awakeSec: 3000 },
    ];
    const alerts = computeSleepAlerts(nights);
    expect(alerts.some((a) => a.includes("fragmentado"))).toBe(true);
  });

  it("retorna [] quando sem alertas", () => {
    const nights = [
      { deepSec: 5400, remSec: 5400, awakeSec: 600 },
      { deepSec: 5400, remSec: 5400, awakeSec: 600 },
    ];
    expect(computeSleepAlerts(nights)).toHaveLength(0);
  });

  it("retorna [] para array vazio", () => {
    expect(computeSleepAlerts([])).toHaveLength(0);
  });

  it("alerta deepLow tem mensagem de mitigação", () => {
    const nights = Array(3).fill({ deepSec: 1800, remSec: 5400, awakeSec: 600 });
    const alerts = computeSleepAlerts(nights);
    expect(alerts[0]).toContain("rever");
  });

  it("fixture sintética 8 noites — exatamente 2 alertas (deepLow + remLow)", () => {
    const alerts = computeSleepAlerts(NIGHTS_8);
    expect(alerts).toHaveLength(2);
  });
});

// ─── fixture sintética — estrutura ───────────────────────────────────────────

describe("fixture sintética sleep-levels.txt", () => {
  it("tem 8 entradas de datas", () => {
    const parsed = parseQueryMetricsText(synthSleepLevels);
    expect(Object.keys(parsed)).toHaveLength(8);
  });

  it("datas estão no formato YYYY-MM-DD", () => {
    const parsed = parseQueryMetricsText(synthSleepLevels);
    for (const key of Object.keys(parsed)) {
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("2024-01-08 tem sleepLevelsMap com 4 fases", () => {
    const parsed = parseQueryMetricsText(synthSleepLevels) as Record<string, Record<string, unknown>>;
    const slm = parsed["2024-01-08"].sleepLevelsMap as Record<string, unknown>;
    expect(slm).toBeDefined();
    expect(Object.keys(slm)).toHaveLength(4);
    expect(slm.rem).toBeDefined();
    expect(slm.deep).toBeDefined();
  });

  it("2024-01-08 tem deepSleepDurationInSeconds=5400 (90min)", () => {
    const parsed = parseQueryMetricsText(synthSleepLevels) as Record<string, Record<string, unknown>>;
    expect(parsed["2024-01-08"].deepSleepDurationInSeconds).toBe(5400);
  });

  it("2024-01-07 tem deepSleepDurationInSeconds=3000 (50min — abaixo de 60min)", () => {
    const parsed = parseQueryMetricsText(synthSleepLevels) as Record<string, Record<string, unknown>>;
    expect(parsed["2024-01-07"].deepSleepDurationInSeconds).toBe(3000);
  });
});
