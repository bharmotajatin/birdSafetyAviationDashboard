"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { OpenAgePage } from "@/components/pages/AnalysisPages";

export default function Page() {
  return (
    <DashboardGate>
      <OpenAgePage />
    </DashboardGate>
  );
}
