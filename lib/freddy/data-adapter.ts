import { getFreddyClient } from "@/lib/freddy/client";
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
 * "raw: {...}" por cada métrica/data. Esta versão extrai os blocos
 * `raw: {...}` do texto, com contagem de chavetas balanceadas.
 *
 * NOVO (item #1 do roadmap): camada de cache por (assinatura, data) em
 * lib/freddy/cache.ts. Datas passadas são imutáveis — só "hoje" (TTL 15min)
 * e "ontem" (TTL 6h) voltam ao Freddy. Consequências diretas:
 *   - o throttle "lotes de 3 + 200ms" quase nunca dispara em navegação normal;
 *   - se o Freddy estiver em baixo, o dashboard serve o último snapshot
 *     (os loaders já mostram freshness — nada a mudar na UI);
 *   - o client MCP só é criado se houver misses (getFreddyClient passou
 *     a ser lazy dentro do queryMetrics).
 *
 * [Certo] A cache guarda o resultado JÁ PARSEADO ({ [date]: raw }), não o
 * texto do Freddy — assim uma mudança no formato de texto só exige
 * reparse dos misses, nunca invalidação manual. Se o formato do valor
 * parseado mudar, incrementar CACHE_VERSION em cache.ts.
 */

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

function parseQueryMetricsText(text: string): Record<string, unknown> {
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

/** Uma chamada real ao Freddy para um intervalo, devolvendo o parseado. */
async function fetchFromFreddy(args: QueryArgs, start: string, end: string): Promise<Record<string, unknown>> {
  const client = await getFreddyClient();
  // [Certo] o parâmetro real da tool é `include_raw` (snake_case) —
  // confirmado no código fonte do @freddy-coach/cli. Conversão só aqui.
  const { includeRaw, days: _days, start: _s, end: _e, ...rest } = args;
  const toolArgs = { ...rest, start, end, ...(includeRaw ? { include_raw: true } : {}) };

  const result = await client.callTool({ name: "query_metrics", arguments: toolArgs });
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
  const firstText = content?.find((c) => c.type === "text")?.text;
  if (!firstText) {
    throw new Error("Resposta do query_metrics sem content de texto — inspecionar result bruto.");
  }

  try {
    return JSON.parse(firstText) as Record<string, unknown>;
  } catch {
    // [Certo] "No data found..." é resposta válida (atrasos de sync, dias
    // sem atividade) — resultado vazio legítimo, que a cache vai marcar
    // com sentinel para não voltar a perguntar.
    if (firstText.startsWith("No data found")) {
      return {};
    }
    const parsed = parseQueryMetricsText(firstText);
    if (Object.keys(parsed).length === 0) {
      console.warn(
        JSON.stringify({
          evt: "freddy_unparseable_text",
          metrics: args.metrics,
          start,
          end,
          sample: firstText.slice(0, 200),
        })
      );
      return {};
    }
    return parsed;
  }
}

/**
 * queryMetrics com cache. Estratégia:
 *  1. resolve o intervalo e lê todas as datas em 1 mget;
 *  2. se houver misses, faz UMA chamada ao Freddy para [minMiss, maxMiss]
 *     (re-obter 1-2 datas já cacheadas no meio é mais barato do que N
 *     chamadas fragmentadas — e o refresh é inofensivo);
 *  3. escreve os frescos + sentinels de vazio, devolve o merge.
 * Em caso de erro do Freddy COM hits em cache, devolve os hits em vez de
 * rebentar — degradação suave, os freshness dots da UI fazem o resto.
 */
async function cachedQueryMetrics(args: QueryArgs): Promise<Record<string, unknown>> {
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
  try {
    fresh = await fetchFromFreddy(args, fetchStart, fetchEnd);
  } catch (err) {
    if (Object.keys(hits).length > 0) {
      console.warn(
        JSON.stringify({ evt: "freddy_fetch_failed_serving_cache", metrics: args.metrics, err: String(err).slice(0, 150) })
      );
      return hits; // snapshot parcial > erro total
    }
    throw err;
  }

  writeCachedDates(sig, enumerateDates(fetchStart, fetchEnd), fresh).catch(() => {
    /* falha de escrita de cache nunca deve afetar a resposta */
  });

  return { ...hits, ...fresh };
}

/**
 * queryRawText com cache de pedido inteiro (não por data — o texto não é
 * separável sem parse, e o consumidor é que o faz). TTL fixo de 15 min:
 * suficiente para eliminar o padrão "cada page load repete tudo", sem a
 * granularidade do caminho principal. [Provável] aceitável porque os
 * consumidores (body battery, steps, HR history, YoY) são janelas que
 * incluem sempre o dia corrente — TTL longo daria dados de hoje velhos.
 */
async function cachedQueryRawText(args: { metrics: string[]; days?: number; start?: string; end?: string }): Promise<string> {
  const { start, end } = args.start
    ? { start: args.start, end: args.end ?? args.start }
    : daysToRange(args.days ?? 7);
  const sigBase = [...args.metrics].sort().join(",") + `|${start}|${end}`;
  const key = `freddy:rawtext:v1:${createHash("sha1").update(sigBase).digest("hex").slice(0, 12)}`;

  try {
    const cached = await kv.get<string>(key);
    if (cached) return cached;
  } catch {
    /* segue sem cache */
  }

  const client = await getFreddyClient();
  const result = await client.callTool({ name: "query_metrics", arguments: { metrics: args.metrics, start, end } });
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
  const firstText = content?.find((c) => c.type === "text")?.text;
  if (!firstText) {
    throw new Error("Resposta do query_metrics sem content de texto.");
  }

  kv.set(key, firstText, { ex: 15 * 60 }).catch(() => {});
  return firstText;
}

export async function getFreddyDataService(): Promise<FreddyDataService> {
  // NOTA: getFreddyClient deixou de ser chamado aqui — passou a ser lazy
  // dentro de fetchFromFreddy/cachedQueryRawText. Um dashboard 100% servido
  // por cache já não abre ligação MCP nenhuma (nem gasta refresh de token).
  return new FreddyDataService({
    queryMetrics: cachedQueryMetrics,
    queryRawText: cachedQueryRawText,
  });
}