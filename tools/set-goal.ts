/**
 * Grava o objetivo de prova no Redis (coach:goal).
 * Executar uma vez: npm run goal:set
 */
import { saveGoal } from "../lib/coach/goal-store";

void (async () => {
  await saveGoal({
    race: "Maratona de Lisboa",
    date: "2026-10-10",
    targetTime: "3:00:00",
    targetPaceSecPerKm: 255,
  });
  console.log("Objetivo gravado: Maratona de Lisboa 2026-10-10 sub-3h (4:15/km).");
  process.exit(0);
})();
