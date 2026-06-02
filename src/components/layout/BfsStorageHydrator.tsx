"use client";

import { useEffect } from "react";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

/** Restores workbook data from localStorage once on client mount. */
export function BfsStorageHydrator() {
  const data = useDashboardStore((state) => state.data);
  const hydrateFromStorage = useDashboardStore((state) => state.hydrateFromStorage);

  useEffect(() => {
    if (!data) {
      hydrateFromStorage();
    }
  }, [data, hydrateFromStorage]);

  return null;
}
