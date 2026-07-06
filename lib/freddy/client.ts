/**
 * [Certo] Confirmado em https://freddy.coach/agents e
 * /help/connect-from-agents.html: a autenticação real para um cliente
 * headless/servidor é OAuth 2.0 Device Authorization Grant (RFC 8628) +
 * Dynamic Client Registration (RFC 7591), implementado em lib/freddy/oauth.ts.
 * A versão anterior deste ficheiro assumia uma "API key pessoal" com base
 * numa suposição do utilizador que se revelou infundada — substituída.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getValidAccessToken } from "@/lib/freddy/oauth";

const FREDDY_MCP_URL = "https://freddy.coach/mcp";

// [Certo] Singleton por instância de módulo (warm serverless). Recriado
// automaticamente quando onerror assinala falha assíncrona do transporte —
// evita que um close() por engano ou um erro de rede condene todas as
// chamadas seguintes na mesma invocação.
let singleton: Client | null = null;
let singletonBroken = false;

export async function getFreddyClient(): Promise<Client> {
  if (singleton && !singletonBroken) return singleton;

  singleton = null;
  singletonBroken = false;

  const accessToken = await getValidAccessToken();

  const transport = new StreamableHTTPClientTransport(new URL(FREDDY_MCP_URL), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const client = new Client({ name: "freddy-running-intelligence", version: "0.1.0" });

  const onErr = (e: unknown) => {
    singletonBroken = true;
    console.warn(JSON.stringify({ evt: "mcp_client_error", err: String(e).slice(0, 150) }));
  };
  client.onerror = onErr;

  // [Suposição] StreamableHTTPClientTransport pode expor onerror — regista
  // defensivamente sem quebrar se o SDK não o suportar nesta versão.
  if ("onerror" in transport) {
    (transport as unknown as { onerror: (e: unknown) => void }).onerror = (e: unknown) => {
      singletonBroken = true;
      console.warn(JSON.stringify({ evt: "mcp_transport_error", err: String(e).slice(0, 150) }));
    };
  }

  await client.connect(transport);
  singleton = client;
  return client;
}

/**
 * Wrapper fino sobre o tool call query_metrics, devolvendo o resultado bruto
 * do MCP. NÃO faz parsing assumido — isso fica nos mappers de lib/freddy/metrics.ts,
 * que por sua vez ainda dependem de confirmação do shape real (ver gap #4 nesse ficheiro).
 */
export async function callQueryMetrics(args: {
  metrics: string[];
  days?: number;
  start?: string;
  end?: string;
  device?: string;
  includeRaw?: boolean;
}) {
  const client = await getFreddyClient();
  return client.callTool({
    name: "query_metrics",
    arguments: args,
  });
}
