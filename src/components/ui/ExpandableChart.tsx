"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, X } from "lucide-react";

export interface ExpandableChartColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

interface ExpandableChartProps {
  title: string;
  subtitle?: string;
  /** Prefer renderChart so preview + modal each get a fresh chart instance */
  renderChart?: () => React.ReactNode;
  /** @deprecated Use renderChart — still supported via clone */
  chart?: React.ReactNode;
  height?: number;
  previewHeight?: number;
  /** Treemap layout: chart fills modal height; table scrolls separately. */
  chartVariant?: "default" | "treemap";
  insight: string;
  caption: string;
  columns: ExpandableChartColumn[];
  rows: Record<string, string | number>[];
}

function DataTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: ExpandableChartColumn[];
  rows: Record<string, string | number>[];
}) {
  return (
    <div className="data-table-wrap overflow-x-auto">
      <table className="data-table w-full min-w-[480px] text-xs">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left"
                }
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <motion.tr
              key={`${title}-row-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="border-b theme-border hover:bg-[var(--table-row-hover)]"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left"
                  }
                >
                  {row[col.key] ?? ""}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartSlot({
  factory,
  instanceKey,
  height,
}: {
  factory: () => React.ReactNode;
  instanceKey: string;
  height: number | "fill";
}) {
  const node = factory();
  if (!node) return null;

  const content = React.isValidElement(node)
    ? React.cloneElement(node, { key: instanceKey })
    : node;

  if (height === "fill") {
    return (
      <div className="relative min-h-0 h-full w-full flex-1 overflow-hidden">
        <div className="absolute inset-0 h-full w-full overflow-hidden">{content}</div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      <div className="absolute inset-0 flex h-full w-full flex-col overflow-hidden">
        {content}
      </div>
    </div>
  );
}

export function ExpandableChart({
  title,
  subtitle,
  renderChart,
  chart,
  height = 400,
  previewHeight = 220,
  chartVariant = "default",
  insight,
  caption,
  columns,
  rows,
}: ExpandableChartProps) {
  const [open, setOpen] = useState(false);

  const chartFactory = useMemo(() => {
    if (renderChart) return renderChart;
    if (chart) return () => chart;
    return () => null;
  }, [renderChart, chart]);

  const modalChartHeight = useMemo(() => {
    if (chartVariant === "treemap") return "fill" as const;
    const labelCount = Math.max(rows.length, 6);
    return Math.min(720, Math.max(height, labelCount * 40 + 100));
  }, [rows.length, height, chartVariant]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const slug = title.replace(/\s+/g, "-");

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="glass-card chart-card group flex w-full cursor-pointer flex-col overflow-hidden text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-gold)]"
      >
        <div className="flex items-start justify-between gap-3 border-b theme-border px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold theme-text transition-colors group-hover:text-[var(--brand-gold)]">
              {title}
            </p>
            {subtitle ? (
              <p className="mt-0.5 text-xs theme-text-muted">{subtitle}</p>
            ) : null}
          </div>
          <span className="theme-bg-navy flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-gold)] opacity-90">
            <Maximize2 size={11} aria-hidden />
            Open
          </span>
        </div>

        <div className="px-4 py-3">
          <ChartSlot
            factory={chartFactory}
            instanceKey={`${slug}-preview`}
            height={previewHeight}
          />
        </div>

        <div className="border-t theme-border px-5 py-2.5">
          <p className="line-clamp-2 text-xs leading-relaxed theme-text-secondary">
            <span className="text-[var(--brand-gold)]">💡 </span>
            {insight}
          </p>
        </div>

        <div className="border-t theme-border bg-[var(--legend-chip-bg)] px-5 py-2 text-center text-[11px] font-medium theme-text-muted transition-colors group-hover:text-[var(--brand-gold)]">
          Click for full chart &amp; data table →
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`chart-dialog-${slug}`}
          >
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="chart-modal flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-2xl border theme-border bg-[var(--background)] shadow-2xl sm:max-w-7xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="theme-bg-navy flex shrink-0 items-center justify-between px-5 py-4 sm:px-6">
                <div className="min-w-0 pr-4">
                  <h2
                    id={`chart-dialog-${slug}`}
                    className="truncate font-semibold text-[var(--text-on-navy)]"
                  >
                    {title}
                  </h2>
                  {subtitle ? (
                    <p className="mt-0.5 truncate text-xs text-[var(--text-on-navy)]/80">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="shrink-0 rounded-lg p-2 text-[var(--text-on-navy)]/70 transition hover:bg-white/10 hover:text-[var(--text-on-navy)]"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  className={
                    chartVariant === "treemap"
                      ? "flex min-h-[min(55vh,520px)] flex-1 flex-col px-4 py-4 sm:px-6"
                      : "shrink-0 px-4 py-4 sm:px-6"
                  }
                >
                  <ChartSlot
                    factory={chartFactory}
                    instanceKey={`${slug}-modal`}
                    height={modalChartHeight}
                  />
                </div>

                <div className="flex shrink-0 gap-2 border-y theme-border bg-[var(--legend-chip-bg)] px-5 py-3 sm:px-6">
                  <span className="text-sm text-[var(--brand-gold)]">💡</span>
                  <p className="text-xs leading-relaxed theme-text-secondary">{insight}</p>
                </div>

                <p className="theme-text-muted shrink-0 px-5 pt-4 pb-2 text-xs italic sm:px-6">
                  {caption}
                </p>

                <div
                  className={
                    chartVariant === "treemap"
                      ? "min-h-0 max-h-[28vh] shrink-0 overflow-y-auto px-5 pb-6 sm:px-6"
                      : "min-h-0 max-h-[32vh] overflow-y-auto px-5 pb-6 sm:px-6"
                  }
                >
                  <DataTable title={title} columns={columns} rows={rows} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
