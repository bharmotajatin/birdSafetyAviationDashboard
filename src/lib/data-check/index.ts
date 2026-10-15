import * as XLSX from "xlsx";
import { SHEET_CONFIG, STATIONS } from "../constants";
import { detectStationColumn, INCIDENT_ALIASES } from "../parse/incidents";
import { stationFromGhrNumber } from "../parse/utils";
import {
  cellToString,
  detectIncidentHeaderRow,
  normalizeCategory,
  normalizeKey,
  normalizeStatus,
  parseFlexibleDate,
  splitMultiValue,
} from "../parse/utils";

/**
 * PA-09 Data Check: cell-level validation of the Incident Log sheet with real Excel
 * row numbers / column letters, plus user corrections ("overrides") applied to the original workbook.
 */

export type CellOverride = {
  /** Excel row number (1-based, as shown in Excel). */
  row: number;
  /** Excel column letter, e.g. "BB". */
  col: string;
  value: string;
  updatedAt: string;
};

export type DataCheckField = "station" | "status" | "category" | "incidentType" | "date";

/** PA-09b: "Accept as is" — only applies while the cell still holds `value`. */
export type CellAcceptance = { row: number; col: string; value: string; acceptedAt: string; acceptedBy: string };

export type HistoryAction = "save" | "revert" | "accept" | "undo-accept" | "upload" | "remove";
export type HistoryEntry = {
  at: string; // UTC ISO
  action: HistoryAction;
  cell: string;
  field: string;
  oldValue: string;
  newValue: string;
  by: string;
};

/** Split issues into open vs accepted (acceptance must match the cell's current value). */
export function partitionIssues<T extends { row: number; col: string; value: string }>(
  issues: T[],
  acceptances: CellAcceptance[],
): { open: T[]; accepted: (T & { acceptance: CellAcceptance })[] } {
  const byCell = new Map(acceptances.map((a) => [`${a.col}${a.row}`, a]));
  const open: T[] = [];
  const accepted: (T & { acceptance: CellAcceptance })[] = [];
  for (const issue of issues) {
    const a = byCell.get(`${issue.col}${issue.row}`);
    if (a && a.value === issue.value) accepted.push({ ...issue, acceptance: a });
    else open.push(issue);
  }
  return { open, accepted };
}

export type DataCheckIssue = {
  row: number;
  col: string;
  cell: string;
  field: DataCheckField;
  header: string;
  serialNo: number;
  value: string;
  problem: string;
};

export type DataCheckColumn = { letter: string; header: string; field?: DataCheckField };

export type DataCheckResult = {
  sheetName: string;
  headerRow: number;
  columns: DataCheckColumn[];
  rows: { row: number; cells: string[] }[];
  issues: DataCheckIssue[];
  options: { station: string[]; status: string[]; category: string[] };
};

export const STATUS_OPTIONS = ["Open", "In Progress", "Pending", "Closed"];
export const CATEGORY_OPTIONS = ["CAT-A", "CAT-B", "CAT-C", "CAT-D"];

const PLACEHOLDER = /^(none|nil|n\/a|na|-+|null|tbd)$/i;
const FIELD_LABEL: Record<DataCheckField, string> = {
  station: "Station",
  status: "Status",
  category: "Category",
  incidentType: "Incident type",
  date: "Date",
};

const readOpts = { type: "array" as const, cellNF: true, cellStyles: true };

export function findIncidentSheetName(wb: XLSX.WorkBook): string | undefined {
  return wb.SheetNames.find((name) => SHEET_CONFIG.incidentLog.names.some((re) => re.test(name)));
}

/** Matrix of the sheet where index i is Excel row (originRow + i), index j is column (originCol + j). */
function sheetMatrix(sheet: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
  });
  return { rows, originRow: range.s.r + 1, originCol: range.s.c };
}

/** 0-based matrix index → Excel row number / column letter. */
export function toExcelRow(index: number, originRow = 1): number {
  return originRow + index;
}
export function toExcelCol(index: number, originCol = 0): string {
  return XLSX.utils.encode_col(originCol + index);
}

