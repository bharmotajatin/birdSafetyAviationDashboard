"use client";

type RadialChartLegendProps = {
  labels: string[];
  values: number[];
  colors: string[];
  /** Default grid (compact). Use "wrap" for Pan India incident-types pie only. */
  variant?: "grid" | "wrap";
};

export function RadialChartLegend({
  labels,
  values,
  colors,
  variant = "grid",
}: RadialChartLegendProps) {
  const total = values.reduce((sum, v) => sum + (Number(v) || 0), 0) || 1;

  if (variant === "wrap") {
    return (
      <div className="mt-3 flex flex-wrap justify-center gap-2 px-1">
        {labels.map((label, index) => {
          const count = values[index] ?? 0;
          const pct = Math.round((count / total) * 1000) / 10;
          return (
            <span
              key={`${label}-${index}`}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs"
              style={{
                borderColor: "var(--legend-chip-border)",
                backgroundColor: "var(--legend-chip-bg)",
              }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: colors[index] }}
                aria-hidden
              />
              <span className="font-medium theme-text-secondary">{label}</span>
              <span className="theme-text-muted">{count}</span>
              <span className="font-medium text-[var(--brand-gold)]">{pct}%</span>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-2 gap-1.5 px-0.5 sm:grid-cols-3 sm:gap-2">
      {labels.map((label, index) => {
        const count = values[index] ?? 0;
        const pct = Math.round((count / total) * 1000) / 10;
        return (
          <span
            key={`${label}-${index}`}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] sm:gap-2 sm:px-2.5 sm:py-1 sm:text-xs"
            style={{
              borderColor: "var(--legend-chip-border)",
              backgroundColor: "var(--legend-chip-bg)",
            }}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: colors[index] }}
              aria-hidden
            />
            <span className="min-w-0 truncate font-medium theme-text-secondary">{label}</span>
            <span className="tabular-nums theme-text-muted">{count}</span>
            <span className="tabular-nums font-medium text-[var(--brand-gold)]">
              {pct}%
            </span>
          </span>
        );
      })}
    </div>
  );
}
