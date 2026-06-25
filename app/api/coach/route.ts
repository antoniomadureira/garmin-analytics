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
    const [readinessEntries, loadEntries, running] = await Promise.all([
      service.getTrainingReadiness(7),
      service.getTrainingLoadSummary(7),
      service.getWeeklyRunningSummary(7),
    ]);
    const latestReadiness = readinessEntries.reduce((b, c) => (!b || c.date > b.date ? c : b), readinessEntries[0]);
    const latestLoad = loadEntries.reduce((b, c) => (!b || c.date > b.date ? c : b), loadEntries[0]);

    return [
      latestReadiness
        ? `Training Readiness mais recente (${latestReadiness.date}): score ${latestReadiness.score}/100, nível ${latestReadiness.level}, feedback: "${latestReadiness.feedbackShort}", acute load ${latestReadiness.acuteLoad}.`
        : "Sem dados recentes de Training Readiness.",
      latestLoad
        ? `Carga de treino mais recente (${latestLoad.date}): ACWR status ${latestLoad.acwrStatus}, ratio ${latestLoad.acwrRatio}.`
        : "Sem dados recentes de carga de treino.",
      `Últimos 7 dias de corrida: ${running.totalDistanceKm} km em ${running.runCount} corridas.`,
    ].join("\n");
  } catch (err) {
    return `[Sem acesso aos dados reais do Freddy neste momento: ${String(err).slice(0, 150)}]`;
  }
}

const SYSTEM_PROMPT_BASE = `Você é um treinador de corrida de longa distância, a falar em português de Portugal (pt-PT), direto e baseado em evidência. Use os dados reais fornecidos abaixo para responder. Se a pergunta não puder ser respondida com os dados disponíveis, diga isso claramente em vez de inventar números. Seja conciso (3-6 frases), e dê uma recomendação prática quando fizer sentido. Nunca dê conselhos médicos definitivos — para dor, lesão ou sintomas preocupantes, recomende sempre consultar um profissional de saúde.`;

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
