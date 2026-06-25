import { NextRequest, NextResponse } from "next/server";
import { issueOtp } from "@/lib/auth/otp";
import { Resend } from "resend";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  /**
   * [Certo] Sem domínio verificado no Resend, só é possível enviar para o
   * email com que a conta Resend foi criada — não para qualquer destinatário.
   * Como esta é uma plataforma de utilizador único (você), isto não é uma
   * limitação: ACCOUNT_OWNER_EMAIL deve ser exatamente esse email. Esta
   * verificação corre ANTES de gerar o OTP, para não gastar o cooldown de
   * reenvio com tentativas de emails não autorizados.
   */
  const ownerEmail = process.env.ACCOUNT_OWNER_EMAIL;
  if (!ownerEmail || email !== ownerEmail.toLowerCase()) {
    return NextResponse.json(
      { error: "Este email não está autorizado a aceder a esta aplicação." },
      { status: 403 }
    );
  }

  const { result, code } = await issueOtp(email);

  if (!result.ok) {
    if (result.reason === "cooldown") {
      return NextResponse.json(
        { error: "Aguarde antes de pedir um novo código.", retryAfterSeconds: result.retryAfterSeconds },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Não foi possível gerar o código." }, { status: 500 });
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY não definida. Configurar em Vercel > Environment Variables.");
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "onboarding@resend.dev", // endereço de sandbox do Resend — não precisa de domínio próprio
    to: email,
    subject: "O seu código de acesso",
    text: `O seu código de acesso é: ${code}\n\nExpira em 10 minutos. Se não pediu este código, ignore este email.`,
  });

  return NextResponse.json({ ok: true });
}
