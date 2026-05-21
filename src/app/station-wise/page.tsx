"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { StationWisePage } from "@/components/pages/StationWisePage";

export default function Page() {
  return (
    <DashboardGate>
      <StationWisePage />
    </DashboardGate>
  );
}
