"use client";

import { useEffect } from "react";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

/** Restores the current workbook from the server, then falls back to local cache. */
export function BfsStorageHydrator() {
  const hydrateFromServer = useDashboardStore((state) => state.hydrateFromServer);

  useEffect(() => {
    void hydrateFromServer();
  }, [hydrateFromServer]);

  return null;
}
