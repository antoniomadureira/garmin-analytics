/**
 * =============================================================================
 * FREDDY COACH — DATA ARCHITECTURE (Fase 1)
 * =============================================================================
 *
 * ESTE FICHEIRO É A FONTE DE VERDADE PARA NOMES DE MÉTRICAS.
 * Toda a string usada em `query_metrics({ metrics: [...] })` está aqui
 * verificada contra o `list_metrics` real da conta (snapshot 2026-06-25).
 *
 * REGRA DE OURO: nenhum componente de UI deve referenciar uma string de
 * métrica "à mão". Tudo passa pelos enums/consts abaixo. Se um metric name
 * mudar no provider, muda-se aqui e só aqui.
 *
 * GAPS CONHECIDOS (não inventar dados para os preencher):
 *   1. [Certo — CONFIRMADO em runtime, 2 corridas reais de 2026-06-23/24]
 *      Running Dynamics clássica (vertical oscillation, ground contact time,
 *      ground contact balance, stride length) NÃO existe em lado nenhum:
 *      nem em list_metrics, nem dentro do raw payload de `activityDetail_samples`.
 *      O raw real só contém os streams: heart_rate, speed, cadence, altitude,
 *      power, latitude, longitude. Conclusão definitiva, não suposição:
 *      a secção "Running Dynamics" da espec original promete dados que a
 *      fenix 7 + Freddy não entregam por esta via. Limitação permanente,
 *      não um gap temporário a resolver depois.
 *   2. Não existe TSB/CTL/ATL ao estilo TrainingPeaks. O substituto real é
 *      ACWR (Acute:Chronic Workload Ratio) via `acuteTrainingLoad_*`.
 *      Qualquer card que use a palavra "TSB" tem de deixar claro que é
 *      uma adaptação, não a métrica original.
 *   3. VO2 Max tem 4 fontes concorrentes. Hierarquia adotada nesta versão:
 *        canónica (card principal) -> userMetrics_vo2Max
 *        série histórica longa     -> maxMet_running_vo2MaxValue
 *        validação cruzada         -> summarizedActivity_vO2MaxValue
 *        biometria (Fitness Age)   -> fitnessAge_biometricVo2Max
 *      Esta hierarquia é uma decisão de produto, não um facto do provider.
 *      Se a equipa de coaching discordar, mudar APENAS aqui.
 *   4. [Crítico] O texto que recebi ao chamar query_metrics nesta conversa
 *      ("2026-06-24: activity_distanceInMeters: 12250.78 meters...") é uma
 *      RENDERIZAÇÃO HUMANA produzida pelo wrapper deste chat — não é
 *      necessariamente o JSON literal que o endpoint MCP de produção
 *      (https://freddy.coach/mcp) devolve a um cliente @modelcontextprotocol/sdk.
 *      A ÚNICA parte do payload confirmada como JSON estruturado real é o
 *      campo `raw` de `activityDetail_samples` (incluído abaixo, verbatim).
 *      Antes de finalizar os mappers de Sleep/TrainingReadiness/TrainingLoad/
 *      Vo2Max/RacePrediction, a equipa TEM de fazer uma chamada real ao
 *      servidor MCP de produção e logar a resposta bruta — não assumir que
 *      o shape é "metric_name -> {date: value}" só porque foi assim que
 *      apareceu aqui.
 * =============================================================================
 */

// -----------------------------------------------------------------------------
// 1. CONST OBJECTS DE METRIC NAMES (agrupados por domínio funcional)
// -----------------------------------------------------------------------------

export const SleepMetrics = {
  durationSec: "sleep_durationInSeconds",
  deepSec: "sleep_deepSleepDurationInSeconds",
  lightSec: "sleep_lightSleepDurationInSeconds",
  remSec: "sleep_remSleepInSeconds",
  awakeSec: "sleep_awakeDurationInSeconds",
  overallScore: "sleep_overallSleepScore",
  // sleepFile_* tem os subscores granulares usados no detalhe (não no card resumo)
  qualityScore: "sleepFile_qualityScore",
  recoveryScore: "sleepFile_recoveryScore",
  restfulnessScore: "sleepFile_restfulnessScore",
  durationScore: "sleepFile_durationScore",
  deepScore: "sleepFile_deepScore",
  lightScore: "sleepFile_lightScore",
  remScore: "sleepFile_remScore",
  avgSleepStress: "sleepFile_avgSleepStress",
  feedback: "sleepFile_feedback",
  insight: "sleepFile_insight",
  spo2Avg: "sleepFile_spo2_averageSPO2",
  spo2Lowest: "sleepFile_spo2_lowestSPO2",
} as const;

