"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bar, Chart, Doughnut, Line, Pie, Radar, Scatter } from "react-chartjs-2";
import { RadialChartLegend } from "@/components/charts/ChartLegend";
import {
  buildCartesianBarOptions,
  buildChartDefaults,
  buildDataLabelStyles,
  buildNonZeroBarDataLabels,
  buildRadialChartOptions,
  buildRadarChartOptions,
  buildTooltipOnlyChartOptions,
  useChartTheme,
  type ChartTheme,
} from "@/lib/chart-theme";
import { buildTreemapNodes } from "@/lib/treemap-theme";
import type { Context } from "chartjs-plugin-datalabels";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COLORS,
  CHART_PALETTE,
  STATUS_BREAKDOWN_ORDER,
  STATUS_COLORS,
} from "@/lib/constants";
import { EmptyState } from "@/components/ui/dashboard-primitives";

export { TreemapChart } from "@/components/charts/TreemapChart";

function hasChartData(values: number[]) {
  return values.length > 0 && values.some((v) => v > 0);
}

function ChartSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("chart-surface h-full w-full", className)}>{children}</div>
  );
}

function defaultRadialChartSize(
  labelCount: number,
  containerHeight?: number,
  legendVariant: "grid" | "wrap" = "grid",
) {
  const compact =
    labelCount > 8 ? 96 : labelCount > 6 ? 108 : labelCount > 4 ? 118 : 132;

  if (!containerHeight || containerHeight < 200) return compact;

  const cols = legendVariant === "wrap" ? 4 : 3;
  const legendRows = Math.ceil(labelCount / cols);
  const rowH = legendVariant === "wrap" ? 22 : 26;
  const legendBudget = Math.min(
    legendVariant === "wrap" ? 150 : 130,
    legendRows * rowH + 10,
  );
  const fromHeight = Math.floor(containerHeight - legendBudget - 12);
  return Math.min(168, Math.max(compact, fromHeight));
}

/** Keeps pie/doughnut sized for the card with legend below (no overlap). */
function RadialChartLayout({
  chart,
  legend,
  labelCount,
  centerOverlay,
  legendVariant = "grid",
}: {
  chart: ReactNode;
  legend: ReactNode;
  labelCount: number;
  centerOverlay?: ReactNode;
  legendVariant?: "grid" | "wrap";
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState(() =>
    defaultRadialChartSize(labelCount, undefined, legendVariant),
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      setChartSize(defaultRadialChartSize(labelCount, el.clientHeight, legendVariant));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [labelCount, legendVariant]);

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col items-stretch gap-1.5 overflow-hidden"
    >
      <div
        className="relative mx-auto shrink-0"
        style={{ width: chartSize, height: chartSize }}
      >
        <ChartSurface className="absolute inset-0 overflow-hidden rounded-md">
          {chart}
        </ChartSurface>
        {centerOverlay}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {legend}
      </div>
    </div>
  );
}

type CountChartProps = {
  labels: string[];
  values: number[];
  type?: "bar" | "horizontal" | "pie" | "doughnut";
  colors?: string[];
  centerText?: string;
  /** Fixed max for vertical bar Y-axis (e.g. 100 for percentages). */
  yMax?: number;
  /** Use "wrap" for chip-style legend (Pan India incident types). */
  legendVariant?: "grid" | "wrap";
};

