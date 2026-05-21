import { STATIONS } from "../constants";
import type {
  DashboardData,
  DashboardKpis,
  Incident,
  IncidentTypeBreakdown,
  MonthlyTrendPoint,
  RiskLevel,
  StationStats,
} from "../types";
import { countBy, isValidMonthKey, monthLabelFromKey, normalizeIncidentType, pct } from "../parse/utils";

type BuildInput = {
  incidents: Incident[];
  monthlyFromSheet?: { monthKey: string; total: number; catA: number }[];
  stationCodes?: string[];
  contributingFromSheet?: { label: string; value: number }[];
};

export function calcRiskScore(catA: number, catB: number, catC: number, catD: number): number {
  return catA * 4 + catB * 3 + catC * 2 + catD * 1;
}

export function calcRiskLevel(score: number, catA: number, total: number): RiskLevel {
  if (total === 0) return "LOW";
  if (score >= 80 || catA >= 5) return "HIGH";
  if (score >= 35 || catA >= 2) return "MEDIUM";
  return "LOW";
}

export function buildKpis(incidents: Incident[]): DashboardKpis {
  const total = incidents.length;
  const open = incidents.filter((i) => i.status === "Open").length;
  const inProgress = incidents.filter((i) => i.status === "In Progress").length;
  const closed = incidents.filter((i) => i.status === "Closed").length;
  const pending = incidents.filter((i) => i.status === "Pending").length;
  const catA = incidents.filter((i) => i.category === "CAT-A").length;
  const catB = incidents.filter((i) => i.category === "CAT-B").length;
  const catC = incidents.filter((i) => i.category === "CAT-C").length;
  const catD = incidents.filter((i) => i.category === "CAT-D").length;
  const staffInjuries = incidents.filter((i) =>
    i.incidentType.toLowerCase().includes("staff injury"),
  ).length;
  const nearMiss = incidents.filter((i) =>
    i.incidentType.toLowerCase().includes("near miss"),
  ).length;
  const ramp = incidents.filter((i) => i.department === "RAMP").length;
  const gsd = incidents.filter((i) => i.department === "GSD").length;

  return {
    total,
    open,
    inProgress,
    closed,
    pending,
    catA,
    catB,
    catC,
    catD,
    staffInjuries,
    nearMiss,
    ramp,
    gsd,
    closureRate: pct(closed, total),
  };
}

export function buildStationStats(
  incidents: Incident[],
  stationCodes: string[] = [...STATIONS],
): StationStats[] {
  return stationCodes.map((station) => {
    const list = incidents.filter((i) => i.station === station);
    const catA = list.filter((i) => i.category === "CAT-A").length;
    const catB = list.filter((i) => i.category === "CAT-B").length;
    const catC = list.filter((i) => i.category === "CAT-C").length;
    const catD = list.filter((i) => i.category === "CAT-D").length;
    const closed = list.filter((i) => i.status === "Closed").length;
    const open = list.filter((i) => i.status === "Open").length;
    const inProgress = list.filter((i) => i.status === "In Progress").length;
    const pending = list.filter((i) => i.status === "Pending").length;
    const total = list.length;
    const riskScore = calcRiskScore(catA, catB, catC, catD);

    return {
      station,
      total,
      catA,
      catB,
      catC,
      catD,
      riskScore,
      riskLevel: calcRiskLevel(riskScore, catA, total),
      closed,
      open,
      inProgress,
      pending,
      closureRate: pct(closed, total),
      nearMiss: list.filter((i) =>
        i.incidentType.toLowerCase().includes("near miss"),
      ).length,
      staffInjuries: list.filter((i) =>
        i.incidentType.toLowerCase().includes("staff injury"),
      ).length,
    };
  });
}

export function buildMonthlyTrend(incidents: Incident[]): MonthlyTrendPoint[] {
  const monthMap = new Map<string, Incident[]>();
  for (const incident of incidents) {
    if (incident.monthKey === "unknown" || !isValidMonthKey(incident.monthKey)) continue;
    const list = monthMap.get(incident.monthKey) ?? [];
    list.push(incident);
    monthMap.set(incident.monthKey, list);
  }

  const sortedKeys = [...monthMap.keys()].sort();
  const points: MonthlyTrendPoint[] = [];

  sortedKeys.forEach((monthKey, index) => {
    const list = monthMap.get(monthKey) ?? [];
    const total = list.length;
    const catA = list.filter((i) => i.category === "CAT-A").length;
    const catB = list.filter((i) => i.category === "CAT-B").length;
    const catC = list.filter((i) => i.category === "CAT-C").length;
    const catD = list.filter((i) => i.category === "CAT-D").length;
    const closed = list.filter((i) => i.status === "Closed").length;
    const open = list.filter((i) => i.status === "Open").length;
    const prevTotal = index > 0 ? (points[index - 1]?.total ?? 0) : null;
    const changeVsLast =
      prevTotal == null ? null : total - prevTotal;

    const prev3 = points.slice(Math.max(0, index - 2), index + 1);
    const rollingAvg3 =
      prev3.length > 0
        ? Math.round(
            ((prev3.reduce((sum, p) => sum + p.total, 0) + total) /
              (prev3.length + 1)) *
              10,
          ) / 10
        : null;

    points.push({
      monthKey,
      label: monthLabelFromKey(monthKey),
      total,
      catA,
      catB,
      catC,
      catD,
      closed,
      open,
      closureRate: pct(closed, total),
      changeVsLast,
      trend:
        changeVsLast == null
          ? "FLAT"
          : changeVsLast > 0
            ? "UP"
            : changeVsLast < 0
              ? "DOWN"
              : "FLAT",
      rollingAvg3,
    });
  });

  return points;
}

