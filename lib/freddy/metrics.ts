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
 *   4. [Ainda relevante, reduzido] O texto que recebo ao chamar query_metrics
 *      nesta conversa é a renderização humana do wrapper do chat, não
 *      necessariamente o envelope JSON-RPC literal que o SDK
 *      `@modelcontextprotocol/sdk` recebe em `client.callTool()` em produção.
 *      Os campos `raw` confirmados abaixo resolvem isto para o CONTEÚDO dos
 *      dados — mas o formato do content block que o envolve (string JSON a
 *      fazer parse vs já objeto) continua por confirmar contra uma chamada
 *      real feita em código, não nesta conversa.
 *
 *   5. [Certo — CONFIRMADO em runtime, 2026-06-25, via include_raw em dados
 *      reais] Três correções importantes às suposições anteriores:
 *
 *      a) `trainingReadiness_score` raw devolve `level` e `feedbackShort`
 *         como CÓDIGOS em inglês maiúsculo (ex: "POOR", "LOW",
 *         "TIME_TO_SLOW_DOWN", "HIGH_RECOVERY_NEEDS"), não frases prontas
 *         nem em português. A UI tem de traduzir via dicionário — ver
 *         READINESS_LEVEL_LABELS / READINESS_FEEDBACK_LABELS abaixo.
 *
 *      b) `trainingReadiness_score.recoveryTime` vem em SEGUNDOS
 *         (ex: 5280 = 88 min), não em horas. RecoveryCard estava a assumir
 *         horas diretamente — corrigir na conversão.
 *
 *      c) `acuteTrainingLoad_*` raw confirma exatamente os campos já usados:
 *         `acwrStatus` ("OPTIMAL"/"LOW"/presumivelmente "HIGH"),
 *         `dailyTrainingLoadAcute`, `dailyTrainingLoadChronic`,
 *         `dailyAcuteChronicWorkloadRatio`. `calendarDate` vem em
 *         epoch milissegundos, não string ISO — converter com `new Date()`.
 *
 *      d) `userMetrics_vo2Max` raw é simples: `{ vo2Max, fitnessAge,
 *         calendarDate, enhanced }`. Sem surpresas aqui.
 *
 *      e) `sleep_durationInSeconds` raw devolve o registo de sono completo,
 *         não só a duração: `overallSleepScore` é um OBJETO
 *         `{ value, qualifierKey }`, não um número direto. `sleepScores`
 *         contém qualifiers (POOR/FAIR/GOOD/EXCELLENT) por dimensão
 *         (stress, awakeCount, restlessness, remPercentage, totalDuration,
 *         deepPercentage, lightPercentage). `sleepLevelsMap` tem os
 *         intervalos rem/deep/light/awake em epoch seconds — útil para um
 *         gráfico de hipnograma futuro, não necessário para o card resumo.
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

/**
 * [Certo] Confirmado por teste real (2026-06-26): wellness_* (Intervals.icu)
 * está atualizado até HOJE, ao contrário de trainingReadiness_score do
 * Garmin direto (5 dias de atraso na altura do teste). Qualquer um destes
 * campos, pedido com include_raw, devolve o registo diário COMPLETO — não
 * é preciso pedir vários, um chega.
 */
export const WellnessMetrics = {
  restingHr: "wellness_restingHR",
  hrv: "wellness_hrv",
  ctl: "wellness_ctl",
  atl: "wellness_atl",
  rampRate: "wellness_rampRate",
  sleepScore: "wellness_sleepScore",
  sleepSecs: "wellness_sleepSecs",
  sleepQuality: "wellness_sleepQuality",
  steps: "wellness_steps",
  vo2max: "wellness_vo2max",
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
  /**
   * [Certo] Necessário porque summarizedActivity_distance/elevationGain/avgHr
   * NÃO têm suporte a `raw` (confirmado em list_metrics — sem a anotação
   * "[raw available]"). Para estas, a única forma de agregar é somar os
   * valores escalares do texto devolvido — não há JSON estruturado nenhum
   * a extrair. Opcional porque a maioria dos mappers não precisa disto.
   */
  queryRawText?(args: { metrics: string[]; days?: number; start?: string; end?: string }): Promise<string>;
}

export class FreddyDataService {
  constructor(private readonly client: FreddyMcpClient) {}

  /**
   * [Certo] Pede só sleep_durationInSeconds, não as 10 métricas listadas
   * antes — o raw dessa única métrica já contém o registo de sono
   * completo (scores, sleepScores, durações por fase). Pedir múltiplas
   * métricas ao mesmo tempo arrisca o parser de texto ficar com o último
   * bloco `raw` que aparecer, que pode ter forma diferente por métrica.
   */
  async getSleepSummary(days = 7): Promise<SleepSummary[]> {
    const raw = await this.client.queryMetrics({
      metrics: [SleepMetrics.durationSec],
      days,
      includeRaw: true,
    });
    return mapToSleepSummary(raw);
  }

  async getTrainingReadiness(days = 7): Promise<TrainingReadinessSummary[]> {
    const raw = await this.client.queryMetrics({
      metrics: Object.values(TrainingReadinessMetrics),
      days,
      includeRaw: true,
    });
    return mapToTrainingReadiness(raw);
  }

  /**
   * [Certo] Pede só métricas `acuteTrainingLoad_*` — todas partilham o
   * mesmo raw (confirmado em teste real). `trainingHistory_trainingStatus`
   * e `trainingHistory_fitnessLevelTrend` têm raw de FORMA DIFERENTE
   * (campos `trainingStatus`/`sport`/`fitnessLevelTrend`, sem `acwrStatus`).
   * Misturá-las na mesma chamada foi a causa provável do badge ACWR vazio
   * que apareceu no dashboard — o parser ficava com o último bloco `raw`
   * da data, que podia ser o de trainingHistory. Buscar trainingHistory
   * fica para uma chamada separada (getTrainingStatusLabel), ainda não
   * implementada/ligada — o campo `trainingStatus` no resultado fica vazio
   * até essa chamada existir, em vez de arriscar dados errados.
   */
  async getTrainingLoadSummary(days = 56): Promise<TrainingLoadSummary[]> {
    const raw = await this.client.queryMetrics({
      metrics: [
        TrainingLoadMetrics.acuteLoad,
        TrainingLoadMetrics.chronicLoad,
        TrainingLoadMetrics.acwrRatio,
        TrainingLoadMetrics.acwrPercent,
        TrainingLoadMetrics.acwrStatus,
      ],
      days, // 56 dias = 8 semanas, conforme gráfico pedido na espec original
      includeRaw: true,
    });
    return mapToTrainingLoad(raw);
  }

  async getVo2MaxSummary(days = 365): Promise<Vo2MaxSummary[]> {
    const raw = await this.client.queryMetrics({
      metrics: Object.values(Vo2MaxMetrics),
      days,
      includeRaw: true,
    });
    return mapToVo2Max(raw); // aplicar regra hasDiscrepancy aqui
  }

  /**
   * [Certo] Confirmado: racePredictions_* tem o mesmo atraso de
   * sincronização do Training Readiness (último registo visto a vários
   * dias do "hoje" real). Pedir só `days: 1` ("hoje") devolvia
   * sistematicamente "No data found" — corrigido para uma janela maior,
   * escolhendo o registo mais recente disponível dentro dela.
   */
  async getRacePredictions(): Promise<RacePredictionSummary> {
    const raw = await this.client.queryMetrics({
      metrics: Object.values(RacePredictionMetrics),
      days: 10,
      includeRaw: true,
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
      includeRaw: true,
    });
    return mapToRecovery(raw);
  }

