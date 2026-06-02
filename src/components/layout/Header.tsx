"use client";

import Link from "next/link";
import { BirdFlightLogo } from "@/components/dashboard/BirdFlightLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function Header() {
  return (
    <header className="glass-header sticky top-0 z-40 border-b theme-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Link href="/incident-log" className="shrink-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-gold)]">
            <BirdFlightLogo
              width={150}
              className="h-7 w-[clamp(108px,28vw,150px)] sm:h-8"
            />
          </Link>
          <p className="hidden border-l theme-border pl-3 text-xs font-semibold tracking-wide theme-text-muted md:block">
            Safety Incident Dashboard
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