export const HrvMetrics = {
  lastNightAvg: "hrv_lastNightAvg", // ms_rmssd — usar para o card diário
  lastNight5MinHigh: "hrv_lastNight5MinHigh",
  weeklyAverage: "trainingReadiness_hrvWeeklyAverage", // usar para tendência/status
  // healthStatus_HRV é uma série mais longa (desde 2025-09), útil para gráfico de 6+ meses
  statusSeries: "healthStatus_HRV",
} as const;

export const TrainingReadinessMetrics = {
  score: "trainingReadiness_score",
  level: "trainingReadiness_level",
  feedbackShort: "trainingReadiness_feedbackShort",
  acuteLoad: "trainingReadiness_acuteLoad",
  recoveryTime: "trainingReadiness_recoveryTime",
  hrvWeeklyAverage: "trainingReadiness_hrvWeeklyAverage",
} as const;

/**
 * Substituto real de "Training Status" estilo TrainingPeaks.
 * NÃO chamar isto de CTL/ATL/TSB na UI sem aviso — ver gap #2 no topo do ficheiro.
 */
export const TrainingLoadMetrics = {
  acuteLoad: "acuteTrainingLoad_dailyTrainingLoadAcute",
  chronicLoad: "acuteTrainingLoad_dailyTrainingLoadChronic",
  acwrRatio: "acuteTrainingLoad_dailyAcuteChronicWorkloadRatio",
  acwrPercent: "acuteTrainingLoad_acwrPercent",
  acwrStatus: "acuteTrainingLoad_acwrStatus",
  trainingStatus: "trainingHistory_trainingStatus",
  fitnessLevelTrend: "trainingHistory_fitnessLevelTrend",
} as const;

/** Ver nota de hierarquia no topo do ficheiro antes de tocar nisto. */
export const Vo2MaxMetrics = {
  canonical: "userMetrics_vo2Max",
  historicalLong: "maxMet_running_vo2MaxValue",
  crossCheck: "summarizedActivity_vO2MaxValue",
  biometric: "fitnessAge_biometricVo2Max",
} as const;

export const EnduranceAndHillMetrics = {
  enduranceScore: "enduranceScore_overallScore",
  enduranceClassification: "enduranceScore_classification",
  hillOverall: "hillScore_overallScore",
  hillEndurance: "hillScore_enduranceScore",
  hillStrength: "hillScore_strengthScore",
} as const;

export const RacePredictionMetrics = {
  time5k: "racePredictions_raceTime5K", // segundos
  time10k: "racePredictions_raceTime10K",
  timeHalf: "racePredictions_raceTimeHalf",
  timeMarathon: "racePredictions_raceTimeMarathon",
} as const;

export const BodyBatteryMetrics = {
  chargedValue: "dailyBodyBattery_chargedValue",
  drainedValue: "dailyBodyBattery_drainedValue",
  max: "stress_bodyBatteryMax",
  min: "stress_bodyBatteryMin",
} as const;

export const StressMetrics = {
  avgDaily: "daily_averageStressLevel",
  maxDaily: "daily_maxStressLevel",
  avgLastWindow: "stress_avgStressLevel",
  maxLastWindow: "stress_maxStressLevel",
  stressDurationSec: "daily_stressDurationInSeconds",
  highStressDurationSec: "daily_highStressDurationInSeconds",
  lowStressDurationSec: "daily_lowStressDurationInSeconds",
} as const;

