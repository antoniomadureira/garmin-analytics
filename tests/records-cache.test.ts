import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock hoisted above imports — react/server-only/kv/client all stubbed
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));
vi.mock("@/lib/redis", () => ({
  kv: { get: vi.fn(), set: vi.fn() },
}));
vi.mock("@/lib/strava-lab/client", () => ({
  getShoesAndActivities: vi.fn(),
  getPersonalRecords: vi.fn(),
}));

import { kv } from "@/lib/redis";
import { getPersonalRecords, getShoesAndActivities } from "@/lib/strava-lab/client";
import { getCachedPersonalRecords } from "@/lib/strava-lab/records-cache";

const kvMock = kv as unknown as { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
const prMock = getPersonalRecords as ReturnType<typeof vi.fn>;
const shoesMock = getShoesAndActivities as ReturnType<typeof vi.fn>;

const FAKE_RECORDS = [
  { label: "10 km", distanceKm: 10.01, durationSec: 2934, date: "2026-06-01", paceMinPerKm: 4.88, activityName: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  kvMock.set.mockResolvedValue("OK");
  shoesMock.mockResolvedValue({ activities: [{ id: "act-001" }], shoes: [] });
});

describe("getCachedPersonalRecords — cache hit", () => {
  it("Redis hit com latestId correto → getPersonalRecords NÃO é chamado", async () => {
    kvMock.get
      .mockResolvedValueOnce("act-001")    // LATEST_KEY
      .mockResolvedValueOnce(FAKE_RECORDS); // RECORDS_KEY

    const result = await getCachedPersonalRecords();

    expect(prMock).not.toHaveBeenCalled();
    expect(result).toEqual(FAKE_RECORDS);
  });

  it("latestId diferente (nova atividade) → getPersonalRecords é chamado", async () => {
    kvMock.get
      .mockResolvedValueOnce("act-OLD")    // LATEST_KEY — diferente!
      .mockResolvedValueOnce(FAKE_RECORDS); // RECORDS_KEY — stale
    prMock.mockResolvedValueOnce(FAKE_RECORDS);

    await getCachedPersonalRecords();

    expect(prMock).toHaveBeenCalledOnce();
  });

  it("Redis vazio → getPersonalRecords é chamado e resultado gravado com TTL 24h", async () => {
    kvMock.get.mockResolvedValue(null);
    prMock.mockResolvedValueOnce(FAKE_RECORDS);

    await getCachedPersonalRecords();

    expect(prMock).toHaveBeenCalledOnce();
    // Verifica que o set foi chamado com o TTL correto
    expect(kvMock.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      { ex: 86400 },
    );
  });
});
