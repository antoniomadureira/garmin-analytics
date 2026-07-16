/**
 * Testa os invariantes da camada de cache do Freddy.
 * Cada test case corresponde a uma regressão documentada ou a um contrato explícito.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis");
vi.mock("@/lib/freddy/client", () => ({ getFreddyClient: vi.fn() }));

import { getFreddyClient } from "@/lib/freddy/client";
import { __store, __ops, __reset } from "../lib/__mocks__/redis";
import {
  metricsSignature,
  writeCachedDates,
  readCachedDates,
} from "@/lib/freddy/cache";
import { cachedQueryMetrics } from "@/lib/freddy/data-adapter";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeMockClient(callTool: ReturnType<typeof vi.fn>) {
  return { callTool, connect: vi.fn(), onerror: null };
}

/** Wraps text in the MCP content block shape that parseToolResult expects. */
function mcpText(text: string) {
  return { content: [{ type: "text", text }] };
}

const METRICS = ["wellness_restingHR"];
const SIG = metricsSignature(METRICS, true);
function cacheKey(date: string) {
  return `freddy:cache:v2:${SIG}:${date}`;
}

// ─── setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ─── (a) past dates served from cache — no Freddy call ─────────────────────

describe("(a) past dates served from cache", () => {
  it("returns cached data without calling getFreddyClient", async () => {
    __store.set(cacheKey("2020-01-01"), { restingHR: 54 });

    const result = await cachedQueryMetrics({
      metrics: METRICS,
      start: "2020-01-01",
      end: "2020-01-01",
      includeRaw: true,
    });

    expect(result["2020-01-01"]).toEqual({ restingHR: 54 });
    expect(getFreddyClient).not.toHaveBeenCalled();
  });

  it("merges cached hits with Freddy data for partial misses", async () => {
    __store.set(cacheKey("2020-01-01"), { restingHR: 54 });

    const callTool = vi.fn().mockResolvedValue(
      mcpText('2020-01-02:\n  raw: {"restingHR":57}\n')
    );
    vi.mocked(getFreddyClient).mockResolvedValue(
      makeMockClient(callTool) as never
    );

    const result = await cachedQueryMetrics({
      metrics: METRICS,
      start: "2020-01-01",
      end: "2020-01-02",
      includeRaw: true,
    });

    expect(result["2020-01-01"]).toEqual({ restingHR: 54 });
    expect(result["2020-01-02"]).toEqual({ restingHR: 57 });
    expect(callTool).toHaveBeenCalledTimes(1);
  });
});

// ─── (b) empty sentinel — not a miss on subsequent calls ──────────────────

describe("(b) sentinel prevents re-fetching empty days", () => {
  it("treats sentinel as a hit — no second Freddy call", async () => {
    // Pre-seed sentinel (what would have been written after a failed first fetch)
    __store.set(cacheKey("2020-01-01"), "__no_data__");

    const result = await cachedQueryMetrics({
      metrics: METRICS,
      start: "2020-01-01",
      end: "2020-01-01",
      includeRaw: true,
    });

    // Sentinel date is not in the result (it's an acknowledged empty day)
    expect(result["2020-01-01"]).toBeUndefined();
    expect(getFreddyClient).not.toHaveBeenCalled();
  });
});

// ─── (c) legacy-days fallback — regression: sentinel NOT written first ─────
//
// Regressão corrigida em 2026-07-03: a versão anterior gravava sentinels
// imediatamente após o range fetch devolver {}, ANTES de tentar o fallback
// legacy-days. Isso envenenava o cache por 30 dias.

describe("(c) range-empty + days → legacy fallback fires, no early sentinels", () => {
  it("falls back to legacy days when range fetch returns empty", async () => {
    const today = new Date().toISOString().slice(0, 10);

    const callTool = vi
      .fn()
      // 1st call: range query returns empty
      .mockResolvedValueOnce(
        mcpText("No data found for metrics: wellness_restingHR.")
      )
      // 2nd call: legacy days returns data for today
      .mockResolvedValueOnce(
        mcpText(`${today}:\n  raw: {"restingHR":54}\n`)
      );

    vi.mocked(getFreddyClient).mockResolvedValue(
      makeMockClient(callTool) as never
    );

    const result1 = await cachedQueryMetrics({
      metrics: METRICS,
      days: 7,
      includeRaw: true,
    });

    // Fallback was tried: 2 Freddy calls total
    expect(callTool).toHaveBeenCalledTimes(2);
    // Result contains the data from the legacy fallback
    expect(result1[today]).toEqual({ restingHR: 54 });

    // 2nd call — all dates now in cache, no further Freddy calls
    const callCountBefore = callTool.mock.calls.length;
    const result2 = await cachedQueryMetrics({
      metrics: METRICS,
      days: 7,
      includeRaw: true,
    });

    expect(callTool.mock.calls.length).toBe(callCountBefore);
    expect(result2[today]).toEqual({ restingHR: 54 });
  });

  it("does NOT invoke legacy fallback when args.days is absent", async () => {
    const callTool = vi
      .fn()
      .mockResolvedValue(mcpText("No data found for metrics: wellness_restingHR."));

    vi.mocked(getFreddyClient).mockResolvedValue(
      makeMockClient(callTool) as never
    );

    await cachedQueryMetrics({
      metrics: METRICS,
      start: "2020-01-01",
      end: "2020-01-01",
      includeRaw: true,
    });

    // No days arg → no legacy attempt → exactly 1 call
    expect(callTool).toHaveBeenCalledTimes(1);
  });
});