export function buildIncidentTypeBreakdown(
  incidents: Incident[],
): IncidentTypeBreakdown[] {
  const types = countBy(incidents, (i) => normalizeIncidentType(i.incidentType));
  const total = incidents.length || 1;

  return types.map(({ label, value }) => {
    const list = incidents.filter(
      (i) => normalizeIncidentType(i.incidentType) === label,
    );
    return {
      incidentType: label,
      count: value,
      pct: pct(value, total),
      catA: list.filter((i) => i.category === "CAT-A").length,
      catB: list.filter((i) => i.category === "CAT-B").length,
      catC: list.filter((i) => i.category === "CAT-C").length,
      catD: list.filter((i) => i.category === "CAT-D").length,
      open: list.filter((i) => i.status === "Open").length,
      closed: list.filter((i) => i.status === "Closed").length,
    };
  });
}

export function buildDashboardData(input: BuildInput): DashboardData {
  const { incidents, contributingFromSheet = [] } = input;
  const kpis = buildKpis(incidents);
  const stations = buildStationStats(incidents, input.stationCodes);
  const monthlyTrend = buildMonthlyTrend(incidents);
  const incidentTypes = countBy(incidents, (i) => normalizeIncidentType(i.incidentType));
  const incidentTypeBreakdown = buildIncidentTypeBreakdown(incidents);

  const contributingFactors =
    contributingFromSheet.length > 0
      ? contributingFromSheet
      : countBy(incidents, (i) => i.contributingFactor || "Unknown").filter(
          (item) => item.label !== "Unknown" || item.value > 0,
        );

  const activeStations = stations.filter((s) => s.total > 0);
  const bestStation =
    activeStations.sort((a, b) => a.riskScore - b.riskScore)[0]?.station ?? "DEL";

  const monthCount = monthlyTrend.length || 1;

  return {
    incidents,
    kpis,
    stations,
    monthlyTrend,
    incidentTypes,
    incidentTypeBreakdown,
    contributingFactors,
    departments: countBy(incidents, (i) => i.department),
    categories: [
      { label: "CAT-A", value: kpis.catA },
      { label: "CAT-B", value: kpis.catB },
      { label: "CAT-C", value: kpis.catC },
      { label: "CAT-D", value: kpis.catD },
    ],
    statuses: [
      { label: "Open", value: kpis.open },
      { label: "In Progress", value: kpis.inProgress },
      { label: "Closed", value: kpis.closed },
      { label: "Pending", value: kpis.pending },
    ],
    bestStation,
    avgIncidentsPerMonth: Math.round((kpis.total / monthCount) * 10) / 10,
  };
}

export function buildMonthlyTrendForIncidents(
  incidents: Incident[],
): MonthlyTrendPoint[] {
  return buildMonthlyTrend(incidents);
}

export function filterIncidents(
  incidents: Incident[],
  filters: {
    year?: string;
    month?: string;
    station?: string;
    department?: string;
    category?: string;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): Incident[] {
  return incidents.filter((incident) => {
    if (filters.year && filters.year !== "All") {
      if (!incident.monthKey.startsWith(filters.year)) return false;
    }
    if (filters.month && filters.month !== "All") {
      if (incident.monthKey !== filters.month) return false;
    }
    if (filters.station && filters.station !== "All") {
      if (incident.station !== filters.station) return false;
    }
    if (filters.department && filters.department !== "All") {
      if (incident.department !== filters.department) return false;
    }
    if (filters.category && filters.category !== "All") {
      if (incident.category !== filters.category) return false;
    }
    if (filters.status && filters.status !== "All") {
      if (incident.status !== filters.status) return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${incident.title} ${incident.ghrNumber}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.dateFrom && incident.date) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      if (incident.date < from) return false;
    }
    if (filters.dateTo && incident.date) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      if (incident.date > to) return false;
    }
    return true;
  });
}
