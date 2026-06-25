import { Redis } from "@upstash/redis";

/**
 * [Certo] A API do @upstash/redis (get/set/del/incr/ttl com opção `ex`) é
 * compatível com o que se usava em @vercel/kv — a Vercel KV era, de facto,
 * Upstash por trás. Por isso a troca nos route handlers é só o import.
 *
 * Variáveis de ambiente lidas automaticamente: UPSTASH_REDIS_REST_URL e
 * UPSTASH_REDIS_REST_TOKEN (copiar do dashboard Upstash > Database > REST API).
 */
export const kv = Redis.fromEnv();
