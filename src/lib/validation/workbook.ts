import { SHEET_CONFIG } from "@/lib/constants";
import type { RawSheetMatrix } from "@/lib/types";
import {
  cellToString,
  detectIncidentHeaderRow,
  findSheet,
  getField,
  normalizeKey,
  readWorkbookMatrices,
} from "@/lib/parse/utils";

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  sheet: string;
  row: number | null;
  column: string;
  issue: string;
  severity: ValidationSeverity;
  rowRef: string;
};

export type WorkbookValidation = {
  fileName: string;
  missingSheets: string[];
  missingColumns: string[];
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  canLoadWithoutOverride: boolean;
};

type ColumnSpec = {
  label: string;
  aliases: string[];
  required: boolean;
};

export const REQUIRED_SHEET_SPECS = [
  { label: "Incident Log", matchers: [/incident\s*log/i], exclude: [] as RegExp[] },
  { label: "PAN INDIA STATIONS", matchers: [/pan\s*india/i], exclude: [] },
  {
    label: "STATION ANALYSIS",
    matchers: [/station\s*analysis/i],
    exclude: [/station[-\s]*wise/i],
  },
  { label: "STATION-WISE ANALYSIS", matchers: [/station[-\s]*wise/i], exclude: [] },
  {
    label: "MONTHLY DASHBOARD",
    matchers: [/monthly\s*dashboard/i],
    exclude: [/trend/i],
  },
  { label: "GRAPHS DASHBOARD", matchers: [/graph/i], exclude: [] },
  { label: "MONTHLY TREND ANALYSIS", matchers: [/monthly\s*trend/i], exclude: [] },
] as const;

const INCIDENT_REQUIRED_COLUMNS: ColumnSpec[] = [
  { label: "S.No.", aliases: ["s.no", "sno", "sr no", "serial no", "serial", "sl no", "sl.no"], required: true },
  {
    label: "Incident Title",
    aliases: [
      "incident title",
      "title of incident",
      "incident name",
      "incident description",
      "description of incident",
    ],
    required: true,
  },
  { label: "GHR No.", aliases: ["ghr number", "ghr no", "ghr no.", "ghr#", "ghr", "ghr id"], required: true },
  {
    label: "Date of Incident",
    aliases: [
      "date of incident",
      "incident date",
      "occurrence date",
      "date reported",
      "reported date",
      "date",
    ],
    required: true,
  },
  {
    label: "Department Involved",
    aliases: ["department involved", "department", "dept", "dept.", "department name", "division"],
    required: true,
  },
  {
    label: "Incident Category",
    aliases: ["incident category", "category", "cat", "severity category", "severity", "cat."],
    required: true,
  },
  { label: "Status", aliases: ["status", "current status", "incident status", "case status"], required: true },
  {
    label: "Station",
    aliases: ["station", "station code", "airport", "airport code", "location code", "base"],
    required: true,
  },
];

const INCIDENT_OPTIONAL_COLUMNS: ColumnSpec[] = [
  {
    label: "Incident Type",
    aliases: ["incident type", "type of incident", "event type", "classification"],
    required: false,
  },
  { label: "Incident Brief", aliases: ["incident brief", "brief", "description", "details", "narrative"], required: false },
  { label: "Root Cause", aliases: ["root cause", "root cause analysis", "rca", "cause"], required: false },
  {
    label: "Corrective Action",
    aliases: ["corrective action", "corrective actions", "capa", "action taken"],
    required: false,
  },
];

function headerHasColumn(headers: string[], aliases: string[]): boolean {
  const normalizedHeaders = headers.map((h) => normalizeKey(h));
  const sortedAliases = [...aliases].sort((a, b) => b.length - a.length);

  for (const alias of sortedAliases) {
    const key = normalizeKey(alias);
    if (normalizedHeaders.some((h) => h === key || (key.length >= 4 && h.startsWith(key)))) {
      return true;
    }
  }
  return false;
}

function buildSummary(issues: ValidationIssue[]) {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  return {
    errorCount,
    warningCount,
    canLoadWithoutOverride: errorCount === 0,
  };
}

function validateIncidentLogSheet(sheets: RawSheetMatrix[]): {
  missingColumns: string[];
  issues: ValidationIssue[];
} {
  const sheet = findSheet(sheets, [...SHEET_CONFIG.incidentLog.names]);
  const sheetName = sheet?.name ?? "Incident Log";
  const missingColumns: string[] = [];
  const issues: ValidationIssue[] = [];

  if (!sheet || sheet.rows.length === 0) {
    return { missingColumns: INCIDENT_REQUIRED_COLUMNS.map((c) => c.label), issues };
  }

  const headerRowIndex = detectIncidentHeaderRow(
    sheet.rows,
    SHEET_CONFIG.incidentLog.headerRow,
  );
  const headerCells = sheet.rows[headerRowIndex] ?? [];
  const headers = headerCells.map((cell, index) => {
    const label = cellToString(cell);
    return label || `Column ${index + 1}`;
  });

  for (const col of INCIDENT_REQUIRED_COLUMNS) {
    if (!headerHasColumn(headers, col.aliases)) {
      missingColumns.push(col.label);
      issues.push({
        sheet: sheetName,
        row: headerRowIndex + 1,
        column: col.label,
        issue: "Required column missing from header row",
        severity: "error",
        rowRef: "—",
      });
    }
  }

  for (let i = headerRowIndex + 1; i < sheet.rows.length; i++) {
    const rawRow = sheet.rows[i] ?? [];
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cellToString(rawRow[index]);
    });

    const title = getField(row, INCIDENT_REQUIRED_COLUMNS[1]!.aliases);
    const ghr = getField(row, INCIDENT_REQUIRED_COLUMNS[2]!.aliases);
    if (!title && !ghr) continue;

    const serialRaw = getField(row, INCIDENT_REQUIRED_COLUMNS[0]!.aliases);
    const rowRef = ghr || serialRaw || `Row ${i + 1}`;
    const excelRow = i + 1;

    const allColumns = [...INCIDENT_REQUIRED_COLUMNS, ...INCIDENT_OPTIONAL_COLUMNS];
    for (const col of allColumns) {
      if (!headerHasColumn(headers, col.aliases)) continue;

      const value = getField(row, col.aliases);
      if (value.trim()) continue;

      issues.push({
        sheet: sheetName,
        row: excelRow,
        column: col.label,
        issue: col.required ? "Required field is blank" : "Optional field is empty",
        severity: col.required ? "error" : "warning",
        rowRef,
      });
    }
  }

  return { missingColumns, issues };
}

export function validateWorkbook(
  buffer: ArrayBuffer,
  fileName = "workbook.xlsx",
): WorkbookValidation {
  const sheets = readWorkbookMatrices(buffer);
  const missingSheets: string[] = [];
  const issues: ValidationIssue[] = [];

  for (const spec of REQUIRED_SHEET_SPECS) {
    const found = findSheet(sheets, [...spec.matchers], [...spec.exclude]);
    if (!found) {
      missingSheets.push(spec.label);
      issues.push({
        sheet: spec.label,
        row: null,
        column: "—",
        issue: "Required worksheet is missing from workbook",
        severity: "error",
        rowRef: "—",
      });
    }
  }

  const incidentResult = validateIncidentLogSheet(sheets);
  const missingColumns = incidentResult.missingColumns;

  issues.push(...incidentResult.issues);

  const summary = buildSummary(issues);

  return {
    fileName,
    missingSheets,
    missingColumns,
    issues,
    ...summary,
  };
}
