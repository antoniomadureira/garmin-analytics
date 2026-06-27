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
    const [readinessEntries, loadEntries, running, wellness, composed] = await Promise.all([
      service.getTrainingReadiness(10),
      service.getTrainingLoadSummary(7),
      service.getWeeklyRunningSummary(7),
      service.getWellnessWeekly(7).catch(() => []),
      service.getComposedReadiness().catch(() => null),
    ]);
    const latestReadiness = readinessEntries.reduce((b, c) => (!b || c.date > b.date ? c : b), readinessEntries[0]);
    const latestLoad = loadEntries.reduce((b, c) => (!b || c.date > b.date ? c : b), loadEntries[0]);
    const latestWellness = wellness[wellness.length - 1];

    const todayStr = new Date().toISOString().slice(0, 10);
    const staleDays = latestReadiness
      ? Math.round((new Date(todayStr).getTime() - new Date(latestReadiness.date).getTime()) / 86400000)
      : 0;

    return [
      composed && composed.compositeScore !== null
        ? `[FONTE PRINCIPAL para "estou apto a treinar hoje", composto próprio de sinais frescos de hoje]: Score composto ${composed.compositeScore}/100. Recomendação base: "${composed.recommendation}". Sinais individuais: ${composed.signals.map((s) => `${s.label}: ${s.detail} (${s.status})`).join("; ")}. Este composto é uma média simples e transparente de sinais frescos (TSB, HRV, FC repouso, sono, stress) — NÃO é o algoritmo oficial do Garmin, é a tua melhor aproximação dada a indisponibilidade do Training Readiness real. Usa isto como base principal da resposta, explica os sinais que mais pesaram, e dá uma recomendação concreta de tipo de treino (fácil/moderado/séries/descanso).`
        : "Sem sinais frescos suficientes para um composto de readiness.",
      latestWellness
        ? `[Intervals.icu, dados de HOJE ${latestWellness.date}, carga de treino]: CTL (fitness) ${latestWellness.ctl}, ATL (fadiga) ${latestWellness.atl}, TSB ${latestWellness.tsb}.`
        : "Sem dados do Intervals.icu disponíveis.",
      latestReadiness
        ? `Training Readiness do Garmin (CONTEXTO HISTÓRICO, não atual) — último registo de ${latestReadiness.date} (${staleDays} dia(s) atrás): score ${latestReadiness.score}/100, nível ${latestReadiness.level}.${
            staleDays > 1
              ? ` Tem ${staleDays} dias de atraso — NÃO uses isto como resposta principal a "estou apto hoje", usa o composto acima.`
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

const SYSTEM_PROMPT_BASE = `Você é um treinador de corrida de longa distância, a falar em português de Portugal (pt-PT), direto e baseado em evidência. Use os dados reais fornecidos abaixo para responder. TSB/CTL/ATL (Intervals.icu) e Training Readiness (Garmin) medem coisas diferentes — TSB é só equilíbrio de carga de treino, Training Readiness combina HRV+sono+stress+carga. NUNCA trates um como substituto do outro; se divergirem, diz isso ao utilizador em vez de escolher um e ignorar o outro. Se a pergunta não puder ser respondida com os dados disponíveis, diga isso claramente em vez de inventar números. Se usar um dado do Garmin marcado como desatualizado, é OBRIGATÓRIO mencionar isso explicitamente. Seja conciso (3-6 frases), e dê uma recomendação prática quando fizer sentido. Nunca dê conselhos médicos definitivos — para dor, lesão ou sintomas preocupantes, recomende sempre consultar um profissional de saúde.`;

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
