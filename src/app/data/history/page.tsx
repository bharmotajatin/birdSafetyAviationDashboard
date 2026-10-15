"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { DataHistoryPage } from "@/components/pages/DataHistoryPage";

export default function Page() {
  return (
    <DashboardGate>
      <DataHistoryPage />
    </DashboardGate>
  );
}
