import { NextRequest, NextResponse } from "next/server";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { getAthleteZones } from "@/lib/strava-lab/client";
import { getTodayWeather, type GeoHint } from "@/lib/weather/client";

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

async function buildContextSummary(geo?: GeoHint): Promise<string> {
  let service;
  try {
    service = await getFreddyDataService();
  } catch (err) {
    return `[Sem ligação ao Freddy neste momento: ${String(err).slice(0, 150)}. Diz isto claramente ao utilizador em vez de inventar dados.]`;
  }

  // [Certo] Corrigido rate limit confirmado: a versão anterior disparava
  // getWellnessWeekly DUAS VEZES em paralelo (uma direta, outra dentro de
  // getComposedReadiness) mais 4 outras chamadas — 7 pedidos reais ao
  // Freddy de um só golpe, contra o padrão "lotes de 3" já validado no
  // resto da app. Corrigido: getComposedReadiness passa a aceitar os
  // dados de wellness já obtidos (sem repetir o pedido), e o resto corre
  // em 2 lotes pequenos com pausa entre eles.
  const [readinessEntries, wellness] = await Promise.all([
    service.getTrainingReadiness(10).catch(() => []),
    service.getWellnessWeekly(8).catch(() => []),
  ]);
  await new Promise((r) => setTimeout(r, 250));
  const [loadEntries, running, composed, zones, todayActivities, weather] = await Promise.all([
    service.getTrainingLoadSummary(7).catch(() => []),
    service.getWeeklyRunningSummary(7).catch(() => null),
    service.getComposedReadinessFromWellness(wellness).catch(() => null),
    getAthleteZones().catch(() => null),
    // [Certo] activity_* cobre os últimos ~35 dias com dados frescos —
    // é a única fonte que inclui treinos do próprio dia (summarizedActivity_*
    // tem atraso confirmado de ~30 dias). Pedido mínimo: 1 dia.
    service.getRecentActivities(1).catch(() => []),
    getTodayWeather(geo).catch(() => null),
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
      : "Sem sinais frescos suficientes para um composto de readiness (Intervals.icu pode estar indisponível neste momento).",
    latestWellness
      ? `[Intervals.icu, dados de HOJE ${latestWellness.date}, carga de treino]: CTL (fitness) ${latestWellness.ctl}, ATL (fadiga) ${latestWellness.atl}, TSB ${latestWellness.tsb}.`
      : "Sem dados do Intervals.icu disponíveis.",
    zones && zones.heartRateZones.length > 0
      ? `[Zonas de FC REAIS do atleta, Strava]: ${zones.heartRateZones.map((z) => `Z${z.zone} ${z.min}-${z.max}bpm`).join(", ")}. Usa estes valores exatos ao sugerir treinos por zona, em vez de inventar.`
      : "Sem zonas de FC reais disponíveis — usa termos qualitativos (fácil/moderado/forte) em vez de inventar valores em bpm.",
    latestReadiness
      ? `Training Readiness do Garmin (CONTEXTO HISTÓRICO, não atual) — último registo de ${latestReadiness.date} (${staleDays} dia(s) atrás): score ${latestReadiness.score}/100, nível ${latestReadiness.level}.${
          staleDays > 1
            ? ` Tem ${staleDays} dias de atraso — NÃO uses isto como resposta principal a "estou apto hoje", usa o composto acima.`
            : ""
        }`
      : "Sem dados recentes de Training Readiness do Garmin.",
    weather
      ? `[METEO HOJE, ${weather.locationName}]: máx ${weather.tempMaxC}°C / mín ${weather.tempMinC}°C, agora ${weather.tempNowC}°C com ${weather.humidityNowPct}% humidade, vento máx ${weather.windMaxKmh}km/h, prob. chuva ${weather.precipProbMaxPct}%. OBRIGATÓRIO: ajusta a recomendação ao tempo — com calor (>26°C) sugere horários frescos, hidratação e pace ~10-20s/km mais lento; acima de 32°C desaconselha treinos intensos ao meio do dia; com chuva forte ou vento >40km/h menciona percurso/equipamento.`
      : "Sem dados meteorológicos disponíveis.",
    latestLoad ? `ACWR (Garmin, complementar): status ${latestLoad.acwrStatus}, ratio ${latestLoad.acwrRatio}.` : "",
    (() => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayRuns = todayActivities.filter((a) => a.date === todayStr);
      if (todayRuns.length === 0) return "Sem atividade registada hoje ainda.";
      const totalKm = todayRuns.reduce((s, a) => s + a.distanceKm, 0);
      const totalMin = Math.round(todayRuns.reduce((s, a) => s + a.durationSec, 0) / 60);
      return `[TREINO DE HOJE JÁ REALIZADO — usa isto para ajustar a resposta]: ${todayRuns.length} atividade(s) hoje, ${totalKm.toFixed(1)}km em ${totalMin}min. ${
        todayRuns.length > 0 ? `Pace médio: ${todayRuns[0].paceMinPerKm?.toFixed(2) ?? "—"}min/km.` : ""
      } Se o utilizador pergunta "que treino posso fazer hoje" DEPOIS de já ter treinado, reconhece isso explicitamente e adapta a recomendação (ex: recuperação activa, descanso, ou segundo treino leve se o TSB o permitir).`;
    })(),
    running ? `Volume últimos 7 dias (summarized, pode não incluir hoje): ${running.totalDistanceKm} km em ${running.runCount} corridas.` : "Sem dados de volume semanal.",
  ]
    .filter(Boolean)
    .join("\n");
}