export function CountChart({
  labels,
  values,
  type = "bar",
  colors,
  centerText,
  yMax,
  legendVariant = "grid",
}: CountChartProps) {
  const theme = useChartTheme();

  if (!hasChartData(values)) {
    return <EmptyState message="No data for this chart with current filters." />;
  }

  const palette =
    colors ??
    labels.map((label, index) => {
      if (label in CATEGORY_COLORS) {
        return CATEGORY_COLORS[label as keyof typeof CATEGORY_COLORS];
      }
      if (label in STATUS_COLORS) {
        return STATUS_COLORS[label as keyof typeof STATUS_COLORS];
      }
      return CHART_PALETTE[index % CHART_PALETTE.length];
    });

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: palette,
        borderColor: palette,
        borderWidth: 1,
      },
    ],
  };

  const isHorizontal = type === "horizontal";
  const cartesianOptions = buildCartesianBarOptions(theme, isHorizontal);
  const barOptions =
    yMax != null && !isHorizontal
      ? {
          ...cartesianOptions,
          scales: {
            ...cartesianOptions.scales,
            y: {
              ...cartesianOptions.scales?.y,
              max: yMax,
              suggestedMax: yMax,
            },
          },
        }
      : cartesianOptions;
  const radialOptions = {
    ...buildRadialChartOptions(theme),
    plugins: {
      ...buildRadialChartOptions(theme).plugins,
      tooltip: {
        ...buildRadialChartOptions(theme).plugins?.tooltip,
        callbacks: {
          label: (ctx: { label?: string; parsed?: number; dataset: { data: number[] } }) => {
            const value = Number(ctx.parsed ?? 0);
            const total = (ctx.dataset.data as number[]).reduce((s, v) => s + Number(v), 0) || 1;
            const pct = Math.round((value / total) * 1000) / 10;
            return `${ctx.label}: ${value} (${pct}%)`;
          },
        },
      },
    },
  };

  const legend = (
    <RadialChartLegend
      labels={labels}
      values={values}
      colors={palette}
      variant={legendVariant}
    />
  );

  if (type === "pie") {
    return (
      <RadialChartLayout
        labelCount={labels.length}
        chart={<Pie data={data} options={radialOptions as never} />}
        legend={legend}
        legendVariant={legendVariant}
      />
    );
  }

  if (type === "doughnut") {
    return (
      <RadialChartLayout
        labelCount={labels.length}
        chart={<Doughnut data={data} options={radialOptions as never} />}
        legend={legend}
        centerOverlay={
          centerText ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                className="text-xl font-bold sm:text-2xl"
                style={{ color: theme.centerText }}
              >
                {centerText}
              </span>
            </div>
          ) : null
        }
      />
    );
  }

  return (
    <ChartSurface>
      <Bar data={data} options={barOptions as never} />
    </ChartSurface>
  );
}

type StatusBreakdownProps = {
  open: number;
  inProgress: number;
  pending: number;
  closed: number;
};

/** Horizontal bars — every status visible even when one dominates (e.g. 57 Closed). */
export function StatusBreakdownChart({
  open,
  inProgress,
  pending,
  closed,
}: StatusBreakdownProps) {
  const countByStatus: Record<string, number> = {
    Open: open,
    "In Progress": inProgress,
    Pending: pending,
    Closed: closed,
  };
  const labels = [...STATUS_BREAKDOWN_ORDER];
  const values = labels.map((s) => countByStatus[s] ?? 0);
  const colors = labels.map((s) => STATUS_COLORS[s as keyof typeof STATUS_COLORS]);

  return (
    <CountChart
      labels={labels}
      values={values}
      type="horizontal"
      colors={colors}
    />
  );
}

function resolvePalette(labels: string[], colors?: string[]) {
  if (colors) return colors;
  return labels.map((label, index) => {
    if (label in CATEGORY_COLORS) {
      return CATEGORY_COLORS[label as keyof typeof CATEGORY_COLORS];
    }
    if (label in STATUS_COLORS) {
      return STATUS_COLORS[label as keyof typeof STATUS_COLORS];
    }
    return CHART_PALETTE[index % CHART_PALETTE.length];
  });
}

type RadarChartProps = {
  labels: string[];
  values: number[];
  colors?: string[];
  datasetLabel?: string;
};

