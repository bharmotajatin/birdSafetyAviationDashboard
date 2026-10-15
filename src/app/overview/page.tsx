"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { GraphsPage } from "@/components/pages/GraphsPage";

export default function Page() {
  return (
    <DashboardGate>
      <GraphsPage />
    </DashboardGate>
  );
}
