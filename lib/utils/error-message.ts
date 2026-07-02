export function humanizeError(err: unknown): string {
  const raw = String(err instanceof Error ? err.message : err);
  if (raw.includes("fetch failed") || raw.includes("ECONNREFUSED") || raw.includes("ENOTFOUND"))
    return "Serviço temporariamente indisponível — tente de novo em breve.";
  if (raw.includes("Rate limit") || raw.includes("rate limit") || raw.includes("429"))
    return "Limite de pedidos atingido — aguarde alguns minutos.";
  if (raw.includes("timeout") || raw.includes("Timeout") || raw.includes("ETIMEDOUT"))
    return "O servidor demorou demasiado a responder — tente de novo.";
  if (raw.includes("401") || raw.includes("Unauthorized"))
    return "Sessão expirada — recarregue a página.";
  if (raw.includes("MCP server connection lost") || raw.includes("connection lost"))
    return "Ligação ao Freddy perdida temporariamente — recarregue.";
  return raw.length > 100 ? raw.slice(0, 100) + "…" : raw;
}
