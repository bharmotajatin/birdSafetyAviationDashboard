"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { UploadScreen } from "@/components/dashboard/upload-screen";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { LoadingSkeleton } from "@/components/ui/dashboard-primitives";

const DASHBOARD = "/incident-log";

function formatImported(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** Home always opens on the upload page; a stored sheet is offered via "Continue", a new upload goes to the dashboard. */
export default function HomePage() {
  const router = useRouter();
  const workbookLoaded = useDashboardStore((s) => s.workbookLoaded);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const data = useDashboardStore((s) => s.data);
  const fileName = useDashboardStore((s) => s.fileName);
  const importedAt = useDashboardStore((s) => s.importedAt);
  const uploadedAt = useDashboardStore((s) => s.uploadedAt);

  useEffect(() => {
    if (uploadedAt && workbookLoaded && data) router.push(DASHBOARD);
  }, [uploadedAt, workbookLoaded, data, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
        <LoadingSkeleton />
        <p className="text-sm font-medium text-[#1a2a5e]">Parsing Excel workbook...</p>
      </div>
    );
  }

  const date = formatImported(importedAt);
  return (
    <>
      {workbookLoaded && data && !uploadedAt ? (
        <div className="relative z-50 flex justify-center px-4 pb-1 pt-3">
          <button
            type="button"
            data-testid="continue-last-sheet"
            onClick={() => router.push(DASHBOARD)}
            className="inline-flex items-center gap-2 rounded-full bg-[#1a2a5e] px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#24377a] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
          >
            Continue with last uploaded sheet ({fileName ?? "saved sheet"}{date ? `, ${date}` : ""})
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
      <UploadScreen />
    </>
  );
}