/** Compare one metric across many categories (e.g. closure % per station) */
export function RadarMetricChart({
  labels,
  values,
  colors,
  datasetLabel = "Value",
}: RadarChartProps) {
  const theme = useChartTheme();

  if (!hasChartData(values)) {
    return <EmptyState message="No data for this chart with current filters." />;
  }

  const palette = resolvePalette(labels, colors);
  const max = Math.max(...values, 1);
  const radarOptions = buildRadarChartOptions(theme);

  return (
    <ChartSurface>
      <Radar
        data={{
          labels,
          datasets: [
            {
              label: datasetLabel,
              data: values,
              backgroundColor: "rgba(212, 175, 55, 0.2)",
              borderColor: "#d4af37",
              borderWidth: 2,
              pointBackgroundColor: palette,
              pointBorderColor: theme.chartBg,
              pointRadius: 5,
            },
          ],
        }}
        options={
          {
            ...radarOptions,
            scales: {
              r: {
                ...radarOptions.scales?.r,
                suggestedMax: max * 1.15,
              },
            },
          } as never
        }
      />
    </ChartSurface>
  );
}

type SingleSeriesAreaProps = {
  labels: string[];
  values: number[];
  label?: string;
  color?: string;
};

/** Single time series as filled area — use when combo chart already has a line for the same metric */
export function SingleSeriesAreaChart({
  labels,
  values,
  label = "Count",
  color = "#ef4444",
}: SingleSeriesAreaProps) {
  const theme = useChartTheme();
  const chartOptions = buildChartDefaults(theme);

  if (labels.length === 0) {
    return <EmptyState message="No trend data available." />;
  }

  return (
    <ChartSurface>
      <Line
        data={{
          labels,
          datasets: [
            {
              label,
              data: values,
              fill: true,
              backgroundColor:
                color === "#ef4444"
                  ? "rgba(239, 68, 68, 0.15)"
                  : color.startsWith("#") && color.length === 7
                    ? `${color}26`
                    : "rgba(239, 68, 68, 0.15)",
              borderColor: color,
              tension: 0.35,
            },
          ],
        }}
        options={
          {
            ...chartOptions,
            plugins: {
              ...chartOptions.plugins,
              ...buildTooltipOnlyChartOptions(theme),
            },
          } as never
        }
      />
    </ChartSurface>
  );
}

type ComboTrendProps = {
  labels: string[];
  totals: number[];
  catA: number[];
  rollingAvg: (number | null)[];
};

export function ComboTrendChart({ labels, totals, catA, rollingAvg }: ComboTrendProps) {
  const theme = useChartTheme();
  const chartOptions = buildChartDefaults(theme);

  if (labels.length === 0) {
    return <EmptyState message="No monthly trend data available." />;
  }

  const data = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "Total incidents",
        data: totals,
        backgroundColor: "rgba(212, 175, 55, 0.55)",
        borderColor: "#d4af37",
        borderWidth: 1,
        order: 2,
      },
      {
        type: "line" as const,
        label: "CAT-A",
        data: catA,
        borderColor: "#ef4444",
        backgroundColor: "#ef4444",
        tension: 0.35,
        order: 1,
      },
      {
        type: "line" as const,
        label: "3-mo rolling avg",
        data: rollingAvg,
        borderColor: "#64748b",
        borderDash: [6, 4],
        tension: 0.35,
        order: 0,
      },
    ],
  };

  return (
    <ChartSurface>
      <Chart
        type="bar"
        data={data as never}
        options={
          {
            ...chartOptions,
            plugins: {
              ...chartOptions.plugins,
              ...buildTooltipOnlyChartOptions(theme),
              legend: {
                labels: { color: theme.legend, boxWidth: 12, font: { size: 11 } },
              },
            },
          } as never
        }
      />
    </ChartSurface>
  );
}

type GroupedBarProps = {
  labels: string[];
  series: { label: string; data: number[]; color: string }[];
};

export function GroupedBarChart({ labels, series }: GroupedBarProps) {
  const theme = useChartTheme();
  const chartOptions = buildChartDefaults(theme);
  const dataLabels = buildNonZeroBarDataLabels(theme);

  if (labels.length === 0) {
    return <EmptyState message="No station comparison data." />;
  }

  const data = {
    labels,
    datasets: series.map((s) => ({
      label: s.label,
      data: s.data,
      backgroundColor: s.color,
      datalabels: dataLabels,
    })),
  };

  return (
    <ChartSurface>
      <Bar
        data={data}
        options={
          {
            ...chartOptions,
            plugins: {
              ...chartOptions.plugins,
              datalabels: dataLabels,
            },
          } as never
        }
      />
    </ChartSurface>
  );
}

