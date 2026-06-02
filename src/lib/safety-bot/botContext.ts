import type { DashboardData, GraphFilters } from "@/lib/types";
import { buildSystemPrompt } from "./buildSystemPrompt";
import { monthRangeLabel } from "./questionPreviews";

export function buildContextBannerText(
  data: DashboardData,
  pathname: string,
  graphFilters: GraphFilters,
  sheetCount: number,
): string {
  const range = monthRangeLabel(data);
  const station =
    graphFilters.station !== "All" ? graphFilters.station : data.bestStation ?? "All stations";

  if (pathname.startsWith("/station-analysis")) {
    const depts =
      graphFilters.department !== "All"
        ? graphFilters.department
        : "RAMP & GSD departments";
    return `Focused on: Station Analysis · ${station} · ${depts}`;
  }
  if (pathname.startsWith("/monthly")) {
    return `Focused on: Monthly Dashboard · ${range} · ${data.incidents.length} incidents`;
  }
  if (pathname.startsWith("/graphs")) {
    return `Focused on: Graphs · ${graphFilters.year} · ${graphFilters.station} · ${graphFilters.category}`;
  }
  if (pathname.startsWith("/incident-log")) {
    return `Focused on: Incident Log · ${data.incidents.length} rows · full search`;
  }
  if (pathname.startsWith("/pan-india")) {
    return `Focused on: Pan India · ${data.stations.length} stations`;
  }
  if (pathname.startsWith("/station-wise")) {
    return `Focused on: Station-Wise · ${station}`;
  }

  return `Analysing: ${data.incidents.length} incidents · ${station} · ${range} · ${sheetCount} sheets loaded`;
}

export function buildSheetContextRows(data: DashboardData): { name: string; rows: number }[] {
  return [
    { name: "Incident Log", rows: data.incidents.length },
    { name: "Monthly Trend", rows: data.monthlyTrend.length },
    { name: "Station Stats", rows: data.stations.length },
    { name: "Incident Types", rows: data.incidentTypes.length },
    { name: "Departments", rows: data.departments.length },
    { name: "Contributing Factors", rows: data.contributingFactors.length },
    { name: "Categories", rows: data.categories.length },
  ];
}

/** Alias for context modal preview. */
export function buildBotSystemPromptPreview(
  data: DashboardData,
  pathname: string,
  graphFilters: GraphFilters,
  fileName: string | null,
): string {
  return buildSystemPrompt(data, pathname, graphFilters, fileName);
}