  /**
   * [Certo] Implementação nova e isolada (não reaproveita
   * getRunActivityDetail/mapToRunActivityDetail acima, que ficaram
   * desalinhados com o shape real devolvido por data-adapter.ts —
   * acediam a `raw["activityDetail_samples_raw"]` quando na realidade
   * `raw[date]` já É o objeto de samples. Marcado como conhecido, não
   * corrigido aqui para não alargar o escopo desta funcionalidade nova).
   *
   * Faz 2 chamadas separadas de propósito:
   *   1. métricas escalares (sem raw) — simples, sem ambiguidade.
   *   2. SÓ activityDetail_samples com includeRaw — isola o único raw
   *      real desta atividade, sem misturar com outros blocos.
   * [Provável] Se houver mais de uma atividade no mesmo dia, esta função
   * só devolve a primeira (limitação conhecida, não tratada aqui).
   */
  async getActivityDetailFull(date: string): Promise<{
    date: string;
    distanceKm: number;
    durationSec: number;
    paceMinPerKm: number;
    avgHr: number | null;
    maxHr: number | null;
    elevationGainM: number | null;
    caloriesKcal: number | null;
    route: [number, number][]; // [lat, lng]
    series: { distanceKm: number; hr: number | null; altitude: number | null; paceMinPerKm: number | null; cadence: number | null }[];
    samplesUnavailable: boolean;
  }> {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText.");
    }
    // [Certo] Confirmado real: activity_* (RunActivityMetrics) só cobre os
    // últimos ~35 dias. Para datas mais antigas (ex: recordes pessoais de
    // há mais de 1 mês) isto devolvia sempre 0/null em tudo, mesmo nos
    // stats básicos. Corrigido: tenta activity_* primeiro, cai para
    // summarizedActivity_* (cobertura 2016+) se vazio — elevação /100,
    // mesma correção de unidade já confirmada noutros sítios da app.
    const recentText = await this.client.queryRawText({
      metrics: [
        RunActivityMetrics.distanceM,
        RunActivityMetrics.durationSec,
        RunActivityMetrics.avgHr,
        RunActivityMetrics.maxHr,
        RunActivityMetrics.elevationGainM,
        RunActivityMetrics.activeKcal,
      ],
      start: date,
      end: date,
    });
    let distanceM = extractValuesByDate(recentText, RunActivityMetrics.distanceM).get(date)?.[0] ?? 0;
    let durationSec = extractValuesByDate(recentText, RunActivityMetrics.durationSec).get(date)?.[0] ?? 0;
    let avgHr = extractValuesByDate(recentText, RunActivityMetrics.avgHr).get(date)?.[0] ?? null;
    let maxHr = extractValuesByDate(recentText, RunActivityMetrics.maxHr).get(date)?.[0] ?? null;
    let elevationGainM = extractValuesByDate(recentText, RunActivityMetrics.elevationGainM).get(date)?.[0] ?? null;
    let caloriesKcal = extractValuesByDate(recentText, RunActivityMetrics.activeKcal).get(date)?.[0] ?? null;

    if (distanceM === 0) {
      const summText = await this.client.queryRawText({
        metrics: [
          SummarizedActivityMetrics.distanceM,
          SummarizedActivityMetrics.durationSec,
          SummarizedActivityMetrics.avgHr,
          SummarizedActivityMetrics.elevationGainM,
          SummarizedActivityMetrics.calories,
        ],
        start: date,
        end: date,
      });
      distanceM = extractValuesByDate(summText, SummarizedActivityMetrics.distanceM).get(date)?.[0] ?? 0;
      durationSec = extractValuesByDate(summText, SummarizedActivityMetrics.durationSec).get(date)?.[0] ?? 0;
      avgHr = extractValuesByDate(summText, SummarizedActivityMetrics.avgHr).get(date)?.[0] ?? null;
      const elevRaw = extractValuesByDate(summText, SummarizedActivityMetrics.elevationGainM).get(date)?.[0] ?? null;
      elevationGainM = elevRaw !== null ? elevRaw / 100 : null; // bug de unidade confirmado, igual ao resto da app
      const calRaw = extractValuesByDate(summText, SummarizedActivityMetrics.calories).get(date)?.[0] ?? null;
      caloriesKcal = calRaw !== null ? Math.round(calRaw / 4.184) : null; // kJ -> kcal, bug confirmado, igual ao resto da app
      // maxHr não existe no summarizedActivity para esta atividade — fica null, honesto em vez de inventado
    }

    const route: [number, number][] = [];
    const series: { distanceKm: number; hr: number | null; altitude: number | null; paceMinPerKm: number | null; cadence: number | null }[] = [];
    let samplesUnavailable = false;

    // [Certo] As amostras GPS/FC ao segundo (activityDetail_samples) só
    // existem para os últimos ~35 dias (confirmado: range real visto era
    // 2026-05-23 a 2026-06-27). Para corridas mais antigas isto falha
    // sempre — nunca deve rebentar a função toda, só esta secção.
    try {
      const samplesResult = await this.client.queryMetrics({
        metrics: [RunActivityMetrics.samples],
        start: date,
        end: date,
        includeRaw: true,
      });
      const samples = samplesResult[date] as ActivityDetailSamplesRaw | undefined;

      if (samples) {
        const lat = samples.streams.latitude?.values ?? [];
        const lng = samples.streams.longitude?.values ?? [];
        for (let i = 0; i < Math.min(lat.length, lng.length); i++) {
          if (lat[i] !== null && lng[i] !== null) route.push([lat[i] as number, lng[i] as number]);
        }

        const speed = samples.streams.speed?.values ?? [];
        const hr = samples.streams.heart_rate?.values ?? [];
        const altitude = samples.streams.altitude?.values ?? [];
        const cadence = samples.streams.cadence?.values ?? [];
        const ts = samples.timestamps ?? [];

        let cumDistanceM = 0;
        for (let i = 0; i < ts.length; i++) {
          const dt = i === 0 ? 0 : ts[i] - ts[i - 1];
          const v = speed[i] ?? 0;
          cumDistanceM += (v ?? 0) * dt;
          const paceMinPerKm = v && v > 0.3 ? roundTo(1000 / v / 60, 2) : null; // [Suposição] abaixo de 0.3 m/s considera-se parado, sem pace válido
          series.push({
            distanceKm: roundTo(cumDistanceM / 1000, 3),
            hr: hr[i] ?? null,
            altitude: altitude[i] ?? null,
            paceMinPerKm,
            cadence: cadence[i] ?? null,
          });
        }
      } else {
        samplesUnavailable = true;
      }
    } catch {
      samplesUnavailable = true;
    }

    return {
      date,
      distanceKm: roundTo(distanceM / 1000, 2),
      durationSec,
      paceMinPerKm: distanceM > 0 ? roundTo(durationSec / 60 / (distanceM / 1000), 2) : 0,
      avgHr,
      maxHr,
      elevationGainM,
      caloriesKcal,
      route,
      series,
      samplesUnavailable,
    };
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

  /**
   * Comparação homóloga. [Certo, confirmado por teste cruzado real]:
   *   1. `summarizedActivity_elevationGain` está errado por um fator de
   *      EXATAMENTE 100x — confirmado comparando as mesmas 4 corridas de
   *      2026-06-21 nas duas tabelas (activity_totalElevationGainInMeters:
   *      114.37/9.59/5.13/2.37m vs summarizedActivity_elevationGain:
   *      11437/958.99/512.99/237 — razão exata 100.0 nos 4 casos).
   *   2. `summarizedActivity_*` tem uma janela sem dados (~1 mês mais
   *      recente, ex: 2026-05-21 a 2026-06-21) que `activity_*` cobre. As
   *      duas tabelas sobrepõem-se na fronteira (mesmo dia, mesmos valores
   *      de distância/duração) — por isso, para o período coberto por
   *      `activity_*`, usa-se essa fonte (elevação já correta) e
   *      descarta-se `summarizedActivity_*` para essas mesmas datas, para
   *      não contar a dobrar.
   * `activity_*` só guarda os últimos ~30-35 dias (confirmado: pedir
   * `days` maior simplesmente não devolve mais — não é um parâmetro a
   * ajustar, é o histórico real disponível nessa tabela).
   */
  /**
   * Resumo semanal para o card "Running Summary" — usa activity_* (fonte
   * "ao vivo", já validada no YoY). [Provável] últimos `days` dias
   * corridos a partir de hoje; se `activity_*` não cobrir esse período
   * (só guarda ~30-35 dias), os dias mais antigos do range vêm vazios em
   * vez de errados — não há fallback para summarizedActivity_* aqui
   * porque um resumo semanal não precisa da cobertura histórica.
   */
  /**
   * [Certo] daily_restingHeartRateInBeatsPerMinute/averageHeartRateInBeatsPerMinute/
   * maxHeartRateInBeatsPerMinute NÃO têm raw (confirmado em list_metrics) —
   * mesma técnica de extração escalar por data usada no running summary.
   */
  /** [Certo] daily_steps e uds_dailyStepGoal partilham o mesmo registo diário (confirmado). */
  /**
   * [Certo] Substitui o modelo errado anterior (dailyBodyBattery_charged/
   * drainedValue, que media outra coisa). Confirmado por teste cruzado real:
   * `stress_bodyBatteryMax` para 2026-06-25 deu 76 — bate exatamente com o
   * valor "Body Battery" mostrado no Garmin Connect real para esse dia.
   * `dailyBodyBattery_chargedValue` dava 47-48, um conceito diferente
   * (quanto carregou no dia, não o nível atual/pico).
   */
  /**
   * [Certo] Shape real confirmado (2026-06-26): um único campo wellness_*
   * com include_raw devolve TODO o registo diário (ctl, atl, rampRate,
   * restingHR, hrv, sleepSecs, sleepScore, sleepQuality, steps, vo2max,
   * e campos de autorregisto como readiness/fatigue/mood, null se o
   * utilizador não os preencher manualmente no Intervals.icu).
   */
  /**
   * [Certo] Composto PRÓPRIO, transparente, de sinais frescos — não
   * pretende substituir o algoritmo do Garmin (essa foi a lição da
   * tentativa anterior com TSB sozinho: misturava conceitos diferentes
   * e deu um resultado otimista a mais). Cada sinal é avaliado
   * individualmente e fica visível; o score final é só a média das
   * pontuações 0-100 de cada sinal disponível, sem peso "secreto".
   * [Suposição] Os limiares de cada sub-avaliação (TSB, HRV±10%, FC±5%)
   * são escolhas minhas razoáveis, não uma fórmula oficial publicada.
   */
  async getComposedReadiness(): Promise<{
    compositeScore: number | null;
    recommendation: string;
    signals: { label: string; status: "bom" | "ok" | "atencao"; detail: string; subScore: number | null }[];
  }> {
    const wellness = await this.getWellnessWeekly(8);
    return this.getComposedReadinessFromWellness(wellness);
  }

