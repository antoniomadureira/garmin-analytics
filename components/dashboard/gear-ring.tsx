"use client";

import { useState } from "react";

const MAX_KM = 700; // [Suposição] limiar comum de substituição de calçado, ajustável por equipamento no futuro

/** [Certo] Interpolação de cor por troços: verde até 50%, amarelo até 75%, laranja até 90%, vermelho daí para cima. */
function colorForPct(pct: number): string {
  if (pct < 50) return "#34d399"; // verde
  if (pct < 75) return "#fbbf24"; // amarelo
  if (pct < 90) return "#fb923c"; // laranja
  return "#f87171"; // vermelho
}

export function GearRing({
  gearId,
  name,
  distanceKm,
  retired,
  priceEur,
  onSavePrice,
}: {
  gearId: string;
  name: string;
  distanceKm: number;
  retired: boolean;
  priceEur: number | null;
  onSavePrice: (gearId: string, priceEur: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(priceEur?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const pct = Math.min(100, Math.round((distanceKm / MAX_KM) * 100));
  const color = colorForPct(pct);
  const costPerKm = priceEur && distanceKm > 0 ? priceEur / distanceKm : null;

  async function handleSave() {
    const value = parseFloat(inputValue.replace(",", "."));
    if (isNaN(value) || value <= 0) return;
    setSaving(true);
    try {
      await onSavePrice(gearId, value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/40 p-4 ${retired ? "opacity-60" : ""}`}>
      <div className="mb-3 flex items-center justify-center">
        <div
          className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, #1e293b 0deg)` }}
        >
          <div className="flex h-[94px] w-[94px] flex-col items-center justify-center rounded-full bg-slate-950">
            <span className="text-2xl font-bold leading-none" style={{ color }}>
              {pct}%
            </span>
            <span className="mt-1 text-[10px] text-slate-500">de {MAX_KM}km</span>
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="truncate text-sm font-medium text-slate-200">{name}</div>
        <div className="mt-0.5 text-lg font-semibold text-slate-100">{distanceKm.toLocaleString("pt-PT")} km</div>
      </div>

      <div className="mt-3 border-t border-slate-800 pt-2 text-center">
        {editing ? (
          <div className="flex items-center justify-center gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="€"
              className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center text-xs text-slate-200"
              autoFocus
            />
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-cyan-600 px-2 py-1 text-xs text-white hover:bg-cyan-500 disabled:opacity-50">
              ✓
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-300">
              ✕
            </button>
          </div>
        ) : costPerKm !== null ? (
          <div className="flex items-center justify-center gap-1.5 text-xs">
            <span className="font-medium text-cyan-400">{costPerKm.toFixed(3)}€/km</span>
            <span className="text-slate-600">({priceEur}€)</span>
            <button
              onClick={() => {
                setInputValue(priceEur?.toString() ?? "");
                setEditing(true);
              }}
              className="text-slate-500 hover:text-cyan-400"
              title="Editar preço"
            >
              ✎
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-slate-500 underline-offset-2 hover:text-cyan-400 hover:underline">
            + adicionar preço de compra
          </button>
        )}
      </div>
    </div>
  );
}
