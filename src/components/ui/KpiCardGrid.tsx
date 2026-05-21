"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function KpiCardGrid({
  children,
  className,
  columns,
}: {
  children: ReactNode;
  className?: string;
  /** Force a single row with this many equal columns (e.g. 8 on Monthly, 6 on Pan India). */
  columns?: number;
}) {
  return (
    <div
      className={cn(
        "kpi-card-grid",
        columns === 8 && "kpi-card-grid--8",
        columns === 6 && "kpi-card-grid--6",
        className,
      )}
    >
      {children}
    </div>
  );
}
