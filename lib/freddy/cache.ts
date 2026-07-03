import { kv } from "@/lib/redis";
import { createHash } from "crypto";

/**
 * Cache de leituras MCP por (assinatura-do-pedido, data).
 *
 * Regras de imutabilidade:
 *  - data < ontem  → imutável: TTL longo (30 dias, renovado a cada hit de escrita)
 *  - ontem         → TTL 6h ([Provável] sono/wellness de ontem ainda é
 *                    reescrito pelo Garmin/ICU durante a manhã seguinte)
 *  - hoje          → TTL 15 min
 *
 * A chave inclui um hash das métricas pedidas + includeRaw, porque o MESMO
 * dia devolve raws diferentes consoante as métricas (confirmado: misturar
 * acuteTrainingLoad_* com trainingHistory_* dava blocos raw de forma
 * diferente — bug do badge ACWR). Nunca partilhar cache entre pedidos
 * com listas de métricas diferentes.
 *
 * CACHE_VERSION: incrementar sempre que o formato do valor guardado mudar
 * (ex: se o parser passar a extrair mais campos) — invalida tudo sem
 * precisar de FLUSHDB.
 */

const CACHE_VERSION = 1;
const TTL_IMMUTABLE_S = 30 * 24 * 3600;
const TTL_YESTERDAY_S = 6 * 3600;
const TTL_TODAY_S = 15 * 60;

export function metricsSignature(metrics: string[], includeRaw: boolean): string {
  const canonical = [...metrics].sort().join(",") + `|raw:${includeRaw ? 1 : 0}`;
  return createHash("sha1").update(canonical).digest("hex").slice(0, 12);
}

function keyFor(sig: string, date: string): string {
  return `freddy:cache:v${CACHE_VERSION}:${sig}:${date}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

function ttlFor(date: string): number {
  const today = todayStr();
  if (date === today) return TTL_TODAY_S;
  if (date === yesterdayStr()) return TTL_YESTERDAY_S;
  if (date < today) return TTL_IMMUTABLE_S;
  // data futura não devia existir — TTL curto por segurança
  return TTL_TODAY_S;
}

/** Datas ISO (YYYY-MM-DD) do intervalo [start, end], inclusivo. */
export function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const endD = new Date(`${end}T00:00:00Z`);
  while (d <= endD) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Converte { days } no intervalo equivalente terminado hoje. */
export function daysToRange(days: number): { start: string; end: string } {
  const end = todayStr();
  const start = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  return { start, end };
}

/**
 * Marcador para "o Freddy respondeu e não havia dados nesta data".
 * Sem isto, dias legitimamente vazios (ex: dia sem corrida) seriam
 * cache-miss eternos e iriam sempre ao Freddy — o pior dos dois mundos.
 * Guardado com o TTL normal da data.
 */
const EMPTY_SENTINEL = "__no_data__" as const;

export interface CacheReadResult {
  /** dados encontrados em cache (inclui datas vazias resolvidas) */
  hits: Record<string, unknown>;
  /** datas que têm de ir ao Freddy */
  misses: string[];
}

export async function readCachedDates(sig: string, dates: string[]): Promise<CacheReadResult> {
  if (dates.length === 0) return { hits: {}, misses: [] };
  const keys = dates.map((d) => keyFor(sig, d));
  // 1 comando Upstash para N datas
  const values = await kv.mget<(unknown | null)[]>(...keys);

  const hits: Record<string, unknown> = {};
  const misses: string[] = [];
  dates.forEach((date, i) => {
    const v = values[i];
    if (v === null || v === undefined) {
      misses.push(date);
    } else if (v !== EMPTY_SENTINEL) {
      hits[date] = v;
    }
    // v === EMPTY_SENTINEL → hit "sem dados": não é miss, não entra em hits
  });
  return { hits, misses };
}

/**
 * Escreve o resultado fresco do Freddy. `requestedDates` são TODAS as datas
 * pedidas ao Freddy — as que não vierem em `fresh` gravam o sentinel vazio.
 * Pipeline: N sets num único round-trip.
 */
export async function writeCachedDates(
  sig: string,
  requestedDates: string[],
  fresh: Record<string, unknown>
): Promise<void> {
  if (requestedDates.length === 0) return;
  const p = kv.pipeline();
  for (const date of requestedDates) {
    const value = date in fresh ? fresh[date] : EMPTY_SENTINEL;
    p.set(keyFor(sig, date), value, { ex: ttlFor(date) });
  }
  await p.exec();
}