// ─── (d) TTLs ─────────────────────────────────────────────────────────────

describe("(d) TTLs: today 15min, ontem 6h, passado 30d", () => {
  it("writes correct TTLs via pipeline", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const past = "2020-01-01";

    await writeCachedDates(SIG, [today, yesterday, past], {
      [today]: { restingHR: 54 },
      [yesterday]: { restingHR: 55 },
      [past]: { restingHR: 56 },
    });

    const byKey = Object.fromEntries(__ops.map((o: { key: string; ttl?: number }) => [o.key, o.ttl]));
    expect(byKey[cacheKey(today)]).toBe(15 * 60);       // 900s
    expect(byKey[cacheKey(yesterday)]).toBe(6 * 3600);  // 21600s
    expect(byKey[cacheKey(past)]).toBe(30 * 24 * 3600); // 2592000s
  });

  it("uses long TTL for immutable past dates", async () => {
    await writeCachedDates(SIG, ["2019-06-15", "2021-03-22"], {
      "2019-06-15": { restingHR: 50 },
      "2021-03-22": { restingHR: 52 },
    });
    for (const op of __ops) {
      expect(op.ttl).toBe(30 * 24 * 3600);
    }
  });
});

// ─── (e) auth/transient error — sentinel NOT written ──────────────────────
//
// Regressão: token Freddy expirado devolvia texto não reconhecido (não
// "No data found") → parseToolResult retornava {} → writeCachedDates gravava
// sentinel envenenado para todas as datas pedidas. Fix: texto não reconhecido
// lança FreddyTransientError → cachedQueryMetrics não chega a writeCachedDates.

describe("(e) auth/transient error — sentinel NOT written", () => {
  it("auth error text → sem sentinel na cache, erro propagado", async () => {
    const callTool = vi.fn().mockResolvedValue(
      mcpText("Error: Authentication failed. Token expired.")
    );
    vi.mocked(getFreddyClient).mockResolvedValue(
      makeMockClient(callTool) as never
    );

    await expect(
      cachedQueryMetrics({
        metrics: METRICS,
        start: "2020-01-01",
        end: "2020-01-01",
        includeRaw: true,
      })
    ).rejects.toThrow();

    expect(__store.has(cacheKey("2020-01-01"))).toBe(false);
  });

  it("auth error com hits parciais em cache → devolve hits, sem sentinel", async () => {
    __store.set(cacheKey("2020-01-02"), { restingHR: 60 });

    const callTool = vi.fn().mockResolvedValue(
      mcpText("Error: Authentication failed. Token expired.")
    );
    vi.mocked(getFreddyClient).mockResolvedValue(
      makeMockClient(callTool) as never
    );

    const result = await cachedQueryMetrics({
      metrics: METRICS,
      start: "2020-01-01",
      end: "2020-01-02",
      includeRaw: true,
    });

    expect(result["2020-01-02"]).toEqual({ restingHR: 60 });
    expect(__store.has(cacheKey("2020-01-01"))).toBe(false);
  });

  it('"No data found" → grava sentinel (comportamento legítimo)', async () => {
    const callTool = vi.fn().mockResolvedValue(
      mcpText("No data found for metrics: wellness_restingHR.")
    );
    vi.mocked(getFreddyClient).mockResolvedValue(
      makeMockClient(callTool) as never
    );

    await cachedQueryMetrics({
      metrics: METRICS,
      start: "2020-01-01",
      end: "2020-01-01",
      includeRaw: true,
    });

    expect(__store.get(cacheKey("2020-01-01"))).toBe("__no_data__");
  });
});

// ─── readCachedDates contract ──────────────────────────────────────────────

describe("readCachedDates", () => {
  it("returns hit for sentinel — date is not a miss", async () => {
    __store.set(cacheKey("2020-01-01"), "__no_data__");
    const { hits, misses } = await readCachedDates(SIG, ["2020-01-01"]);
    expect(misses).toHaveLength(0);
    expect(hits["2020-01-01"]).toBeUndefined(); // sentinel is not in hits
  });

  it("reports null/undefined as miss", async () => {
    const { misses } = await readCachedDates(SIG, ["2020-01-01"]);
    expect(misses).toContain("2020-01-01");
  });
});