/** Same column resolution as getField: exact alias first (longest first), then prefix match. */
export function resolveColumn(headers: string[], aliases: string[]): number {
  const keys = headers.map((h) => normalizeKey(h));
  const sorted = [...aliases].sort((a, b) => b.length - a.length).map(normalizeKey);
  for (const alias of sorted) {
    const idx = keys.indexOf(alias);
    if (idx >= 0) return idx;
  }
  for (const alias of sorted) {
    if (alias.length < 4) continue;
    const match = keys
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => k.startsWith(alias))
      .sort((a, b) => a.k.length - b.k.length)[0];
    if (match) return match.i;
  }
  return -1;
}

/** Apply overrides to the original workbook bytes. Returns the original bytes when there are none. */
export function applyOverrides(bytes: ArrayBuffer, overrides: CellOverride[]): ArrayBuffer {
  if (!overrides.length) return bytes;
  const wb = XLSX.read(bytes, readOpts);
  const name = findIncidentSheetName(wb);
  if (!name) return bytes;
  const sheet = wb.Sheets[name]!;
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  for (const o of overrides) {
    const addr = `${o.col}${o.row}`;
    const existing = sheet[addr] as XLSX.CellObject | undefined;
    sheet[addr] = { ...(existing?.s ? { s: existing.s } : {}), t: "s", v: o.value } as XLSX.CellObject;
    const { r, c } = XLSX.utils.decode_cell(addr);
    range.e.r = Math.max(range.e.r, r);
    range.e.c = Math.max(range.e.c, c);
  }
  sheet["!ref"] = XLSX.utils.encode_range(range);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true }) as ArrayBuffer;
  return out;
}

/** Value currently in a cell of the incident sheet (after any overrides already applied to bytes). */
export function readCellValue(bytes: ArrayBuffer, row: number, col: string): string {
  const wb = XLSX.read(bytes, readOpts);
  const name = findIncidentSheetName(wb);
  if (!name) return "";
  const cell = wb.Sheets[name]![`${col}${row}`] as XLSX.CellObject | undefined;
  if (!cell) return "";
  return cellToString(cell.w ?? cell.v ?? "");
}

