import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Middleware corre em Edge Runtime — não pode importar lib/auth/session.ts.
// Verificação de JWT replicada aqui com `jose` (Edge-safe).

const PUBLIC_PATHS = ["/login", "/api/auth"];

async function readSession(req: NextRequest) {
  const token = req.cookies.get("freddy_session")?.value;
  if (!token) return null;

  const secret = process.env.SESSION_SECRET;
  // [Certo] Alinhado com o fail-loud de lib/auth/session.ts: uma secret
  // ausente/curta em produção significava antes "rejeitar tudo em silêncio"
  // aqui, e "rebentar com mensagem clara" nas rotas — dois comportamentos
  // para o mesmo erro de configuração. Agora é um só.
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou demasiado curta (mínimo 32 caracteres). Definir em Vercel > Project Settings > Environment Variables."
    );
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as { userId: string; email: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // [Certo] Bypass de auth agora é OPT-IN EXPLÍCITO, nunca inferido da
  // ausência de NODE_ENV=production. A versão anterior deixava o dashboard
  // aberto em qualquer ambiente que não definisse a variável (next start
  // local, self-host futuro). Para rever layout sem Upstash/Resend:
  //   AUTH_BYPASS=1 npm run dev
  // A dupla condição impede que AUTH_BYPASS esquecido num env de produção
  // desligue a auth lá.
  if (process.env.AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await readSession(req);

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};