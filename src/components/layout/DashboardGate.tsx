"use client";

import { AppShell } from "@/components/layout/AppShell";
import { UploadScreen } from "@/components/dashboard/upload-screen";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { LoadingSkeleton } from "@/components/ui/dashboard-primitives";

export function DashboardGate({ children }: { children: React.ReactNode }) {
  const workbookLoaded = useDashboardStore((s) => s.workbookLoaded);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const data = useDashboardStore((s) => s.data);

  if (!workbookLoaded || !data) {
    if (isLoading) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
          <LoadingSkeleton />
          <p className="text-sm font-medium text-[#1a2a5e]">Parsing Excel workbook...</p>
        </div>
      );
    }
    return <UploadScreen />;
  }

  return <AppShell>{children}</AppShell>;
}
