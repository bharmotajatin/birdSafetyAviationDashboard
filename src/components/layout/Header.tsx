"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BirdFlightLogo } from "@/components/dashboard/BirdFlightLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export function Header() {
  const router = useRouter();
  const fileName = useDashboardStore((s) => s.fileName);
  const clearWorkbook = useDashboardStore((s) => s.clearWorkbook);

  return (
    <header className="glass-header sticky top-0 z-40 border-b theme-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Link
            href="/incident-log"
            className="shrink-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-gold)]"
          >
            <BirdFlightLogo
              width={150}
              className="h-7 w-[clamp(108px,28vw,150px)] sm:h-8"
            />
          </Link>
          <p className="hidden border-l theme-border pl-3 text-xs font-semibold tracking-wide theme-text-muted md:block">
            Safety Sheet Analyser
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          {fileName ? (
            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              <span
                className="max-w-[220px] truncate text-xs font-medium text-[#1a2a5e]"
                title={fileName}
              >
                {fileName}
              </span>
              <button
                type="button"
                onClick={() => {
                  clearWorkbook();
                  router.push("/");
                }}
                className="shrink-0 rounded border border-[#1a2a5e]/30 px-2.5 py-1 text-xs font-semibold text-[#1a2a5e] transition hover:bg-[#1a2a5e]/5"
              >
                Change file
              </button>
            </div>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
