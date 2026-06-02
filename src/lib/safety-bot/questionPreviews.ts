import { calcRiskScore } from "@/lib/analytics";
import { monthLabelFromKey } from "@/lib/parse/utils";
import type { DashboardData } from "@/lib/types";

function delRiskScore(data: DashboardData) {
  const del = data.incidents.filter((i) => i.station === "DEL");
  return calcRiskScore(
    del.filter((i) => i.category === "CAT-A").length,
    del.filter((i) => i.category === "CAT-B").length,
    del.filter((i) => i.category === "CAT-C").length,
    del.filter((i) => i.category === "CAT-D").length,
  );
}

export function getQuestionPreviewSubtitle(questionId: string, data: DashboardData): string {
  const open = data.incidents.filter((i) => i.status === "Open").length;
  const inProgress = data.incidents.filter((i) => i.status === "In Progress").length;
  const peak = [...data.monthlyTrend]
    .filter((m) => m.monthKey !== "unknown")
    .sort((a, b) => b.total - a.total)[0];
  const avg = data.avgIncidentsPerMonth;

  switch (questionId) {
    case "del-risk": {
      const score = delRiskScore(data);
      const level = data.stations.find((s) => s.station === "DEL")?.riskLevel ?? "HIGH";
      return `Risk Score · ${score} · ${level}`;
    }
    case "open-incidents":
      return `${open} open · ${inProgress} in progress`;
    case "monthly-average":
      return `${avg} per month · ${peak?.label?.slice(0, 3) ?? "—"} peak`;
    case "cat-a-count":
      return `${data.kpis.catA} CAT-A · ${open} open`;
    case "pending-count":
      return `${data.kpis.pending} pending · ${data.kpis.closureRate}% closed`;
    case "peak-month":
      return peak ? `${peak.total} in ${peak.label.slice(0, 3)}` : "No trend data";
    case "near-miss":
      return `${data.kpis.nearMiss} near miss · ${open} open`;
    case "dept-closure": {
      const ramp = data.incidents.filter((i) => i.department === "RAMP");
      const rampRate = ramp.length
        ? Math.round((ramp.filter((i) => i.status === "Closed").length / ramp.length) * 100)
        : 0;
      return `RAMP ${rampRate}% · compare depts`;
    }
    case "closure-this-month":
      return `${data.kpis.closureRate}% overall closure`;
    case "highest-risk-station": {
      const top = [...data.stations].sort((a, b) => b.riskScore - a.riskScore)[0];
      return top ? `${top.station} · ${top.riskScore} score` : "—";
    }
    case "staff-injuries-2025":
      return `${data.incidents.filter((i) => i.incidentType.toLowerCase().includes("staff injury") && i.monthKey.startsWith("2025")).length} in 2025`;
    case "cat-a-by-month":
      return `Spread · ${data.kpis.catA} total CAT-A`;
    case "closed-count":
      return `${data.kpis.closed} closed · ${data.kpis.closureRate}%`;
    case "in-progress-count":
      return `${inProgress} active · ${open} open`;
    case "cat-b-count":
      return `${data.kpis.catB} CAT-B · ${data.kpis.catA} CAT-A`;
    case "ramp-incidents":
      return `${data.kpis.ramp} RAMP · ${open} open`;
    case "cargo-dept":
      return `${data.incidents.filter((i) => i.department === "CARGO").length} CARGO rows`;
    case "compare-ramp-gsd":
      return "RAMP vs GSD stats";
    case "gse-incidents":
      return `${data.incidents.filter((i) => i.incidentType.toLowerCase().includes("gse")).length} GSE type`;
    case "loading-errors":
      return `${data.incidents.filter((i) => i.incidentType.toLowerCase().includes("loading")).length} loading`;
    default:
      return `${data.incidents.length} incidents loaded`;
  }
}

export function monthRangeLabel(data: DashboardData): string {
  const keys = data.incidents
    .map((i) => i.monthKey)
    .filter((k) => k !== "unknown" && /^\d{4}-\d{2}$/.test(k))
    .sort();
  if (!keys.length) return "—";
  const first = monthLabelFromKey(keys[0]!);
  const last = monthLabelFromKey(keys[keys.length - 1]!);
  return `${first}–${last}`;
}