  /**
   * [Certo] Extraído de getComposedReadiness para permitir reaproveitar
   * um `wellness` já obtido — confirmado como causa real de rate limit
   * no Consultor de Treino: a função antiga pedia getWellnessWeekly
   * outra vez internamente, mesmo quando o chamador já o tinha acabado
   * de pedir, duplicando 1 dos ~7 pedidos disparados de uma vez.
   */
  async getComposedReadinessFromWellness(wellness: WellnessDay[]): Promise<{
    compositeScore: number | null;
    recommendation: string;
    signals: { label: string; status: "bom" | "ok" | "atencao"; detail: string; subScore: number | null }[];
  }> {
    const battery = await this.getBodyBatteryWeekly(3).catch(() => []);
    const latest = wellness[wellness.length - 1];
    const latestBattery = battery[battery.length - 1];
    const hrvValues = wellness.map((w) => w.hrv).filter((v): v is number => v !== null);
    const hrvAvg = hrvValues.length ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : null;
    const rhrValues = wellness.map((w) => w.restingHr).filter((v): v is number => v !== null);
    const rhrAvg = rhrValues.length ? rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length : null;

    const signals: { label: string; status: "bom" | "ok" | "atencao"; detail: string; subScore: number | null }[] = [];

    // TSB
    if (latest?.tsb !== null && latest?.tsb !== undefined) {
      const tsb = latest.tsb;
      const status = tsb > 5 ? "bom" : tsb >= -10 ? "ok" : "atencao";
      const subScore = tsb > 5 ? 100 : tsb >= -10 ? 70 : tsb >= -20 ? 40 : 10;
      signals.push({ label: "Carga de Treino (TSB)", status, detail: `${tsb > 0 ? "+" : ""}${tsb}`, subScore });
    }

    // HRV vs média 7d
    if (latest?.hrv !== null && latest?.hrv !== undefined && hrvAvg !== null) {
      const diffPct = ((latest.hrv - hrvAvg) / hrvAvg) * 100;
      const status = diffPct >= -5 ? "bom" : diffPct >= -10 ? "ok" : "atencao";
      const subScore = Math.max(0, Math.min(100, Math.round(70 + diffPct * 3)));
      signals.push({ label: "HRV", status, detail: `${latest.hrv}ms (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(0)}% vs média)`, subScore });
    }

    // FC repouso vs média 7d (inverso: mais alto que a média é mau sinal)
    if (latest?.restingHr !== null && latest?.restingHr !== undefined && rhrAvg !== null) {
      const diffPct = ((latest.restingHr - rhrAvg) / rhrAvg) * 100;
      const status = diffPct <= 3 ? "bom" : diffPct <= 7 ? "ok" : "atencao";
      const subScore = Math.max(0, Math.min(100, Math.round(70 - diffPct * 5)));
      signals.push({ label: "FC Repouso", status, detail: `${latest.restingHr}bpm (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(0)}% vs média)`, subScore });
    }

    // Sono (score já 0-100)
    if (latest?.sleepScore !== null && latest?.sleepScore !== undefined) {
      const s = latest.sleepScore;
      const status = s >= 75 ? "bom" : s >= 55 ? "ok" : "atencao";
      signals.push({ label: "Sono", status, detail: `${s}/100`, subScore: s });
    }

    // Stress/Bateria (Garmin, ~1 dia de atraso, não 6)
    if (latestBattery?.avgStress !== null && latestBattery?.avgStress !== undefined) {
      const stress = latestBattery.avgStress;
      const status = stress < 30 ? "bom" : stress < 45 ? "ok" : "atencao";
      const subScore = Math.max(0, Math.min(100, Math.round(100 - stress * 1.5)));
      signals.push({ label: "Stress Médio", status, detail: `${Math.round(stress)}`, subScore });
    }

    const validScores = signals.map((s) => s.subScore).filter((v): v is number => v !== null);
    const compositeScore = validScores.length ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : null;

    let recommendation: string;
    if (compositeScore === null) {
      recommendation = "Sem sinais suficientes para uma recomendação — verificar ligação ao Intervals.icu/Garmin.";
    } else if (compositeScore >= 75) {
      recommendation = "Sinais maioritariamente positivos — janela razoável para treino de qualidade (séries, tempo run).";
    } else if (compositeScore >= 55) {
      recommendation = "Sinais mistos — corrida moderada ou rolante é a opção mais segura hoje, evitar séries duras.";
    } else {
      recommendation = "Vários sinais de fadiga/recuperação incompleta — corrida fácil ou descanso recomendado.";
    }

    return { compositeScore, recommendation, signals };
  }