export const RunActivityMetrics = {
  // Resumo por atividade (uma corrida = um registo) — usar para o detalhe de uma corrida
  distanceM: "activity_distanceInMeters",
  durationSec: "activity_durationInSeconds",
  avgPaceMinPerKm: "activity_averagePaceInMinutesPerKilometer",
  maxPaceMinPerKm: "activity_maxPaceInMinutesPerKilometer",
  avgSpeedMs: "activity_averageSpeedInMetersPerSecond",
  maxSpeedMs: "activity_maxSpeedInMetersPerSecond",
  avgCadence: "activity_averageRunCadenceInStepsPerMinute",
  maxCadence: "activity_maxRunCadenceInStepsPerMinute",
  avgHr: "activity_averageHeartRateInBeatsPerMinute",
  maxHr: "activity_maxHeartRateInBeatsPerMinute",
  elevationGainM: "activity_totalElevationGainInMeters",
  elevationLossM: "activity_totalElevationLossInMeters",
  activeKcal: "activity_activeKilocalories",
  activityType: "activity_activityType",
  activityName: "activity_activityName",
  // amostras intra-treino (raw-only) — usar com include_raw + source_id para gráfico de uma corrida específica
  samples: "activityDetail_samples",
  avgPowerW: "activityDetail_averagePowerInWatts",
  maxPowerW: "activityDetail_maxPowerInWatts",
  normalizedPowerW: "activityDetail_normalizedPowerInWatts",
} as const;

/**
 * Histórico longo (2016+) e agregados por treino — usar para "Recordes e Competições"
 * e para análises homólogas multi-ano, porque cobre um período muito maior que `activity_*`.
 */
export const SummarizedActivityMetrics = {
  distanceM: "summarizedActivity_distance",
  durationSec: "summarizedActivity_duration",
  avgHr: "summarizedActivity_avgHr",
  maxHr: "summarizedActivity_maxHr",
  avgSpeedMs: "summarizedActivity_avgSpeed",
  maxSpeedMs: "summarizedActivity_maxSpeed",
  avgCadence: "summarizedActivity_avgRunCadence",
  maxCadence: "summarizedActivity_maxRunCadence",
  elevationGainM: "summarizedActivity_elevationGain",
  elevationLossM: "summarizedActivity_elevationLoss",
  calories: "summarizedActivity_calories",
  trainingLoad: "summarizedActivity_activityTrainingLoad",
  aerobicTrainingEffect: "summarizedActivity_aerobicTrainingEffect",
  anaerobicTrainingEffect: "summarizedActivity_anaerobicTrainingEffect",
  trainingEffectLabel: "summarizedActivity_trainingEffectLabel",
  vo2MaxCrossCheck: "summarizedActivity_vO2MaxValue",
  sportType: "summarizedActivity_sportType",
  locationName: "summarizedActivity_locationName",
  hrZoneSeconds: [
    "summarizedActivity_hrTimeInZone_0",
    "summarizedActivity_hrTimeInZone_1",
    "summarizedActivity_hrTimeInZone_2",
    "summarizedActivity_hrTimeInZone_3",
    "summarizedActivity_hrTimeInZone_4",
    "summarizedActivity_hrTimeInZone_5",
    "summarizedActivity_hrTimeInZone_6",
  ],
} as const;

export const DailyAggregateMetrics = {
  steps: "daily_steps",
  distanceM: "daily_distanceInMeters",
  activeKcal: "daily_activeKilocalories",
  bmrKcal: "daily_bmrKilocalories",
  restingHr: "daily_restingHeartRateInBeatsPerMinute",
  avgHr: "daily_averageHeartRateInBeatsPerMinute",
  maxHr: "daily_maxHeartRateInBeatsPerMinute",
  minHr: "daily_minHeartRateInBeatsPerMinute",
  floorsClimbed: "daily_floorsClimbed",
} as const;

export const RespirationMetrics = {
  avgBreathsPerMin: "respiration_avgBreathsPerMinute",
  maxBreathsPerMin: "respiration_maxBreathsPerMinute",
  minBreathsPerMin: "respiration_minBreathsPerMinute",
} as const;

// -----------------------------------------------------------------------------
// 2. INTERFACES DE DOMÍNIO (forma final consumida pela UI)
// -----------------------------------------------------------------------------

export interface SleepSummary {
  date: string; // YYYY-MM-DD
  durationSec: number;
  deepSec: number;
  lightSec: number;
  remSec: number;
  awakeSec: number;
  overallScore: number | null;
  qualityScore: number | null;
  recoveryScore: number | null;
  feedback: string | null;
  insight: string | null;
}

