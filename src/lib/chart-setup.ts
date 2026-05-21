"use client";

import {
  ArcElement,
  BarController,
  BarElement,
  BubbleController,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  RadialLinearScale,
  RadarController,
  ScatterController,
  Title,
  Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { Context } from "chartjs-plugin-datalabels";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  BarController,
  LineController,
  BubbleController,
  ScatterController,
  RadarController,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels,
);

export function formatDataLabelValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "";
  if (n === 0) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function radialLabelFormatter(value: number, ctx: Context): string {
  const formatted = formatDataLabelValue(value);
  if (!formatted) return "";
  const dataset = ctx.chart.data.datasets[ctx.datasetIndex];
  const data = (dataset?.data ?? []) as number[];
  const total = data.reduce((sum, v) => sum + (Number(v) || 0), 0);
  if (!total) return formatted;
  const pct = Math.round((Number(value) / total) * 1000) / 10;
  return `${formatted}\n(${pct}%)`;
}

export const dataLabelBase = {
  color: "#f8fafc",
  font: { weight: "bold" as const, size: 11 },
  textStrokeColor: "rgba(15, 23, 42, 0.9)",
  textStrokeWidth: 2,
  clamp: true,
  clip: false,
};

export const barValueLabels = {
  ...dataLabelBase,
  display: (ctx: Context) => {
    const v = ctx.dataset.data[ctx.dataIndex];
    return v != null && (typeof v === "number" || typeof v === "string");
  },
  formatter: formatDataLabelValue,
  anchor: "end" as const,
  align: "end" as const,
  offset: 4,
};

export const horizontalBarValueLabels = {
  ...barValueLabels,
  anchor: "end" as const,
  align: "end" as const,
  offset: 6,
};

export const pieValueLabels = {
  ...dataLabelBase,
  display: (ctx: Context) => Number(ctx.dataset.data[ctx.dataIndex]) > 0,
  formatter: radialLabelFormatter,
  anchor: "center" as const,
  align: "center" as const,
};

export const linePointLabels = {
  ...dataLabelBase,
  font: { weight: "bold" as const, size: 10 },
  display: (ctx: Context) => {
    const v = ctx.dataset.data[ctx.dataIndex];
    return typeof v === "number" && v > 0;
  },
  formatter: formatDataLabelValue,
  anchor: "end" as const,
  align: "top" as const,
  offset: 4,
};

export const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: "#cbd5e1", boxWidth: 12, font: { size: 12 } },
    },
    datalabels: {
      display: false,
    },
  },
  scales: {
    x: {
      ticks: { color: "#94a3b8", font: { size: 11 } },
      grid: { color: "rgba(255,255,255,0.06)" },
    },
    y: {
      ticks: { color: "#94a3b8", font: { size: 11 } },
      grid: { color: "rgba(255,255,255,0.06)" },
    },
  },
};

export const radialChartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    datalabels: { display: false },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      titleColor: "#f8fafc",
      bodyColor: "#cbd5e1",
      borderColor: "rgba(212, 175, 55, 0.35)",
      borderWidth: 1,
    },
  },
};

export const tooltipOnlyPlugins = {
  legend: { display: false },
  datalabels: { display: false },
  tooltip: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    titleColor: "#f8fafc",
    bodyColor: "#cbd5e1",
    borderColor: "rgba(212, 175, 55, 0.35)",
    borderWidth: 1,
  },
};

export const radarChartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    ...tooltipOnlyPlugins,
  },
  scales: {
    r: {
      beginAtZero: true,
      ticks: { color: "#94a3b8", backdropColor: "transparent" },
      grid: { color: "rgba(255,255,255,0.08)" },
      pointLabels: { color: "#cbd5e1", font: { size: 11 } },
    },
  },
};
