"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { TimeOfDayPage } from "@/components/pages/AnalysisPages";

export default function Page() {
  return (
    <DashboardGate>
      <TimeOfDayPage />
    </DashboardGate>
  );
}
