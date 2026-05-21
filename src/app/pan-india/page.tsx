"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { PanIndiaPage } from "@/components/pages/PanIndiaPage";

export default function Page() {
  return (
    <DashboardGate>
      <PanIndiaPage />
    </DashboardGate>
  );
}
