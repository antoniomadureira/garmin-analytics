import { NextRequest, NextResponse } from "next/server";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { getAthleteZones } from "@/lib/strava-lab/client";
import { getTodayWeather, getAirQuality, type GeoHint } from "@/lib/weather/client";
import { getIcuPaceZones, getPlannedWorkoutForDate } from "@/lib/intervals/client";
import { loadRecentWorkoutDates, loadPrescription, parseIcuWorkout, savePrescription } from "@/lib/coach/prescription-store";
import { loadExecution } from "@/lib/coach/execution-analysis";
import { formatWorkoutHistory, secPerKmToMinSec } from "@/lib/coach/workout-history";
import { loadGoal, formatGoalContext } from "@/lib/coach/goal-store";
import { SYSTEM_PROMPT_BASE, SYSTEM_PROMPT_EVALUATE_SUFFIX, SYSTEM_PROMPT_REVIEW_SUFFIX } from "@/lib/coach/system-prompt";
import { checkIcuConsistency } from "@/lib/coach/icu-consistency";
import { computeWeeklyStressMetrics, formatStressContext } from "@/lib/analysis/training-stress";
import { selectPlannedWorkout, extractEvaluateVerdict, extractPlanFromMessage, buildReviewContext } from "@/lib/coach/evaluate";
import type { PrescribedWorkout, WorkoutExecution } from "@/lib/types/coach";
import { getDecisionWellness } from "@/lib/utils/wellness";

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

function formatPaceRange(minSec: number | null, maxSec: number | null): string {
  if (minSec !== null && maxSec !== null)
    return `${secPerKmToMinSec(minSec)}-${secPerKmToMinSec(maxSec)}/km`;
  if (minSec !== null) return `>${secPerKmToMinSec(minSec)}/km`;
  if (maxSec !== null) return `<${secPerKmToMinSec(maxSec)}/km`;
  return "?";
}

type TodayRun = { distanceKm: number; durationSec: number; paceMinPerKm: number | null };