type RankedHorizontalBarProps = {
  labels: string[];
  values: number[];
};

/** Horizontal bar chart sorted largest → smallest with navy-gold rank colours. */
export function RankedHorizontalBarChart({ labels, values }: RankedHorizontalBarProps) {
  const nodes = buildTreemapNodes(labels, values);
  return (
    <CountChart
      labels={nodes.map((n) => n.name)}
      values={nodes.map((n) => n.count)}
      type="horizontal"
      colors={nodes.map((n) => n.fill)}
    />
  );
}

type AreaTrendProps = {
  labels: string[];
  totals: number[];
  catA: number[];
  averageLine?: number;
};

export function AreaTrendChart({ labels, totals, catA, averageLine }: AreaTrendProps) {
  const theme = useChartTheme();
  const chartOptions = buildChartDefaults(theme);

  if (labels.length === 0) {
    return <EmptyState message="No trend data for selected filters." />;
  }

  const data = {
    labels,
    datasets: [
      {
        label: "Total incidents",
        data: totals,
        fill: true,
        backgroundColor: "rgba(26, 42, 94, 0.15)",
        borderColor: "#1a2a5e",
        tension: 0.35,
      },
      {
        label: "CAT-A",
        data: catA,
        fill: false,
        borderColor: "#ef4444",
        tension: 0.35,
      },
      ...(averageLine
        ? [
            {
              label: "Monthly average",
              data: labels.map(() => averageLine),
              borderColor: "#64748b",
              borderDash: [5, 5],
              pointRadius: 0,
            },
          ]
        : []),
    ],
  };

  return (
    <ChartSurface>
      <Line
        data={data}
        options={
          {
            ...chartOptions,
            plugins: {
              ...chartOptions.plugins,
              ...buildTooltipOnlyChartOptions(theme),
              legend: {
                labels: { color: theme.legend, boxWidth: 12, font: { size: 11 } },
              },
            },
          } as never
        }
      />
    </ChartSurface>
  );
}

type StackedBarProps = {
  labels: string[];
  open: number[];
  closed: number[];
};

export function StackedStatusBar({ labels, open, closed }: StackedBarProps) {
  const theme = useChartTheme();
  const chartOptions = buildChartDefaults(theme);
  const dataLabels = {
    ...buildDataLabelStyles(theme),
    anchor: "center" as const,
    align: "center" as const,
    display: (ctx: Context) => Number(ctx.dataset.data[ctx.dataIndex]) > 0,
  };

  if (labels.length === 0) {
    return <EmptyState message="No open/closed breakdown available." />;
  }

  const data = {
    labels,
    datasets: [
      { label: "Closed", data: closed, backgroundColor: "#22c55e", datalabels: dataLabels },
      { label: "Open", data: open, backgroundColor: "#ef4444", datalabels: dataLabels },
    ],
  };

  return (
    <ChartSurface>
      <Bar
        data={data}
        options={
          {
            ...chartOptions,
            plugins: {
              ...chartOptions.plugins,
              datalabels: dataLabels,
            },
            scales: {
              x: { ...chartOptions.scales?.x, stacked: true },
              y: { ...chartOptions.scales?.y, stacked: true },
            },
          } as never
        }
      />
    </ChartSurface>
  );
}

type ScatterPoint = { x: number; y: number; r: number; label: string };

