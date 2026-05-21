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
  const acc = incidents.reduce(
    (counts, inc) => {
      counts.total += 1;
      if (inc.status === "Open") counts.open += 1;
      else if (inc.status === "In Progress") counts.inProgress += 1;
      else if (inc.status === "Closed") counts.closed += 1;
      else if (inc.status === "Pending") counts.pending += 1;

      if (inc.category === "CAT-A") counts.catA += 1;
      else if (inc.category === "CAT-B") counts.catB += 1;
      else if (inc.category === "CAT-C") counts.catC += 1;
      else if (inc.category === "CAT-D") counts.catD += 1;

      const typeLower = inc.incidentType.toLowerCase();
      if (typeLower.includes("staff injury")) counts.staffInjuries += 1;
      if (typeLower.includes("near miss")) counts.nearMiss += 1;

      if (inc.department === "RAMP") counts.ramp += 1;
      else if (inc.department === "GSD") counts.gsd += 1;

      return counts;
    },
    {
      total: 0,
      open: 0,
      inProgress: 0,
      closed: 0,
      pending: 0,
      catA: 0,
      catB: 0,
      catC: 0,
      catD: 0,
      staffInjuries: 0,
      nearMiss: 0,
      ramp: 0,
      gsd: 0,
    },
  );

  return {
    ...acc,
    closureRate: pct(acc.closed, acc.total),
  };
}

function statsFromIncidentGroup(station: string, list: Incident[]): StationStats {
  let catA = 0;
  let catB = 0;
  let catC = 0;
  let catD = 0;
  let closed = 0;
  let open = 0;
  let inProgress = 0;
  let pending = 0;
  let nearMiss = 0;
  let staffInjuries = 0;

  for (const inc of list) {
    if (inc.category === "CAT-A") catA += 1;
    else if (inc.category === "CAT-B") catB += 1;
    else if (inc.category === "CAT-C") catC += 1;
    else if (inc.category === "CAT-D") catD += 1;

    if (inc.status === "Open") open += 1;
    else if (inc.status === "In Progress") inProgress += 1;
    else if (inc.status === "Closed") closed += 1;
    else if (inc.status === "Pending") pending += 1;

    const typeLower = inc.incidentType.toLowerCase();
    if (typeLower.includes("near miss")) nearMiss += 1;
    if (typeLower.includes("staff injury")) staffInjuries += 1;
  }

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
    nearMiss,
    staffInjuries,
  };
}

export function buildStationStats(
  incidents: Incident[],
  stationCodes: string[] = [...STATIONS],
): StationStats[] {
  const byStation = incidents.reduce((map, inc) => {
    const key = String(inc.station);
    const group = map.get(key) ?? [];
    group.push(inc);
    map.set(key, group);
    return map;
  }, new Map<string, Incident[]>());

  return stationCodes.map((station) =>
    statsFromIncidentGroup(station, byStation.get(station) ?? []),
  );
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
    let catA = 0;
    let catB = 0;
    let catC = 0;
    let catD = 0;
    let closed = 0;
    let open = 0;
    for (const inc of list) {
      if (inc.category === "CAT-A") catA += 1;
      else if (inc.category === "CAT-B") catB += 1;
      else if (inc.category === "CAT-C") catC += 1;
      else if (inc.category === "CAT-D") catD += 1;
      if (inc.status === "Closed") closed += 1;
      else if (inc.status === "Open") open += 1;
    }
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

  const bucketedTotal = points.reduce((sum, p) => sum + p.total, 0);
  const unknownCount = incidents.length - bucketedTotal;
  if (unknownCount > 0) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Incidents with unparseable dates:", unknownCount);
    }
    points.push({
      monthKey: "unknown",
      label: "Unknown Date",
      total: unknownCount,
      catA: 0,
      catB: 0,
      catC: 0,
      catD: 0,
      closed: 0,
      open: 0,
      closureRate: 0,
      changeVsLast: null,
      trend: "FLAT",
      rollingAvg3: null,
    });
  }

  return points;
}

export function buildIncidentTypeBreakdown(
  incidents: Incident[],
): IncidentTypeBreakdown[] {
  const total = incidents.length || 1;
  const byType = incidents.reduce(
    (map, inc) => {
      const key = normalizeIncidentType(inc.incidentType);
      const entry = map.get(key) ?? {
        count: 0,
        catA: 0,
        catB: 0,
        catC: 0,
        catD: 0,
        open: 0,
        closed: 0,
      };
      entry.count += 1;
      if (inc.category === "CAT-A") entry.catA += 1;
      else if (inc.category === "CAT-B") entry.catB += 1;
      else if (inc.category === "CAT-C") entry.catC += 1;
      else if (inc.category === "CAT-D") entry.catD += 1;
      if (inc.status === "Open") entry.open += 1;
      else if (inc.status === "Closed") entry.closed += 1;
      map.set(key, entry);
      return map;
    },
    new Map<
      string,
      {
        count: number;
        catA: number;
        catB: number;
        catC: number;
        catD: number;
        open: number;
        closed: number;
      }
    >(),
  );

  return [...byType.entries()].map(([incidentType, entry]) => ({
    incidentType,
    count: entry.count,
    pct: pct(entry.count, total),
    catA: entry.catA,
    catB: entry.catB,
    catC: entry.catC,
    catD: entry.catD,
    open: entry.open,
    closed: entry.closed,
  }));
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
