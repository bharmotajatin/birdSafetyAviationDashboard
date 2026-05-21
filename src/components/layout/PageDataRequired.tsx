"use client";

import { useDashboardStore } from "@/lib/stores/dashboard-store";
import type { DashboardData } from "@/lib/types";
import { EmptyState } from "@/components/ui/dashboard-primitives";

export function usePageData(): DashboardData | null {
  return useDashboardStore((s) => s.data);
}

export function PageDataRequired({
  children,
}: {
  children: (data: DashboardData) => React.ReactNode;
}) {
  const data = usePageData();
  if (!data) {
    return (
      <EmptyState message="Upload DEL_INCIDENT_FIXED.xlsx to load dashboard data." />
    );
  }
  if (data.incidents.length === 0) {
    return (
      <EmptyState message="No incidents were parsed. Check the Incident Log sheet headers." />
    );
  }
  return <>{children(data)}</>;
}
