import type { StationCode } from "./constants";

export type Category = "CAT-A" | "CAT-B" | "CAT-C" | "CAT-D";
export type Status = "Open" | "In Progress" | "Closed" | "Pending";
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export type Incident = {
  id: string;
  serialNo: number;
  title: string;
  ghrNumber: string;
  date: Date | null;
  dateLabel: string;
  category: Category;
  incidentType: string;
  department: string;
  status: Status;
  station: StationCode | string;
  brief: string;
  rootCause: string;
  correctiveAction: string;
  location: string;
  time: string;
  personInvolved: string;
  equipment: string;
  contributingFactor: string;
  monthKey: string;
};

export type CountItem = {
  label: string;
  value: number;
};

export type StationStats = {
  station: StationCode | string;
  total: number;
  catA: number;
  catB: number;
  catC: number;
  catD: number;
  riskScore: number;
  riskLevel: RiskLevel;
  closed: number;
  open: number;
  inProgress: number;
  pending: number;
  closureRate: number;
  nearMiss: number;
  staffInjuries: number;
};

export type MonthlyTrendPoint = {
  monthKey: string;
  label: string;
  total: number;
  catA: number;
  catB: number;
  catC: number;
  catD: number;
  closed: number;
  open: number;
  closureRate: number;
  changeVsLast: number | null;
  trend: "UP" | "DOWN" | "FLAT";
  rollingAvg3: number | null;
};

export type DashboardKpis = {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
  pending: number;
  catA: number;
  catB: number;
  catC: number;
  catD: number;
  staffInjuries: number;
  nearMiss: number;
  ramp: number;
  gsd: number;
  closureRate: number;
};

export type IncidentTypeBreakdown = {
  incidentType: string;
  count: number;
  pct: number;
  catA: number;
  catB: number;
  catC: number;
  catD: number;
  open: number;
  closed: number;
};

export type DashboardData = {
  incidents: Incident[];
  kpis: DashboardKpis;
  stations: StationStats[];
  monthlyTrend: MonthlyTrendPoint[];
  incidentTypes: CountItem[];
  incidentTypeBreakdown: IncidentTypeBreakdown[];
  contributingFactors: CountItem[];
  departments: CountItem[];
  categories: CountItem[];
  statuses: CountItem[];
  bestStation: string;
  avgIncidentsPerMonth: number;
};

export type GraphFilters = {
  year: "2025" | "2026" | "All";
  month: string;
  station: string;
  department: string;
  category: string;
};

export type RawSheetMatrix = {
  name: string;
  rows: unknown[][];
};
