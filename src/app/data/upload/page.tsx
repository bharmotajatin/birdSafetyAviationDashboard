"use client";

import { DashboardGate } from "@/components/layout/DashboardGate";
import { UploadSheetsPage } from "@/components/pages/UploadSheetsPage";

export default function Page() {
  return (
    <DashboardGate>
      <UploadSheetsPage />
    </DashboardGate>
  );
}
