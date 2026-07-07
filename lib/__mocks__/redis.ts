// In-memory Redis mock. Used by vi.mock('@/lib/redis') in test files.
// All state is module-scoped; call __reset() in beforeEach to isolate tests.

const store = new Map<string, unknown>();

interface PipelineOp {
  key: string;
  value: unknown;
  ttl?: number;
}
const ops: PipelineOp[] = [];

const pipeline = {
  set(key: string, value: unknown, opts?: { ex?: number }) {
    ops.push({ key, value, ttl: opts?.ex });
    store.set(key, value);
    return pipeline;
  },
  async exec() {
    return ops.map(() => "OK");
  },
};

export const kv = {
  async get(key: string) {
    return store.get(key) ?? null;
  },
  async set(key: string, value: unknown, _opts?: { ex?: number }) {
    store.set(key, value);
    return "OK";
  },
  async mget(...keys: string[]) {
    return keys.map((k) => store.get(k) ?? null);
  },
  async del(...keys: string[]) {
    let n = 0;
    for (const k of keys) if (store.delete(k)) n++;
    return n;
  },
  pipeline() {
    return pipeline;
  },
};

// Exported for direct store inspection and manipulation in tests
export const __store = store;
export const __ops = ops;
export function __reset() {
  store.clear();
  ops.length = 0;
}