const SYSTEM_PROMPT_BASE = `Você é um treinador de corrida de longa distância, a falar em português de Portugal (pt-PT), direto e baseado em evidência. Use os dados reais fornecidos abaixo para responder. TSB/CTL/ATL (Intervals.icu) e Training Readiness (Garmin) medem coisas diferentes — TSB é só equilíbrio de carga de treino, Training Readiness combina HRV+sono+stress+carga. NUNCA trates um como substituto do outro; se divergirem, diz isso ao utilizador em vez de escolher um e ignorar o outro. Se a pergunta não puder ser respondida com os dados disponíveis, diga isso claramente em vez de inventar números. Se usar um dado do Garmin marcado como desatualizado, é OBRIGATÓRIO mencionar isso explicitamente. Nunca dê conselhos médicos definitivos — para dor, lesão ou sintomas preocupantes, recomende sempre consultar um profissional de saúde.

Para perguntas gerais (ex: "como está a minha forma", "estou apto para treinar"), seja conciso (3-6 frases).

Para pedidos de um TREINO ESPECÍFICO para hoje, responda SEMPRE com DUAS partes na mesma mensagem, nesta ordem exacta:

PARTE 1 — Markdown legível para o utilizador:
- Título ### com emoji e nome do treino
- Frase de contexto ligando o treino aos sinais do dia
- Secções **Aquecimento:**, **Sessão Principal:**, **Arrefecimento:** com sub-pontos e zonas de FC reais quando disponíveis
- **🎯 Objetivo:** e **💡 Pós-Treino:** no final

PARTE 2 — Bloco estruturado para o Intervals.icu (obrigatório):
Imediatamente a seguir ao Markdown, adiciona exactamente este separador e bloco:
---ICU_WORKOUT---
<name>Nome do treino em PT</name>
<description>
Usa EXACTAMENTE esta sintaxe de texto do Intervals.icu (o servidor faz o parse e cria passos estruturados):

Warmup
- 15m 65-70% HR

6x
- 800mtr 3:50-4:00/km Pace
- 2m Z1

Cooldown
- 10m 60-65% HR

Regras obrigatórias:
- "m" significa minutos, NUNCA metros. Usa "mtr" ou "km" para distâncias (ex: 800mtr, 1.6km).
- Pace no formato MM:SS/km (ex: 3:50-4:00/km Pace).
- Zonas: Z1, Z2, Z3, Z4, Z5 ou percentagem HR (ex: 70-80% HR). Usa as zonas reais do atleta se fornecidas.
- Repetições: número seguido de "x" numa linha própria, depois os passos indentados com "- ".
- Secções separadas por linha em branco. Nomes de secção livres (Warmup, Main Set, Cooldown, etc.).
Não expliques o formato — vai direto ao conteúdo dentro das tags.
</description>
---ICU_END---

Não expliques o formato nem menciones os separadores ao utilizador — eles são invisíveis na app.`;

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

  const geo: GeoHint = {
    lat: req.headers.get("x-vercel-ip-latitude"),
    lon: req.headers.get("x-vercel-ip-longitude"),
    city: req.headers.get("x-vercel-ip-city"),
  };
  const context = await buildContextSummary(geo);

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
      max_tokens: 900,
    }),
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    return NextResponse.json({ error: `Erro da Groq: ${groqRes.status} ${errText.slice(0, 200)}` }, { status: 502 });
  }

  const data = await groqRes.json();
  const fullReply = data.choices?.[0]?.message?.content ?? "Sem resposta.";

  // Extrai o bloco ICU do modelo, invisível para o utilizador
  const icuMatch = fullReply.match(/---ICU_WORKOUT---([\s\S]*?)---ICU_END---/);
  const icuRaw = icuMatch ? icuMatch[1].trim() : null;
  const reply = fullReply.replace(/---ICU_WORKOUT---[\s\S]*?---ICU_END---/, "").trim();

  let icuWorkout: { name: string; description: string } | null = null;
  if (icuRaw) {
    const nameMatch = icuRaw.match(/<name>([\s\S]*?)<\/name>/);
    const descMatch = icuRaw.match(/<description>([\s\S]*?)<\/description>/);
    if (nameMatch && descMatch) {
      icuWorkout = { name: nameMatch[1].trim(), description: descMatch[1].trim() };
    }
  }

  return NextResponse.json({ reply, icuWorkout });
}
