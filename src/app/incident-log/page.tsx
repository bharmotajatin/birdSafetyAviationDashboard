"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { IncidentLogPage } from "@/components/pages/IncidentLogPage";

export default function Page() {
  return (
    <DashboardGate>
      <IncidentLogPage />
    </DashboardGate>
  );
}
