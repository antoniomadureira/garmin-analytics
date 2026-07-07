/**
 * Garante que getFreddyClient() reutiliza o singleton MCP e nunca chama
 * close() — dois comportamentos que, se quebrados, causam ligações duplas
 * ou perda de conexão em mid-flight.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/redis");

let constructCount = 0;
const mockClose = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Client: vi.fn(function (this: any) {
    constructCount++;
    Object.assign(this, { onerror: null, connect: mockConnect, close: mockClose });
  }),
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StreamableHTTPClientTransport: vi.fn(function (this: any) {
    this.onerror = null;
  }),
}));

vi.mock("@/lib/freddy/oauth", () => ({
  getValidAccessToken: vi.fn().mockResolvedValue("fake-token"),
}));

import { getFreddyClient } from "@/lib/freddy/client";

describe("getFreddyClient singleton", () => {
  it("returns the same instance on consecutive calls, never calls close()", async () => {
    const c1 = await getFreddyClient();
    const c2 = await getFreddyClient();

    expect(c1).toBe(c2);
    expect(constructCount).toBe(1); // Client constructed exactly once
    expect(mockClose).not.toHaveBeenCalled();
  });
});
