export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-xl border border-slate-800 bg-slate-900/40"
      style={{ height }}
    />
  );
}
