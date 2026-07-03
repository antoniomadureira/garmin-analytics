/**
 * Semáforo global para chamadas MCP ao Freddy: máx. 2 em voo, backoff em
 * 429. Vive ao nível do módulo — todas as rotas/loaders da mesma invocação
 * partilham a mesma fila. [Certo] Substitui os throttles locais espalhados
 * ("lotes de 3 + 200ms"), que não se coordenavam entre loaders.
 */
const MAX_CONCURRENT = 2;
const RETRY_DELAYS_MS = [500, 1500, 4000]; // 3 tentativas em 429

let active = 0;
const queue: (() => void)[] = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) { active++; return Promise.resolve(); }
  return new Promise((res) => queue.push(res));
}
function release(): void {
  const next = queue.shift();
  if (next) next(); else active--;
}

function is429(err: unknown): boolean {
  const s = String(err);
  return s.includes("429") || s.includes("Rate limit");
}

export async function withFreddyLimit<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (is429(err) && attempt < RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          continue;
        }
        throw err;
      }
    }
  } finally {
    release();
  }
}