"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { AnalysisExcelPage } from "@/components/pages/AnalysisExcelPage";

export default function Page() {
  return (
    <DashboardGate>
      <AnalysisExcelPage />
    </DashboardGate>
  );
}
