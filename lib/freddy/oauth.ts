/**
 * [Certo] Mecanismo real, confirmado em https://freddy.coach/agents e
 * https://freddy.coach/help/connect-from-agents.html (2026-06-25):
 *   - Dynamic Client Registration (RFC 7591): POST /oauth/register
 *   - Device Authorization Grant (RFC 8628): POST /oauth/device_authorization
 *   - Token (device_code grant): POST /oauth/token
 *   - access_token válido 1h; refresh_token válido 60 dias
 *   - Chamadas MCP usam "um bearer token" — confirmado na própria
 *     documentação ("any client that speaks MCP can read a user's data
 *     with one bearer token"), portanto Authorization: Bearer <token>
 *     deixa de ser suposição.
 *
 * [Certo — testado em 2026-06-25 pelo utilizador, PowerShell real]
 *   - /oauth/register DEVOLVE client_secret (token_endpoint_auth_method:
 *     "client_secret_post") — a versão anterior deste ficheiro assumia
 *     que não havia secret. Tem de ser enviado em /oauth/token.
 *   - grant_types devolvidos foram ["authorization_code","refresh_token"]
 *     — não inclui "urn:ietf:params:oauth:grant-type:device_code" na lista,
 *     mas o endpoint /oauth/device_authorization aceitou e funcionou
 *     mesmo assim (testado e confirmado: device_code, user_code,
 *     verification_uri, verification_uri_complete, expires_in, interval
 *     vieram todos como esperado). Provavelmente o campo grant_types da
 *     resposta de registo está incompleto/desatualizado no servidor —
 *     não bloquear nada com base nele.
 *   - verification_uri_complete usa o parâmetro `?code=`, não `?user_code=`
 *     como eu tinha assumido por analogia com outros provedores (GitHub,
 *     Okta usam padrões diferentes entre si nisto).
 *
 * [Provável — ainda não confirmado] grant_type "refresh_token" continua
 * por testar; e agora sabe-se que o /oauth/token provavelmente espera
 * também client_secret no pedido (client_secret_post), não só client_id.
 */

import { kv } from "@/lib/redis";

const FREDDY_BASE = "https://freddy.coach";
const CLIENT_KV_KEY = "freddy:oauth_client";
const TOKENS_KV_KEY = "freddy:oauth_tokens";
const DEVICE_KV_KEY = "freddy:oauth_device_pending";

interface RegisteredClient {
  client_id: string;
  client_secret: string; // [Certo] confirmado presente na resposta real
}

interface DeviceAuthorization {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms, calculado por nós a partir de expires_in
}

