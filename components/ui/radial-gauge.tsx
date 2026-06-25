export interface GaugeZone {
  from: number; // 0-100
  to: number;
  color: string;
}

/**
 * Gauge radial em arco (não círculo completo) — inspirado no padrão visual
 * do Garmin Connect (arco com zonas coloridas + ponteiro), mas dimensionado
 * para caber num card responsivo em vez de um espaço fixo de app nativa.
 */
export function RadialGauge({
  value,
  size = 96,
  zones,
}: {
  value: number; // 0-100
  size?: number;
  zones: GaugeZone[];
}) {
  const strokeWidth = size * 0.07;
  const radius = size / 2 - strokeWidth - 2;
  const center = size / 2;

  // arco de 270° (de -225° a +45°, deixando 90° em baixo livre para o valor)
  const startAngle = -225;
  const endAngle = 45;
  const totalAngle = endAngle - startAngle;

  function angleFor(pct: number) {
    return startAngle + (pct / 100) * totalAngle;
  }

  function pointOn(angleDeg: number, r: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad),
    };
  }

  function arcPath(fromPct: number, toPct: number) {
    const a1 = angleFor(fromPct);
    const a2 = angleFor(toPct);
    const p1 = pointOn(a1, radius);
    const p2 = pointOn(a2, radius);
    const largeArc = a2 - a1 > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
  }

  const pointerAngle = angleFor(value);
  const pointerPos = pointOn(pointerAngle, radius);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {zones.map((zone, i) => (
        <path
          key={i}
          d={arcPath(zone.from, zone.to)}
          fill="none"
          stroke={zone.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ))}
      <circle cx={pointerPos.x} cy={pointerPos.y} r={strokeWidth * 0.55} fill="#f1f5f9" />
      <text
        x={center}
        y={center + size * 0.04}
        textAnchor="middle"
        className="fill-slate-100"
        fontSize={size * 0.24}
        fontWeight={500}
      >
        {Math.round(value)}
      </text>
    </svg>
  );
}
