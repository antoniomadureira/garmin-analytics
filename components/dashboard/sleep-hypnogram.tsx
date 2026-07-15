"use client";

import type { SleepPhaseBlock } from "@/lib/analysis/sleep-phases";

const PHASE_COLOR: Record<SleepPhaseBlock["phase"], string> = {
  deep: "#3b82f6",
  rem: "#a78bfa",
  light: "#64748b",
  awake: "#f59e0b",
};

const PHASE_LABEL: Record<SleepPhaseBlock["phase"], string> = {
  deep: "Profundo",
  rem: "REM",
  light: "Leve",
  awake: "Acordado",
};

const PHASE_TOOLTIP: Record<SleepPhaseBlock["phase"], string> = {
  deep: "Sono profundo (N3) — restaura músculo e sistema imunitário; ocorre principalmente nas primeiras 3h. Prejudicado por álcool, horário irregular e temperatura alta.",
  rem: "REM — consolida memória e processa emoções; concentra-se no fim da noite. Prejudicado por álcool, alarme precoce e ansiedade.",
  light: "Sono leve (N1/N2) — fase de transição; mais fácil de interromper. Normal ser a fase mais longa.",
  awake: "Acordado — alguns minutos são normais; mais de 45min total por noite é sinal de atenção.",
};

const LEGEND_PHASES: SleepPhaseBlock["phase"][] = ["deep", "rem", "light", "awake"];

function fmtHours(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export function SleepHypnogram({ blocks }: { blocks: SleepPhaseBlock[] }) {
  const totalSec = blocks.reduce((max, b) => Math.max(max, b.startOffsetSec + b.durationSec), 0);
  if (totalSec === 0) return null;

  // Time axis ticks every 3600s (1h), up to total duration
  const tickCount = Math.floor(totalSec / 3600) + 1;
  const ticks = Array.from({ length: tickCount }, (_, i) => i * 3600);

  const BAR_H = 36;
  const LABEL_Y = BAR_H + 18;
  const SVG_H = BAR_H + 28;

  return (
    <div>
      <svg
        viewBox={`0 0 1000 ${SVG_H}`}
        style={{ width: "100%", display: "block" }}
        aria-label="Hipnograma da última noite"
      >
        {/* Phase blocks */}
        {blocks.map((b, i) => {
          const x = (b.startOffsetSec / totalSec) * 1000;
          const w = Math.max((b.durationSec / totalSec) * 1000, 1);
          return (
            <rect
              key={i}
              x={x}
              y={0}
              width={w}
              height={BAR_H}
              fill={PHASE_COLOR[b.phase]}
              rx={1}
            />
          );
        })}
        {/* Time axis ticks and labels */}
        {ticks.map((sec) => {
          const x = (sec / totalSec) * 1000;
          return (
            <g key={sec}>
              <line x1={x} y1={BAR_H} x2={x} y2={BAR_H + 4} stroke="#334155" strokeWidth={1} />
              <text
                x={x}
                y={LABEL_Y}
                textAnchor="middle"
                fontSize={10}
                fill="#64748b"
                fontFamily="sans-serif"
              >
                {fmtHours(sec)}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Legend — tooltips via title (cursor-help indica que há informação extra) */}
      <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-400">
        {LEGEND_PHASES.map((phase) => (
          <span
            key={phase}
            className="flex cursor-help items-center gap-1.5"
            title={PHASE_TOOLTIP[phase]}
          >
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ backgroundColor: PHASE_COLOR[phase] }}
            />
            {PHASE_LABEL[phase]}
          </span>
        ))}
      </div>
      {/* Nota de humildade — atigrafia tem concordância modesta com polissonografia */}
      <p className="mt-2 text-[10px] text-slate-600">
        Fases estimadas pelo relógio — margem de erro significativa; valoriza tendências, não noites isoladas.
      </p>
    </div>
  );
}
