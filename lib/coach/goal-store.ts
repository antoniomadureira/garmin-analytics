import { kv } from "@/lib/redis";

export interface RaceGoal {
  race: string;
  date: string;                  // "YYYY-MM-DD"
  targetTime: string;            // "3:00:00"
  targetPaceSecPerKm: number;    // 255
}

export type CyclePhase = "base" | "especifico" | "taper";

const GOAL_KEY = "coach:goal";

export async function loadGoal(): Promise<RaceGoal | null> {
  return kv.get<RaceGoal>(GOAL_KEY);
}

export async function saveGoal(goal: RaceGoal): Promise<void> {
  await kv.set(GOAL_KEY, goal);
}

/** Semanas completas restantes até raceDate (0 se já passou). */
export function weeksRemaining(
  raceDate: string,
  today = new Date().toISOString().slice(0, 10),
): number {
  const ms =
    new Date(`${raceDate}T00:00:00`).getTime() -
    new Date(`${today}T00:00:00`).getTime();
  return Math.max(0, Math.floor(ms / (7 * 24 * 3600 * 1000)));
}

/** >12 semanas = base; ≥3 = específico; <3 = taper. */
export function cyclePhase(weeksLeft: number): CyclePhase {
  if (weeksLeft > 12) return "base";
  if (weeksLeft >= 3) return "especifico";
  return "taper";
}

/** H:MM:SS para tempo de maratona (ex: "3:07:23"). */
export function formatMarathonTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** "+7:03" ou "−1:30" (sinal sempre presente; usa U+2212 para o menos). */
export function formatTimeDelta(deltaSec: number): string {
  const sign = deltaSec >= 0 ? "+" : "−";
  const abs = Math.abs(deltaSec);
  const m = Math.floor(abs / 60);
  const s = Math.round(abs % 60);
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

/** ≤0 = verde; 1-300s = âmbar; >300s = vermelho. */
export function deltaSeverity(deltaSec: number): "green" | "amber" | "red" {
  if (deltaSec <= 0) return "green";
  if (deltaSec <= 300) return "amber";
  return "red";
}

/** Linha de contexto completa para o prompt do coach. */
export function formatGoalContext(
  goal: RaceGoal,
  today = new Date().toISOString().slice(0, 10),
): string {
  const weeks = weeksRemaining(goal.date, today);
  const phase = cyclePhase(weeks);
  const pMin = Math.floor(goal.targetPaceSecPerKm / 60);
  const pSec = goal.targetPaceSecPerKm % 60;
  const paceStr = `${pMin}:${String(pSec).padStart(2, "0")}/km`;

  const phaseLabel: Record<CyclePhase, string> = {
    base: "Base",
    especifico: "Específico",
    taper: "Taper",
  };
  const phaseInstruction: Record<CyclePhase, string> = {
    base: "Fase Base: prioridade ao volume aeróbico (Z1-Z2); treinos de qualidade pontuais mas volume é o foco.",
    especifico: `Fase Específico: progressivamente mais treinos a pace de maratona (${paceStr}) e MP±10s/km. Séries de tempo a MP ou corridas longas com segmentos a MP.`,
    taper: `Fase Taper: volume a cair 20-30%/semana, manter intensidade. Corrida longa máx 25km, séries a MP mantidas mas volume reduzido.`,
  };

  return `[OBJETIVO DO ATLETA — lê ANTES de prescrever]: Prova "${goal.race}" em ${goal.date} (${weeks} semanas). Pace alvo: ${paceStr} (${goal.targetTime}). Fase atual: ${phaseLabel[phase]}. INSTRUÇÃO OBRIGATÓRIA: ${phaseInstruction[phase]}`;
}
