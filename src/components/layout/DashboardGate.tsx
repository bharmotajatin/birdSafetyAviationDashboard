"use client";

import { UploadScreen } from "@/components/dashboard/upload-screen";
import { WorkbookValidationPanel } from "@/components/dashboard/WorkbookValidationPanel";
import { Header } from "@/components/layout/Header";
import { SheetTabs } from "@/components/layout/SheetTabs";
import { LoadingSkeleton } from "@/components/ui/dashboard-primitives";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export function DashboardGate({ children }: { children: React.ReactNode }) {
  const workbookLoaded = useDashboardStore((s) => s.workbookLoaded);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const error = useDashboardStore((s) => s.error);
  const validation = useDashboardStore((s) => s.validation);
  const pendingLoad = useDashboardStore((s) => s.pendingLoad);
  const confirmValidationAndLoad = useDashboardStore((s) => s.confirmValidationAndLoad);
  const dismissValidation = useDashboardStore((s) => s.dismissValidation);

  const blockedByValidation =
    validation != null &&
    validation.errorCount > 0 &&
    pendingLoad != null;

  const showDashboard =
    workbookLoaded && !blockedByValidation;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {showDashboard ? <SheetTabs /> : null}
      <main
        className={
          !workbookLoaded
            ? "flex-1 p-0"
            : "mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6"
        }
      >
        {validation && workbookLoaded && (blockedByValidation || validation.warningCount > 0) ? (
          <div className="mb-6">
            <WorkbookValidationPanel
              validation={validation}
              isLoading={isLoading}
              onLoadAnyway={() =>
                blockedByValidation
                  ? void confirmValidationAndLoad()
                  : dismissValidation()
              }
              onDismiss={dismissValidation}
            />
          </div>
        ) : null}

        {isLoading && workbookLoaded && !blockedByValidation ? (
          <LoadingSkeleton />
        ) : !workbookLoaded ? (
          <UploadScreen />
        ) : blockedByValidation ? (
          <div className="glass-card interactive-card border border-amber-500/30 p-6 theme-text-secondary">
            <p className="text-sm">
              New data from{" "}
              <span className="font-semibold theme-text">
                {pendingLoad?.kind === "data" ? pendingLoad.fileName : "workbook"}
              </span>{" "}
              failed validation. Resolve errors above or choose Load Anyway to merge.
            </p>
          </div>
        ) : error ? (
          <div className="glass-card border border-red-300 bg-red-50 p-6 text-sm text-red-800">
            {error}
          </div>
        ) : showDashboard ? (
          children
        ) : null}
      </main>
    </div>
  );
}
