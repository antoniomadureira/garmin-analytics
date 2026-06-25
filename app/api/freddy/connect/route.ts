import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { randomBytes } from "crypto";
import { kv } from "@/lib/redis";

/**
 * [Suposição] Os nomes exatos dos parâmetros do endpoint de autorização do
 * Freddy (client_id, scope, response_type) seguem o padrão OAuth 2.1
 * standard porque é o que a espec do projeto e a descrição do MCP indicam.
 * NÃO tenho o documento de OAuth do freddy.coach à frente — confirmar
 * contra a documentação real antes de produção. O endpoint usado aqui
 * (`https://freddy.coach/oauth/authorize`) é uma suposição de convenção,
 * não um valor confirmado.
 */
const FREDDY_AUTHORIZE_URL = "https://freddy.coach/oauth/authorize";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", "http://localhost"));
  }

  const state = randomBytes(16).toString("hex");
  // state associado ao userId, TTL curto — usado para validar o callback e evitar CSRF
  await kv.set(`oauth_state:${state}`, session.userId, { ex: 600 });

  const clientId = process.env.FREDDY_CLIENT_ID;
  const redirectUri = process.env.FREDDY_REDIRECT_URI; // ex: https://app.seudominio.com/api/freddy/callback
  if (!clientId || !redirectUri) {
    throw new Error("FREDDY_CLIENT_ID ou FREDDY_REDIRECT_URI ausentes nas env vars da Vercel.");
  }

  const url = new URL(FREDDY_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "health_data:read");

  return NextResponse.redirect(url.toString());
}
