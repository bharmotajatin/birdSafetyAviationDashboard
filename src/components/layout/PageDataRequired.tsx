"use client";

import { useEffect, useState } from "react";
import { useDbDashboardData } from "@/lib/dashboard/useDbDashboardData";
import type { DashboardData } from "@/lib/types";
import { EmptyState, LoadingSkeleton } from "@/components/ui/dashboard-primitives";

export function usePageData(): DashboardData | null {
  return useDbDashboardData().data;
}

export function PageDataRequired({
  children,
}: {
  children: (data: DashboardData) => React.ReactNode;
}) {
  const { data, isLoading, error, refresh } = useDbDashboardData();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (data) setLastUpdated(new Date());
  }, [data]);

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
      <EmptyState message="No incident data is available in MongoDB yet." />
    );
  }
  const updatedText = lastUpdated ? lastUpdated.toLocaleString() : "—";
  const hasIncidents = data.incidents.length > 0;

  return (
    <>
      <div className="mb-4 flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm">
        <span className="text-slate-600">Last updated: {updatedText}</span>
        <button
          type="button"
          onClick={() => {
            void refresh();
            setLastUpdated(new Date());
          }}
          className="rounded border border-[#1a2a5e]/30 px-3 py-1 font-semibold text-[#1a2a5e]"
        >
          Refresh
        </button>
      </div>

      {hasIncidents ? (
        <>{children(data)}</>
      ) : (
        <EmptyState message="No incidents match the current filters." />
      )}
    </>
  );
}
