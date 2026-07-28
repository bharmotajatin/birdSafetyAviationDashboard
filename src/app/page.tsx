"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UploadScreen } from "@/components/dashboard/upload-screen";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { LoadingSkeleton } from "@/components/ui/dashboard-primitives";

export default function HomePage() {
  const router = useRouter();
  const workbookLoaded = useDashboardStore((s) => s.workbookLoaded);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const data = useDashboardStore((s) => s.data);

  useEffect(() => {
    if (workbookLoaded && data) {
      router.replace("/incident-log");
    }
  }, [workbookLoaded, data, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
        <LoadingSkeleton />
        <p className="text-sm font-medium text-[#1a2a5e]">Parsing Excel workbook...</p>
      </div>
    );
  }

  if (workbookLoaded && data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
        <LoadingSkeleton />
        <p className="text-sm font-medium text-[#1a2a5e]">Loading dashboard...</p>
      </div>
    );
  }

  return <UploadScreen />;
}
