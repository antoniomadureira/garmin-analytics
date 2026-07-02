import { getFreddyClient } from "@/lib/freddy/client";
import { FreddyDataService } from "@/lib/freddy/metrics";

/**
 * [Certo — corrigido depois de teste real em produção, 2026-06-25] A
 * resposta do query_metrics NÃO é JSON puro no content block — é texto
 * formatado para leitura humana, com o JSON bruto embutido depois de
 * "raw: {...}" por cada métrica/data, exatamente no mesmo formato que se
 * vê nesta conversa. A tentativa anterior de `JSON.parse(firstText)`
 * direto estava errada e falhava sempre. Esta versão extrai os blocos
 * `raw: {...}` do texto, com contagem de chavetas balanceadas (não regex
 * simples, porque o JSON tem objetos aninhados).
 *
 * Estrutura assumida do texto (confirmada nesta conversa, múltiplas vezes):
 *   "YYYY-MM-DD:\n  <metric_name>: <valor> (<source>)\n    raw: {...}\n"
 * Para os mappers atuais (1 métrica pedida por chamada), há um único bloco
 * `raw` por data — por isso o resultado final é `{ [date]: parsedRaw }`,
 * que é exatamente o shape que os mappers em metrics.ts já esperam.
 *
 * [Provável] Isto assume que `query_metrics` foi chamado com apenas 1
 * métrica de cada vez (como os loaders do dashboard já fazem). Se alguma
 * chamada futura pedir múltiplas métricas em simultâneo, esta extração
 * vai precisar de also capturar o nome da métrica antes de cada `raw:` —
 * não implementado ainda porque não há esse caso de uso ainda.
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
  return null; // chavetas nunca fecharam — texto truncado ou malformado
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
            // [Suposição] se o parse falhar para esta data, ignora-a em vez
            // de rebentar a chamada toda — melhor ter alguns dias em falta
            // do que nenhum dado.
          }
        }
      }
    }
  }
  return result;
}

export async function getFreddyDataService(): Promise<FreddyDataService> {
  const client = await getFreddyClient();

  return new FreddyDataService({
    queryMetrics: async (args) => {
      // [Certo] Confirmado no código fonte real do @freddy-coach/cli
      // (dist/index.js): o parâmetro da tool é `include_raw` (snake_case),
      // não `includeRaw`. As interfaces internas deste projeto usam
      // camelCase por convenção TS — a conversão faz-se só aqui, na
      // fronteira com a tool MCP real.
      const { includeRaw, ...rest } = args;
      const toolArgs = { ...rest, ...(includeRaw ? { include_raw: true } : {}) };

      const result = await client.callTool({ name: "query_metrics", arguments: toolArgs });
      const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
      const firstText = content?.find((c) => c.type === "text")?.text;
      if (!firstText) {
        throw new Error("Resposta do query_metrics sem content de texto — inspecionar result bruto.");
      }

      // Tenta JSON puro primeiro (caso a produção alguma vez devolva isso
      // diretamente), só cai para o parser de texto se isso falhar.
      try {
        return JSON.parse(firstText) as Record<string, unknown>;
      } catch {
        // [Certo] "No data found for metrics: X" é uma resposta válida do
        // Freddy (ex: trainingReadiness com atraso de 5-6 dias, ou período
        // sem atividade). Não é um erro — é um resultado vazio legítimo.
        if (firstText.startsWith("No data found")) {
          return {};
        }
        const parsed = parseQueryMetricsText(firstText);
        if (Object.keys(parsed).length === 0) {
          // Texto inesperado mas não bloqueante — devolver vazio em vez de
          // rebentar toda a secção de readiness por causa de 1 métrica.
          console.warn(`query_metrics devolveu texto não parseável: ${firstText.slice(0, 200)}`);
          return {};
        }
        return parsed;
      }
    },

    /**
     * Para métricas sem suporte a raw (ex: summarizedActivity_distance) —
     * devolve o texto bruto tal qual, sem tentar fazer parse de JSON nem
     * extrair blocos `raw`. Usado só pela comparação homóloga.
     */
    queryRawText: async (args) => {
      const result = await client.callTool({ name: "query_metrics", arguments: args });
      const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
      const firstText = content?.find((c) => c.type === "text")?.text;
      if (!firstText) {
        throw new Error("Resposta do query_metrics sem content de texto.");
      }
      return firstText;
    },
  });
}
