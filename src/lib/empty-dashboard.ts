import type { DashboardData, DashboardKpis, StationStats } from "@/lib/types";

export const EMPTY_KPIS: DashboardKpis = {
  total: 0,
  open: 0,
  closed: 0,
  inProgress: 0,
  pending: 0,
  catA: 0,
  catB: 0,
  catC: 0,
  catD: 0,
  closureRate: 0,
  ramp: 0,
  gsd: 0,
  nearMiss: 0,
  staffInjuries: 0,
};

export const EMPTY_STATION_STATS: StationStats = {
  station: "DEL",
  total: 0,
  catA: 0,
  catB: 0,
  catC: 0,
  catD: 0,
  riskScore: 0,
  riskLevel: "LOW",
  closed: 0,
  open: 0,
  inProgress: 0,
  pending: 0,
  closureRate: 0,
  nearMiss: 0,
  staffInjuries: 0,
};

/** Safe defaults when the store has not hydrated or a station row is missing. */
export function createEmptyDashboardData(): DashboardData {
  return {
    incidents: [],
    kpis: { ...EMPTY_KPIS },
    stations: [],
    monthlyTrend: [],
    incidentTypes: [],
    incidentTypeBreakdown: [],
    contributingFactors: [],
    departments: [],
    categories: [],
    statuses: [],
    bestStation: "DEL",
    avgIncidentsPerMonth: 0,
  };
}

export function resolveStationStats(
  stations: StationStats[],
  selectedStation: string,
): StationStats {
  return (
    stations.find((s) => s.station === selectedStation) ??
    stations.find((s) => s.station === "DEL") ??
    stations[0] ?? { ...EMPTY_STATION_STATS, station: selectedStation }
  );
}