  async getWellnessWeekly(days = 7): Promise<WellnessDay[]> {
    const raw = await this.client.queryMetrics({
      metrics: [WellnessMetrics.restingHr],
      days,
      includeRaw: true,
    });
    const entries = Object.entries(raw) as [string, WellnessRaw][];
    return entries
      .map(([date, r]) => ({
        date,
        ctl: r.ctl ?? null,
        atl: r.atl ?? null,
        tsb:
          r.ctl !== undefined && r.atl !== undefined && r.ctl !== null && r.atl !== null
            ? roundTo(r.ctl - r.atl, 1)
            : null,
        rampRate: r.rampRate ?? null,
        restingHr: r.restingHR ?? null,
        hrv: r.hrv ?? null,
        sleepScore: r.sleepScore ?? null,
        sleepSecs: r.sleepSecs ?? null,
        steps: r.steps ?? null,
        vo2max: r.vo2max ?? null,
        readiness: r.readiness ?? null,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  async getBodyBatteryWeekly(days = 7): Promise<
    { date: string; max: number | null; min: number | null; avgStress: number | null; maxStress: number | null }[]
  > {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText — necessário para body battery semanal.");
    }
    const text = await this.client.queryRawText({
      metrics: [BodyBatteryMetrics.max, BodyBatteryMetrics.min, StressMetrics.avgLastWindow, StressMetrics.maxLastWindow],
      days,
    });
    const maxByDate = extractValuesByDate(text, BodyBatteryMetrics.max);
    const minByDate = extractValuesByDate(text, BodyBatteryMetrics.min);
    const avgStressByDate = extractValuesByDate(text, StressMetrics.avgLastWindow);
    const maxStressByDate = extractValuesByDate(text, StressMetrics.maxLastWindow);

    const dates = [...new Set([...maxByDate.keys(), ...avgStressByDate.keys()])].sort();
    return dates.map((date) => ({
      date,
      max: maxByDate.get(date)?.[0] ?? null,
      min: minByDate.get(date)?.[0] ?? null,
      avgStress: avgStressByDate.get(date)?.[0] ?? null,
      maxStress: maxStressByDate.get(date)?.[0] ?? null,
    }));
  }

  async getStepsWeekly(days = 7): Promise<{
    todaySteps: number | null;
    todayGoal: number | null;
    avgSteps7d: number | null;
    daily: { date: string; steps: number; goal: number | null }[];
  }> {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText — necessário para passos semanais.");
    }
    const text = await this.client.queryRawText({
      metrics: [DailyAggregateMetrics.steps, "uds_dailyStepGoal"],
      days,
    });
    const stepsByDate = extractValuesByDate(text, DailyAggregateMetrics.steps);
    const goalByDate = extractValuesByDate(text, "uds_dailyStepGoal");

    const dates = [...stepsByDate.keys()].sort();
    const daily = dates.map((date) => ({
      date,
      steps: stepsByDate.get(date)?.[0] ?? 0,
      goal: goalByDate.get(date)?.[0] ?? null,
    }));
    const lastDate = dates[dates.length - 1];
    const allSteps = daily.map((d) => d.steps);

    return {
      todaySteps: lastDate ? stepsByDate.get(lastDate)?.[0] ?? null : null,
      todayGoal: lastDate ? goalByDate.get(lastDate)?.[0] ?? null : null,
      avgSteps7d: allSteps.length ? Math.round(allSteps.reduce((a, b) => a + b, 0) / allSteps.length) : null,
      daily,
    };
  }

  /**
   * [Certo] FC por atividade (nome real, não data) — substitui o anterior
   * getActivityPaceHrHistory, que misturava pace (não fazia sentido nesta
   * página). activity_activityName é texto, não escalar — usa um extrator
   * próprio em vez de extractValuesByDate (numérico).
   */
  async getActivityHrHistory(days = 35): Promise<
    { date: string; name: string; avgHr: number | null; maxHr: number | null; minHr: number | null }[]
  > {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText — necessário para o histórico de FC.");
    }
    const text = await this.client.queryRawText({
      metrics: [RunActivityMetrics.activityName, RunActivityMetrics.avgHr, RunActivityMetrics.maxHr],
      days,
    });
    const namesByDate = extractStringValuesByDate(text, RunActivityMetrics.activityName);
    const avgHrByDate = extractValuesByDate(text, RunActivityMetrics.avgHr);
    const maxHrByDate = extractValuesByDate(text, RunActivityMetrics.maxHr);

    const out: { date: string; name: string; avgHr: number | null; maxHr: number | null; minHr: number | null }[] = [];
    for (const [date, names] of namesByDate) {
      const avgs = avgHrByDate.get(date) ?? [];
      const maxs = maxHrByDate.get(date) ?? [];
      names.forEach((name, i) => {
        out.push({
          date,
          name,
          avgHr: avgs[i] ?? null,
          maxHr: maxs[i] ?? null,
          minHr: null, // [TODO] activity_* não tem FC mínima por atividade — só a média e a máxima
        });
      });
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  async getHeartRateWeekly(days = 7): Promise<{
    restingToday: number | null;
    maxThisWeek: number | null;
    minToday: number | null;
    daily: { date: string; resting: number | null; max: number | null }[];
  }> {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText — necessário para FC semanal.");
    }
    const text = await this.client.queryRawText({
      metrics: [DailyAggregateMetrics.restingHr, DailyAggregateMetrics.maxHr, DailyAggregateMetrics.minHr],
      days,
    });
    const restingByDate = extractValuesByDate(text, DailyAggregateMetrics.restingHr);
    const maxByDate = extractValuesByDate(text, DailyAggregateMetrics.maxHr);
    const minByDate = extractValuesByDate(text, DailyAggregateMetrics.minHr);

    const allDates = [...new Set([...restingByDate.keys(), ...maxByDate.keys()])].sort();
    const daily = allDates.map((date) => ({
      date,
      resting: restingByDate.get(date)?.[0] ?? null,
      max: maxByDate.get(date)?.[0] ?? null,
    }));

    const lastDate = allDates[allDates.length - 1];
    const allMaxValues = [...maxByDate.values()].flat();
    const allMinValues = [...minByDate.values()].flat();

    return {
      restingToday: lastDate ? restingByDate.get(lastDate)?.[0] ?? null : null,
      maxThisWeek: allMaxValues.length ? Math.max(...allMaxValues) : null,
      minToday: lastDate ? minByDate.get(lastDate)?.[0] ?? (allMinValues.length ? Math.min(...allMinValues) : null) : null,
      daily,
    };
  }

  async getWeeklyRunningSummary(days = 7): Promise<{
    totalDistanceKm: number;
    totalDurationSec: number;
    runCount: number;
    dailyDistanceKm: { date: string; km: number }[];
  }> {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText — necessário para o resumo semanal.");
    }
    const text = await this.client.queryRawText({
      metrics: [RunActivityMetrics.distanceM, RunActivityMetrics.durationSec],
      days,
    });
    const distanceByDate = extractValuesByDate(text, RunActivityMetrics.distanceM);
    const durationByDate = extractValuesByDate(text, RunActivityMetrics.durationSec);

    const allDistances = flattenAll(distanceByDate);
    const allDurations = flattenAll(durationByDate);

    const dailyDistanceKm = [...distanceByDate.entries()]
      .map(([date, values]) => ({ date, km: roundTo(sum(values) / 1000, 1) }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    // [Certo] Preenche os dias sem corrida com 0km — sem isto o gráfico
    // tinha "buracos" e parecia ter menos de 7 dias quando faltava treino.
    const filledByDate = new Map(dailyDistanceKm.map((d) => [d.date, d.km]));
    const fullWeek: { date: string; km: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      fullWeek.push({ date: dateStr, km: filledByDate.get(dateStr) ?? 0 });
    }

    return {
      totalDistanceKm: roundTo(sum(allDistances) / 1000, 1),
      totalDurationSec: sum(allDurations),
      runCount: allDistances.length,
      dailyDistanceKm: fullWeek,
    };
  }

  /**
   * [Certo] Reutiliza a mesma combinação de fontes validada no YoY
   * (activity_* recente + summarizedActivity_* histórico, elevação /100).
   * [Certo, confirmado por teste cruzado real] `summarizedActivity_calories`
   * está em kJ, não kcal, apesar do nome — confirmado comparando 4
   * atividades reais nas duas tabelas (razão consistente ≈4.184, que é
   * exatamente a conversão kJ→kcal). `activity_activeKilocalories` está
   * correto. Aplica-se a divisão só ao primeiro, nunca ao segundo.
   * Range fixo a partir de 1 de janeiro do ano atual até hoje (YTD) —
   * não é "últimos N meses" rolantes.
   */
  /**
   * [Certo] Substitui o antigo getMonthlyTrend — devolve dados DIÁRIOS
   * para o último ano (activity_* recente + summarizedActivity_*
   * histórico, calorias do summarizedActivity convertidas de kJ para
   * kcal ÷4.184, elevação seria /100 mas não é usada aqui). A agregação
   * por período (7D/1M/3M/6M/YTD/1Y) faz-se no cliente a partir destes
   * dados diários, evitando uma chamada ao servidor por cada clique no
   * seletor de período.
   */
  /**
   * [Certo] Estatísticas agregadas para a página de Corrida — reutiliza a
   * mesma combinação de fontes validada (activity_* recente +
   * summarizedActivity_* histórico, elevação /100), mas inclui também
   * contagem de atividades e elevação, e separadamente o total histórico
   * completo (consulta extra, mais pesada, só para o número "Total Histórico").
   */
  async getRunningStatsOverview(): Promise<{
    thisWeekKm: number;
    lastWeekKm: number;
    avgWeekKm: number;
    bestWeekKm: number;
    totalYtdKm: number;
    totalAllTimeKm: number;
    weeklyVolume: { weekLabel: string; km: number }[]; // últimas 18 semanas
    monthlyVolume: { month: string; km: number }[]; // últimos 12 meses
    weeklyRunCount: { weekLabel: string; count: number }[];
    weeklyElevation: { weekLabel: string; m: number }[];
  }> {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText — necessário para as estatísticas de corrida.");
    }
    const end = new Date();
    const start18w = new Date(end);
    start18w.setDate(start18w.getDate() - 18 * 7);
    const startStr = start18w.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const [summarizedText, recentText] = await Promise.all([
      this.client.queryRawText({
        metrics: [SummarizedActivityMetrics.distanceM, SummarizedActivityMetrics.elevationGainM],
        start: startStr,
        end: endStr,
      }),
      this.client.queryRawText({
        metrics: [RunActivityMetrics.distanceM, RunActivityMetrics.elevationGainM],
        start: startStr,
        end: endStr,
      }),
    ]);

    const recentDist = extractValuesByDate(recentText, RunActivityMetrics.distanceM);
    const recentElev = extractValuesByDate(recentText, RunActivityMetrics.elevationGainM);
    const summDist = extractValuesByDate(summarizedText, SummarizedActivityMetrics.distanceM);
    const summElev = extractValuesByDate(summarizedText, SummarizedActivityMetrics.elevationGainM);
    const recentDates = new Set(recentDist.keys());

    const byDate = new Map<string, { km: number; elevM: number; count: number }>();
    for (const [date, vals] of recentDist) {
      byDate.set(date, { km: sum(vals) / 1000, elevM: sum(recentElev.get(date) ?? []), count: vals.length });
    }
    for (const [date, vals] of summDist) {
      if (recentDates.has(date)) continue;
      byDate.set(date, { km: sum(vals) / 1000, elevM: sum(summElev.get(date) ?? []) / 100, count: vals.length });
    }

    // [Certo] Substituído o loop anual por pedidos trimestrais
    // (fetchInQuarterlyChunks) — mesma correção aplicada em getDailyTrend,
    // depois de confirmar que mesmo 1 ano inteiro pode ultrapassar as 500
    // linhas da API consoante o volume de atividades.
    const queryRawText = this.client.queryRawText;
    const allTimeText = await fetchInQuarterlyChunks(
      queryRawText,
      [SummarizedActivityMetrics.distanceM],
      "2016-01-01",
      endStr
    );
    const allTimeDist = new Map<string, number[]>();
    for (const [date, vals] of extractValuesByDate(allTimeText, SummarizedActivityMetrics.distanceM)) {
      allTimeDist.set(date, vals);
    }
    let totalAllTimeKm = 0;
    for (const vals of allTimeDist.values()) totalAllTimeKm += sum(vals) / 1000;
    // somar também o período recente que pode não estar no summarized (sobreposição/atraso de sync), evitando dupla contagem por data
    for (const [date, vals] of recentDist) {
      if (!allTimeDist.has(date)) totalAllTimeKm += sum(vals) / 1000;
    }

    // Agrupar por semana (segunda a domingo) e por mês — usa byDate (janela de 18 semanas), correto para isto
    function isoWeekStart(d: Date): string {
      const date = new Date(d);
      const day = (date.getDay() + 6) % 7; // 0 = segunda
      date.setDate(date.getDate() - day);
      return date.toISOString().slice(0, 10);
    }

    const weekBuckets = new Map<string, { km: number; elevM: number; count: number }>();
    const monthBuckets = new Map<string, number>();

    for (const [date, d] of byDate) {
      const weekKey = isoWeekStart(new Date(`${date}T00:00:00`));
      const wb = weekBuckets.get(weekKey) ?? { km: 0, elevM: 0, count: 0 };
      wb.km += d.km;
      wb.elevM += d.elevM;
      wb.count += d.count;
      weekBuckets.set(weekKey, wb);

      const monthKey = date.slice(0, 7);
      monthBuckets.set(monthKey, (monthBuckets.get(monthKey) ?? 0) + d.km);
    }

    // [Certo] Total YTD — corrigido: antes comparava contra `byDate`, que só
    // tem 18 semanas, sub-contando sempre que 1 de Janeiro caía fora dessa
    // janela (quase todo o ano). Agora soma a partir do histórico completo
    // (allTimeDist, já corrigido acima) fundido com os dados recentes.
    const ytdStart = `${end.getFullYear()}-01-01`;
    let totalYtdKm = 0;
    for (const [date, vals] of allTimeDist) {
      if (date >= ytdStart) totalYtdKm += sum(vals) / 1000;
    }
    for (const [date, vals] of recentDist) {
      if (date >= ytdStart && !allTimeDist.has(date)) totalYtdKm += sum(vals) / 1000;
    }

    const sortedWeeks = [...weekBuckets.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const sortedMonths = [...monthBuckets.entries()].sort(([a], [b]) => (a < b ? -1 : 1));

    const weekLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
    const weeklyVolume = sortedWeeks.map(([wk, d]) => ({ weekLabel: weekLabel(wk), km: roundTo(d.km, 1) }));
    const weeklyRunCount = sortedWeeks.map(([wk, d]) => ({ weekLabel: weekLabel(wk), count: d.count }));
    const weeklyElevation = sortedWeeks.map(([wk, d]) => ({ weekLabel: weekLabel(wk), m: Math.round(d.elevM) }));
    const monthlyVolume = sortedMonths.map(([m, km]) => ({ month: m, km: roundTo(km, 1) }));

    const thisWeekKm = sortedWeeks.length ? roundTo(sortedWeeks[sortedWeeks.length - 1][1].km, 1) : 0;
    const lastWeekKm = sortedWeeks.length > 1 ? roundTo(sortedWeeks[sortedWeeks.length - 2][1].km, 1) : 0;
    const weekKms = sortedWeeks.map(([, d]) => d.km);
    const avgWeekKm = weekKms.length ? roundTo(weekKms.reduce((a, b) => a + b, 0) / weekKms.length, 1) : 0;
    const bestWeekKm = weekKms.length ? roundTo(Math.max(...weekKms), 1) : 0;

    return {
      thisWeekKm,
      lastWeekKm,
      avgWeekKm,
      bestWeekKm,
      totalYtdKm: roundTo(totalYtdKm, 1),
      totalAllTimeKm: roundTo(totalAllTimeKm, 1),
      weeklyVolume,
      monthlyVolume,
      weeklyRunCount,
      weeklyElevation,
    };
  }

  /**
   * [Certo] Alargado de 1 para 2 anos — a comparação homóloga
   * (MonthlyTrendChart, modo "Comparar com ano anterior") precisa do
   * ano anterior completo até à data equivalente de hoje. Com só 1 ano
   * de alcance, faltava sempre a parte mais antiga do ano anterior.
   */
  /**
   * [Certo] Confirmado por teste real: o pedido de summarizedActivity_*
   * (3 métricas × 2 anos) atinge o limite de 500 linhas da API do Freddy
   * e corta silenciosamente em meados de agosto de 2025 — exatamente a
   * causa do "ano anterior em falta" na comparação homóloga. Corrigido:
   * pede o summarized ANO A ANO (mesma técnica já validada em
   * getRunningStatsOverview), cada pedido fica bem abaixo do limite.
   * recent (activity_*, só ~35 dias) continua num pedido único, nunca
   * se aproxima do limite.
   */
  async getDailyTrend(): Promise<{ date: string; distanceKm: number; durationH: number; caloriesKcal: number }[]> {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText — necessário para a tendência diária.");
    }
    const queryRawText = this.client.queryRawText;
    const end = new Date();
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 2);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const recentTextPromise = queryRawText({
      metrics: [RunActivityMetrics.distanceM, RunActivityMetrics.durationSec, RunActivityMetrics.activeKcal],
      start: startStr,
      end: endStr,
    });

    const summarizedText = await fetchInQuarterlyChunks(
      queryRawText,
      [SummarizedActivityMetrics.distanceM, SummarizedActivityMetrics.durationSec, SummarizedActivityMetrics.calories],
      startStr,
      endStr
    );
    const recentText = await recentTextPromise;

    const recentDist = extractValuesByDate(recentText, RunActivityMetrics.distanceM);
    const recentDur = extractValuesByDate(recentText, RunActivityMetrics.durationSec);
    const recentKcal = extractValuesByDate(recentText, RunActivityMetrics.activeKcal);
    const summDist = extractValuesByDate(summarizedText, SummarizedActivityMetrics.distanceM);
    const summDur = extractValuesByDate(summarizedText, SummarizedActivityMetrics.durationSec);
    const summKcal = extractValuesByDate(summarizedText, SummarizedActivityMetrics.calories);

    const recentDates = new Set(recentDist.keys());
    const byDate = new Map<string, { km: number; sec: number; kcal: number }>();

    for (const [date, vals] of recentDist) {
      byDate.set(date, { km: sum(vals) / 1000, sec: sum(recentDur.get(date) ?? []), kcal: sum(recentKcal.get(date) ?? []) });
    }
    for (const [date, vals] of summDist) {
      if (recentDates.has(date)) continue;
      byDate.set(date, { km: sum(vals) / 1000, sec: sum(summDur.get(date) ?? []), kcal: sum(summKcal.get(date) ?? []) / 4.184 });
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, b]) => ({ date, distanceKm: roundTo(b.km, 2), durationH: roundTo(b.sec / 3600, 2), caloriesKcal: Math.round(b.kcal) }));
  }

  /**
   * [Provável] Zip por posição entre arrays extraídos independentemente
   * por métrica, para a mesma data — funciona porque cada métrica é
   * varrida pela mesma ordem de leitura do texto, preservando a ordem
   * relativa das atividades desse dia (não testado formalmente, mas é a
   * única leitura coerente com o texto real observado).
   */
  /**
   * [Certo] Usa summarizedActivity_* (cobertura 2016+, confirmada) para
   * encontrar o melhor tempo real já feito perto de cada distância-alvo
   * (5K/10K/Meia/Maratona), dentro de uma tolerância — não exige a
   * distância exata, porque corridas reais raramente batem 5.00km certos.
   * [Suposição] Tolerâncias (±6-8%) são uma escolha razoável minha, não
   * uma convenção oficial — uma corrida de 5.3km entra como "5K", o que
   * pode não ser o que o utilizador consideraria um recorde de 5K "puro".
   */
  /**
   * [Certo] Confirmado por teste real: pedir o histórico desde 2016 devolve
   * só 500 linhas (limite da API), que na prática cobre uns ~14 meses, não
   * 10 anos — e provavelmente foi a causa de esta função ter falhado em
   * produção (timeout/limite ao processar um pedido tão grande). Corrigido
   * para pedir só ~18 meses de propósito, dentro do limite confirmado, e o
   * texto da UI deixa de dizer "desde 2016".
   */
  async getPersonalRecords(): Promise<
    { label: string; targetKm: number; distanceKm: number; durationSec: number; date: string; paceMinPerKm: number; activityName: string | null }[]
  > {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText — necessário para os recordes pessoais.");
    }
    const start = new Date();
    start.setDate(start.getDate() - 540);
    const text = await this.client.queryRawText({
      metrics: [SummarizedActivityMetrics.distanceM, SummarizedActivityMetrics.durationSec, RunActivityMetrics.activityName],
      start: start.toISOString().slice(0, 10),
      end: new Date().toISOString().slice(0, 10),
    });
    const distByDate = extractValuesByDate(text, SummarizedActivityMetrics.distanceM);
    const durByDate = extractValuesByDate(text, SummarizedActivityMetrics.durationSec);
    const nameByDate = extractStringValuesByDate(text, RunActivityMetrics.activityName);

    const candidates: { date: string; distanceKm: number; durationSec: number; activityName: string | null }[] = [];
    for (const [date, distances] of distByDate) {
      const durations = durByDate.get(date) ?? [];
      const names = nameByDate.get(date) ?? [];
      distances.forEach((distM, i) => {
        candidates.push({ date, distanceKm: distM / 1000, durationSec: durations[i] ?? 0, activityName: names[i] ?? null });
      });
    }

    const targets = [
      { label: "5 km", km: 5, tolerance: 0.08 },
      { label: "10 km", km: 10, tolerance: 0.06 },
      { label: "Meia Maratona", km: 21.0975, tolerance: 0.05 },
      { label: "Maratona", km: 42.195, tolerance: 0.05 },
    ];

    return targets
      .map((t) => {
        const matches = candidates.filter(
          (c) => c.distanceKm >= t.km * (1 - t.tolerance) && c.distanceKm <= t.km * (1 + t.tolerance) && c.durationSec > 0
        );
        const best = matches.reduce((b, c) => (!b || c.durationSec < b.durationSec ? c : b), matches[0]);
        if (!best) return null;
        return {
          label: t.label,
          targetKm: t.km,
          distanceKm: roundTo(best.distanceKm, 2),
          durationSec: best.durationSec,
          date: best.date,
          paceMinPerKm: roundTo(best.durationSec / 60 / best.distanceKm, 2),
          activityName: best.activityName,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }

  async getRecentActivities(days = 30): Promise<
    { date: string; distanceKm: number; durationSec: number; paceMinPerKm: number; elevationGainM: number | null }[]
  > {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText — necessário para a lista de atividades.");
    }
    const text = await this.client.queryRawText({
      metrics: [RunActivityMetrics.distanceM, RunActivityMetrics.durationSec, RunActivityMetrics.elevationGainM],
      days,
    });
    const distByDate = extractValuesByDate(text, RunActivityMetrics.distanceM);
    const durByDate = extractValuesByDate(text, RunActivityMetrics.durationSec);
    const elevByDate = extractValuesByDate(text, RunActivityMetrics.elevationGainM);

    const out: { date: string; distanceKm: number; durationSec: number; paceMinPerKm: number; elevationGainM: number | null }[] = [];
    for (const [date, distances] of distByDate) {
      const durations = durByDate.get(date) ?? [];
      const elevations = elevByDate.get(date) ?? [];
      distances.forEach((distM, i) => {
        const durSec = durations[i] ?? 0;
        out.push({
          date,
          distanceKm: roundTo(distM / 1000, 2),
          durationSec: durSec,
          paceMinPerKm: distM > 0 ? roundTo(durSec / 60 / (distM / 1000), 2) : 0,
          elevationGainM: elevations[i] ?? null,
        });
      });
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  async getYearOverYearKpis(yearStart: string, yearEnd: string, prevYearStart: string, prevYearEnd: string): Promise<YearOverYearKpi[]> {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText — necessário para a comparação homóloga.");
    }
    const summarizedMetrics = [
      SummarizedActivityMetrics.distanceM,
      SummarizedActivityMetrics.durationSec,
      SummarizedActivityMetrics.elevationGainM,
      SummarizedActivityMetrics.avgHr,
    ];
    const recentMetrics = [
      RunActivityMetrics.distanceM,
      RunActivityMetrics.durationSec,
      RunActivityMetrics.elevationGainM,
      RunActivityMetrics.avgHr,
    ];

    const [currentSummarized, previousSummarized, currentRecent, previousRecent] = await Promise.all([
      this.client.queryRawText({ metrics: summarizedMetrics, start: yearStart, end: yearEnd }),
      this.client.queryRawText({ metrics: summarizedMetrics, start: prevYearStart, end: prevYearEnd }),
      this.client.queryRawText({ metrics: recentMetrics, start: yearStart, end: yearEnd }),
      this.client.queryRawText({ metrics: recentMetrics, start: prevYearStart, end: prevYearEnd }),
    ]);

    return computeYearOverYearKpis(
      { summarized: currentSummarized, recent: currentRecent },
      { summarized: previousSummarized, recent: previousRecent }
    );
  }
}

/**
 * [Certo] Shape REAL confirmado do raw payload de activityDetail_samples
 * (verificado em 2026-06-25 contra duas corridas reais: ids 23367317760-detail
 * e 23354613062-detail). Esta é a única interface deste ficheiro que não é
 * suposição — é cópia estrutural do JSON devolvido.
 */
export /** [Certo] Shape real confirmado via include_raw em wellness_restingHR, 2026-06-26. */
interface WellnessRaw {
  id: string;
  ctl?: number | null;
  atl?: number | null;
  rampRate?: number | null;
  restingHR?: number | null;
  hrv?: number | null;
  sleepSecs?: number | null;
  sleepScore?: number | null;
  sleepQuality?: number | null;
  steps?: number | null;
  vo2max?: number | null;
  readiness?: number | null;
  updated?: string;
}

export interface WellnessDay {
  date: string;
  ctl: number | null;
  atl: number | null;
  /** TSB = CTL - ATL, real, da metodologia TrainingPeaks/Intervals.icu — não é mais a aproximação ACWR do Garmin. */
  tsb: number | null;
  rampRate: number | null;
  restingHr: number | null;
  hrv: number | null;
  sleepScore: number | null;
  sleepSecs: number | null;
  steps: number | null;
  vo2max: number | null;
  readiness: number | null;
}

interface ActivityDetailSamplesRaw {
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


/**
 * [Certo] Shape real confirmado (sleep_durationInSeconds raw, testado em
 * 3 noites reais). overallSleepScore é objeto {value, qualifierKey}, não
 * número direto. sleepScores tem qualifiers por dimensão — usados aqui só
 * para feedback textual, não como números (não há valor numérico nesses
 * subscores neste registo, só o qualifier).
 */
interface SleepRaw {
  durationInSeconds: number;
  deepSleepDurationInSeconds: number;
  lightSleepDurationInSeconds: number;
  remSleepInSeconds: number;
  awakeDurationInSeconds: number;
  overallSleepScore: { value: number; qualifierKey: string };
  calendarDate: string;
  sleepScores?: {
    stress?: { qualifierKey: string };
    restlessness?: { qualifierKey: string };
  };
}

/** [Suposição] mesmo dicionário de qualifiers usado no Training Readiness — não confirmado para este contexto específico, mas é o mesmo padrão (POOR/FAIR/GOOD/EXCELLENT) visto nos dados reais. */
const SLEEP_QUALIFIER_LABELS: Record<string, string> = {
  POOR: "Fraco",
  FAIR: "Razoável",
  GOOD: "Bom",
  EXCELLENT: "Excelente",
};

function mapToSleepSummary(raw: Record<string, unknown>): SleepSummary[] {
  const entries = Object.entries(raw) as [string, SleepRaw][];
  return entries.map(([date, r]) => {
    const qualifier = r.overallSleepScore?.qualifierKey;
    return {
      date,
      durationSec: r.durationInSeconds,
      deepSec: r.deepSleepDurationInSeconds,
      lightSec: r.lightSleepDurationInSeconds,
      remSec: r.remSleepInSeconds,
      awakeSec: r.awakeDurationInSeconds,
      overallScore: r.overallSleepScore?.value ?? null,
      qualityScore: null, // [TODO] sleepFile_qualityScore é uma métrica separada, não testada ainda
      recoveryScore: null, // idem, sleepFile_recoveryScore
      feedback: qualifier ? (SLEEP_QUALIFIER_LABELS[qualifier] ?? qualifier) : null,
      insight: r.sleepScores?.stress?.qualifierKey
        ? `Stress durante o sono: ${SLEEP_QUALIFIER_LABELS[r.sleepScores.stress.qualifierKey] ?? r.sleepScores.stress.qualifierKey}`
        : null,
    };
  });
}
/**
 * [Certo] Dicionários de tradução para os códigos reais devolvidos por
 * trainingReadiness_score.raw — confirmados em runtime (level: "POOR",
 * "LOW" vistos; "MODERATE"/"GOOD"/"EXCELLENT" não vistos ainda mas
 * coerentes com o padrão de qualifiers usado em sleepScores). Se aparecer
 * um código não mapeado, o fallback devolve o próprio código em vez de
 * rebentar — mais seguro para produção do que assumir a lista é exaustiva.
 */
const READINESS_LEVEL_LABELS: Record<string, string> = {
  POOR: "Fraco",
  LOW: "Baixo",
  MODERATE: "Moderado",
  GOOD: "Bom",
  EXCELLENT: "Excelente",
};

/** [Suposição] Lista parcial — só os 2 códigos vistos em runtime estão confirmados. */
const READINESS_FEEDBACK_LABELS: Record<string, string> = {
  TIME_TO_SLOW_DOWN: "Hora de abrandar — recuperação prioritária.",
  HIGH_RECOVERY_NEEDS: "Necessidade elevada de recuperação.",
};

function translateReadinessLevel(code: string): string {
  return READINESS_LEVEL_LABELS[code] ?? code;
}
function translateReadinessFeedback(code: string): string {
  return READINESS_FEEDBACK_LABELS[code] ?? code.replaceAll("_", " ").toLowerCase();
}

/** Shape real confirmado do raw de trainingReadiness_score (ver gap #5 no topo). */
interface TrainingReadinessRaw {
  score: number;
  level: string;
  feedbackShort: string;
  recoveryTime: number; // segundos
  hrvWeeklyAverage: number;
  acuteLoad: number;
  calendarDate: string; // já é string ISO "YYYY-MM-DD" aqui, ao contrário do acuteTrainingLoad
}

/** Shape real confirmado do raw de acuteTrainingLoad_dailyTrainingLoadAcute. */
interface TrainingLoadRaw {
  acwrPercent: number;
  acwrStatus: string; // "OPTIMAL" | "LOW" | presumivelmente "HIGH"
  dailyTrainingLoadAcute: number;
  dailyTrainingLoadChronic: number;
  dailyAcuteChronicWorkloadRatio: number;
  calendarDate: number; // epoch MILISSEGUNDOS — diferente do trainingReadiness!
}

/**
 * [Provável] Assume que a resposta tem uma entrada por dia, indexada por
 * data, com o raw acessível em `<metric>_raw`. Ainda não confirmado contra
 * o envelope JSON-RPC real (ver gap #4) — ajustar a forma de iteração se a
 * estrutura de produção vier diferente desta suposição razoável.
 */
function mapToTrainingReadiness(raw: Record<string, unknown>): TrainingReadinessSummary[] {
  const entries = Object.entries(raw) as [string, TrainingReadinessRaw][];
  return entries.map(([date, r]) => ({
    date,
    score: r.score,
    level: translateReadinessLevel(r.level),
    feedbackShort: translateReadinessFeedback(r.feedbackShort),
    acuteLoad: r.acuteLoad,
    recoveryTimeHours: Math.round((r.recoveryTime / 3600) * 10) / 10, // segundos -> horas, 1 decimal
  }));
}

function mapToTrainingLoad(raw: Record<string, unknown>): TrainingLoadSummary[] {
  const entries = Object.entries(raw) as [string, TrainingLoadRaw][];
  return entries.map(([, r]) => ({
    date: new Date(r.calendarDate).toISOString().slice(0, 10), // epoch ms -> YYYY-MM-DD
    acuteLoad: r.dailyTrainingLoadAcute,
    chronicLoad: r.dailyTrainingLoadChronic,
    acwrRatio: r.dailyAcuteChronicWorkloadRatio,
    acwrStatus: r.acwrStatus,
    trainingStatus: "", // [Suposição] vem de trainingHistory_trainingStatus, métrica separada — não testado ainda
    fitnessLevelTrend: "", // idem, trainingHistory_fitnessLevelTrend
  }));
}
/** Shape real confirmado do raw de userMetrics_vo2Max — simples, sem surpresas. */
interface Vo2MaxRaw {
  vo2Max: number;
  fitnessAge: number;
  calendarDate: string; // "YYYY-MM-DD"
  enhanced: boolean;
}

/**
 * [Provável] Só `canonical` (userMetrics_vo2Max) está confirmado contra raw
 * real. As outras 3 fontes (historicalSeriesValue, crossCheckValue,
 * biometricValue) ainda não foram testadas com include_raw — ficam a 0/null
 * até essa confirmação, em vez de assumir o mesmo shape simples só porque
 * "vo2Max" parece um campo óbvio. Não inventar a estrutura das outras 3.
 */
function mapToVo2Max(raw: Record<string, unknown>): Vo2MaxSummary[] {
  const entries = Object.entries(raw) as [string, Vo2MaxRaw][];
  return entries.map(([, r]) => ({
    date: r.calendarDate,
    canonicalValue: r.vo2Max,
    historicalSeriesValue: null,
    crossCheckValue: null,
    biometricValue: null,
    hasDiscrepancy: false, // sem as outras 3 fontes, não há nada para comparar ainda
  }));
}
/** Shape real confirmado — todos os 4 tempos vêm juntos num único registo. */
interface RacePredictionRaw {
  raceTime5K: number;
  raceTime10K: number;
  raceTimeHalf: number;
  raceTimeMarathon: number;
  calendarDate: string;
}

function mapToRacePrediction(raw: Record<string, unknown>): RacePredictionSummary {
  const entries = Object.values(raw) as RacePredictionRaw[];
  const latest = entries[entries.length - 1]; // [Suposição] assume ordem cronológica; confirmar se vier diferente
  if (!latest) throw new Error("Sem dados de race predictions no período pedido.");
  return {
    date: latest.calendarDate,
    time5kSec: latest.raceTime5K,
    time10kSec: latest.raceTime10K,
    timeHalfSec: latest.raceTimeHalf,
    timeMarathonSec: latest.raceTimeMarathon,
  };
}

/**
 * [Certo] Shape real confirmado: dailyBodyBattery_chargedValue e
 * stress_avgStressLevel devolvem o MESMO registo diário (não são
 * independentes) — campos confirmados: bodyBatteryChargedValue,
 * bodyBatteryDrainedValue, averageStressLevel, maxStressLevel,
 * restingHeartRateInBeatsPerMinute. NÃO existem bodyBatteryMax/Min como
 * valores únicos diários neste registo — só charged/drained. O campo
 * `recoveryTimeHours` desta interface continua a vir de
 * trainingReadiness_score (já mapeado), não deste registo.
 */
interface DailySummaryRaw {
  bodyBatteryChargedValue: number;
  bodyBatteryDrainedValue: number;
  averageStressLevel: number;
  maxStressLevel: number;
  restingHeartRateInBeatsPerMinute?: number;
  calendarDate: string;
}

function mapToRecovery(raw: Record<string, unknown>): RecoverySummary[] {
  const entries = Object.entries(raw) as [string, DailySummaryRaw][];
  return entries.map(([date, r]) => ({
    date,
    recoveryTimeHours: null, // [TODO] cruzar com trainingReadiness_score do mesmo dia, não vem deste registo
    bodyBatteryCharged: r.bodyBatteryChargedValue,
    bodyBatteryDrained: r.bodyBatteryDrainedValue,
    // [Suposição] sem max/min reais diários confirmados — uso charged como proxy do pico
    bodyBatteryMax: r.bodyBatteryChargedValue,
    bodyBatteryMin: r.bodyBatteryChargedValue - r.bodyBatteryDrainedValue,
    avgStress: r.averageStressLevel,
    maxStress: r.maxStressLevel,
  }));
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
const YOY_DATE_HEADER_RE = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2})?:\s*$/;

/**
 * [Certo] Confirmado por teste real: mesmo UM ANO inteiro (3 métricas,
 * ~150 atividades/ano para este utilizador) ultrapassa as 500 linhas da
 * API do Freddy e corta silenciosamente os meses mais antigos (testado:
 * pedido de 2025 inteiro cortou em 2 de março, perdendo Jan/Fev por
 * completo). Esta função substitui os pedidos "ano a ano" por pedidos
 * TRIMESTRAIS (margem de segurança ~4x maior), em lotes de 3 em
 * paralelo com pausa entre lotes — mesmo equilíbrio velocidade/limite
 * já validado noutros sítios da app.
 */
async function fetchInQuarterlyChunks(
  queryRawText: (args: { metrics: string[]; start?: string; end?: string }) => Promise<string>,
  metrics: string[],
  startStr: string,
  endStr: string
): Promise<string> {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);

  const chunks: { from: string; to: string }[] = [];
  let cursor = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
  while (cursor <= end) {
    const chunkStart = cursor < start ? start : cursor;
    const quarterEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 0); // último dia do trimestre
    const chunkEnd = quarterEnd > end ? end : quarterEnd;
    chunks.push({ from: chunkStart.toISOString().slice(0, 10), to: chunkEnd.toISOString().slice(0, 10) });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 1);
  }

  const texts: string[] = [];
  const BATCH_SIZE = 3;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((c) => queryRawText({ metrics, start: c.from, end: c.to }).catch(() => ""))
    );
    texts.push(...batchResults);
    if (i + BATCH_SIZE < chunks.length) await new Promise((r) => setTimeout(r, 200));
  }
  return texts.join("\n");
}

