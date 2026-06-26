import { NextRequest, NextResponse } from "next/server";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";

/**
 * [Certo] Endpoint e modelo confirmados em console.groq.com/docs (2026-06-25):
 * https://api.groq.com/openai/v1/chat/completions, compatível com a API da
 * OpenAI. Modelo "llama-3.3-70b-versatile" é um dos modelos de produção
 * atuais do free tier (30k tokens/min, 14400 pedidos/dia, sem cartão).
 */
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function buildContextSummary(): Promise<string> {
  try {
    const service = await getFreddyDataService();
    const [readinessEntries, loadEntries, running, wellness] = await Promise.all([
      service.getTrainingReadiness(10),
      service.getTrainingLoadSummary(7),
      service.getWeeklyRunningSummary(7),
      service.getWellnessWeekly(7).catch(() => []),
    ]);
    const latestReadiness = readinessEntries.reduce((b, c) => (!b || c.date > b.date ? c : b), readinessEntries[0]);
    const latestLoad = loadEntries.reduce((b, c) => (!b || c.date > b.date ? c : b), loadEntries[0]);
    const latestWellness = wellness[wellness.length - 1];

    const todayStr = new Date().toISOString().slice(0, 10);
    const staleDays = latestReadiness
      ? Math.round((new Date(todayStr).getTime() - new Date(latestReadiness.date).getTime()) / 86400000)
      : 0;

    return [
      latestWellness
        ? `[FONTE MAIS FRESCA, Intervals.icu, dados de HOJE ${latestWellness.date}]: CTL (fitness) ${latestWellness.ctl}, ATL (fadiga) ${latestWellness.atl}, TSB (forma) ${latestWellness.tsb} — TSB positivo e alto = fresco/recuperado, TSB muito negativo = fadigado/sobrecarga. HRV: ${latestWellness.hrv ?? "sem dado"} ms. FC repouso: ${latestWellness.restingHr ?? "sem dado"} bpm. Sono: score ${latestWellness.sleepScore ?? "sem dado"}. Usa isto como base principal para avaliar prontidão para treino hoje, em vez do Training Readiness do Garmin se este estiver desatualizado.`
        : "Sem dados do Intervals.icu disponíveis.",
      latestReadiness
        ? `Training Readiness do Garmin — ÚLTIMO REGISTO DISPONÍVEL é de ${latestReadiness.date} (${staleDays} dia(s) atrás, hoje é ${todayStr}): score ${latestReadiness.score}/100, nível ${latestReadiness.level}, feedback original: "${latestReadiness.feedbackShort}".${
            staleDays > 1
              ? ` Tem ${staleDays} dias de atraso de sincronização — trata isto como contexto secundário/histórico, não como o estado de hoje. Prioriza o TSB do Intervals.icu acima, que está atualizado.`
              : ""
          }`
        : "Sem dados recentes de Training Readiness do Garmin.",
      latestLoad
        ? `ACWR (Garmin, complementar): status ${latestLoad.acwrStatus}, ratio ${latestLoad.acwrRatio}.`
        : "",
      `Últimos 7 dias de corrida: ${running.totalDistanceKm} km em ${running.runCount} corridas.`,
    ]
      .filter(Boolean)
      .join("\n");
  } catch (err) {
    return `[Sem acesso aos dados reais do Freddy neste momento: ${String(err).slice(0, 150)}]`;
  }
}

const SYSTEM_PROMPT_BASE = `Você é um treinador de corrida de longa distância, a falar em português de Portugal (pt-PT), direto e baseado em evidência. Use os dados reais fornecidos abaixo para responder, priorizando sempre a fonte mais fresca (Intervals.icu/TSB) sobre dados antigos do Garmin quando ambos existirem. Se a pergunta não puder ser respondida com os dados disponíveis, diga isso claramente em vez de inventar números. Se usar um dado do Garmin marcado como desatualizado, é OBRIGATÓRIO mencionar isso explicitamente. Seja conciso (3-6 frases), e dê uma recomendação prática quando fizer sentido. Nunca dê conselhos médicos definitivos — para dor, lesão ou sintomas preocupantes, recomende sempre consultar um profissional de saúde.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY não configurada. Defina-a nas variáveis de ambiente para ativar o Treinador IA." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const messages: ChatMessage[] = body?.messages ?? [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "Sem mensagens." }, { status: 400 });
  }

  const context = await buildContextSummary();

  const groqRes = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT_BASE}\n\nDados reais do atleta:\n${context}` },
        ...messages,
      ],
      temperature: 0.4,
      max_tokens: 500,
    }),
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    return NextResponse.json({ error: `Erro da Groq: ${groqRes.status} ${errText.slice(0, 200)}` }, { status: 502 });
  }

  const data = await groqRes.json();
  const reply = data.choices?.[0]?.message?.content ?? "Sem resposta.";
  return NextResponse.json({ reply });
}
