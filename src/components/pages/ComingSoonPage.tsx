"use client";

import { Clock } from "lucide-react";
import { findComingSoon } from "@/lib/nav";
import { PageHeader } from "@/components/ui/dashboard-primitives";

/** PA-12: placeholder for sub-tabs that are planned but not built yet. */
export function ComingSoonPage({ href }: { href: string }) {
  const tab = findComingSoon(href);
  return (
    <div>
      <PageHeader title={tab?.label ?? "Coming soon"} subtitle="Coming soon" />
      <div className="glass-card flex flex-col items-start gap-3 p-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          <Clock size={14} aria-hidden /> Coming soon
        </span>
        <p className="max-w-2xl text-sm theme-text">{tab?.comingSoon ?? "This view is being built."}</p>
      </div>
    </div>
  );
}
