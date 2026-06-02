"use client";

import { Header } from "@/components/layout/Header";
import { SheetTabs } from "@/components/layout/SheetTabs";
import { LoadingSkeleton } from "@/components/ui/dashboard-primitives";
import { PatternAnalysisPage } from "@/components/pages/PatternAnalysisPage";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export default function Page() {
  const workbookLoaded = useDashboardStore((state) => state.workbookLoaded);
  const isLoading = useDashboardStore((state) => state.isLoading);
  const error = useDashboardStore((state) => state.error);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <SheetTabs />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {isLoading && workbookLoaded ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="glass-card border border-red-300 bg-red-50 p-6 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <PatternAnalysisPage />
        )}
      </main>
    </div>
  );
}