export function RiskScatterChart({ points }: { points: ScatterPoint[] }) {
  const theme = useChartTheme();
  const chartOptions = buildChartDefaults(theme);
  const active = points.filter((p) => p.x > 0 || p.y > 0);

  if (active.length === 0) {
    return <EmptyState message="No risk scatter data — only DEL has incidents currently." />;
  }

  const data = {
    datasets: [
      {
        label: "Stations",
        data: active.map((p) => ({ x: p.x, y: p.y })),
        pointRadius: active.map((p) => Math.max(6, Math.min(p.r, 18))),
        pointHoverRadius: active.map((p) => Math.max(8, Math.min(p.r + 2, 22))),
        backgroundColor: active.map((p) =>
          p.y >= 80 ? "#ef4444" : p.y >= 35 ? "#f59e0b" : "#22c55e",
        ),
        borderColor: theme.chartBg,
        borderWidth: 1,
      },
    ],
  };

  return (
    <ChartSurface>
      <Scatter
        data={data}
        options={
          {
            ...chartOptions,
            plugins: {
              ...chartOptions.plugins,
              ...buildTooltipOnlyChartOptions(theme),
              tooltip: {
                ...(buildTooltipOnlyChartOptions(theme)?.tooltip ?? {}),
                callbacks: {
                  label: (ctx: { dataIndex: number }) => {
                    const point = active[ctx.dataIndex];
                    return point
                      ? `${point.label}: ${point.x} incidents, risk ${point.y}`
                      : "";
                  },
                },
              },
            },
            scales: {
              x: {
                ...chartOptions.scales?.x,
                title: { display: true, text: "Total incidents", color: theme.tick },
              },
              y: {
                ...chartOptions.scales?.y,
                title: { display: true, text: "Risk score", color: theme.tick },
              },
            },
          } as never
        }
      />
    </ChartSurface>
  );
}

type TimelineItem = {
  id: string;
  dateLabel: string;
  category: string;
  title: string;
  ghrNumber: string;
  brief: string;
  x: number;
  y: number;
};

export function IncidentTimeline({
  incidents,
  onSelect,
}: {
  incidents: TimelineItem[];
  onSelect: (id: string) => void;
}) {
  const theme = useChartTheme();
  const chartOptions = buildChartDefaults(theme);

  if (incidents.length === 0) {
    return <EmptyState message="No timeline incidents for current filters." />;
  }

  const categories = ["CAT-A", "CAT-B", "CAT-C", "CAT-D"];
  const byCategory = categories.map((cat) =>
    incidents.filter((i) => i.category === cat),
  );

  const data = {
    datasets: categories.map((cat, catIndex) => ({
      label: cat,
      data: byCategory[catIndex]!.map((i) => ({ x: i.x, y: i.y })),
      pointRadius: 6,
      pointHoverRadius: 8,
      backgroundColor: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS],
      borderColor: theme.chartBg,
      borderWidth: 1,
    })),
  };

  return (
    <ChartSurface>
      <Scatter
        data={data}
        options={
          {
            ...chartOptions,
            plugins: {
              ...chartOptions.plugins,
              ...buildTooltipOnlyChartOptions(theme),
              legend: { labels: { color: theme.legend } },
              tooltip: {
                ...(buildTooltipOnlyChartOptions(theme)?.tooltip ?? {}),
                callbacks: {
                  label: (ctx: { datasetIndex?: number; dataIndex: number }) => {
                    const item = byCategory[ctx.datasetIndex ?? 0]?.[ctx.dataIndex ?? 0];
                    return item ? `${item.ghrNumber} — ${item.title}` : "";
                  },
                },
              },
            },
            onClick: (
              _e: unknown,
              elements: { datasetIndex?: number; index?: number }[],
            ) => {
              const ds = elements[0]?.datasetIndex;
              const idx = elements[0]?.index;
              if (ds == null || idx == null) return;
              const item = byCategory[ds]?.[idx];
              if (item) onSelect(item.id);
            },
            scales: {
              x: {
                type: "linear" as const,
                ticks: {
                  color: theme.tick,
                  callback: (value: string | number) => {
                    const date = new Date(Number(value));
                    return Number.isNaN(date.getTime())
                      ? String(value)
                      : date.toLocaleDateString("en-GB", {
                          month: "short",
                          year: "2-digit",
                        });
                  },
                },
                grid: { color: theme.grid },
                title: { display: true, text: "Timeline", color: theme.tick },
              },
              y: {
                min: -0.5,
                max: 3.5,
                ticks: {
                  color: theme.tick,
                  stepSize: 1,
                  callback: (value: string | number) =>
                    categories[Number(value)] ?? "",
                },
                grid: { color: theme.grid },
              },
            },
          } as never
        }
      />
    </ChartSurface>
  );
}
