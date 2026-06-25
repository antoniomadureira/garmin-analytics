import { kv } from "@/lib/redis";
import { createHash, randomInt } from "crypto";

/**
 * [Provável] Parâmetros calibrados por convenção de segurança (NIST 800-63B
 * para OTP de 6 dígitos), não por especificação do freddy.coach — não tenho
 * acesso ao backend deles para confirmar os valores exatos que usam.
 * Ajustar livremente; o que importa é que existam algum TTL e algum limite.
 */
const OTP_TTL_SECONDS = 10 * 60; // 10 minutos
const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

function otpKey(email: string) {
  return `otp:${email.toLowerCase().trim()}`;
}
function cooldownKey(email: string) {
  return `otp:cooldown:${email.toLowerCase().trim()}`;
}
function attemptsKey(email: string) {
  return `otp:attempts:${email.toLowerCase().trim()}`;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  // dígitos 0-9, sem usar Math.random (não criptográfico)
  let code = "";
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += randomInt(0, 10).toString();
  }
  return code;
}

export interface RequestCodeResult {
  ok: boolean;
  reason?: "cooldown";
  retryAfterSeconds?: number;
}

/**
 * Gera e regista um novo código OTP para o email. Devolve o código em claro
 * APENAS para ser passado ao serviço de email — nunca persistir em claro.
 */
export async function issueOtp(email: string): Promise<{ result: RequestCodeResult; code?: string }> {
  const ttlLeft = await kv.ttl(cooldownKey(email));
  if (ttlLeft && ttlLeft > 0) {
    return { result: { ok: false, reason: "cooldown", retryAfterSeconds: ttlLeft } };
  }

  const code = generateCode();
  await kv.set(otpKey(email), hashCode(code), { ex: OTP_TTL_SECONDS });
  await kv.set(cooldownKey(email), "1", { ex: RESEND_COOLDOWN_SECONDS });
  await kv.set(attemptsKey(email), 0, { ex: OTP_TTL_SECONDS });

  return { result: { ok: true }, code };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: "expired_or_missing" | "too_many_attempts" | "invalid_code" };

export async function verifyOtp(email: string, submittedCode: string): Promise<VerifyOtpResult> {
  const storedHash = await kv.get<string>(otpKey(email));
  if (!storedHash) {
    return { ok: false, reason: "expired_or_missing" };
  }

  const attempts = (await kv.get<number>(attemptsKey(email))) ?? 0;
  if (attempts >= MAX_ATTEMPTS) {
    await kv.del(otpKey(email));
    return { ok: false, reason: "too_many_attempts" };
  }

  if (hashCode(submittedCode) !== storedHash) {
    await kv.incr(attemptsKey(email));
    return { ok: false, reason: "invalid_code" };
  }

  // código válido — invalidar imediatamente (uso único)
  await kv.del(otpKey(email));
  await kv.del(attemptsKey(email));
  return { ok: true };
}
