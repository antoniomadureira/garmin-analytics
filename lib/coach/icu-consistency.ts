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
  /**
   * True se algum step usa notação de zona de pace ("Zx Pace") sem valores
   * numéricos — resolve como pace null-null no Garmin quando as zonas ICU
   * não estão configuradas. Exigir sempre "MM:SS-MM:SS/km Pace".
   */
  hasZonePace: boolean;
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
  /**
   * True se o bloco ICU tem repetições (Nx). Implica aviso de sync Garmin:
   * workouts com Nx chegam ao relógio como nota de texto, não como steps.
   * [Certo] Limitação confirmada: forum.intervals.icu/t/124473 e /t/130465
   */
  hasIntervals: boolean;
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
  let hasZonePace = false;
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
    // Zone-pace detection: "Zx Pace" without numeric values (e.g. "Z1 Pace", "Z2 Pace")
    if (/\bZ\d+(?:-Z\d+)?\s+Pace\b/i.test(content) && !/\d+:\d+.*\/km\s+Pace/i.test(content)) {
      hasZonePace = true;
    }

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
    hasZonePace,
  };
}

/**
 * Extrai a distância total do texto (parte markdown), distinguindo entre
 * um total narrativo e uma lista de secções (Aquecimento + Principal + Arrefecimento).
 *
 * Estratégia:
 * 1. Ignora linhas 📊/→ (referem o treino ANTERIOR).
 * 2. Separa linhas de cabeçalho de secção ("**Label:**") das linhas de prosa.
 * 3. Se há menção ≥ 3km na prosa → é o total narrativo; usa-o (comportamento anterior).
 * 4. Sem total narrativo: soma os km encontrados nos cabeçalhos de secção (≥ 2
 *    cabeçalhos com km), que correspondem a Aquecimento + Principal + Arrefecimento.
 * 5. Sem dados suficientes → null (unverifiable em checkIcuConsistency).
 *
 * Evita falso positivo quando o coach lista secções sem mencionar o total:
 * "**Aquecimento:** 2km / **Principal:** 8km / **Arrefecimento:** 1.5km" → 11.5km.
 */
export function extractTextTotalDistance(text: string): number | null {
  const bodyLines = text
    .split("\n")
    .filter((l) => !l.startsWith("📊") && !l.startsWith("→"));

  // Section-header lines: "**Label:** content" — bold label followed by colon
  const isHeaderLine = (l: string) => /^\*\*[^*]+:\*\*/.test(l.trim());
  const paragraphText = bodyLines.filter((l) => !isHeaderLine(l)).join("\n");
  const headerText = bodyLines.filter(isHeaderLine).join("\n");

  // Step 3: narrative total in prose (first km mention ≥ 3km outside section headers)
  const proseMentions = [...paragraphText.matchAll(/(\d+(?:[.,]\d+)?)\s*km\b/gi)]
    .map((m) => parseFloat(m[1].replace(",", ".")))
    .filter((v) => v >= 3);
  if (proseMentions.length > 0) return proseMentions[0];

  // Step 4: sum of section-header km values (require ≥ 2 to be confident)
  const sectionValues = [...headerText.matchAll(/(\d+(?:[.,]\d+)?)\s*km\b/gi)]
    .map((m) => parseFloat(m[1].replace(",", ".")))
    .filter((v) => v >= 0.5);
  if (sectionValues.length >= 2) {
    return Math.round(sectionValues.reduce((a, b) => a + b, 0) * 100) / 100;
  }

  return null;
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

  if (stats.hasZonePace) {
    warnings.push("step usa zona de pace 'Zx Pace' sem valores numéricos — o Garmin mostrará null-null se as zonas ICU não estiverem definidas; usa MM:SS-MM:SS/km Pace");
  }

  // Unverifiable: ICU has explicit distance but text gave us nothing to compare against
  const unverifiable = stats.totalDistanceKm > 0 && textDistanceKm === null && warnings.length === 0;

  return {
    warning: warnings.length > 0 ? warnings.join("; ") : null,
    unverifiable,
    textDistanceKm,
    icuDistanceKm: stats.totalDistanceKm,
    hasIntervals: stats.hasIntervals,
  };
}
