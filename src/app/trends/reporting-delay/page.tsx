"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { ReportingDelayPage } from "@/components/pages/AnalysisPages";

export default function Page() {
  return (
    <DashboardGate>
      <ReportingDelayPage />
    </DashboardGate>
  );
}
