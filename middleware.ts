import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Middleware corre em Edge Runtime — não pode importar lib/auth/session.ts
// Verificação de JWT replicada
// aqui com `jose`, que é Edge-safe. Manter os dois em sincronia manualmente
// se o payload da sessão mudar.

const PUBLIC_PATHS = ["/login", "/api/auth"];

async function readSession(req: NextRequest) {
  const token = req.cookies.get("freddy_session")?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string; email: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // [Crítico] Bypass SÓ para `npm run dev` local, para rever o layout do
  // dashboard sem precisar de Upstash/Resend/Freddy configurados ainda.
  // NUNCA deve chegar a produção assim — a Vercel define NODE_ENV=production
  // automaticamente em builds de deploy, por isso isto desliga-se sozinho lá.
  if (process.env.NODE_ENV !== "production") {
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
