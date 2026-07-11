interface TrendDeltaProps {
  current: number;
  previous: number;
  comparisonLabel?: string;
}

export function TrendDelta({
  current,
  previous,
  comparisonLabel = "vs previous week",
}: TrendDeltaProps) {
  if (previous === 0) {
    return (
      <span className="text-xs text-slate-400">
        {current > 0 ? `no data for previous period` : "—"}
      </span>
    );
  }
  const pct = Math.round((current / previous - 1) * 100);
  const tone =
    pct > 0 ? "text-emerald-600" : pct < 0 ? "text-red-600" : "text-slate-500";
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "＝";
  return (
    <span className="text-xs">
      <span className={`font-medium ${tone}`}>
        {arrow} {pct > 0 ? "+" : ""}
        {pct}%
      </span>{" "}
      <span className="text-slate-400">
        {comparisonLabel} ({previous.toLocaleString()})
      </span>
    </span>
  );
}