/** Regista o cliente uma única vez e guarda client_id + client_secret (cache em Redis). */
async function getOrRegisterClient(): Promise<RegisteredClient> {
  const cached = await kv.get<RegisteredClient>(CLIENT_KV_KEY);
  if (cached) return cached;

  const res = await fetch(`${FREDDY_BASE}/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Freddy Running Intelligence",
      redirect_uris: ["http://localhost"], // exigido pelo endpoint, não usado no device flow
    }),
  });
  if (!res.ok) {
    throw new Error(`Falha ao registar cliente OAuth no Freddy: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as RegisteredClient;
  await kv.set(CLIENT_KV_KEY, data); // sem TTL — o registo do cliente não expira
  return data;
}

/** Passo 1 do fluxo: inicia o device flow e devolve o URL para o utilizador abrir. */
export async function startDeviceFlow(): Promise<DeviceAuthorization> {
  const client = await getOrRegisterClient();

  const res = await fetch(`${FREDDY_BASE}/oauth/device_authorization`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.client_id,
      scope: "mcp account:read connections:write",
    }),
  });
  if (!res.ok) {
    throw new Error(`Falha ao iniciar device flow: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as DeviceAuthorization;

  // guardar device_code associado ao client_id, com TTL = validade do code
  await kv.set(DEVICE_KV_KEY, { device_code: data.device_code, client_id: client.client_id }, {
    ex: data.expires_in,
  });

  return data;
}

export type PollResult =
  | { status: "pending" }
  | { status: "connected" }
  | { status: "error"; error: string };

/** Passo 2: chamar repetidamente (respeitando `interval`) até o utilizador aprovar. */
export async function pollDeviceFlow(): Promise<PollResult> {
  const pending = await kv.get<{ device_code: string; client_id: string }>(DEVICE_KV_KEY);
  if (!pending) {
    return { status: "error", error: "Nenhum pedido de autorização pendente ou expirou. Reinicie o processo." };
  }

  const client = await getOrRegisterClient();

  const res = await fetch(`${FREDDY_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: pending.client_id,
      // [Provável] client_secret incluído porque o registo devolveu
      // token_endpoint_auth_method: "client_secret_post" — a confirmar
      // se /oauth/token de facto o exige ou se é opcional para este grant.
      client_secret: client.client_secret,
      device_code: pending.device_code,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.ok && typeof data.access_token === "string") {
    const tokens: TokenSet = {
      access_token: data.access_token,
      refresh_token: String(data.refresh_token ?? ""),
      expires_at: Date.now() + Number(data.expires_in ?? 3600) * 1000,
    };
    await kv.set(TOKENS_KV_KEY, tokens);
    await kv.del(DEVICE_KV_KEY);
    return { status: "connected" };
  }

  const err = typeof data.error === "string" ? data.error : "unknown_error";
  if (err === "authorization_pending" || err === "slow_down") {
    return { status: "pending" };
  }
  await kv.del(DEVICE_KV_KEY);
  return { status: "error", error: err };
}

/**
 * [Certo] Confirmado em produção (Vercel): chamar getValidAccessToken() em
 * paralelo (ex: Promise.all de 5 loaders no dashboard) faz com que várias
 * chamadas leiam o MESMO refresh_token expirado e tentem renová-lo ao
 * mesmo tempo. Refresh tokens OAuth são normalmente de uso único — só a
 * primeira chamada a chegar ao servidor consegue; as restantes recebem
 * `invalid_grant`/400, porque o token já foi consumido. Este lock garante
 * que, dentro do mesmo processo Node (a mesma invocação serverless), só
 * existe UM refresh em curso de cada vez — as chamadas seguintes esperam
 * pela mesma promise em vez de disparar pedidos próprios.
 * [Provável] Isto resolve a concorrência DENTRO de uma invocação; não
 * protege contra duas invocações serverless diferentes a renovar ao
 * mesmo tempo (cada uma tem a sua própria variável em memória). Para
 * esse caso seria preciso um lock distribuído no Upstash — não
 * implementado ainda porque o caso mais comum (5 loaders na mesma
 * página) já fica resolvido com isto.
 */
/**
 * [Certo] Confirmado em produção real (2026-06-27): o lock em memória
 * (anterior) só protegia chamadas DENTRO da mesma invocação serverless —
 * exatamente como já estava documentado como limitação conhecida. Na
 * prática, abrir várias páginas diferentes (Painel, FC, Sono, Passos,
 * Corrida) em sucessão rápida fez com que invocações serverless
 * DIFERENTES lessem o mesmo refresh_token quase ao mesmo tempo, todas
 * tentassem renovar, e todas-menos-uma recebessem "invalid_token" (o
 * refresh_token é de uso único). Corrigido com um lock distribuído real
 * no Upstash (SET NX, partilhado por todas as invocações):
 *   1. Tenta adquirir o lock (`kv.set(LOCK_KEY, ..., { nx: true, ex: N })`).
 *   2. Se conseguir, renova e liberta o lock.
 *   3. Se NÃO conseguir (outra invocação já está a renovar), espera um
 *      pouco e volta a ler os tokens do Upstash — assume que a invocação
 *      que tem o lock vai escrever o token novo a tempo.
 */
const REFRESH_LOCK_KEY = "freddy:oauth_refresh_lock";
const REFRESH_LOCK_TTL_SECONDS = 20; // tempo-limite de segurança, caso a invocação com o lock rebente sem o libertar

export async function getValidAccessToken(): Promise<string> {
  const tokens = await kv.get<TokenSet>(TOKENS_KV_KEY);
  if (!tokens) {
    throw new Error("Freddy não está ligado. Correr o fluxo de device authorization primeiro.");
  }

  const fiveMinutes = 5 * 60 * 1000;
  if (Date.now() < tokens.expires_at - fiveMinutes) {
    return tokens.access_token;
  }

  const gotLock = await kv.set(REFRESH_LOCK_KEY, "1", { nx: true, ex: REFRESH_LOCK_TTL_SECONDS });

  if (gotLock) {
    try {
      return await doRefresh(tokens);
    } finally {
      await kv.del(REFRESH_LOCK_KEY);
    }
  }

  // [Provável] Outra invocação já está a renovar — espera por ela em vez
  // de competir pelo mesmo refresh_token. Até 6 tentativas × 700ms ≈ 4.2s,
  // tempo razoável para um pedido de token completar.
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((r) => setTimeout(r, 700));
    const fresh = await kv.get<TokenSet>(TOKENS_KV_KEY);
    if (fresh && fresh.expires_at > Date.now() + fiveMinutes) {
      return fresh.access_token;
    }
  }

  throw new Error(
    "Não foi possível obter um token válido — outra invocação estava a renovar mas não terminou a tempo. Tente novamente."
  );
}

async function doRefresh(tokens: TokenSet): Promise<string> {
  // [Provável] grant_type "refresh_token" assumido por convenção — confirmar em produção.
  // client_secret incluído pela mesma razão que em pollDeviceFlow.
  const client = await getOrRegisterClient();
  const res = await fetch(`${FREDDY_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: client.client_id,
      client_secret: client.client_secret,
      refresh_token: tokens.refresh_token,
    }),
  });
  if (!res.ok) {
    throw new Error(`Falha ao renovar token do Freddy: ${res.status} ${await res.text()}. Pode ser necessário reautorizar.`);
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };

  const newTokens: TokenSet = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + Number(data.expires_in ?? 3600) * 1000,
  };
  await kv.set(TOKENS_KV_KEY, newTokens);
  return newTokens.access_token;
}

export async function isFreddyConnected(): Promise<boolean> {
  const tokens = await kv.get<TokenSet>(TOKENS_KV_KEY);
  return !!tokens;
}
