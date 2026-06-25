import { NextRequest, NextResponse } from "next/server";
import { verifyOtp } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const code = typeof body?.code === "string" ? body.code.trim() : null;

  if (!email || !code) {
    return NextResponse.json({ error: "Email e código são obrigatórios." }, { status: 400 });
  }

  const verification = await verifyOtp(email, code);

  if (!verification.ok) {
    const messages: Record<typeof verification.reason, string> = {
      expired_or_missing: "Código expirado ou inexistente. Peça um novo.",
      too_many_attempts: "Demasiadas tentativas falhadas. Peça um novo código.",
      invalid_code: "Código incorreto.",
    };
    return NextResponse.json({ error: messages[verification.reason] }, { status: 401 });
  }

  // userId derivado deterministicamente do email — substituir por lookup/insert
  // numa tabela real de utilizadores (Vercel Postgres) assim que existir.
  // [Suposição] Esta linha é um placeholder funcional, não a decisão final de modelo de dados.
  const userId = createHash("sha256").update(email).digest("hex").slice(0, 24);

  await createSession({ userId, email });

  return NextResponse.json({ ok: true });
}
