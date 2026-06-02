import { normalizeIncidentType } from "@/lib/parse/utils";
import type { DashboardData, GraphFilters, Incident } from "@/lib/types";

function formatIncidentRow(inc: Incident): string {
  return `${inc.ghrNumber} | ${inc.dateLabel} | ${normalizeIncidentType(inc.incidentType)} | ${inc.category} | ${inc.department} | ${inc.status} | ${inc.brief.slice(0, 80)}`;
}

function incidentTypeCounts(incidents: Incident[]): string {
  const map = new Map<string, number>();
  for (const inc of incidents) {
    const key = normalizeIncidentType(inc.incidentType);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type}: ${count}`)
    .join("\n");
}

function departmentBreakdown(incidents: Incident[]): string {
  const depts = [...new Set(incidents.map((i) => i.department))].sort();
  return depts
    .map((dept) => {
      const list = incidents.filter((i) => i.department === dept);
      const catA = list.filter((i) => i.category === "CAT-A").length;
      const closed = list.filter((i) => i.status === "Closed").length;
      const rate = list.length ? Math.round((closed / list.length) * 1000) / 10 : 0;
      return `${dept}: ${list.length} incidents, ${catA} CAT-A, ${closed} closed, ${rate}% closure`;
    })
    .join("\n");
}

function openIncidentsDetail(incidents: Incident[]): string {
  const open = incidents.filter(
    (i) => i.status === "Open" || i.status === "In Progress" || i.status === "Pending",
  );
  if (open.length === 0) return "(none)";
  return open.map(formatIncidentRow).join("\n");
}

function catADetail(incidents: Incident[]): string {
  const catA = incidents.filter((i) => i.category === "CAT-A");
  if (catA.length === 0) return "(none)";
  return catA.map(formatIncidentRow).join("\n");
}

/** Full system prompt for Claude / context preview. */
export function buildSystemPrompt(
  data: DashboardData,
  pathname: string,
  graphFilters: GraphFilters,
  fileName: string | null,
): string {
  const inc = data.incidents;
  const logSample = inc.slice(0, 80).map(formatIncidentRow).join("\n");
  const more = inc.length > 80 ? `\n... and ${inc.length - 80} more rows` : "";

  return [
    "You are the Bird Flight Services Safety Assistant.",
    "",
    `Workbook: ${fileName ?? "loaded dataset"}`,
    `Route context: ${pathname}`,
    `Active filters: station=${graphFilters.station}, year=${graphFilters.year}, month=${graphFilters.month}, department=${graphFilters.department}, category=${graphFilters.category}`,
    "",
    "=== KPIs ===",
    `Total: ${data.kpis.total}, Open: ${data.kpis.open}, In Progress: ${data.kpis.inProgress}, Closed: ${data.kpis.closed}, Pending: ${data.kpis.pending}`,
    `CAT-A: ${data.kpis.catA}, CAT-B: ${data.kpis.catB}, CAT-C: ${data.kpis.catC}, CAT-D: ${data.kpis.catD}`,
    `Closure rate: ${data.kpis.closureRate}%`,
    "",
    "=== INCIDENT LOG (GHR | Date | Type | Category | Department | Status | Brief) ===",
    logSample + more,
    "",
    "=== INCIDENT TYPE COUNTS ===",
    incidentTypeCounts(inc),
    "",
    "=== DEPARTMENT BREAKDOWN ===",
    departmentBreakdown(inc),
    "",
    "=== OPEN INCIDENTS DETAIL ===",
    openIncidentsDetail(inc),
    "",
    "=== CAT-A INCIDENTS DETAIL ===",
    catADetail(inc),
    "",
    "=== MONTHLY TREND ===",
    data.monthlyTrend
      .map((m) => `${m.label}: total=${m.total}, CAT-A=${m.catA}, closed=${m.closed}`)
      .join("\n"),
    "",
    "=== STATION STATS ===",
    data.stations
      .map((s) => `${s.station}: total=${s.total}, risk=${s.riskScore} (${s.riskLevel})`)
      .join("\n"),
    "",
    "RESPONSE RULES:",
    "- Always start your answer with the key number or fact on the first line",
    "- When listing incidents always include: GHR number, date, type, category, status",
    "- When the user asks \"show me\" or \"list\" always provide the full list not a summary",
    "- When asked about trends always cite specific months and numbers from the monthly data",
    "- When asked about risk always show the formula breakdown not just the score",
    "- Never say \"I don't have access to\" — you have the full incident log above",
    "- If asked something not in the data say exactly: \"This information is not in the current workbook\"",
    "- Format numbers with commas for thousands. Format percentages to 1 decimal place",
    "- Keep responses focused — max 3 paragraphs for explanations, use bullet lists for incident lists",
    "",
    "Answer using live incident rows, KPIs, station stats, and monthly trend from the dataset above.",
    "Do not invent counts; compute from loaded incidents.",
  ].join("\n");
}
