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
} from "@/lib/chart-theme";
import { buildTreemapNodes } from "@/lib/treemap-theme";
import type { ChartData, ChartOptions } from "chart.js";
import type { Context } from "chartjs-plugin-datalabels";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { CLICK_HINT } from "@/lib/incident-links";
import {
  CATEGORY_COLORS,
  CHART_PALETTE,
  STATUS_BREAKDOWN_ORDER,
  STATUS_COLORS,
} from "@/lib/constants";
function hasChartData(values: number[]) {
  return values.length > 0 && values.some((v) => v > 0);
}

function ChartNoData() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#94a3b8",
        fontSize: 13,
      }}
    >
      No data available
    </div>
  );
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
  containerWidth?: number,
  legendVariant: "grid" | "wrap" = "grid",
) {
  const compact =
    labelCount > 8 ? 96 : labelCount > 6 ? 108 : labelCount > 4 ? 118 : 132;

  if (!containerHeight || containerHeight < 120) return compact;

  const fromHeight = Math.floor(containerHeight - 8);
  const legendWidthFrac = legendVariant === "wrap" ? 0.5 : 0.44;
  const fromWidth = containerWidth
    ? Math.min(220, Math.floor(containerWidth * (1 - legendWidthFrac) - 16))
    : fromHeight;

  const maxCap =
    containerHeight >= 400
      ? 260
      : containerHeight >= 300
        ? 220
        : containerHeight >= 240
          ? 190
          : 168;

  return Math.min(maxCap, fromHeight, fromWidth, Math.max(compact, Math.min(fromHeight, fromWidth)));
}

/** Pie/doughnut: chart left, legend right. */
function radialCenterFontSize(chartSize: number) {
  if (chartSize >= 240) return "2.25rem";
  if (chartSize >= 200) return "1.75rem";
  if (chartSize >= 160) return "1.5rem";
  return "1.25rem";
}

