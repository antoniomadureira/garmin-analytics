#!/usr/bin/env npx tsx
/**
 * tools/analyze-history.ts
 * Inventário do histórico Strava (export CSV oficial).
 * Uso: npx tsx tools/analyze-history.ts [path/to/activities.csv]
 * Output: markdown para stdout.
 */
import { readFileSync } from "fs";

// ─── CSV parser ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

// ─── Date helpers ───────────────────────────────────────────────────────────

const MON: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseDate(s: string): Date | null {
  // "Jul 22, 2026, 6:03:08 PM"
  const m = s.match(/^(\w{3})\s+(\d+),\s*(\d{4})/);
  if (!m || MON[m[1]] === undefined) return null;
  return new Date(+m[3], MON[m[1]], +m[2]);
}

function isoWeekMon(d: Date): string {
  const date = new Date(d);
  const offset = (date.getDay() + 6) % 7; // Mon=0
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
}

function fmtPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function fmtDist(m: number): string {
  return (m / 1000).toFixed(2) + " km";
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const mn = Math.floor((sec % 3600) / 60);
  const ss = Math.floor(sec % 60);
  if (h > 0) return `${h}h${String(mn).padStart(2, "0")}m`;
  return `${mn}:${String(ss).padStart(2, "0")}`;
}

// ─── Column indices (0-based) in Strava export ──────────────────────────────
// Verified against: Activity ID (0), Activity Date (1), Activity Name (2),
// Activity Type (3), …, Moving Time (16), Distance/m (17), Elevation Gain (20),
// Average Cadence (29), Average Heart Rate (31), Average Watts (33),
// Training Load (88), Competition (95)

const C = {
  DATE:      1,
  NAME:      2,
  TYPE:      3,
  MOVE_SEC:  16,
  DIST_M:    17,
  ELEV_M:    20,
  CADENCE:   29,
  HR:        31,
  WATTS:     33,
  TL:        88,
  COMP:      95,
} as const;

// ─── Activity model ──────────────────────────────────────────────────────────

interface Act {
  date:   Date;
  year:   number;
  week:   string;       // YYYY-MM-DD of ISO Monday
  name:   string;
  type:   string;
  sec:    number;       // moving time
  distM:  number;
  elevM:  number;
  hr:     number | null;
  cad:    number | null;
  watts:  number | null;
  tl:     number | null;
  comp:   boolean;
}

function numOrNull(v: string): number | null {
  const n = parseFloat(v);
  return isFinite(n) && n > 0 ? n : null;
}

// ─── Load & parse ────────────────────────────────────────────────────────────

const csvPath = process.argv[2] ?? "tests/activities/strava/activities.csv";
const lines = readFileSync(csvPath, "utf-8").split("\n").filter(l => l.trim());

const [_header, ...dataLines] = lines;

const all: Act[] = [];
for (const line of dataLines) {
  const f = parseCSVLine(line);
  if (f.length < 96) continue;
  const date = parseDate(f[C.DATE]);
  if (!date) continue;
  const sec   = parseFloat(f[C.MOVE_SEC]) || 0;
  const distM = parseFloat(f[C.DIST_M])   || 0;
  if (sec <= 0 || distM <= 0) continue;
  all.push({
    date,
    year: date.getFullYear(),
    week: isoWeekMon(date),
    name: f[C.NAME],
    type: f[C.TYPE],
    sec,
    distM,
    elevM:  parseFloat(f[C.ELEV_M])  || 0,
    hr:     numOrNull(f[C.HR]),
    cad:    numOrNull(f[C.CADENCE]),
    watts:  numOrNull(f[C.WATTS]),
    tl:     numOrNull(f[C.TL]),
    comp:   f[C.COMP] === "1" || f[C.COMP] === "1.0" || f[C.COMP].toLowerCase() === "true",
  });
}

all.sort((a, b) => a.date.getTime() - b.date.getTime());
const runs = all.filter(a => a.type === "Run");

const years   = [...new Set(all.map(a => a.year))].sort();
const runYrs  = [...new Set(runs.map(a => a.year))].sort();

// ─── Section 1: total por ano ────────────────────────────────────────────────

const byYear = new Map<number, { total: number; runs: number; otherTypes: Set<string> }>();
for (const a of all) {
  const y = byYear.get(a.year) ?? { total: 0, runs: 0, otherTypes: new Set() };
  y.total++;
  if (a.type === "Run") y.runs++;
  else y.otherTypes.add(a.type);
  byYear.set(a.year, y);
}

// ─── Section 2: cobertura de FC ──────────────────────────────────────────────

