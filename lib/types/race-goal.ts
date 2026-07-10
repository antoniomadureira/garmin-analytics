export interface RaceGoalCardData {
  raceName: string;
  raceDate: string;
  weeksLeft: number;
  phase: "base" | "especifico" | "taper";
  targetSec: number;
  predictedSec: number | null;
  predictionDate: string | null;
  predictionSource: "garmin" | "riegel" | null;
  predictionSourceLabel: string | null; // "Garmin", "Riegel/HM", "Riegel/10K", "Riegel/5K"
  predictionStale?: boolean;            // Riegel source > 70d
}
