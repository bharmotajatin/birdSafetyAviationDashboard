"use client";

import useSWR from "swr";
import { buildDashboardDataFromApiRows } from "@/lib/dashboard/db-data";
import type { DashboardData } from "@/lib/types";

type IncidentsApiResponse = {
  items: any[];
  pages: number;
};

type StatsApiResponse = {
  total?: number;
};

async function fetchAllIncidents(): Promise<any[]> {
  const limit = 100;
  let page = 1;
  let pages = 1;
  const collected: any[] = [];

  while (page <= pages) {
    const res = await fetch(`/api/incidents?page=${page}&limit=${limit}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch incidents");
    const json = (await res.json()) as IncidentsApiResponse;
    collected.push(...(json.items ?? []));
    pages = json.pages ?? 1;
    page += 1;
  }

  return collected;
}

export function useDbDashboardData() {
  const swr = useSWR<DashboardData>(
    "db-dashboard-data",
    async () => {
      const [rows, statsRes] = await Promise.all([
        fetchAllIncidents(),
        fetch("/api/incidents/stats", { cache: "no-store" }),
      ]);
      const data = buildDashboardDataFromApiRows(rows);
      if (statsRes.ok) {
        const stats = (await statsRes.json()) as StatsApiResponse;
        if (typeof stats.total === "number") {
          data.kpis.total = stats.total;
        }
      }
      return data;
    },
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );

  return {
    data: swr.data ?? null,
    isLoading: swr.isLoading,
    error: swr.error instanceof Error ? swr.error.message : swr.error ? "Failed to load dashboard data" : null,
    refresh: () => swr.mutate(),
    lastUpdated: swr.data ? new Date() : null,
  };
}
