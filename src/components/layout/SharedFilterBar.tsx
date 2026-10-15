"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { buildStationSummaries } from "@/lib/station-summary";
import { dataMonthKeys } from "@/lib/month-range";
import { monthLabelFromKey } from "@/lib/parse/utils";
import {
  NOT_CLOSED,
  SHARED_FILTER_KEYS,
  SHARED_FILTER_LABELS,
  readSharedFilters,
  type SharedFilterKey,
} from "@/lib/url-filters";
import { cn } from "@/lib/utils";

const CATEGORIES = ["CAT-A", "CAT-B", "CAT-C", "CAT-D", "NIL", "Not set"];

/** PA-12: sticky shared filters (Station, Month, Category, Status). Phone: a Filter button opens a bottom sheet. */
export function SharedFilterBar() {
  const data = useDashboardStore((s) => s.data);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const filters = readSharedFilters(params);
  const active = SHARED_FILTER_KEYS.filter((k) => filters[k]).length;

  const options = useMemo(() => {
    const incidents = data?.incidents ?? [];
    const statuses = [...new Set(incidents.map((i) => i.status))].filter(Boolean).sort();
    return {
      station: buildStationSummaries(incidents).map((s) => ({ value: s.station, label: s.station })),
      month: dataMonthKeys(incidents).map((k) => ({ value: k, label: monthLabelFromKey(k) })),
      category: CATEGORIES.filter((c) => incidents.some((i) => i.category === c)).map((c) => ({ value: c, label: c })),
      status: [NOT_CLOSED, ...statuses].map((s) => ({ value: s, label: s })),
    } satisfies Record<SharedFilterKey, { value: string; label: string }[]>;
  }, [data]);

  const setFilter = (key: SharedFilterKey, value: string) => {
    const q = new URLSearchParams(params?.toString() ?? "");
    if (value) q.set(key, value);
    else q.delete(key);
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };
  const clearAll = () => {
    const q = new URLSearchParams(params?.toString() ?? "");
    for (const k of SHARED_FILTER_KEYS) q.delete(k);
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  if (!data) return null;

  const selects = (layout: "row" | "sheet") =>
    SHARED_FILTER_KEYS.map((key) => (
      <label key={key} className={cn("flex min-w-0 flex-col gap-1 text-xs font-semibold theme-text-muted", layout === "row" && "flex-1")}>
        {SHARED_FILTER_LABELS[key]}
        <select
          value={filters[key] ?? ""}
          onChange={(e) => setFilter(key, e.target.value)}
          className="h-9 min-w-0 rounded-md border theme-border bg-[var(--card-bg,#fff)] px-2 text-sm font-medium theme-text"
        >
          <option value="">All</option>
          {options[key].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    ));

  return (
    <>
      <div className="shared-filter-bar glass-header sticky z-30 border-b theme-border">
        <div className="hidden items-end gap-3 px-4 py-2 sm:flex sm:px-6">
          {selects("row")}
          <button
            type="button"
            onClick={clearAll}
            disabled={!active}
            className="h-9 shrink-0 rounded-md border theme-border px-3 text-xs font-semibold theme-text disabled:opacity-40"
          >
            Clear
          </button>
        </div>
        <div className="flex items-center justify-between px-4 py-2 sm:hidden">
          <span className="truncate text-xs theme-text-muted">
            {active ? SHARED_FILTER_KEYS.filter((k) => filters[k]).map((k) => filters[k]).join(" · ") : "All incidents"}
          </span>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border theme-border px-3 text-sm font-semibold theme-text"
          >
            <SlidersHorizontal size={14} aria-hidden /> Filter{active ? ` (${active})` : ""}
          </button>
        </div>
      </div>

      {sheetOpen ? (
        <div className="fixed inset-0 z-[60] sm:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" aria-label="Close filters" className="absolute inset-0 bg-black/40" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-auto rounded-t-2xl bg-[var(--card-bg,#fff)] p-4 pb-8 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-bold theme-text">Filters</p>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close" className="rounded p-1 theme-text">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3">{selects("sheet")}</div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={clearAll} className="h-10 flex-1 rounded-md border theme-border text-sm font-semibold theme-text">
                Clear all
              </button>
              <button type="button" onClick={() => setSheetOpen(false)} className="h-10 flex-1 rounded-md bg-[#1a2a5e] text-sm font-semibold text-[#d4af37]">
                Show results
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
