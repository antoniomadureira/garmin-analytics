import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSessionFreddyConnected } from "@/lib/auth/session";
import { kv } from "@/lib/redis";

/** [Suposição] Mesma ressalva do route.ts de /connect — confirmar endpoint real. */
const FREDDY_TOKEN_URL = "https://freddy.coach/oauth/token";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/onboarding?error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/onboarding?error=missing_code", req.url));
  }

  const expectedUserId = await kv.get<string>(`oauth_state:${state}`);
  if (!expectedUserId || expectedUserId !== session.userId) {
    // state inválido ou reaproveitado — possível CSRF, recusar
    return NextResponse.redirect(new URL("/onboarding?error=invalid_state", req.url));
  }
  await kv.del(`oauth_state:${state}`);

  const clientId = process.env.FREDDY_CLIENT_ID;
  const clientSecret = process.env.FREDDY_CLIENT_SECRET;
  const redirectUri = process.env.FREDDY_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Credenciais OAuth do Freddy ausentes nas env vars da Vercel.");
  }

  const tokenRes = await fetch(FREDDY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/onboarding?error=token_exchange_failed", req.url));
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Tokens NUNCA vão para o cookie de sessão (esse é só para identidade do utilizador
  // na nossa app). Persistem associados ao userId, do lado do servidor.
  await kv.set(`freddy_tokens:${session.userId}`, JSON.stringify(tokens));

  await updateSessionFreddyConnected(true);

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
