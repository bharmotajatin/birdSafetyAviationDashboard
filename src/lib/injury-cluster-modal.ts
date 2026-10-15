import type { Incident } from "@/lib/types";
import { extractActivity, extractBodyPart } from "@/lib/analytics/patternEngine";

export type InjuryModalType = "bodymap" | "barchart" | "activitychart";

export type InjuryModalRow = {
  ghr: string;
  date: string;
  dept: string;
  bodyPart: string;
  description: string;
  category: string;
  activity?: string;
};

export type InjuryModalData = {
  type: InjuryModalType;
  title: string;
  data: InjuryModalRow[];
};

export function isInjuryRelatedIncident(incident: Incident): boolean {
  const text = `${incident.brief} ${incident.title} ${incident.incidentType} ${incident.personInvolved}`;
  return /injur/i.test(text) || extractBodyPart(text) !== "unspecified";
}

export function incidentToModalRow(incident: Incident): InjuryModalRow {
  const text = `${incident.brief} ${incident.title} ${incident.personInvolved}`;
  const bodyPart = extractBodyPart(text);
  return {
    ghr: incident.ghrNumber || "—",
    date: incident.dateLabel || "—",
    dept: incident.department || "—",
    bodyPart: bodyPart === "unspecified" ? "—" : bodyPart,
    description: incident.brief || incident.title || "",
    category: incident.category || "N/A",
    activity: extractActivity(incident.brief),
  };
}

export function buildBodyMapModalRows(incidents: Incident[]): InjuryModalRow[] {
  return incidents.filter(isInjuryRelatedIncident).map(incidentToModalRow);
}

export function buildBodyPartBarModalRows(incidents: Incident[]): InjuryModalRow[] {
  return incidents.filter(isInjuryRelatedIncident).map(incidentToModalRow);
}

export function buildActivityChartModalRows(incidents: Incident[]): InjuryModalRow[] {
  return incidents.filter(isInjuryRelatedIncident).map(incidentToModalRow);
}

export function getDateRange(data: InjuryModalRow[]): string {
  const dates = data
    .map((row) => new Date(row.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length < 2) {
    return dates[0]?.getFullYear()?.toString() ?? "N/A";
  }
  const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmt = (date: Date) => `${SHORT_MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
  return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
}

export function getMostCommon(data: InjuryModalRow[], key: keyof InjuryModalRow): string {
  const counts: Record<string, number> = {};
  data.forEach((row) => {
    const value = String(row[key] ?? "");
    if (!value || value === "—") return;
    counts[value] = (counts[value] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
}

export function getDeptColor(dept: string): { bg: string; text: string } {
  const normalized = dept.toUpperCase();
  const map: Record<string, { bg: string; text: string }> = {
    RAMP: { bg: "#FEF0EF", text: "#C0392B" },
    GSD: { bg: "#FFFBF0", text: "#D4A017" },
    PAX: { bg: "#EEF4FF", text: "#1A5FA8" },
    GSE: { bg: "#F0FAF4", text: "#1A7A4A" },
    CARGO: { bg: "#F5F0FF", text: "#6C3483" },
  };
  const match = Object.entries(map).find(([key]) => normalized.includes(key));
  return match?.[1] ?? { bg: "#F5F5F5", text: "#555555" };
}

export function ghrRowId(ghr: string | number): string {
  return `ghr-row-${String(ghr).replace(/[^\w.-]+/g, "-")}`;
}
