"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { buildDashboardData } from "@/lib/analytics";
import { STATIONS } from "@/lib/constants";
import { applySharedFilters, hasSharedFilters, readSharedFilters, type SharedFilterKey } from "@/lib/url-filters";
import type { DashboardData } from "@/lib/types";
import { EmptyState, LoadingSkeleton } from "@/components/ui/dashboard-primitives";

/**
 * PA-12: dashboard data with the shared URL filters (Station, Month, Category, Status) applied.
 * With no filters set this is exactly the stored data.
 */
export function useFilteredData(ignore: SharedFilterKey[] = []): DashboardData | null {
  const data = useDashboardStore((s) => s.data);
  const params = useSearchParams();
  const key = params?.toString() ?? "";
  const ignoreKey = ignore.join(",");
  return useMemo(() => {
    if (!data) return data;
    const f = readSharedFilters(new URLSearchParams(key));
    const ig = ignoreKey ? (ignoreKey.split(",") as SharedFilterKey[]) : [];
    if (!hasSharedFilters(f, ig)) return data;
    return buildDashboardData({
      incidents: applySharedFilters(data.incidents, f, ig),
      stationCodes: [...STATIONS],
      contributingFromSheet: [],
    });
  }, [data, key, ignoreKey]);
}

export function usePageData(): DashboardData | null {
  return useFilteredData();
}

export function PageDataRequired({
  children,
  ignoreFilters,
}: {
  children: (data: DashboardData) => React.ReactNode;
  /** Shared filters this page handles itself (e.g. Pan India selects a station instead of filtering). */
  ignoreFilters?: SharedFilterKey[];
}) {
  const data = useFilteredData(ignoreFilters);
  const raw = useDashboardStore((s) => s.data);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const error = useDashboardStore((s) => s.error);

  if (isLoading && !data) {
    return <LoadingSkeleton />;
  }
  if (error && !data) {
    return (
      <div className="glass-card border border-red-300 bg-red-50 p-6 text-sm text-red-800">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <EmptyState message="Upload a GHR Excel workbook to begin analysis." />
    );
  }

  const hasIncidents = data.incidents.length > 0;
  if (!hasIncidents && (raw?.incidents.length ?? 0) > 0) {
    return <EmptyState message="No incidents match the selected filters. Clear a filter to see more." />;
  }

  return hasIncidents ? (
    <>{children(data)}</>
  ) : (
    <EmptyState message="No incidents found in the uploaded workbook." />
  );
}
