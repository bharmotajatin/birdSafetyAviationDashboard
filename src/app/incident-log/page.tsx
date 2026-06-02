"use client";

import { Suspense } from "react";
import { DashboardGate } from "@/components/layout/DashboardGate";
import { IncidentLogPage } from "@/components/pages/IncidentLogPage";
import { LoadingSkeleton } from "@/components/ui/dashboard-primitives";

export default function Page() {
  return (
    <DashboardGate>
      <Suspense fallback={<LoadingSkeleton />}>
        <IncidentLogPage />
      </Suspense>
    </DashboardGate>
  );
}
