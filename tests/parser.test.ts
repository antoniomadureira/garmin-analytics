import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";

vi.mock("@/lib/redis");
vi.mock("@/lib/freddy/client", () => ({ getFreddyClient: vi.fn() }));

import { parseQueryMetricsText } from "@/lib/freddy/data-adapter";
import { extractValuesByDate } from "@/lib/freddy/metrics";

const SYNTH = path.join(process.cwd(), "tests/fixtures-synthetic");
const REAL = path.join(process.cwd(), "tests/fixtures");

const synthWellness = readFileSync(path.join(SYNTH, "wellness.txt"), "utf8");
const synthNoData = readFileSync(path.join(SYNTH, "no-data.txt"), "utf8");

const realExists = existsSync(path.join(REAL, "wellness.txt"));
const realWellness = realExists ? readFileSync(path.join(REAL, "wellness.txt"), "utf8") : "";
const realNoData = realExists ? readFileSync(path.join(REAL, "no-data.txt"), "utf8") : "";

function parserSuite(wellness: string, noData: string) {
  describe("parseQueryMetricsText", () => {
    it("extracts 7 date entries from wellness fixture", () => {
      const result = parseQueryMetricsText(wellness);
      expect(Object.keys(result)).toHaveLength(7);
      // Dates are YYYY-MM-DD format
      for (const key of Object.keys(result)) {
        expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it("parses nested raw JSON correctly — restingHR is a number", () => {
      const result = parseQueryMetricsText(wellness);
      const first = Object.values(result)[0] as Record<string, unknown>;
      expect(typeof first.restingHR).toBe("number");
    });

    it("returns {} for 'No data found' response without throwing", () => {
      expect(() => parseQueryMetricsText(noData)).not.toThrow();
      const result = parseQueryMetricsText(noData);
      expect(result).toEqual({});
    });

    it("returns {} for corrupted text without throwing", () => {
      const corrupted = "some random text\nwith no date headers\nand no raw JSON";
      expect(() => parseQueryMetricsText(corrupted)).not.toThrow();
      expect(parseQueryMetricsText(corrupted)).toEqual({});
    });

    it("returns {} for truncated balanced-brace JSON without throwing", () => {
      const truncated = "2026-01-01:\n  raw: {\"id\":\"2026-01-01\",\"restingHR\":54";
      expect(() => parseQueryMetricsText(truncated)).not.toThrow();
      // extractBalancedJson returns null on unclosed brace → {} for that date
      expect(parseQueryMetricsText(truncated)).toEqual({});
    });

    it("skips failed date and keeps succeeding dates", () => {
      const mixed =
        "2026-01-01:\n  raw: {\"restingHR\":54}\n" +
        "2026-01-02:\n  raw: {corrupted\n" +
        "2026-01-03:\n  raw: {\"restingHR\":57}\n";
      const result = parseQueryMetricsText(mixed);
      // 2026-01-01 and 2026-01-03 parse; 2026-01-02 fails silently
      expect(result["2026-01-01"]).toEqual({ restingHR: 54 });
      expect(result["2026-01-03"]).toEqual({ restingHR: 57 });
      expect(result["2026-01-02"]).toBeUndefined();
    });
  });

  describe("extractValuesByDate", () => {
    it("extracts 7 restingHR values from wellness fixture", () => {
      const map = extractValuesByDate(wellness, "wellness_restingHR");
      expect(map.size).toBe(7);
    });

    it("each date has exactly one restingHR reading", () => {
      const map = extractValuesByDate(wellness, "wellness_restingHR");
      for (const [, values] of map) {
        expect(values).toHaveLength(1);
        expect(typeof values[0]).toBe("number");
      }
    });

    it("returns empty map for unknown metric name", () => {
      const map = extractValuesByDate(wellness, "nonexistent_metric");
      expect(map.size).toBe(0);
    });

    it("returns empty map for 'No data found' text", () => {
      const map = extractValuesByDate(noData, "wellness_restingHR");
      expect(map.size).toBe(0);
    });
  });
}

describe("parser — synthetic fixtures", () => {
  parserSuite(synthWellness, synthNoData);
});

describe.runIf(realExists)("parser — real fixtures", () => {
  parserSuite(realWellness, realNoData);
});