export function buildDataCheck(bytes: ArrayBuffer): DataCheckResult {
  const wb = XLSX.read(bytes, readOpts);
  const sheetName = findIncidentSheetName(wb);
  const empty: DataCheckResult = {
    sheetName: sheetName ?? "",
    headerRow: 0,
    columns: [],
    rows: [],
    issues: [],
    options: { station: [...STATIONS], status: STATUS_OPTIONS, category: CATEGORY_OPTIONS },
  };
  if (!sheetName) return empty;

  const { rows, originRow, originCol } = sheetMatrix(wb.Sheets[sheetName]!);
  const headerIdx = detectIncidentHeaderRow(rows, SHEET_CONFIG.incidentLog.headerRow);
  const headerCells = rows[headerIdx] ?? [];
  const width = Math.max(headerCells.length, ...rows.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => String(headerCells[i] ?? "").trim());

  const col = {
    serial: resolveColumn(headers, INCIDENT_ALIASES.serialNo),
    title: resolveColumn(headers, INCIDENT_ALIASES.title),
    ghr: resolveColumn(headers, INCIDENT_ALIASES.ghrNumber),
    date: resolveColumn(headers, INCIDENT_ALIASES.date),
    category: resolveColumn(headers, INCIDENT_ALIASES.category),
    status: resolveColumn(headers, INCIDENT_ALIASES.status),
    incidentType: resolveColumn(headers, INCIDENT_ALIASES.incidentType),
    station: resolveColumn(headers, INCIDENT_ALIASES.station),
    reportDate: resolveColumn(headers, INCIDENT_ALIASES.reportDate),
  };
  if (col.station < 0) col.station = detectStationColumn(rows.slice(headerIdx + 1), headerCells);

  const fieldByIndex = new Map<number, DataCheckField>();
  (["station", "status", "category", "incidentType", "date"] as const).forEach((f) => {
    if (col[f] >= 0) fieldByIndex.set(col[f], f);
  });

  const columns: DataCheckColumn[] = headers.map((h, i) => ({
    letter: toExcelCol(i, originCol),
    header: h || (fieldByIndex.get(i) === "station" ? "(no header) Station" : ""),
    field: fieldByIndex.get(i),
  }));

  const issues: DataCheckIssue[] = [];
  const gridRows: DataCheckResult["rows"] = [];
  const stationsSeen = new Set<string>();
  const cellAt = (r: unknown[], i: number) => (i >= 0 ? cellToString(r[i]) : "");

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const cells = Array.from({ length: width }, (_, j) => cellToString(r[j]));
    const excelRow = toExcelRow(i, originRow);
    if (cells.some(Boolean)) gridRows.push({ row: excelRow, cells });

    // Same row filter as the parser: needs a title or GHR, and a positive numeric S.No.
    const serialRaw = cellAt(r, col.serial);
    const serialNo = Number(serialRaw.replace(/[^0-9.-]/g, ""));
    if (!cellAt(r, col.title) && !cellAt(r, col.ghr)) continue;
    if (!serialRaw || !Number.isFinite(serialNo) || serialNo <= 0) continue;

    const add = (field: DataCheckField, value: string, problem: string) => {
      const idx = col[field];
      const letter = toExcelCol(idx, originCol);
      issues.push({
        row: excelRow,
        col: letter,
        cell: `${letter}${excelRow}`,
        field,
        header: columns[idx]?.header || FIELD_LABEL[field],
        serialNo: Math.trunc(serialNo),
        value,
        problem,
      });
    };

    const station = cellAt(r, col.station);
    if (col.station >= 0) {
      const fromGhr = station ? null : stationFromGhrNumber(cellAt(r, col.ghr), STATIONS);
      if (!station && fromGhr) add("station", station, `Station taken from GHR no. (${fromGhr})`);
      else if (!station) add("station", station, "Station is blank");
      else if (PLACEHOLDER.test(station)) add("station", station, "Placeholder value instead of a station code");
      else if (!/^[A-Za-z]{3}$/.test(station)) add("station", station, "Unrecognised station code (expected 3-letter IATA code)");
      else stationsSeen.add(station.toUpperCase());
    }

    const status = cellAt(r, col.status);
    if (col.status >= 0) {
      if (!status) add("status", status, "Status is blank");
      else if (PLACEHOLDER.test(status)) add("status", status, "Placeholder value instead of a status");
      else if (normalizeStatus(status) === "Not set") add("status", status, "Unknown status value");
    }

    const category = cellAt(r, col.category);
    if (col.category >= 0) {
      if (!category) add("category", category, "Category is blank");
      else if (PLACEHOLDER.test(category)) add("category", category, "Placeholder value (NIL/NONE/N/A) instead of a category");
      else if (normalizeCategory(category) === "Not set") add("category", category, "Unknown category value");
    }

    const type = cellAt(r, col.incidentType);
    if (col.incidentType >= 0) {
      const parts = splitMultiValue(type);
      if (!type) add("incidentType", type, "Incident type is blank");
      else if (parts.every((p) => PLACEHOLDER.test(p))) add("incidentType", type, "Placeholder value instead of an incident type");
    }

    if (col.date >= 0) {
      const dateText = cellAt(r, col.date);
      if (dateText) {
        const parsed = parseFlexibleDate(r[col.date]);
        // Only unreadable dates are flagged. (Day/month order is ambiguous in this sheet; see report.)
        if (!parsed) add("date", dateText, "Date could not be read");
        // Reporting delay: a report date earlier than the incident date is a data problem, never negative days.
        const reportText = cellAt(r, col.reportDate);
        const reported = parsed && reportText ? parseFlexibleDate(r[col.reportDate]) : null;
        if (parsed && reported && reported.getTime() < parsed.getTime() - 12 * 3600_000) {
          const letter = toExcelCol(col.reportDate, originCol);
          issues.push({
            row: excelRow,
            col: letter,
            cell: `${letter}${excelRow}`,
            field: "date",
            header: columns[col.reportDate]?.header || "Reporting Date",
            serialNo: Math.trunc(serialNo),
            value: reportText,
            problem: "Reporting date is before the incident date",
          });
        }
      }
    }
  }

  return {
    sheetName,
    headerRow: toExcelRow(headerIdx, originRow),
    columns,
    rows: gridRows,
    issues,
    options: {
      station: [...new Set([...STATIONS, ...stationsSeen])].sort(),
      status: STATUS_OPTIONS,
      category: CATEGORY_OPTIONS,
    },
  };
}

export function correctedWorkbook(bytes: ArrayBuffer, overrides: CellOverride[]): ArrayBuffer {
  return applyOverrides(bytes, overrides);
}