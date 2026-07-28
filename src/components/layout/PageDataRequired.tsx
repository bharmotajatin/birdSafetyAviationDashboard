"use client";

import { useDashboardStore } from "@/lib/stores/dashboard-store";
import type { DashboardData } from "@/lib/types";
import { EmptyState, LoadingSkeleton } from "@/components/ui/dashboard-primitives";

export function usePageData(): DashboardData | null {
  return useDashboardStore((s) => s.data);
}

export function PageDataRequired({
  children,
}: {
  children: (data: DashboardData) => React.ReactNode;
}) {
  const data = useDashboardStore((s) => s.data);
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

  return hasIncidents ? (
    <>{children(data)}</>
  ) : (
    <EmptyState message="No incidents found in the uploaded workbook." />
  );
}
