/**
 * Valida consistência entre a parte textual da resposta do coach e o
 * bloco ICU estruturado. Detecta discrepâncias de distância e
 * recuperações espúrias em treinos contínuos.
 */

export interface IcuBlockStats {
  /** Soma de todos os passos de distância × repetições (km) */
  totalDistanceKm: number;
  /** Soma de todos os passos de duração × repetições (min) */
  totalDurationMin: number;
  /** True se há blocos de repetição ("Nx" lines) */
  hasIntervals: boolean;
  /** True se há secção "Recuperação/Recovery" fora de um bloco de repetição */
  hasSpuriousRecovery: boolean;
  /**
   * True se o bloco mistura steps com target "Pace" e steps com target "HR"
   * no mesmo workout — o Garmin só processa um tipo de target e apaga ambos.
   * [Certo] Limitação confirmada: forum.intervals.icu/t/syncing-pace-hr-targets-to-garmin/130238
   */
  hasMixedMetrics: boolean;
}

export interface ConsistencyResult {
  warning: string | null;
  /**
   * True quando o ICU tem distância explícita mas o texto não menciona
   * nenhuma distância extraível — verificação impossível, não é "sem problemas".
   */
  unverifiable: boolean;
  textDistanceKm: number | null;
  icuDistanceKm: number;
}

/** Extrai estatísticas do bloco ICU (o campo description dentro das tags). */
export function parseIcuBlockStats(description: string): IcuBlockStats {
  const lines = description.split("\n");
  let totalDistanceKm = 0;
  let totalDurationMin = 0;
  let hasIntervals = false;
  let hasSpuriousRecovery = false;
  let hasHrStep = false;
  let hasPaceStep = false;
  let currentReps = 1;
  let inRepBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") continue;

    // Repetition header: "6x" alone on a line
    const repsMatch = line.match(/^(\d+)x\s*$/);
    if (repsMatch) {
      currentReps = parseInt(repsMatch[1]);
      inRepBlock = true;
      hasIntervals = true;
      continue;
    }

    // Section header (non-indented, non-step line) → reset rep block
    if (!line.startsWith("-")) {
      if (inRepBlock) {
        currentReps = 1;
        inRepBlock = false;
      }
      // Recovery section outside a rep block = spurious in continuous workouts
      if (/^(recupera[çc][aã]o|recovery|rest|descanso)\s*$/i.test(line)) {
        hasSpuriousRecovery = true;
      }
      continue;
    }

    const content = line.slice(1).trim();

    // Mixed-metrics detection: HR vs Pace targets on step lines
    if (/\bHR\b/i.test(content)) hasHrStep = true;
    if (/\bPace\b/i.test(content)) hasPaceStep = true;

    // Distance steps: "10km", "800mtr"
    const kmMatch = content.match(/^(\d+(?:\.\d+)?)\s*km\b/i);
    const mtrMatch = content.match(/^(\d+(?:\.\d+)?)\s*mtr\b/i);
    if (kmMatch) {
      totalDistanceKm += parseFloat(kmMatch[1]) * currentReps;
    } else if (mtrMatch) {
      totalDistanceKm += (parseFloat(mtrMatch[1]) / 1000) * currentReps;
    }

    // Duration steps: "15min"
    const minMatch = content.match(/^(\d+(?:\.\d+)?)\s*min\b/i);
    if (minMatch) {
      totalDurationMin += parseFloat(minMatch[1]) * currentReps;
    }
  }

  return {
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    totalDurationMin: Math.round(totalDurationMin * 10) / 10,
    hasIntervals,
    // Spurious = recovery section AND no intervals anywhere in the block
    hasSpuriousRecovery: hasSpuriousRecovery && !hasIntervals,
    hasMixedMetrics: hasHrStep && hasPaceStep,
  };
}

/**
 * Extrai a primeira menção de distância >= 3km do texto (parte markdown).
 * Ignora as linhas 📊/→ (referem o treino ANTERIOR, não o prescrito).
 * Aceita "13.5km", "13,5 km", etc. Ignora valores < 3km (passos individuais).
 */
export function extractTextTotalDistance(text: string): number | null {
  // Skip the 📊 history header and → ajuste line — they mention the last workout distance
  const body = text
    .split("\n")
    .filter((l) => !l.startsWith("📊") && !l.startsWith("→"))
    .join("\n");
  const matches = [...body.matchAll(/(\d+(?:[.,]\d+)?)\s*km\b/gi)];
  const values = matches.map((m) => parseFloat(m[1].replace(",", ".")));
  return values.find((v) => v >= 3) ?? null;
}

/**
 * Compara o texto markdown do coach com o bloco ICU estruturado.
 * Threshold: >20% de diferença E >=1km absoluto → warning.
 */
export function checkIcuConsistency(textPart: string, icuDescription: string): ConsistencyResult {
  const stats = parseIcuBlockStats(icuDescription);
  const textDistanceKm = extractTextTotalDistance(textPart);

  const warnings: string[] = [];

  if (stats.totalDistanceKm > 0 && textDistanceKm !== null) {
    const delta = Math.abs(textDistanceKm - stats.totalDistanceKm);
    const pct = delta / textDistanceKm;
    if (pct > 0.2 && delta >= 1.0) {
      warnings.push(
        `texto menciona ${textDistanceKm.toFixed(1)}km mas bloco ICU soma ${stats.totalDistanceKm.toFixed(1)}km (Δ${delta.toFixed(1)}km, ${Math.round(pct * 100)}%)`,
      );
    }
  }

  if (stats.hasSpuriousRecovery) {
    warnings.push("bloco ICU tem secção Recuperação/Recovery num treino contínuo (sem repetições)");
  }

  if (stats.hasMixedMetrics) {
    warnings.push("workout mistura targets de Pace e de HR — o Garmin só processa um tipo; usa Pace em todos os steps");
  }

  // Unverifiable: ICU has explicit distance but text gave us nothing to compare against
  const unverifiable = stats.totalDistanceKm > 0 && textDistanceKm === null && warnings.length === 0;

  return {
    warning: warnings.length > 0 ? warnings.join("; ") : null,
    unverifiable,
    textDistanceKm,
    icuDistanceKm: stats.totalDistanceKm,
  };
}
