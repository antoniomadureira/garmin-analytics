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

  async getRacePredictions(): Promise<RacePredictionSummary> {
    const raw = await this.client.queryMetrics({
      metrics: Object.values(RacePredictionMetrics),
      days: 1,
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
  }> {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText.");
    }
    const scalarText = await this.client.queryRawText({
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
    const distanceM = extractValuesByDate(scalarText, RunActivityMetrics.distanceM).get(date)?.[0] ?? 0;
    const durationSec = extractValuesByDate(scalarText, RunActivityMetrics.durationSec).get(date)?.[0] ?? 0;
    const avgHr = extractValuesByDate(scalarText, RunActivityMetrics.avgHr).get(date)?.[0] ?? null;
    const maxHr = extractValuesByDate(scalarText, RunActivityMetrics.maxHr).get(date)?.[0] ?? null;
    const elevationGainM = extractValuesByDate(scalarText, RunActivityMetrics.elevationGainM).get(date)?.[0] ?? null;
    const caloriesKcal = extractValuesByDate(scalarText, RunActivityMetrics.activeKcal).get(date)?.[0] ?? null;

    const samplesResult = await this.client.queryMetrics({
      metrics: [RunActivityMetrics.samples],
      start: date,
      end: date,
      includeRaw: true,
    });
    const samples = samplesResult[date] as ActivityDetailSamplesRaw | undefined;

    const route: [number, number][] = [];
    const series: { distanceKm: number; hr: number | null; altitude: number | null; paceMinPerKm: number | null; cadence: number | null }[] = [];

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
  async getDailyTrend(): Promise<{ date: string; distanceKm: number; durationH: number; caloriesKcal: number }[]> {
    if (!this.client.queryRawText) {
      throw new Error("Este client não implementa queryRawText — necessário para a tendência diária.");
    }
    const end = new Date();
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const [summarizedText, recentText] = await Promise.all([
      this.client.queryRawText({
        metrics: [SummarizedActivityMetrics.distanceM, SummarizedActivityMetrics.durationSec, SummarizedActivityMetrics.calories],
        start: startStr,
        end: endStr,
      }),
      this.client.queryRawText({
        metrics: [RunActivityMetrics.distanceM, RunActivityMetrics.durationSec, RunActivityMetrics.activeKcal],
        start: startStr,
        end: endStr,
      }),
    ]);

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