export interface HrvSummary {
  date: string;
  lastNightAvgMsRmssd: number;
  lastNight5MinHighMsRmssd: number | null;
  weeklyAverageMsRmssd: number | null;
}

export interface TrainingReadinessSummary {
  date: string;
  score: number;
  level: string;
  feedbackShort: string;
  acuteLoad: number | null;
  recoveryTimeHours: number | null;
}

/**
 * Card "Estado de Forma". O nome `tsbProxy` é deliberado — não chamar de
 * `tsb` para não sugerir equivalência com a fórmula TrainingPeaks.
 */
export interface TrainingLoadSummary {
  date: string;
  acuteLoad: number;
  chronicLoad: number;
  acwrRatio: number;
  acwrStatus: string; // ex: "OPTIMAL" | "HIGH" | "LOW" — confirmar valores reais no provider
  trainingStatus: string;
  fitnessLevelTrend: string;
}

export interface Vo2MaxSummary {
  date: string;
  canonicalValue: number; // userMetrics_vo2Max
  historicalSeriesValue: number | null; // maxMet_running_vo2MaxValue
  crossCheckValue: number | null; // summarizedActivity_vO2MaxValue
  biometricValue: number | null; // fitnessAge_biometricVo2Max
  /** true se as fontes divergirem além de uma tolerância definida pelo produto (ex: 2 ml/kg/min) */
  hasDiscrepancy: boolean;
}

export interface RacePredictionSummary {
  date: string;
  time5kSec: number;
  time10kSec: number;
  timeHalfSec: number;
  timeMarathonSec: number;
}

export interface RecoverySummary {
  date: string;
  recoveryTimeHours: number | null;
  bodyBatteryCharged: number;
  bodyBatteryDrained: number;
  bodyBatteryMax: number;
  bodyBatteryMin: number;
  avgStress: number;
  maxStress: number;
}

export interface RunActivitySummary {
  activityId: string; // vem de activityDetail_summaryId / source id
  date: string;
  distanceM: number;
  durationSec: number;
  avgPaceMinPerKm: number;
  avgCadence: number;
  avgHr: number;
  maxHr: number;
  elevationGainM: number;
  /** Limitado a este conjunto até confirmação do gap #1 (ver topo do ficheiro) */
  runDynamics: {
    avgCadence: number;
    avgSpeedMs: number;
    avgPowerW: number | null;
    normalizedPowerW: number | null;
    // verticalOscillationMm, groundContactTimeMs, groundContactBalancePercent:
    // NÃO incluir até confirmar via include_raw em activityDetail_samples
  };
}

export interface YearOverYearKpi {
  label: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  percentChange: number;
}

// -----------------------------------------------------------------------------
// 3. CAMADA DE SERVIÇO — chamadas reais ao Freddy MCP
// -----------------------------------------------------------------------------

/**
 * Tipo mínimo do client MCP do Freddy (ajustar import real do
 * @modelcontextprotocol/sdk no momento da implementação).
 */
interface FreddyMcpClient {
  queryMetrics(args: {
    metrics: string[];
    days?: number;
    start?: string;
    end?: string;
    device?: string;
    includeRaw?: boolean;
  }): Promise<Record<string, unknown>>;
}

export class FreddyDataService {
  constructor(private readonly client: FreddyMcpClient) {}

  async getSleepSummary(days = 7): Promise<SleepSummary[]> {
    const raw = await this.client.queryMetrics({
      metrics: [
        SleepMetrics.durationSec,
        SleepMetrics.deepSec,
        SleepMetrics.lightSec,
        SleepMetrics.remSec,
        SleepMetrics.awakeSec,
        SleepMetrics.overallScore,
        SleepMetrics.qualityScore,
        SleepMetrics.recoveryScore,
        SleepMetrics.feedback,
        SleepMetrics.insight,
      ],
      days,
    });
    return mapToSleepSummary(raw); // implementar conforme shape real da resposta
  }

  async getTrainingReadiness(days = 7): Promise<TrainingReadinessSummary[]> {
    const raw = await this.client.queryMetrics({
      metrics: Object.values(TrainingReadinessMetrics),
      days,
    });
    return mapToTrainingReadiness(raw);
  }

