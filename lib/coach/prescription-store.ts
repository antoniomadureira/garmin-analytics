import { kv } from "@/lib/redis";
import type { PrescribedSection, PrescribedStep, PrescribedWorkout } from "@/lib/types/coach";

const TTL = 90 * 24 * 3600; // 90 dias
const DATES_KEY = "coach:workout-dates";
const MAX_TRACKED_DATES = 30;

// ─── ICU Workout parser ──────────────────────────────────────────────────────

function parseStep(line: string): PrescribedStep {
  const text = line.replace(/^-\s*/, "").trim();
  const step: PrescribedStep = { label: text };

  // Distância — tem de ser antes de "m" para não capturar "km" como "k" + minutos
  const kmMatch = text.match(/\b(\d+(?:\.\d+)?)\s*km\b/);
  const mtrMatch = text.match(/\b(\d+(?:\.\d+)?)\s*mtr\b/);
  if (kmMatch) step.distanceM = parseFloat(kmMatch[1]) * 1000;
  else if (mtrMatch) step.distanceM = parseFloat(mtrMatch[1]);

  // Duração — "m" ou "min" NÃO seguido de "tr" (evita "mtr")
  const durMatch = text.match(/\b(\d+)\s*m(?:in)?\b(?!tr)/);
  if (durMatch) step.durationSec = parseInt(durMatch[1]) * 60;

  // Pace — M:SS-M:SS/km Pace
  const paceMatch = text.match(/\b(\d+):(\d+)-(\d+):(\d+)\/km\s+Pace/i);
  if (paceMatch) {
    step.paceMin = parseInt(paceMatch[1]) * 60 + parseInt(paceMatch[2]);
    step.paceMax = parseInt(paceMatch[3]) * 60 + parseInt(paceMatch[4]);
  }

  // HR% ceiling — "N-N% HR" → guarda extremo superior
  const hrMatch = text.match(/\b(\d+)-(\d+)%\s*HR/i);
  if (hrMatch) step.hrCeilingPct = parseInt(hrMatch[2]);

  // Zone
  const zoneMatch = text.match(/\bZ(\d+)\b/);
  if (zoneMatch) step.zone = `Z${zoneMatch[1]}`;

  return step;
}

function parseSections(description: string): PrescribedSection[] {
  const sections: PrescribedSection[] = [];
  const chunks = description
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const first = lines[0];
    const stepLines = lines.filter((l) => l.startsWith("-"));
    const steps = stepLines.map(parseStep);

    if (/^\d+x$/i.test(first)) {
      sections.push({ name: "Main", reps: parseInt(first), steps });
    } else {
      sections.push({ name: first, reps: 1, steps });
    }
  }

  return sections;
}

export function parseIcuWorkout(name: string, description: string): PrescribedWorkout {
  const sections = parseSections(description);

  // mainPace = alvo do 1º passo que tenha pace explícito (tipicamente a secção principal)
  let mainPace: PrescribedWorkout["mainPace"] = null;
  outer: for (const sec of sections) {
    for (const step of sec.steps) {
      if (step.paceMin !== undefined && step.paceMax !== undefined) {
        mainPace = { minSecPerKm: step.paceMin, maxSecPerKm: step.paceMax };
        break outer;
      }
    }
  }

  // totalDurationSec = soma de durações × reps (passos de distância não contribuem)
  let totalDurationSec = 0;
  for (const sec of sections) {
    for (const step of sec.steps) {
      if (step.durationSec !== undefined) {
        totalDurationSec += step.durationSec * sec.reps;
      }
    }
  }

  return {
    name,
    sections,
    totalDurationSec: totalDurationSec > 0 ? totalDurationSec : null,
    mainPace,
  };
}

// ─── Redis persistence ───────────────────────────────────────────────────────

async function trackDate(date: string): Promise<void> {
  const existing = (await kv.get<string[]>(DATES_KEY)) ?? [];
  const updated = [date, ...existing.filter((d) => d !== date)].slice(0, MAX_TRACKED_DATES);
  await kv.set(DATES_KEY, updated, { ex: TTL });
}

export async function savePrescription(date: string, workout: PrescribedWorkout): Promise<void> {
  await Promise.all([
    kv.set(`coach:prescribed:${date}`, workout, { ex: TTL }),
    trackDate(date),
  ]);
}

export async function loadPrescription(date: string): Promise<PrescribedWorkout | null> {
  return kv.get<PrescribedWorkout>(`coach:prescribed:${date}`);
}

/** Datas com prescrição guardada, mais recentes primeiro (máx n). */
export async function loadRecentWorkoutDates(n: number): Promise<string[]> {
  const dates = (await kv.get<string[]>(DATES_KEY)) ?? [];
  return dates.slice(0, n);
}
