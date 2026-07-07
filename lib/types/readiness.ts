export interface ReadinessSignal {
  label: string;
  status: "bom" | "ok" | "atencao";
  detail: string;
}

export interface ReadinessCardData {
  compositeScore: number | null;
  recommendation: string;
  /** [Certo] Classificação vinda do serviço composto — fonte única, nunca reclassificar localmente. */
  level: "green" | "yellow" | "red" | "unknown";
  signals: ReadinessSignal[];
  garminScore: number | null;
  garminLevel: string;
  garminStaleDaysAgo: number | null;
  /** Valor numérico do sono (0-100), extraído do sinal "Sono" — conveniência para outros blocos (ex: StatTile "Condição Atual"). */
  sleepScoreValue: number | null;
}

export interface RecoveryCardData {
  recoveryTimeHours: number | null;
  acuteLoad: number | null;
  bodyBatteryMax: number | null;
  bodyBatteryMin: number | null;
  avgStress: number | null;
  hrv: number | null;
  hrvBaseline: number | null;
  restingHr: number | null;
  restingHrBaseline: number | null;
}