  /** Card "Estado de Forma" — ver aviso de nomenclatura no topo do ficheiro. */
  async getTrainingLoadSummary(days = 56): Promise<TrainingLoadSummary[]> {
    const raw = await this.client.queryMetrics({
      metrics: Object.values(TrainingLoadMetrics),
      days, // 56 dias = 8 semanas, conforme gráfico pedido na espec original
    });
    return mapToTrainingLoad(raw);
  }

  async getVo2MaxSummary(days = 365): Promise<Vo2MaxSummary[]> {
    const raw = await this.client.queryMetrics({
      metrics: Object.values(Vo2MaxMetrics),
      days,
    });
    return mapToVo2Max(raw); // aplicar regra hasDiscrepancy aqui
  }

  async getRacePredictions(): Promise<RacePredictionSummary> {
    const raw = await this.client.queryMetrics({
      metrics: Object.values(RacePredictionMetrics),
      days: 1,
    });
    return mapToRacePrediction(raw);
  }

  async getRecoverySummary(days = 7): Promise<RecoverySummary[]> {
    const raw = await this.client.queryMetrics({
      metrics: [
        TrainingReadinessMetrics.recoveryTime,
        BodyBatteryMetrics.chargedValue,
        BodyBatteryMetrics.drainedValue,
        BodyBatteryMetrics.max,
        BodyBatteryMetrics.min,
        StressMetrics.avgDaily,
        StressMetrics.maxDaily,
      ],
      days,
    });
    return mapToRecovery(raw);
  }

  /**
   * Detalhe de uma corrida específica. `includeRaw` só deve ser pedido aqui
   * (página de detalhe), nunca na listagem, por custo de payload (5-30KB/registo).
   */
  async getRunActivityDetail(activityDate: string): Promise<RunActivitySummary> {
    const raw = await this.client.queryMetrics({
      metrics: [
        RunActivityMetrics.distanceM,
        RunActivityMetrics.durationSec,
        RunActivityMetrics.avgPaceMinPerKm,
        RunActivityMetrics.avgCadence,
        RunActivityMetrics.avgHr,
        RunActivityMetrics.maxHr,
        RunActivityMetrics.elevationGainM,
        RunActivityMetrics.avgSpeedMs,
        RunActivityMetrics.avgPowerW,
        RunActivityMetrics.normalizedPowerW,
        RunActivityMetrics.samples,
      ],
      start: activityDate,
      end: activityDate,
      includeRaw: true,
    });
    return mapToRunActivityDetail(raw); // AQUI verificar se vertical oscillation aparece no raw
  }

  /** Comparação homóloga — usa summarizedActivity_* pela cobertura histórica (2016+). */
  async getYearOverYearKpis(yearStart: string, yearEnd: string, prevYearStart: string, prevYearEnd: string): Promise<YearOverYearKpi[]> {
    const [current, previous] = await Promise.all([
      this.client.queryMetrics({
        metrics: [
          SummarizedActivityMetrics.distanceM,
          SummarizedActivityMetrics.durationSec,
          SummarizedActivityMetrics.elevationGainM,
          SummarizedActivityMetrics.avgHr,
        ] as string[],
        start: yearStart,
        end: yearEnd,
      }),
      this.client.queryMetrics({
        metrics: [
          SummarizedActivityMetrics.distanceM,
          SummarizedActivityMetrics.durationSec,
          SummarizedActivityMetrics.elevationGainM,
          SummarizedActivityMetrics.avgHr,
        ] as string[],
        start: prevYearStart,
        end: prevYearEnd,
      }),
    ]);
    return computeYearOverYearKpis(current, previous);
  }
}

/**
 * [Certo] Shape REAL confirmado do raw payload de activityDetail_samples
 * (verificado em 2026-06-25 contra duas corridas reais: ids 23367317760-detail
 * e 23354613062-detail). Esta é a única interface deste ficheiro que não é
 * suposição — é cópia estrutural do JSON devolvido.
 */
