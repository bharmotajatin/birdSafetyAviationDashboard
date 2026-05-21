"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { StationAnalysisPage } from "@/components/pages/StationAnalysisPage";

export default function Page() {
  return (
    <DashboardGate>
      <StationAnalysisPage />
    </DashboardGate>
  );
}
