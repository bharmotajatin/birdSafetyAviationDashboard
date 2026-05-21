"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { MonthlyPage } from "@/components/pages/MonthlyPage";

export default function Page() {
  return (
    <DashboardGate>
      <MonthlyPage />
    </DashboardGate>
  );
}
