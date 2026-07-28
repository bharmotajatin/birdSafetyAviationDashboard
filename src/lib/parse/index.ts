import { STATIONS } from "../constants";
import { buildDashboardData } from "../analytics";
import type { DashboardData } from "../types";
import { readWorkbookMatrices } from "./utils";
import {
  ensureUniqueIncidentIds,
  parseContributingFactorsFromSheet,
  parseIncidentLog,
  parseMonthlyTrendFromSheet,
} from "./incidents";

/**
 * Throws a descriptive error if critical dashboard fields are missing/NaN
 * after parsing so upload bugs surface immediately.
 */
export function validateParsedData(data: DashboardData): void {
  const failures: string[] = [];

  if (!Array.isArray(data.incidents)) {
    failures.push("incidents is not an array");
  } else if (data.incidents.length === 0) {
    failures.push("incidents array is empty");
  }

  const kpi = data.kpis;
  if (!kpi) {
    failures.push("kpis is undefined");
  } else {
    const numericKeys: (keyof typeof kpi)[] = [
      "total",
      "open",
      "inProgress",
      "closed",
      "pending",
      "catA",
      "catB",
      "catC",
      "catD",
      "ramp",
      "gsd",
      "staffInjuries",
      "nearMiss",
      "acDamage",
      "closureRate",
      "riskScore",
    ];
    for (const key of numericKeys) {
      const value = kpi[key];
      if (typeof value !== "number" || Number.isNaN(value)) {
        failures.push(`kpis.${key} is ${String(value)}`);
      }
    }
  }

  if (!Array.isArray(data.stations)) {
    failures.push("stations is not an array");
  } else {
    for (const station of data.stations) {
      if (!station?.station) failures.push("station row missing station code");
      if (typeof station.total !== "number" || Number.isNaN(station.total)) {
        failures.push(`station ${station?.station ?? "?"} total is NaN/undefined`);
      }
      if (typeof station.riskScore !== "number" || Number.isNaN(station.riskScore)) {
        failures.push(`station ${station?.station ?? "?"} riskScore is NaN/undefined`);
      }
    }
  }

  if (!Array.isArray(data.monthlyTrend)) {
    failures.push("monthlyTrend is not an array");
  }

  for (const incident of data.incidents ?? []) {
    if (!incident.id) failures.push("incident missing id");
    if (!incident.title) failures.push(`incident ${incident.id} missing title`);
    if (typeof incident.serialNo !== "number" || Number.isNaN(incident.serialNo)) {
      failures.push(`incident ${incident.id} has invalid serialNo`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Parsed workbook failed validation:\n- ${failures.slice(0, 12).join("\n- ")}${
        failures.length > 12 ? `\n- …and ${failures.length - 12} more` : ""
      }`,
    );
  }
}

export function parseWorkbookParts(buffer: ArrayBuffer) {
  const sheets = readWorkbookMatrices(buffer);
  const incidents = ensureUniqueIncidentIds(parseIncidentLog(sheets));
  const monthlyFromSheet = parseMonthlyTrendFromSheet(sheets);
  const contributingFromSheet = parseContributingFactorsFromSheet(sheets);

  if (incidents.length === 0) {
    throw new Error(
      "Could not read incident data. Ensure the workbook contains an 'Incident Log' sheet with headers around row 4.",
    );
  }

  return { incidents, monthlyFromSheet, contributingFromSheet };
}

export function parseWorkbook(buffer: ArrayBuffer): DashboardData {
  const { incidents, monthlyFromSheet, contributingFromSheet } =
    parseWorkbookParts(buffer);

  const data = buildDashboardData({
    incidents,
    monthlyFromSheet,
    stationCodes: [...STATIONS],
    contributingFromSheet,
  });

  validateParsedData(data);
  return data;
}