async function buildContextSummary(
  geo?: GeoHint,
  messages: ChatMessage[] = [],
): Promise<{ context: string; todayRuns: TodayRun[] }> {
  let service;
  try {
    service = await getFreddyDataService();
  } catch (err) {
    return {
      context: `[Sem ligação ao Freddy neste momento: ${String(err).slice(0, 150)}. Diz isto claramente ao utilizador em vez de inventar dados.]`,
      todayRuns: [],
    };
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
    service.getWellnessWeekly(30).catch(() => []),
  ]);
  // [Certo] setTimeout(250) removido — redundante com semáforo em lib/freddy/limiter.ts
  const [loadEntries, running, composed, zones, todayActivities, weather, aq, paceZones, recentDates, goal] = await Promise.all([
    service.getTrainingLoadSummary(7).catch(() => []),
    service.getWeeklyRunningSummary(7).catch(() => null),
    service.getComposedReadinessFromWellness(wellness).catch(() => null),
    getAthleteZones().catch(() => null),
    // [Certo] activity_* cobre os últimos ~35 dias com dados frescos —
    // é a única fonte que inclui treinos do próprio dia (summarizedActivity_*
    // tem atraso confirmado de ~30 dias). Pedido mínimo: 1 dia.
    service.getRecentActivities(1).catch(() => []),
    getTodayWeather(geo).catch(() => null),
    // AQ e pace zones: APIs externas, nunca bloqueiam o coach se falharem
    (geo?.lat && geo?.lon ? getAirQuality(geo.lat, geo.lon) : Promise.resolve(null)).catch(() => null),
    getIcuPaceZones().catch(() => null),
    // Redis — sem rate limit, corre em paralelo com os pedidos Freddy
    loadRecentWorkoutDates(3).catch((): string[] => []),
    loadGoal().catch(() => null),
  ]);

  // Carrega pares prescrição/execução (Redis, rápido)
  const workoutHistory: Array<{
    date: string;
    prescribed: PrescribedWorkout | null;
    executed: WorkoutExecution | null;
  }> = recentDates.length > 0
    ? await Promise.all(
        recentDates.map(async (date) => ({
          date,
          prescribed: await loadPrescription(date).catch(() => null),
          executed: await loadExecution(date).catch(() => null),
        })),
      )
    : [];
  const latestReadiness = readinessEntries.reduce((b, c) => (!b || c.date > b.date ? c : b), readinessEntries[0]);
  const latestLoad = loadEntries.reduce((b, c) => (!b || c.date > b.date ? c : b), loadEntries[0]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const latestWellness = getDecisionWellness(wellness, todayStr);
  const staleDays = latestReadiness
    ? Math.round((new Date(todayStr).getTime() - new Date(latestReadiness.date).getTime()) / 86400000)
    : 0;

  // Detect if the last user message is likely a prescription request.
  // The citation instruction ("DEVES referir o último treino") is relevant
  // only when the model is about to prescribe — not in general Q&A.
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const isPrescriptionRequest = /\b(prescreve|prescri|treino (para|de) hoje|que treino|que (posso|devo) (fazer|treinar|correr)|sessão|propõe|sugere (um |uma )?treino)\b/i.test(lastUserMsg);

  // Workout history block (built before logging so we can log it exactly as injected)
  const historyBlock = formatWorkoutHistory(workoutHistory, isPrescriptionRequest);
  const goalBlock = goal ? formatGoalContext(goal, todayStr) : "";
  const stressBlock = formatStressContext(computeWeeklyStressMetrics(wellness, todayStr));

  // Permanent instrumentation — visible in Vercel Function logs
  if (goalBlock) console.log("[coach:goal]", goalBlock);
  if (stressBlock) console.log("[coach:stress]", stressBlock);
  if (historyBlock) console.log("[coach:history]", historyBlock);

  // Extracted here so we can return them alongside the context string (for review mode)
  const todayRuns = todayActivities.filter((a) => a.date === todayStr);

  const context = [
    composed && composed.compositeScore !== null
      ? `[FONTE PRINCIPAL para "estou apto a treinar hoje", composto próprio de sinais frescos${composed.morningDate ? ` (sono/RHR da noite de ${composed.morningDate})` : ""}${composed.decisionDate ? ` (carga até ${composed.decisionDate})` : ""}]: Score composto ${composed.compositeScore}/100. Recomendação base: "${composed.recommendation}". Sinais individuais: ${composed.signals.map((s) => `${s.label}: ${s.detail} (${s.status})`).join("; ")}. Este composto é uma média simples e transparente de sinais frescos (TSB, HRV, FC repouso, sono, stress) — NÃO é o algoritmo oficial do Garmin, é a tua melhor aproximação dada a indisponibilidade do Training Readiness real. Usa isto como base principal da resposta, explica os sinais que mais pesaram, e dá uma recomendação concreta de tipo de treino (fácil/moderado/séries/descanso).`
      : "Sem sinais frescos suficientes para um composto de readiness (Intervals.icu pode estar indisponível neste momento).",
    latestWellness
      ? `[Intervals.icu, dados de ${latestWellness.date} (ontem), carga de treino]: CTL (fitness) ${latestWellness.ctl}, ATL (fadiga) ${latestWellness.atl}, TSB ${latestWellness.tsb}.`
      : "Sem dados do Intervals.icu disponíveis.",
    zones && zones.heartRateZones.length > 0
      ? `[Zonas de FC REAIS do atleta, Strava]: ${zones.heartRateZones.map((z) => `Z${z.zone} ${z.min}-${z.max}bpm`).join(", ")}. Usa estes valores exatos ao sugerir treinos por zona, em vez de inventar.`
      : "Sem zonas de FC reais disponíveis — usa termos qualitativos (fácil/moderado/forte) em vez de inventar valores em bpm.",
    paceZones && paceZones.zones.length > 0
      ? `[PACE ZONES DO ATLETA, Intervals.icu]${paceZones.thresholdSecPerKm ? ` — Threshold ${secPerKmToMinSec(paceZones.thresholdSecPerKm)}/km` : ""}: ${paceZones.zones.map((z) => `${z.name} ${formatPaceRange(z.minSecPerKm, z.maxSecPerKm)}`).join(", ")}. Usa estes paces ao prescrever treinos — formato "X km a M:SS-M:SS/km (FC < Nbpm)", pace é a grandeza primária e FC é limite de controlo.`
      : "Sem pace zones do Intervals.icu — usa termos qualitativos de pace e zonas de FC.",
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
    aq
      ? `[QUALIDADE DO AR HOJE]: AQI europeu ${aq.europeanAqi}${aq.europeanAqi > 60 ? " — MÁ" : aq.europeanAqi >= 40 ? " — MÉDIA" : " — BOA"}. REGRA OBRIGATÓRIA: AQI >60 → não prescrever treino outdoor (sugerir indoor ou adiar, explicitamente); AQI 40-60 → só treino fácil outdoor, nada intenso; AQI ≤40 → sem restrição de qualidade do ar.`
      : "",
    latestLoad ? `ACWR (Garmin, complementar): status ${latestLoad.acwrStatus}, ratio ${latestLoad.acwrRatio}.` : "",
    (() => {
      if (todayRuns.length === 0) return "Sem atividade registada hoje ainda.";
      const totalKm = todayRuns.reduce((s, a) => s + a.distanceKm, 0);
      const totalMin = Math.round(todayRuns.reduce((s, a) => s + a.durationSec, 0) / 60);
      const startTime = todayRuns[0].startTimeLocal;
      const timeStr = startTime ? ` às ${startTime}` : "";
      // [Certo] Bug: .toFixed(2) produzia "4.88min/km" → LLM formatava como "4:88/km".
      // Fix: converter para min:sec via secPerKmToMinSec (Math.round(pace * 60)).
      const paceStr = todayRuns[0].paceMinPerKm != null
        ? `${secPerKmToMinSec(Math.round(todayRuns[0].paceMinPerKm * 60))}/km`
        : "—";
      return `[TREINO DE HOJE JÁ REALIZADO${timeStr} — REGRA: por defeito recomenda descanso ou recuperação passiva com justificação de carga; segunda sessão só se o utilizador pedir explicitamente]: ${todayRuns.length} atividade(s) hoje, ${totalKm.toFixed(1)}km em ${totalMin}min. Pace médio: ${paceStr}.`;
    })(),
    running ? `Volume últimos 7 dias (summarized, pode não incluir hoje): ${running.totalDistanceKm} km em ${running.runCount} corridas.` : "Sem dados de volume semanal.",
    stressBlock,
    goalBlock,
    historyBlock,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    context,
    todayRuns: todayRuns.map((r) => ({
      distanceKm: r.distanceKm,
      durationSec: r.durationSec,
      paceMinPerKm: r.paceMinPerKm,
    })),
  };
}


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
  let manualPlan: string | null =
    typeof body?.plannedWorkout === "string" && body.plannedWorkout.trim() ? body.plannedWorkout.trim() : null;
  // Auto-detect plan pasted into chat input when the field is empty
  if (!manualPlan) {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const autoDetected = extractPlanFromMessage(lastUserMsg);
    if (autoDetected) {
      manualPlan = autoDetected;
      console.log("[coach:plan-autodetect]");
    }
  }

  // Mesma cadeia de resolução do dashboard: cookie geo (GPS) → env → geo-IP → default
  const geoCookie = req.cookies.get("geo")?.value;
  const [cookieLat, cookieLon] = geoCookie?.split(",") ?? [];
  const vercelLat = req.headers.get("x-vercel-ip-latitude");
  const vercelLon = req.headers.get("x-vercel-ip-longitude");
  const geo: GeoHint = {
    lat: cookieLat ?? process.env.WEATHER_LAT ?? vercelLat ?? null,
    lon: cookieLon ?? process.env.WEATHER_LON ?? vercelLon ?? null,
    city: cookieLat ? null : req.headers.get("x-vercel-ip-city"),
    source: cookieLat ? "cookie" : process.env.WEATHER_LAT ? "env" : vercelLat ? "vercel-geo-ip" : "default",
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // Parallel: context + ICU event (skip event fetch if manual plan already provided)
  const icuEventPromise = manualPlan
    ? Promise.resolve(null)
    : getPlannedWorkoutForDate(todayStr).catch(() => null);
  const [{ context: contextBase, todayRuns }, icuEvent] = await Promise.all([
    buildContextSummary(geo, messages),
    icuEventPromise,
  ]);

  // Priority: manual field > ICU event > null (prescribe mode)
  const plan = selectPlannedWorkout(manualPlan, icuEvent);

  // Review mode: plan exists AND today's execution already happened
  const reviewMode = plan !== null && todayRuns.length > 0;

  let context = plan
    ? `${contextBase}\n[PLANO DO DIA — FONTE: ${plan.source === "icu" ? `Intervals.icu (${plan.name})` : "campo manual"}]:\n${plan.text}`
    : contextBase;

  if (reviewMode) {
    const parsedPlan = plan!.source === "icu" ? parseIcuWorkout(plan!.name, plan!.text) : null;
    context += `\n${buildReviewContext(todayRuns[0], plan!, parsedPlan?.mainPace ?? null)}`;
  }

  const systemPrompt = reviewMode
    ? `${SYSTEM_PROMPT_BASE}${SYSTEM_PROMPT_REVIEW_SUFFIX}`
    : plan
    ? `${SYSTEM_PROMPT_BASE}${SYSTEM_PROMPT_EVALUATE_SUFFIX}`
    : SYSTEM_PROMPT_BASE;

  const groqRes = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: `${systemPrompt}\n\nDados reais do atleta:\n${context}` },
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
  let consistencyWarning: string | null = null;
  if (icuRaw) {
    const nameMatch = icuRaw.match(/<name>([\s\S]*?)<\/name>/);
    const descMatch = icuRaw.match(/<description>([\s\S]*?)<\/description>/);
    if (nameMatch && descMatch) {
      icuWorkout = { name: nameMatch[1].trim(), description: descMatch[1].trim() };
      const consistency = checkIcuConsistency(reply, icuWorkout.description);
      // Platform limitation: Nx repeat blocks don't arrive as structured steps on Garmin
      if (consistency.hasIntervals) {
        const nxWarn = "Treino com repetições — por limitação Intervals→Garmin, os steps podem chegar ao relógio como nota de texto. O pace está no texto acima.";
        consistencyWarning = consistency.warning ? `${nxWarn}; ${consistency.warning}` : nxWarn;
      } else if (consistency.warning) {
        consistencyWarning = consistency.warning;
      }
      if (consistencyWarning) {
        console.log("[coach:consistency] WARN", {
          warning: consistencyWarning,
          textDistanceKm: consistency.textDistanceKm,
          icuDistanceKm: consistency.icuDistanceKm,
          workoutName: icuWorkout.name,
        });
      } else if (consistency.unverifiable) {
        console.log("[coach:consistency] UNVERIFIABLE", {
          reason: "ICU tem distância explícita mas texto não menciona distância total",
          icuDistanceKm: consistency.icuDistanceKm,
          workoutName: icuWorkout.name,
        });
      }
    }
  }

  // Evaluate/review mode: log verdict + save plan as prescription for memory continuity
  if (plan) {
    const verdict = extractEvaluateVerdict(reply);
    const mode = reviewMode ? "review" : "evaluate";
    console.log(`[coach:${mode}]`, { source: plan.source, verdict, name: plan.name });
    const prescription: PrescribedWorkout =
      plan.source === "icu"
        ? parseIcuWorkout(plan.name, plan.text)
        : { name: plan.name, sections: [], totalDurationSec: null, mainPace: null, rawBlock: plan.text };
    savePrescription(todayStr, prescription).catch(() => {});
  }

  return NextResponse.json({
    reply,
    icuWorkout: plan ? null : icuWorkout,
    consistencyWarning: plan ? null : consistencyWarning,
    evaluateMode: plan ? (reviewMode ? "review" : "evaluate") : false,
  });
}
