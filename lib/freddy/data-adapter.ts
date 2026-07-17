import { getFreddyClient } from "@/lib/freddy/client";
import { withFreddyLimit } from "@/lib/freddy/limiter";
import { FreddyDataService } from "@/lib/freddy/metrics";
import { kv } from "@/lib/redis";
import {
  metricsSignature,
  daysToRange,
  enumerateDates,
  readCachedDates,
  writeCachedDates,
} from "@/lib/freddy/cache";
import { createHash } from "crypto";

/**
 * [Certo — corrigido depois de teste real em produção, 2026-06-25] A
 * resposta do query_metrics NÃO é JSON puro no content block — é texto
 * formatado para leitura humana, com o JSON bruto embutido depois de
 * "raw: {...}" por cada métrica/data. Extração por contagem de chavetas
 * balanceadas (JSON aninhado, regex simples não chega).
 *
 * Camada de cache (roadmap #1): por (assinatura, data) em lib/freddy/cache.ts.
 * Datas passadas são imutáveis — só "hoje" (TTL 15min) e "ontem" (TTL 6h)
 * voltam ao Freddy.
 *
 * [Certo — REGRESSÃO CORRIGIDA, 2026-07-03] A primeira versão da cache
 * convertia SEMPRE {days} para {start,end} na chamada à tool. Confirmado
 * em produção: algumas métricas devolvem vazio quando pedidas por range
 * mas devolvem dados por days — o vazio gravava sentinels de "sem dados"
 * (até 30 dias de TTL) e os cards caíam para mock permanentemente.
 * Correção dupla:
 *   1. fallback: se o pedido original era por days e o range devolveu
 *      vazio, retenta com days puro antes de gravar qualquer sentinel;
 *   2. CACHE_VERSION incrementado em cache.ts (1→2) para descartar os
 *      sentinels envenenados já gravados.
 */

/**
 * Lançado quando o Freddy responde com texto não reconhecível — erro de
 * autenticação, rede, ou resposta inesperada do MCP. Distinto de "No data
 * found" (vazio legítimo). cachedQueryMetrics não grava sentinel neste caso:
 * o erro é transitório e os dados voltam sozinhos no primeiro load pós-fix.
 */
class FreddyTransientError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "FreddyTransientError";
  }
}

const DATE_HEADER_RE = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2})?:\s*$/;

function extractBalancedJson(text: string, startIndex: number): { json: string; endIndex: number } | null {
  if (text[startIndex] !== "{") return null;
  let depth = 0;
  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return { json: text.slice(startIndex, i + 1), endIndex: i + 1 };
    }
  }
  return null;
}

export function parseQueryMetricsText(text: string): Record<string, unknown> {
  const lines = text.split("\n");
  const result: Record<string, unknown> = {};
  let currentDate: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const dateMatch = lines[i].match(DATE_HEADER_RE);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }
    const rawIdx = lines[i].indexOf("raw:");
    if (rawIdx !== -1 && currentDate) {
      const afterRaw = lines[i].slice(rawIdx + 4).trimStart();
      const braceIdx = afterRaw.indexOf("{");
      if (braceIdx !== -1) {
        const extracted = extractBalancedJson(afterRaw, braceIdx);
        if (extracted) {
          try {
            result[currentDate] = JSON.parse(extracted.json);
          } catch {
            // parse falhado para esta data → ignora, mantém as restantes
          }
        }
      }
    }
  }
  return result;
}

type QueryArgs = {
  metrics: string[];
  days?: number;
  start?: string;
  end?: string;
  device?: string;
  includeRaw?: boolean;
};

/** Normaliza {days} vs {start,end} para um intervalo concreto de datas. */
function resolveRange(args: QueryArgs): { start: string; end: string } {
  if (args.start && args.end) return { start: args.start, end: args.end };
  if (args.start && !args.end) return { start: args.start, end: args.start };
  return daysToRange(args.days ?? 7);
}

