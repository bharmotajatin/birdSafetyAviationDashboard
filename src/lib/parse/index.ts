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

  return buildDashboardData({
    incidents,
    monthlyFromSheet,
    stationCodes: [...STATIONS],
    contributingFromSheet,
  });
}
