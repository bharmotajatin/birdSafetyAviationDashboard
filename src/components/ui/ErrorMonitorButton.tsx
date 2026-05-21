"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Shield, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { useErrorMonitorStore } from "@/lib/stores/error-monitor-store";

export function ErrorMonitorButton() {
  const errors = useErrorMonitorStore((s) => s.errors);
  const clearError = useErrorMonitorStore((s) => s.clearError);
  const clearAll = useErrorMonitorStore((s) => s.clearAll);
  const [open, setOpen] = useState(false);

  const healthy = errors.length === 0;
  const healthScore = healthy ? 100 : Math.max(0, 100 - errors.length * 15);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`error-monitor-fab fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border px-4 py-2.5 shadow-lg transition ${
          healthy
            ? "border-emerald-400/50 bg-emerald-600/95 text-white"
            : "border-red-400/60 bg-red-600/95 text-white animate-pulse"
        }`}
        aria-label={healthy ? "Error monitor healthy" : `${errors.length} runtime issues`}
      >
        {healthy ? (
          <Shield size={18} aria-hidden />
        ) : (
          <ShieldAlert size={18} aria-hidden />
        )}
        <span className="text-xs font-semibold">
          {healthy ? `Health ${healthScore}%` : `${errors.length} issue${errors.length === 1 ? "" : "s"}`}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-20 right-6 z-50 w-[min(92vw,22rem)] rounded-xl border theme-border bg-[var(--background)] p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold theme-text">Error Monitor</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 theme-text-muted hover:bg-[var(--legend-chip-bg)]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-3 text-xs theme-text-muted">
              Health score: <strong>{healthScore}%</strong>
            </p>
            {errors.length === 0 ? (
              <p className="text-xs text-emerald-600">No runtime issues detected.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
                {errors.map((err) => (
                  <li
                    key={err.id}
                    className="rounded-lg border border-red-200/40 bg-red-50/80 px-2 py-1.5 dark:bg-red-950/40"
                  >
                    <p className="font-medium text-red-700 dark:text-red-300">{err.source}</p>
                    <p className="theme-text-secondary">{err.message}</p>
                    <button
                      type="button"
                      onClick={() => clearError(err.id)}
                      className="mt-1 text-[10px] font-semibold text-red-600 underline"
                    >
                      Dismiss
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {errors.length > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="mt-3 w-full rounded-lg border theme-border px-2 py-1.5 text-xs font-medium theme-text hover:bg-[var(--legend-chip-bg)]"
              >
                Clear all
              </button>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
