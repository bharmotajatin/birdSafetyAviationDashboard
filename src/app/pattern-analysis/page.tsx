"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { PatternAnalysisPage } from "@/components/pages/PatternAnalysisPage";

export default function Page() {
  return (
    <DashboardGate>
      <PatternAnalysisPage />
    </DashboardGate>
  );
}
