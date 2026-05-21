"use client";

import { useEffect, useState } from "react";
import type { ChartOptions } from "chart.js";
import { formatDataLabelValue } from "@/lib/chart-setup";
import type { Context } from "chartjs-plugin-datalabels";

export type ChartTheme = {
  tick: string;
  label: string;
  grid: string;
  legend: string;
  tooltipBg: string;
  tooltipTitle: string;
  tooltipBody: string;
  tooltipBorder: string;
  dataLabel: string;
  dataLabelStroke: string;
  chartBg: string;
  rechartsStroke: string;
  treemapText: string;
  treemapValue: string;
  centerText: string;
};

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function readChartTheme(): ChartTheme {
  return {
    tick: cssVar("--chart-tick", "#64748b"),
    label: cssVar("--chart-label", "#334155"),
    grid: cssVar("--chart-grid", "rgba(26, 42, 94, 0.08)"),
    legend: cssVar("--chart-legend", "#475569"),
    tooltipBg: cssVar("--chart-tooltip-bg", "rgba(255, 255, 255, 0.98)"),
    tooltipTitle: cssVar("--chart-tooltip-title", "#0f172a"),
    tooltipBody: cssVar("--chart-tooltip-body", "#475569"),
    tooltipBorder: cssVar("--chart-tooltip-border", "rgba(212, 175, 55, 0.5)"),
    dataLabel: cssVar("--chart-datalabel", "#0f172a"),
    dataLabelStroke: cssVar("--chart-datalabel-stroke", "rgba(255, 255, 255, 0.9)"),
    chartBg: cssVar("--chart-bg", "#ffffff"),
    rechartsStroke: cssVar("--recharts-stroke", "#1a2a5e"),
    treemapText: cssVar("--treemap-text", "#0f172a"),
    treemapValue: cssVar("--treemap-value", "#1a2a5e"),
    centerText: cssVar("--chart-center-text", "#1a2a5e"),
  };
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readChartTheme);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(readChartTheme());
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

function tooltipPlugins(theme: ChartTheme) {
  void theme;
  return {
    tooltip: {
      backgroundColor: "#1a2a5e",
      titleColor: "#ffffff",
      bodyColor: "#f8fafc",
      borderColor: "#d4af37",
      borderWidth: 1,
      cornerRadius: 8,
      padding: { top: 10, right: 14, bottom: 10, left: 14 },
      titleFont: { size: 12, weight: "bold" as const },
      bodyFont: { size: 11 },
    },
  };
}

export function buildNonZeroBarDataLabels(theme: ChartTheme) {
  return {
    ...buildDataLabelStyles(theme),
    display: (ctx: Context) => {
      const v = ctx.dataset.data[ctx.dataIndex];
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) && n > 0;
    },
  };
}

export function buildDataLabelStyles(theme: ChartTheme) {
  return {
    color: theme.dataLabel,
    font: { weight: "bold" as const, size: 11 },
    textStrokeColor: theme.dataLabelStroke,
    textStrokeWidth: 2,
    clamp: true,
    clip: false,
    display: (ctx: Context) => {
      const v = ctx.dataset.data[ctx.dataIndex];
      return v != null && (typeof v === "number" || typeof v === "string");
    },
    formatter: formatDataLabelValue,
    anchor: "end" as const,
    align: "end" as const,
    offset: 4,
  };
}

export function buildHorizontalDataLabelStyles(theme: ChartTheme) {
  return {
    ...buildDataLabelStyles(theme),
    offset: 6,
  };
}

export function buildChartDefaults(theme: ChartTheme): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: theme.legend, boxWidth: 12, font: { size: 12 } },
      },
      datalabels: { display: false },
      ...tooltipPlugins(theme),
    },
    scales: {
      x: {
        ticks: { color: theme.tick, font: { size: 11 } },
        grid: { color: theme.grid, lineWidth: 1, tickLength: 0 },
        border: { dash: [3, 3] },
      },
      y: {
        ticks: { color: theme.tick, font: { size: 11 } },
        grid: { color: theme.grid, lineWidth: 1, tickLength: 0 },
        border: { dash: [3, 3] },
      },
    },
  };
}

export function buildCartesianBarOptions(
  theme: ChartTheme,
  horizontal = false,
): ChartOptions {
  const defaults = buildChartDefaults(theme);
  return {
    ...defaults,
    indexAxis: horizontal ? "y" : "x",
    plugins: {
      ...defaults.plugins,
      legend: { display: false },
      datalabels: horizontal
        ? buildNonZeroBarDataLabels(theme)
        : buildNonZeroBarDataLabels(theme),
    },
  };
}

export function buildRadialChartOptions(theme: ChartTheme): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1,
    layout: {
      padding: { top: 4, right: 4, bottom: 4, left: 4 },
    },
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      ...tooltipPlugins(theme),
    },
  };
}

export function buildRadarChartOptions(theme: ChartTheme): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      ...tooltipPlugins(theme),
    },
    scales: {
      r: {
        beginAtZero: true,
        ticks: { color: theme.tick, backdropColor: "transparent" },
        grid: { color: theme.grid },
        pointLabels: { color: theme.label, font: { size: 11 } },
      },
    },
  };
}

export function buildTooltipOnlyChartOptions(theme: ChartTheme): ChartOptions["plugins"] {
  return {
    datalabels: { display: false },
    ...tooltipPlugins(theme),
  };
}
