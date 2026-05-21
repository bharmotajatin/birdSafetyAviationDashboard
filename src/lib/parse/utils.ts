import * as XLSX from "xlsx";
import type { RawSheetMatrix } from "../types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const MIN_MONTH_KEY = "2020-01";
const MIN_DATA_YEAR = 2020;

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function isYearInRange(date: Date): boolean {
  return date.getFullYear() >= MIN_DATA_YEAR;
}

export function isValidMonthKey(key: string): boolean {
  if (!key || key === "unknown") return false;
  if (!/^\d{4}-\d{2}$/.test(key)) return false;
  return key >= MIN_MONTH_KEY;
}

export function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return formatIsoDate(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 25000 && value < 60000) {
      const parsed = parseExcelSerialDate(value);
      if (parsed) return formatIsoDate(parsed);
    }
    return String(value);
  }
  return String(value).trim();
}

export function parseExcelSerialDate(serial: number): Date | null {
  if (serial < 25000) return null;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  const date = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S);
  if (!isValidDate(date) || !isYearInRange(date)) return null;
  return date;
}

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseFlexibleDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && isValidDate(value)) {
    return isYearInRange(value) ? value : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return parseExcelSerialDate(value);
  }

  const text = cellToString(value);
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return isValidDate(date) && isYearInRange(date) ? date : null;
  }

  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    const date = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]));
    return isValidDate(date) && isYearInRange(date) ? date : null;
  }

  const parsed = new Date(text);
  if (isValidDate(parsed) && isYearInRange(parsed)) return parsed;

  return null;
}

export function monthKeyFromDate(date: Date | null): string {
  if (!date || !isYearInRange(date)) return "unknown";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthLabelFromKey(key: string): string {
  if (!isValidMonthKey(key)) return "Unknown";
  const [year, month] = key.split("-");
  if (!year || !month) return key;
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (!isValidDate(date)) return key;
  return `${MONTHS[date.getMonth()]} ${year}`;
}

export function normalizeCategory(value: string): "CAT-A" | "CAT-B" | "CAT-C" | "CAT-D" {
  const text = value.toUpperCase().replace(/\s+/g, "");
  if (/^CAT-?A$/.test(text) || text === "CATA" || /^A$/.test(text)) return "CAT-A";
  if (/^CAT-?B$/.test(text) || text === "CATB" || /^B$/.test(text)) return "CAT-B";
  if (/^CAT-?C$/.test(text) || text === "CATC" || /^C$/.test(text)) return "CAT-C";
  if (/^CAT-?D$/.test(text) || text === "CATD" || /^D$/.test(text)) return "CAT-D";
  return "CAT-D";
}

export function normalizeStatus(value: string): "Open" | "In Progress" | "Closed" | "Pending" {
  const text = value.toLowerCase();
  if (text.includes("progress")) return "In Progress";
  if (text.includes("pending")) return "Pending";
  if (text.includes("closed") || text.includes("complete")) return "Closed";
  if (text.includes("open")) return "Open";
  return "Closed";
}

/** Merge duplicate types from inconsistent Excel casing (e.g. STAFF INJURY vs Staff Injury). */
export function normalizeIncidentType(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Unknown";

  const lower = trimmed.toLowerCase();
  if (lower === "a/c damage" || lower === "ac damage") return "A/C Damage";

  return lower
    .split(/\s+/)
    .map((word) => {
      if (word === "a/c") return "A/C";
      if (word.length <= 3 && /^[a-z]+$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function normalizeDepartment(value: string): string {
  const text = value.toUpperCase();
  if (text.includes("RAMP")) return "RAMP";
  if (text.includes("GSD")) return "GSD";
  if (text.includes("CARGO")) return "CARGO";
  return value.trim() || "OTHER";
}

export function normalizeStation(value: string): string {
  const text = value.trim().toUpperCase();
  if (text.length >= 3) return text.slice(0, 3);
  return text || "DEL";
}

export function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = cellToString(value).replace(/[^0-9.-]/g, "");
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
}

export function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export function countBy<T>(
  items: T[],
  keyFn: (item: T) => string,
): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function getField(row: Record<string, string>, aliases: string[]): string {
  const normalizedRow: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalizedRow[normalizeKey(key)] = cellToString(value);
  }

  const sortedAliases = [...aliases].sort((a, b) => b.length - a.length);

  for (const alias of sortedAliases) {
    const key = normalizeKey(alias);
    const value = normalizedRow[key];
    if (value != null && value !== "") return value;
  }

  for (const alias of sortedAliases) {
    const key = normalizeKey(alias);
    if (key.length < 4) continue;

    const match = Object.entries(normalizedRow)
      .filter(([columnKey]) => columnKey === key || columnKey.startsWith(key))
      .sort(([a], [b]) => a.length - b.length)[0];

    if (match?.[1] != null && match[1] !== "") return match[1];
  }

  return "";
}

export function getRawField(row: Record<string, unknown>, aliases: string[]): unknown {
  const normalizedRow: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalizedRow[normalizeKey(key)] = value;
  }

  const sortedAliases = [...aliases].sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    const key = normalizeKey(alias);
    const value = normalizedRow[key];
    if (value != null && cellToString(value) !== "") return value;
  }
  return null;
}

export function formatDisplayDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function readWorkbookMatrices(
  buffer: ArrayBuffer,
): { name: string; rows: unknown[][] }[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name]!, {
      header: 1,
      defval: "",
      raw: false,
    }),
  }));
}