/** Parse do content block da tool para { [date]: raw }. */
function parseToolResult(result: unknown, metrics: string[], contextLabel: string): Record<string, unknown> {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
  const firstText = content?.find((c) => c.type === "text")?.text;
  if (!firstText) {
    throw new Error("Resposta do query_metrics sem content de texto — inspecionar result bruto.");
  }

  try {
    return JSON.parse(firstText) as Record<string, unknown>;
  } catch {
    // [Certo] "No data found..." é resposta válida (atrasos de sync, dias
    // sem atividade) — resultado vazio legítimo.
    if (firstText.startsWith("No data found")) {
      return {};
    }
    const parsed = parseQueryMetricsText(firstText);
    if (Object.keys(parsed).length === 0) {
      console.warn(
        JSON.stringify({
          evt: "freddy_transient_error",
          ctx: contextLabel,
          metrics,
          sample: firstText.slice(0, 200),
        })
      );
      throw new FreddyTransientError(
        `Unrecognized Freddy response (${contextLabel}): ${firstText.slice(0, 120)}`
      );
    }
    return parsed;
  }
}

/** [Certo] `include_raw` (snake_case) é o nome real do parâmetro da tool. */
function toToolArgs(args: QueryArgs, mode: { start: string; end: string } | { days: number }) {
  const { includeRaw, days: _d, start: _s, end: _e, ...rest } = args;
  return { ...rest, ...mode, ...(includeRaw ? { include_raw: true } : {}) };
}

/** Chamada real ao Freddy por intervalo start/end. */
async function fetchFromFreddyByRange(args: QueryArgs, start: string, end: string): Promise<Record<string, unknown>> {
  return withFreddyLimit(async () => {
    const client = await getFreddyClient();
    const result = await client.callTool({
      name: "query_metrics",
      arguments: toToolArgs(args, { start, end }),
    });
    return parseToolResult(result, args.metrics, `range:${start}..${end}`);
  });
}

/**
 * [Certo — fallback da regressão] Chamada à maneira antiga, com `days`
 * puro e SEM start/end. Usada apenas quando o pedido original era por
 * days e a variante por range devolveu vazio — cobre as métricas que
 * ignoram/rejeitam range silenciosamente.
 */
async function fetchFromFreddyLegacyDays(args: QueryArgs): Promise<Record<string, unknown>> {
  return withFreddyLimit(async () => {
    const client = await getFreddyClient();
    const result = await client.callTool({
      name: "query_metrics",
      arguments: toToolArgs(args, { days: args.days ?? 7 }),
    });
    return parseToolResult(result, args.metrics, `days:${args.days ?? 7}`);
  });
}

/**
 * queryMetrics com cache:
 *  1. resolve o intervalo e lê todas as datas em 1 mget;
 *  2. misses → UMA chamada ao Freddy para [minMiss, maxMiss]; se vier
 *     vazio e o pedido original era por days, retenta com days puro;
 *  3. escreve frescos + sentinels de vazio, devolve o merge.
 * Erro do Freddy COM hits em cache → devolve os hits (degradação suave).
 */
export async function cachedQueryMetrics(args: QueryArgs): Promise<Record<string, unknown>> {
  const { start, end } = resolveRange(args);
  const dates = enumerateDates(start, end);
  const sig = metricsSignature(args.metrics, !!args.includeRaw);

  let hits: Record<string, unknown> = {};
  let misses: string[] = dates;
  try {
    ({ hits, misses } = await readCachedDates(sig, dates));
  } catch {
    // Upstash indisponível → segue sem cache, comportamento antigo
  }

  if (misses.length === 0) return hits;

  const fetchStart = misses[0];
  const fetchEnd = misses[misses.length - 1];
  let fresh: Record<string, unknown>;
  let usedLegacyDays = false;
  try {
    fresh = await fetchFromFreddyByRange(args, fetchStart, fetchEnd);
    if (Object.keys(fresh).length === 0 && args.days) {
      fresh = await fetchFromFreddyLegacyDays(args);
      usedLegacyDays = true;
      if (Object.keys(fresh).length > 0) {
        console.warn(
          JSON.stringify({ evt: "freddy_metric_needs_legacy_days", metrics: args.metrics })
        );
      }
    }
  } catch (err) {
    if (Object.keys(hits).length > 0) {
      console.warn(
        JSON.stringify({
          evt: "freddy_fetch_failed_serving_cache",
          metrics: args.metrics,
          err: String(err).slice(0, 150),
        })
      );
      return hits; // snapshot parcial > erro total
    }
    throw err;
  }

  // No caminho legacy o Freddy pode devolver datas fora de [fetchStart,
  // fetchEnd] (days conta a partir de hoje) — grava-se o que veio, mas os
  // sentinels de vazio só se aplicam às datas do range pedido.
  const datesToWrite = usedLegacyDays
    ? [...new Set([...enumerateDates(fetchStart, fetchEnd), ...Object.keys(fresh)])]
    : enumerateDates(fetchStart, fetchEnd);

  writeCachedDates(sig, datesToWrite, fresh).catch((e) => {
    console.warn(
      JSON.stringify({ evt: "cache_write_failed", metrics: args.metrics, err: String(e).slice(0, 120) })
    );
  });

  return { ...hits, ...fresh };
}