const hrByYear = new Map<number, { total: number; withHr: number }>();
for (const r of runs) {
  const y = hrByYear.get(r.year) ?? { total: 0, withHr: 0 };
  y.total++;
  if (r.hr !== null) y.withHr++;
  hrByYear.set(r.year, y);
}

// ─── Section 3: volume semanal ───────────────────────────────────────────────

const weekMap = new Map<string, number>(); // week -> km
for (const r of runs) {
  weekMap.set(r.week, (weekMap.get(r.week) ?? 0) + r.distM / 1000);
}

const allWeeks = [...weekMap.keys()].sort();
const firstWeek = allWeeks[0];
const lastWeek  = allWeeks[allWeeks.length - 1];

// Enumerate all calendar weeks in the range to find gaps
function addWeeks(isoMon: string, n: number): string {
  const d = new Date(isoMon + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

const gaps: { start: string; end: string; weeks: number }[] = [];
let gapStart: string | null = null;
let cur = firstWeek;
while (cur <= lastWeek) {
  const hasData = weekMap.has(cur);
  if (!hasData && gapStart === null) gapStart = cur;
  if (hasData && gapStart !== null) {
    // compute length of gap in weeks
    const d1 = new Date(gapStart + "T00:00:00Z");
    const d2 = new Date(cur + "T00:00:00Z");
    const weeks = Math.round((d2.getTime() - d1.getTime()) / (7 * 86400_000));
    gaps.push({ start: gapStart, end: addWeeks(cur, -1), weeks });
    gapStart = null;
  }
  cur = addWeeks(cur, 1);
}
if (gapStart !== null) {
  const d1 = new Date(gapStart + "T00:00:00Z");
  const d2 = new Date(lastWeek + "T00:00:00Z");
  const weeks = Math.round((d2.getTime() - d1.getTime()) / (7 * 86400_000));
  gaps.push({ start: gapStart, end: lastWeek, weeks });
}

// Weekly km stats per year
const weekByYear = new Map<number, number[]>();
for (const [wk, km] of weekMap) {
  const yr = parseInt(wk.slice(0, 4));
  const arr = weekByYear.get(yr) ?? [];
  arr.push(km);
  weekByYear.set(yr, arr);
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}
function sum(arr: number[]): number { return arr.reduce((a, b) => a + b, 0); }

// ─── Section 4: candidatos a performance ────────────────────────────────────

const RACE_KW = [
  "race", "prova", "maratona", "marathon", "10k", "5k", "meia", "half",
  "10 km", "5 km", "21k", "42k", "cross", "trail race", "campeonato",
  "championship", "ekiden", "competição", "xc "
];

function isRaceName(name: string): boolean {
  const l = name.toLowerCase();
  return RACE_KW.some(kw => l.includes(kw));
}

// Yearly median pace (sec/km) for runs ≥ 5 km
const yearlyMedianPace = new Map<number, number>();
for (const yr of runYrs) {
  const paces = runs
    .filter(r => r.year === yr && r.distM >= 5000)
    .map(r => (r.sec / r.distM) * 1000);
  if (paces.length > 0) yearlyMedianPace.set(yr, median(paces));
}

const raceCandidates = runs.filter(r => {
  if (r.distM < 3000) return false;
  const nameMatch = isRaceName(r.name) || r.comp;
  const pace = (r.sec / r.distM) * 1000;
  const med = yearlyMedianPace.get(r.year);
  const paceMatch = med ? pace < med * 0.87 : false; // >13% faster than yearly median
  return nameMatch || paceMatch;
});

raceCandidates.sort((a, b) => a.date.getTime() - b.date.getTime());

// ─── Section 5: campos disponíveis por ano ───────────────────────────────────

const fieldsByYear = new Map<number, {
  hrPct: number; cadPct: number; wattsPct: number; elevPct: number; tlPct: number;
}>();
for (const yr of runYrs) {
  const yrRuns = runs.filter(r => r.year === yr);
  const n = yrRuns.length;
  if (n === 0) continue;
  const pct = (fn: (r: Act) => boolean) => Math.round(yrRuns.filter(fn).length / n * 100);
  fieldsByYear.set(yr, {
    hrPct:   pct(r => r.hr !== null),
    cadPct:  pct(r => r.cad !== null),
    wattsPct:pct(r => r.watts !== null),
    elevPct: pct(r => r.elevM > 0),
    tlPct:   pct(r => r.tl !== null),
  });
}

// ─── Output ─────────────────────────────────────────────────────────────────

const out: string[] = [];
const L = (s: string) => out.push(s);

L("# Inventário do Histórico Strava");
L("");
L(`Ficheiro: \`${csvPath}\`  `);
L(`Total de atividades: **${all.length}** | Corridas: **${runs.length}**  `);
L(`Período: **${firstWeek}** → **${lastWeek}**`);
L("");

// --- 1 ---
L("## 1. Atividades por Ano");
L("");
L("| Ano | Total | Corridas | Outros tipos |");
L("|----:|------:|---------:|--------------|");
for (const yr of years) {
  const d = byYear.get(yr)!;
  const others = [...d.otherTypes].join(", ") || "—";
  L(`| ${yr} | ${d.total} | ${d.runs} | ${others} |`);
}
L("");

// --- 2 ---
L("## 2. Cobertura de FC por Ano (corridas)");
L("");
L("| Ano | Com FC | Total corridas | % FC |");
L("|----:|-------:|---------------:|-----:|");
for (const yr of runYrs) {
  const d = hrByYear.get(yr)!;
  const pct = d.total > 0 ? Math.round(d.withHr / d.total * 100) : 0;
  L(`| ${yr} | ${d.withHr} | ${d.total} | ${pct}% |`);
}
L("");
// Find first year with ≥80% FC coverage
const firstGoodHr = runYrs.find(yr => {
  const d = hrByYear.get(yr)!;
  return d.total > 0 && d.withHr / d.total >= 0.80;
});
if (firstGoodHr) L(`> FC consistente (≥ 80%) a partir de **${firstGoodHr}**.`);
L("");

// --- 3 ---
L("## 3. Volume Semanal — Série Completa");
L("");
L("### Por ano (semanas com dados)");
L("");
L("| Ano | Semanas c/ dados | km total | km/semana mediano | km/semana máx |");
L("|----:|-----------------:|---------:|------------------:|--------------:|");
for (const yr of runYrs) {
  const kms = weekByYear.get(yr) ?? [];
  if (kms.length === 0) continue;
  L(`| ${yr} | ${kms.length} | ${sum(kms).toFixed(0)} | ${median(kms).toFixed(0)} | ${Math.max(...kms).toFixed(0)} |`);
}
L("");

if (gaps.length === 0) {
  L("Sem lacunas na série — todas as semanas do período têm pelo menos uma corrida.");
} else {
  L(`### Lacunas (${gaps.length} bloco(s) sem corridas)`);
  L("");
  L("| Início | Fim | Semanas |");
  L("|--------|-----|--------:|");
  for (const g of gaps) {
    L(`| ${g.start} | ${g.end} | ${g.weeks} |`);
  }
}
L("");

// --- 4 ---
L("## 4. Candidatos a Performance Datada");
L("");
if (raceCandidates.length === 0) {
  L("Nenhum candidato encontrado com os critérios actuais.");
} else {
  L(`Total: **${raceCandidates.length}** candidatos (keyword no nome OU Strava "Competition" OU pace >13% abaixo da mediana anual)`);
  L("");
  L("| Data | Nome | Dist | Tempo | Pace | Detecção |");
  L("|------|------|-----:|------:|-----:|----------|");
  for (const r of raceCandidates) {
    const pace = (r.sec / r.distM) * 1000;
    const dateStr = r.date.toISOString().slice(0, 10);
    const flags: string[] = [];
    if (isRaceName(r.name)) flags.push("keyword");
    if (r.comp) flags.push("competition");
    const med = yearlyMedianPace.get(r.year);
    if (med && pace < med * 0.87) flags.push(`pace ${fmtPace(pace)} vs med ${fmtPace(med)}`);
    L(`| ${dateStr} | ${r.name.slice(0, 45)} | ${fmtDist(r.distM)} | ${fmtTime(r.sec)} | ${fmtPace(pace)} | ${flags.join(", ")} |`);
  }
}
L("");

// --- 5 ---
L("## 5. Campos Disponíveis por Ano (corridas)");
L("");
L("Percentagem de corridas com o campo preenchido.");
L("");
L("| Ano | FC | Cadência | Potência | Elevação | Training Load |");
L("|----:|---:|---------:|---------:|---------:|--------------:|");
for (const yr of runYrs) {
  const f = fieldsByYear.get(yr);
  if (!f) continue;
  L(`| ${yr} | ${f.hrPct}% | ${f.cadPct}% | ${f.wattsPct}% | ${f.elevPct}% | ${f.tlPct}% |`);
}
L("");
L("> **Potência** = Stryd ou pedal meter — só aparece quando sensor foi usado.");
L("> **Training Load** = calculado pelo Strava a partir dos dados do aparelho.");

// --- print ---
console.log(out.join("\n"));