export function findSheet(
  sheets: { name: string; rows: unknown[][] }[],
  matchers: RegExp[],
  exclude: RegExp[] = [],
): { name: string; rows: unknown[][] } | undefined {
  return sheets.find((sheet) => {
    if (exclude.some((pattern) => pattern.test(sheet.name))) return false;
    return matchers.some((pattern) => pattern.test(sheet.name));
  });
}

const GENERIC_HEADER_HINTS = [
  "incident",
  "ghr",
  "category",
  "status",
  "station",
  "date",
  "month",
  "total",
];

const INCIDENT_HEADER_HINTS = [
  "s.no",
  "sno",
  "serial",
  "incident title",
  "ghr",
  "date of incident",
  "incident date",
  "department",
  "incident category",
  "category",
  "status",
  "station",
];

export function detectHeaderRow(
  rows: unknown[][],
  fallbackRow: number,
  hints: string[] = GENERIC_HEADER_HINTS,
  minScore = 2,
): number {
  const maxScan = Math.min(rows.length, fallbackRow + 8);
  const fallbackIndex = Math.max(0, fallbackRow - 1);

  let bestIndex = fallbackIndex;
  let bestScore = 0;

  for (let i = 0; i < maxScan; i++) {
    const cells = (rows[i] ?? []).map((cell) => cellToString(cell).toLowerCase());
    const line = cells.join(" ");
    let score = 0;
    for (const hint of hints) {
      if (cells.some((c) => c.includes(hint)) || line.includes(hint)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestScore >= minScore) return bestIndex;
  return fallbackIndex;
}

export function detectIncidentHeaderRow(rows: unknown[][], fallbackRow: number): number {
  return detectHeaderRow(rows, fallbackRow, INCIDENT_HEADER_HINTS, 4);
}

export function matrixToRecords(rows: unknown[][], headerRow: number) {
  const headerCells = rows[headerRow] ?? [];
  const headers = headerCells.map(
    (cell, index) => cellToString(cell) || `Column ${index + 1}`,
  );
  const records: Record<string, string>[] = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const rawRow = rows[i] ?? [];
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cellToString(rawRow[index]);
    });
    records.push(row);
  }

  return { headers, rows: records };
}

export function readSheetMatrix(sheet: XLSX.WorkSheet, name = ""): RawSheetMatrix {
  return {
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }),
  };
}