/**
 * Texto legítimo do Freddy: "No data found" (vazio legítimo) ou qualquer
 * resposta com pelo menos um cabeçalho de data (YYYY-MM-DD). Texto de erro
 * de auth/rede não contém datas — falha este teste e não deve ser cacheado.
 */
function isLegitimateFreddyText(text: string): boolean {
  if (text.startsWith("No data found")) return true;
  return /\d{4}-\d{2}-\d{2}/.test(text);
}

/**
 * queryRawText com cache de pedido inteiro, TTL 15 min. Escrita com log
 * de diagnóstico: se falhar por tamanho (limite ~1MB do Upstash REST é o
 * suspeito para a página de performance lenta), o log diz os bytes —
 * decisão de compressão/chunking só depois de o log confirmar.
 * Erros transitórios (auth/rede) lançam FreddyTransientError sem escrever
 * em cache — os dados voltam sozinhos no primeiro load pós-reconnect.
 */
export async function cachedQueryRawText(args: { metrics: string[]; days?: number; start?: string; end?: string; includeRaw?: boolean }): Promise<string> {
  const { start, end } = args.start
    ? { start: args.start, end: args.end ?? args.start }
    : daysToRange(args.days ?? 7);
  // [Certo] includeRaw deve entrar na chave — raw vs não-raw têm formatos distintos
  const sigBase = [...args.metrics].sort().join(",") + `|${start}|${end}${args.includeRaw ? "|raw" : ""}`;
  const key = `freddy:rawtext:v1:${createHash("sha1").update(sigBase).digest("hex").slice(0, 12)}`;

  try {
    const cached = await kv.get<string>(key);
    if (cached) return cached;
  } catch {
    /* segue sem cache */
  }

  const firstText = await withFreddyLimit(async () => {
    const client = await getFreddyClient();
    const mcpArgs: Record<string, unknown> = { metrics: args.metrics, start, end };
    if (args.includeRaw) mcpArgs.include_raw = true;
    const result = await client.callTool({ name: "query_metrics", arguments: mcpArgs });
    const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
    const text = content?.find((c) => c.type === "text")?.text;
    if (!text) throw new Error("Resposta do query_metrics sem content de texto.");
    return text;
  });

  if (!isLegitimateFreddyText(firstText)) {
    console.warn(
      JSON.stringify({
        evt: "freddy_rawtext_transient_error",
        metrics: args.metrics,
        sample: firstText.slice(0, 200),
      })
    );
    throw new FreddyTransientError(
      `Unrecognized Freddy rawtext (${args.metrics.join(",")}): ${firstText.slice(0, 120)}`
    );
  }

  kv.set(key, firstText, { ex: 15 * 60 }).catch((e) =>
    console.warn(
      JSON.stringify({
        evt: "rawtext_cache_write_failed",
        bytes: firstText.length,
        metrics: args.metrics,
        err: String(e).slice(0, 120),
      })
    )
  );
  return firstText;
}

export async function getFreddyDataService(): Promise<FreddyDataService> {
  // getFreddyClient é lazy dentro dos fetches — um dashboard 100% servido
  // por cache não abre ligação MCP nem gasta refresh de token.
  return new FreddyDataService({
    queryMetrics: cachedQueryMetrics,
    queryRawText: cachedQueryRawText,
  });
}