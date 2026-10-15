"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { DashboardExportPage } from "@/components/pages/AnalysisPages";

export default function Page() {
  return (
    <DashboardGate>
      <DashboardExportPage />
    </DashboardGate>
  );
}