export interface ActivityDetailSamplesRaw {
  startTime: string; // ISO 8601
  recordingRate: number | null;
  sampleCount: number;
  streams: {
    heart_rate?: { unit: "bpm"; values: (number | null)[] };
    speed?: { unit: "m/s"; values: (number | null)[] };
    cadence?: { unit: "spm"; values: (number | null)[] };
    altitude?: { unit: "m"; values: (number | null)[] };
    power?: { unit: "watts"; values: (number | null)[] };
    latitude?: { unit: "degrees"; values: (number | null)[] };
    longitude?: { unit: "degrees"; values: (number | null)[] };
    // NÃO existem (confirmado): vertical_oscillation, ground_contact_time,
    // ground_contact_balance, stride_length. Não adicionar campos especulativos aqui.
  };
  timestamps: number[]; // segundos desde o início, um por amostra
  decimated: boolean;
  originalCount: number; // ex: 4021 amostras originais, decimadas para sampleCount (183)
}

// -----------------------------------------------------------------------------
// 4. MAPPERS
//    mapToRunActivityDetail está implementado de verdade (shape confirmado).
//    Os restantes ficam como esqueleto até confirmação do gap #4 acima.
// -----------------------------------------------------------------------------


function mapToSleepSummary(_raw: Record<string, unknown>): SleepSummary[] {
  throw new Error("TODO: implementar mapeamento — confirmar shape real da resposta query_metrics");
}
function mapToTrainingReadiness(_raw: Record<string, unknown>): TrainingReadinessSummary[] {
  throw new Error("TODO: implementar mapeamento");
}
function mapToTrainingLoad(_raw: Record<string, unknown>): TrainingLoadSummary[] {
  throw new Error("TODO: implementar mapeamento");
}
function mapToVo2Max(_raw: Record<string, unknown>): Vo2MaxSummary[] {
  throw new Error("TODO: implementar mapeamento — aplicar regra de discrepância entre as 4 fontes");
}
function mapToRacePrediction(_raw: Record<string, unknown>): RacePredictionSummary {
  throw new Error("TODO: implementar mapeamento");
}
function mapToRecovery(_raw: Record<string, unknown>): RecoverySummary[] {
  throw new Error("TODO: implementar mapeamento");
}
function mapToRunActivityDetail(raw: Record<string, unknown>): RunActivitySummary {
  // NOTA: esta implementação assume que o cliente MCP devolve o campo `raw`
  // de activityDetail_samples já como objeto parseado (ActivityDetailSamplesRaw).
  // Se a resposta de produção vier como string JSON, fazer JSON.parse antes.
  const samples = raw["activityDetail_samples_raw"] as ActivityDetailSamplesRaw | undefined;
  const scalars = raw as Record<string, number | string>;

  const avgOf = (values: (number | null)[] | undefined): number | null => {
    if (!values || values.length === 0) return null;
    const valid = values.filter((v): v is number => v !== null);
    if (valid.length === 0) return null;
    return valid.reduce((sum, v) => sum + v, 0) / valid.length;
  };

  return {
    activityId: String(scalars["activityDetail_summaryId"] ?? ""),
    date: String(scalars["date"] ?? ""),
    distanceM: Number(scalars[RunActivityMetrics.distanceM] ?? 0),
    durationSec: Number(scalars[RunActivityMetrics.durationSec] ?? 0),
    avgPaceMinPerKm: Number(scalars[RunActivityMetrics.avgPaceMinPerKm] ?? 0),
    avgCadence: Number(scalars[RunActivityMetrics.avgCadence] ?? 0),
    avgHr: Number(scalars[RunActivityMetrics.avgHr] ?? 0),
    maxHr: Number(scalars[RunActivityMetrics.maxHr] ?? 0),
    elevationGainM: Number(scalars[RunActivityMetrics.elevationGainM] ?? 0),
    runDynamics: {
      avgCadence: avgOf(samples?.streams.cadence?.values) ?? 0,
      avgSpeedMs: avgOf(samples?.streams.speed?.values) ?? 0,
      avgPowerW: avgOf(samples?.streams.power?.values),
      normalizedPowerW: Number(scalars[RunActivityMetrics.normalizedPowerW] ?? NaN) || null,
      // confirmado ausente: verticalOscillationMm, groundContactTimeMs, groundContactBalancePercent
    },
  };
}
function computeYearOverYearKpis(
  _current: Record<string, unknown>,
  _previous: Record<string, unknown>
): YearOverYearKpi[] {
  throw new Error("TODO: implementar agregação e cálculo de percentChange");
}
