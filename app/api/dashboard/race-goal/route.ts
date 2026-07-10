import { NextResponse } from "next/server";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { loadGoal, weeksRemaining, cyclePhase } from "@/lib/coach/goal-store";
import { selectRiegelInput } from "@/lib/analysis/race-prediction";
import type { RaceGoalCardData } from "@/lib/types/race-goal";

export async function GET() {
  const goal = await loadGoal().catch(() => null);
  if (!goal) {
    return NextResponse.json({ data: null, isReal: false });
  }

  const today = new Date().toISOString().slice(0, 10);
  const weeksLeft = weeksRemaining(goal.date, today);
  const phase = cyclePhase(weeksLeft);
  const [h, m, s] = goal.targetTime.split(":").map(Number);
  const targetSec = h * 3600 + m * 60 + s;

  let predictedSec: number | null = null;
  let predictionDate: string | null = null;
  let predictionSource: RaceGoalCardData["predictionSource"] = null;
  let predictionSourceLabel: string | null = null;
  let predictionStale = false;

  let service = null;
  try {
    service = await getFreddyDataService();
  } catch { /* Freddy indisponivel */ }

  // Garmin: aceitar so se fresco (<14d)
  if (service) {
    try {
      const pred = await service.getRacePredictions();
      const ageDays = Math.floor((Date.now() - new Date(`${pred.date}T00:00:00`).getTime()) / 86_400_000);
      if (ageDays < 14) {
        predictedSec = pred.timeMarathonSec;
        predictionDate = pred.date;
        predictionSource = "garmin";
        predictionSourceLabel = "Garmin";
      }
    } catch { /* tentar Riegel */ }
  }

  // Riegel: Freddy records (data = data da corrida, nao PR all-time)
  if (predictedSec === null && service) {
    try {
      const records = await service.getPersonalRecords(180);
      let riegel = selectRiegelInput(records, 70);
      let stale = false;
      if (!riegel) {
        riegel = selectRiegelInput(records, 180);
        stale = true;
      }
      if (riegel) {
        predictedSec = riegel.predictedMarathonSec;
        predictionDate = riegel.sourceDate;
        predictionSource = "riegel";
        predictionSourceLabel = `Riegel/${riegel.sourceLabel}`;
        predictionStale = stale;
      }
    } catch { /* graceful */ }
  }

  const data: RaceGoalCardData = {
    raceName: goal.race,
    raceDate: goal.date,
    weeksLeft,
    phase,
    targetSec,
    predictedSec,
    predictionDate,
    predictionSource,
    predictionSourceLabel,
    predictionStale: predictionStale || undefined,
  };

  return NextResponse.json({
    data,
    isReal: predictedSec !== null,
    error: predictedSec === null
      ? (service ? "Sem dados de corrida nos ultimos 180d (5K/10K/HM)" : "Freddy indisponivel")
      : undefined,
  });
}
