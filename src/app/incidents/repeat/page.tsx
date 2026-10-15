"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { RepeatPage } from "@/components/pages/AnalysisPages";

export default function Page() {
  return (
    <DashboardGate>
      <RepeatPage />
    </DashboardGate>
  );
}
