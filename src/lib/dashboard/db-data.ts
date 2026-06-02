import { buildDashboardData } from "@/lib/analytics";
import type { DashboardData, Incident } from "@/lib/types";

type ApiIncident = {
  _id: string;
  serialNo?: number;
  incidentTitle?: string;
  ghrNo?: string;
  dateOfIncident?: string;
  incidentCategory?: "CAT-A" | "CAT-B" | "CAT-C" | "CAT-D";
  incidentType?: string;
  department?: { code?: string; name?: string } | string;
  status?: "Open" | "In Progress" | "Pending" | "Closed" | "Reviewed" | "Rejected";
  station?: { code?: string; name?: string } | string;
  incidentBrief?: string;
  rootCause?: string;
  correctiveAction?: string;
  location?: { text?: string; bay?: string; gate?: string; zone?: string } | string;
  timeOfIncident?: string;
  personInvolved?: { name?: string } | string;
  equipmentInvolved?: string;
};

function normalizeStatus(status: ApiIncident["status"]): Incident["status"] {
  if (status === "Open" || status === "In Progress" || status === "Closed" || status === "Pending") {
    return status;
  }
  if (status === "Reviewed") return "In Progress";
  if (status === "Rejected") return "Pending";
  return "Open";
}

function monthKeyFromDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function mapApiIncidentToDashboardIncident(row: ApiIncident): Incident {
  const locationText = typeof row.location === "string" ? row.location : row.location?.text ?? "";
  const departmentCode =
    typeof row.department === "string" ? row.department : row.department?.code ?? row.department?.name ?? "OTHER";
  const stationCode = typeof row.station === "string" ? row.station : row.station?.code ?? "DEL";
  const dateObj = row.dateOfIncident ? new Date(row.dateOfIncident) : null;

  return {
    id: row._id,
    serialNo: row.serialNo ?? 0,
    title: row.incidentTitle ?? "Untitled incident",
    ghrNumber: row.ghrNo ?? "N/A",
    date: dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj : null,
    dateLabel: dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : "-",
    category: row.incidentCategory ?? "CAT-D",
    incidentType: row.incidentType ?? "Other",
    department: departmentCode,
    status: normalizeStatus(row.status),
    station: stationCode,
    brief: row.incidentBrief ?? "",
    rootCause: row.rootCause ?? "",
    correctiveAction: row.correctiveAction ?? "",
    location: locationText,
    time: row.timeOfIncident ?? "",
    personInvolved: typeof row.personInvolved === "string" ? row.personInvolved : row.personInvolved?.name ?? "",
    equipment: row.equipmentInvolved ?? "",
    contributingFactor: row.rootCause ?? "Unknown",
    monthKey: monthKeyFromDate(row.dateOfIncident),
  };
}

export function buildDashboardDataFromApiRows(rows: ApiIncident[]): DashboardData {
  const incidents = rows.map(mapApiIncidentToDashboardIncident);
  return buildDashboardData({ incidents });
}