/** Extrai valores escalares de uma métrica, agrupados por data (cabeçalho "YYYY-MM-DD:"). */
function extractValuesByDate(text: string, metricName: string): Map<string, number[]> {
  const lines = text.split("\n");
  const result = new Map<string, number[]>();
  let currentDate: string | null = null;
  const valueRe = new RegExp(`^\\s*${metricName}:\\s*(-?\\d+(?:\\.\\d+)?)`);

  for (const line of lines) {
    const dateMatch = line.match(YOY_DATE_HEADER_RE);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }
    const valueMatch = line.match(valueRe);
    if (valueMatch && currentDate) {
      const arr = result.get(currentDate) ?? [];
      arr.push(Number(valueMatch[1]));
      result.set(currentDate, arr);
    }
  }
  return result;
}

/** Igual a extractValuesByDate, mas para campos de texto (ex: nome da atividade), não numéricos. */
function extractStringValuesByDate(text: string, metricName: string): Map<string, string[]> {
  const lines = text.split("\n");
  const result = new Map<string, string[]>();
  let currentDate: string | null = null;
  const valueRe = new RegExp(`^\\s*${metricName}:\\s*(.+?)\\s*\\(`); // texto até antes de "(Garmin)" etc.

  for (const line of lines) {
    const dateMatch = line.match(YOY_DATE_HEADER_RE);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }
    const valueMatch = line.match(valueRe);
    if (valueMatch && currentDate) {
      const arr = result.get(currentDate) ?? [];
      arr.push(valueMatch[1].trim());
      result.set(currentDate, arr);
    }
  }
  return result;
}

