import {
  BarChart2,
  Building,
  Calendar,
  ClipboardCheck,
  FileText,
  GitMerge,
  Map,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export const STATIONS = [
  "BLR",
  "CJB",
  "COK",
  "DEL",
  "GOI",
  "HYD",
  "IMF",
  "IXA",
  "IXC",
  "MAA",
  "TRV",
  "TRZ",
] as const;

export type StationCode = (typeof STATIONS)[number];

export const CATEGORY_COLORS = {
  "CAT-A": "#ef4444",
  "CAT-B": "#f59e0b",
  "CAT-C": "#fbbf24",
  "CAT-D": "#22c55e",
  NIL: "#94a3b8",
  "Not set": "#64748b",
} as const;

export const STATUS_COLORS = {
  Open: "#ef4444",
  "In Progress": "#f59e0b",
  Closed: "#22c55e",
  Pending: "#8b5cf6",
  "Not set": "#64748b",
} as const;

/** Fixed order for status breakdown horizontal bars */
export const STATUS_BREAKDOWN_ORDER = [
  "Open",
  "In Progress",
  "Pending",
  "Closed",
] as const;

export const DEPT_COLORS = {
  RAMP: "#1a2a5e",
  GSD: "#d4af37",
  CARGO: "#243666",
  OTHER: "#64748b",
} as const;

export const RISK_COLORS = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#22c55e",
  CRITICAL: "#991b1b",
} as const;

export const CHART_PALETTE = [
  "#d4af37",
  "#1a2a5e",
  "#243666",
  "#b8941f",
  "#ef4444",
  "#f59e0b",
  "#fbbf24",
  "#22c55e",
  "#8b5cf6",
];

export const SHEET_CONFIG = {
  incidentLog: {
    names: [/incident\s*log/i],
    /** 1-based Excel row; detectHeaderRow converts to 0-index (row 4 → index 3). */
    headerRow: 4,
  },
  analysisDashboard: {
    names: [/analysis\s*dashboard/i],
    kpiRow: 4,
  },
  stationAnalysis: {
    names: [/station\s*analysis/i],
    exclude: [/station[-\s]*wise/i],
    headerRow: 7,
  },
  stationWiseAnalysis: {
    names: [/station[-\s]*wise/i],
    headerRow: 8,
  },
  monthlyDashboard: {
    names: [/monthly\s*dashboard/i],
    exclude: [/trend/i],
    kpiRow: 7,
  },
  monthlyTrend: {
    names: [/monthly\s*trend/i],
    headerRow: 10,
  },
  graphsDashboard: {
    names: [/graph/i],
    headerRow: 4,
    dataStartRow: 4,
  },
  panIndia: {
    names: [/pan\s*india/i],
    stationRow: 4,
    headerRow: 4,
  },
} as const;

export const ROUTES: ReadonlyArray<{
  href: string;
  label: string;
  icon?: LucideIcon;
}> = [
  { href: "/incident-log", label: "Incident Log", icon: FileText },
  { href: "/pan-india", label: "Pan India", icon: Map },
  { href: "/station-analysis", label: "Station Analysis", icon: BarChart2 },
  { href: "/station-wise", label: "Station-Wise", icon: Building },
  { href: "/monthly", label: "Monthly", icon: Calendar },
  { href: "/graphs", label: "Graphs", icon: TrendingUp },
  { href: "/pattern-analysis", label: "Patterns", icon: GitMerge },
  { href: "/data-check", label: "Data Check", icon: ClipboardCheck },
] as const;
