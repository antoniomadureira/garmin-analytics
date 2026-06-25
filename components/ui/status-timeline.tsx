export interface TimelineSegment {
  label: string; // ex: "Productive", "Maintaining"
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  Productive: "#34d399",
  Peaking: "#22d3ee",
  Maintaining: "#fbbf24",
  Overreaching: "#fb923c",
  Recovery: "#60a5fa",
  Detraining: "#f87171",
  "No Status": "#475569",
};

export function StatusTimeline({
  segments,
  rangeLabel,
  sinceLabel,
}: {
  segments: TimelineSegment[];
  rangeLabel: string; // ex: "Last 4w"
  sinceLabel: string; // ex: "Since Jun 21"
}) {
  return (
    <div>
      <div className="flex h-1.5 gap-[3px] overflow-hidden">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="h-full flex-1 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[seg.label] ?? seg.color }}
            title={seg.label}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
        <span>{rangeLabel}</span>
        <span>{sinceLabel}</span>
      </div>
    </div>
  );
}
