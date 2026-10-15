"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { DataCheckPage } from "@/components/pages/DataCheckPage";

export default function Page() {
  return (
    <DashboardGate>
      <DataCheckPage />
    </DashboardGate>
  );
}