function flattenExcluding(map: Map<string, number[]>, excludeDates: Set<string>): number[] {
  const out: number[] = [];
  for (const [date, values] of map) {
    if (!excludeDates.has(date)) out.push(...values);
  }
  return out;
}
function flattenAll(map: Map<string, number[]>): number[] {
  return [...map.values()].flat();
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
function average(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
function percentDiff(current: number, previous: number): number {
  return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}

interface YoySourcePair {
  summarized: string;
  recent: string;
}

/**
 * [Certo] Combina as duas fontes: `recent` (activity_*, últimos ~30-35
 * dias, elevação correta) tem prioridade; `summarized` (summarizedActivity_*,
 * histórico) só contribui para datas que `recent` NÃO cobre, e a sua
 * elevação é dividida por 100 (bug de unidade confirmado).
 */
function computeYearOverYearKpis(current: YoySourcePair, previous: YoySourcePair): YearOverYearKpi[] {
  function aggregateOne(pair: YoySourcePair) {
    const recentDistance = extractValuesByDate(pair.recent, RunActivityMetrics.distanceM);
    const recentDuration = extractValuesByDate(pair.recent, RunActivityMetrics.durationSec);
    const recentElevation = extractValuesByDate(pair.recent, RunActivityMetrics.elevationGainM);
    const recentHr = extractValuesByDate(pair.recent, RunActivityMetrics.avgHr);

    const summDistance = extractValuesByDate(pair.summarized, SummarizedActivityMetrics.distanceM);
    const summDuration = extractValuesByDate(pair.summarized, SummarizedActivityMetrics.durationSec);
    const summElevation = extractValuesByDate(pair.summarized, SummarizedActivityMetrics.elevationGainM);
    const summHr = extractValuesByDate(pair.summarized, SummarizedActivityMetrics.avgHr);

    const recentDates = new Set(recentDistance.keys());

    const distance = [...flattenAll(recentDistance), ...flattenExcluding(summDistance, recentDates)];
    const duration = [...flattenAll(recentDuration), ...flattenExcluding(summDuration, recentDates)];
    const elevation = [
      ...flattenAll(recentElevation),
      ...flattenExcluding(summElevation, recentDates).map((v) => v / 100), // correção do bug de unidade
    ];
    const hr = [...flattenAll(recentHr), ...flattenExcluding(summHr, recentDates)];
    const runCount = distance.length;

    return { distance, duration, elevation, hr, runCount };
  }

  const cur = aggregateOne(current);
  const prev = aggregateOne(previous);

  const build = (label: string, curValues: number[], prevValues: number[], unit: string, aggregate: (v: number[]) => number, decimals = 0): YearOverYearKpi => {
    const c = aggregate(curValues);
    const p = aggregate(prevValues);
    return { label, currentValue: roundTo(c, decimals), previousValue: roundTo(p, decimals), unit, percentChange: percentDiff(c, p) };
  };

  return [
    { label: "Corridas", currentValue: cur.runCount, previousValue: prev.runCount, unit: "", percentChange: percentDiff(cur.runCount, prev.runCount) },
    build("Distância", cur.distance, prev.distance, "m", sum),
    build("Tempo", cur.duration, prev.duration, "s", sum),
    build("Elevação", cur.elevation, prev.elevation, "m", sum),
    build("FC Média", cur.hr, prev.hr, "bpm", average, 0),
  ];
}