function RadialChartLayout({
  chart,
  legend,
  labelCount,
  centerOverlay,
  centerText,
  centerTextColor,
  legendVariant = "grid",
}: {
  chart: ReactNode;
  legend: ReactNode;
  labelCount: number;
  centerOverlay?: ReactNode;
  centerText?: string;
  centerTextColor?: string;
  legendVariant?: "grid" | "wrap";
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState(() =>
    defaultRadialChartSize(labelCount, undefined, undefined, legendVariant),
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      setChartSize(
        defaultRadialChartSize(
          labelCount,
          el.clientHeight,
          el.clientWidth,
          legendVariant,
        ),
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [labelCount, legendVariant]);

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-row items-center gap-3 overflow-hidden sm:gap-4"
    >
      <div
        className="relative shrink-0"
        style={{ width: chartSize, height: chartSize }}
      >
        <ChartSurface className="absolute inset-0 overflow-hidden rounded-md">
          {chart}
        </ChartSurface>
        {centerOverlay ??
          (centerText ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                className="font-bold"
                style={{
                  color: centerTextColor,
                  fontSize: radialCenterFontSize(chartSize),
                }}
              >
                {centerText}
              </span>
            </div>
          ) : null)}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-y-auto overscroll-contain py-1">
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
} & ChartLinkProps;

/** PA-07: bars/slices link to the Incident Log and show group details on hover. */
export type ChartLinkProps = {
  /** Incident Log URL for a label; omit to keep the chart non-clickable. */
  linkFor?: (label: string) => string | undefined;
  /** Extra tooltip lines for a label (count, open/closed, CAT breakdown). */
  tooltipFor?: (label: string) => string[];
};

function darken(hex: string, amount = 0.15): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const ch = (shift: number) => Math.max(0, Math.round(((n >> shift) & 255) * (1 - amount)));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

type LinkEvent = { native?: Event | null };
type LinkElement = { index: number }[];

function useChartLinkOptions(labels: string[], { linkFor, tooltipFor }: ChartLinkProps) {
  const router = useRouter();
  const lastTap = useRef<number | null>(null);
  if (!linkFor && !tooltipFor) return null;
  return {
    onHover: (event: LinkEvent, elements: LinkElement) => {
      const target = event.native?.target as HTMLElement | undefined;
      if (target) target.style.cursor = linkFor && elements.length ? "pointer" : "default";
    },
    onClick: (event: LinkEvent, elements: LinkElement) => {
      const index = elements[0]?.index;
      if (index == null || !linkFor) return;
      const href = linkFor(labels[index]!);
      if (!href) return;
      const native = event.native as (Event & { pointerType?: string }) | null | undefined;
      const isTouch = native?.pointerType === "touch" || native?.type?.startsWith("touch");
      // Touch: first tap shows the tooltip, second tap on the same bar navigates.
      if (isTouch && lastTap.current !== index) {
        lastTap.current = index;
        return;
      }
      router.push(href);
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      titleColor: "#fff",
      bodyColor: "#e2e8f0",
      footerColor: "#94a3b8",
      usePointStyle: true,
      callbacks: {
        afterBody: (items: { dataIndex: number }[]) =>
          tooltipFor && items[0] ? tooltipFor(labels[items[0].dataIndex]!) : [],
        footer: () => (linkFor ? CLICK_HINT : ""),
      },
    },
  };
}

export function CountChart({
  labels,
  values,
  type = "bar",
  colors,
  centerText,
  yMax,
  legendVariant = "grid",
  linkFor,
  tooltipFor,
}: CountChartProps) {
  const theme = useChartTheme();
  const linkOptions = useChartLinkOptions(labels ?? [], { linkFor, tooltipFor });

  if (!labels?.length || !values?.length || !hasChartData(values)) {
    return <ChartNoData />;
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
        hoverBackgroundColor: palette.map((c) => darken(String(c))),
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

  const withLinks = <T extends { plugins?: Record<string, unknown> }>(opts: T): T => {
    if (!linkOptions) return opts;
    const baseTooltip = (opts.plugins?.tooltip ?? {}) as { callbacks?: Record<string, unknown> };
    return {
      ...opts,
      onHover: linkOptions.onHover,
      onClick: linkOptions.onClick,
      plugins: {
        ...opts.plugins,
        tooltip: {
          ...baseTooltip,
          ...linkOptions.tooltip,
          callbacks: { ...baseTooltip.callbacks, ...linkOptions.tooltip.callbacks },
        },
      },
    };
  };

  const legend = (
    <RadialChartLegend
      labels={labels}
      values={values}
      colors={palette}
      variant={legendVariant}
      layout="aside"
    />
  );

  if (type === "pie") {
    return (
      <RadialChartLayout
        labelCount={labels.length}
        chart={<Pie data={data} options={withLinks(radialOptions) as ChartOptions<"pie">} />}
        legend={legend}
        legendVariant={legendVariant}
      />
    );
  }

  if (type === "doughnut") {
    return (
      <RadialChartLayout
        labelCount={labels.length}
        chart={<Doughnut data={data} options={withLinks(radialOptions) as ChartOptions<"doughnut">} />}
        legend={legend}
        centerText={centerText}
        centerTextColor={theme.centerText}
      />
    );
  }

  return (
    <ChartSurface>
      <Bar data={data} options={withLinks(barOptions as { plugins?: Record<string, unknown> }) as ChartOptions<"bar">} />
    </ChartSurface>
  );
}

type StatusBreakdownProps = ChartLinkProps & {
  open: number;
  inProgress: number;
  pending: number;
  closed: number;
  notSet?: number;
};

/** Horizontal bars — every status visible even when one dominates (e.g. 57 Closed). */
export function StatusBreakdownChart({
  open,
  inProgress,
  pending,
  closed,
  notSet = 0,
  linkFor,
  tooltipFor,
}: StatusBreakdownProps) {
  const countByStatus: Record<string, number> = {
    Open: open,
    "In Progress": inProgress,
    Pending: pending,
    Closed: closed,
    "Not set": notSet,
  };
  // "Not set" goes last and only when present.
  const labels: string[] = [...STATUS_BREAKDOWN_ORDER, ...(notSet > 0 ? ["Not set"] : [])];
  const values = labels.map((s) => countByStatus[s] ?? 0);
  const colors = labels.map((s) => STATUS_COLORS[s as keyof typeof STATUS_COLORS]);

  return (
    <CountChart
      linkFor={linkFor}
      tooltipFor={tooltipFor}
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

  if (!labels?.length || !values?.length || !hasChartData(values)) {
    return <ChartNoData />;
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
          } as ChartOptions<"radar">
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

  if (!labels?.length) {
    return <ChartNoData />;
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
          } as ChartOptions<"line">
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

  if (!labels?.length) {
    return <ChartNoData />;
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
        data={data as ChartData<"bar" | "line", number[], string>}
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
          } as ChartOptions<"bar" | "line">
        }
      />
    </ChartSurface>
  );
}

type GroupedBarProps = {
  labels: string[];
  series: { label: string; data: number[]; color: string; barColors?: string[] }[];
};

export function GroupedBarChart({ labels, series }: GroupedBarProps) {
  const theme = useChartTheme();
  const chartOptions = buildChartDefaults(theme);
  const dataLabels = buildNonZeroBarDataLabels(theme);

  if (!labels?.length) {
    return <ChartNoData />;
  }

  const data = {
    labels,
    datasets: series.map((s) => ({
      label: s.label,
      data: s.data,
      backgroundColor: s.barColors ?? s.color,
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
          } as ChartOptions<"bar">
        }
      />
    </ChartSurface>
  );
}

type RankedHorizontalBarProps = ChartLinkProps & {
  labels: string[];
  values: number[];
  /** When given, bars keep the caller's order and use these colours (one per label). */
  colors?: string[];
};

/** Horizontal bar chart sorted largest → smallest with navy-gold rank colours. */
export function RankedHorizontalBarChart({ labels, values, colors, linkFor, tooltipFor }: RankedHorizontalBarProps) {
  if (colors) {
    return (
      <CountChart labels={labels} values={values} type="horizontal" colors={colors} linkFor={linkFor} tooltipFor={tooltipFor} />
    );
  }
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

  if (!labels?.length) {
    return <ChartNoData />;
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
          } as ChartOptions<"line">
        }
      />
    </ChartSurface>
  );
}

type StackedBarProps = {
  labels: string[];
  open: number[];
  closed: number[];
  /** Legend label for the "open" series (default "Open"). */
  openLabel?: string;
};

export function StackedStatusBar({ labels, open, closed, openLabel = "Open" }: StackedBarProps) {
  const theme = useChartTheme();
  const chartOptions = buildChartDefaults(theme);
  const dataLabels = {
    ...buildDataLabelStyles(theme),
    anchor: "center" as const,
    align: "center" as const,
    display: (ctx: Context) => Number(ctx.dataset.data[ctx.dataIndex]) > 0,
  };

  if (!labels?.length) {
    return <ChartNoData />;
  }

  const data = {
    labels,
    datasets: [
      { label: "Closed", data: closed, backgroundColor: "#22c55e", datalabels: dataLabels },
      { label: openLabel, data: open, backgroundColor: "#ef4444", datalabels: dataLabels },
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
          } as ChartOptions<"bar">
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
    return <ChartNoData />;
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
          } as ChartOptions<"scatter">
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

  if (!incidents?.length) {
    return <ChartNoData />;
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
          } as ChartOptions<"scatter">
        }
      />
    </ChartSurface>
  );
}
