"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { READ_ONLY_CLIENT } from "@/lib/read-only";

/** PA-12: Data > Upload sheets — replace the dashboard workbook from inside the app. */
export function UploadSheetsPage() {
  const fileName = useDashboardStore((s) => s.fileName);
  const count = useDashboardStore((s) => s.data?.incidents.length ?? 0);
  const loadWorkbook = useDashboardStore((s) => s.loadWorkbook);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const error = useDashboardStore((s) => s.error);
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Upload sheets" subtitle="Upload a new incident log. It replaces the workbook every tab uses; Data Check corrections are re-applied." />
      <div className="glass-card p-4">
        <p className="text-sm theme-text">
          Current workbook: <span className="font-semibold">{fileName ?? "none"}</span> · {count} incidents
        </p>
        {READ_ONLY_CLIENT ? (
          <p className="mt-3 text-sm text-slate-500">This site is view only. Uploading is turned off.</p>
        ) : (
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed theme-border px-4 py-3 text-sm font-semibold theme-text hover:border-[#d4af37]">
          <FileSpreadsheet size={16} aria-hidden />
          {isLoading ? "Uploading…" : "Choose incident log (.xlsx)"}
          <input
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setPicked(f.name);
              void loadWorkbook(f);
            }}
          />
        </label>
        )}
        {picked && !isLoading && !error ? <p className="mt-2 text-sm text-emerald-700">Loaded {picked}.</p> : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
