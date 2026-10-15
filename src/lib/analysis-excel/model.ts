import { departmentsOf, incidentTypesOf } from "../analytics";
import { isValidMonthKey, monthLabelFromKey } from "../parse/utils";
import { dataMonthKeys } from "../month-range";
import { buildStationSummaries } from "../station-summary";
import type { Incident } from "../types";
import { HIDDEN, type PersonalColumn } from "./privacy";

/**
 * PA-12: pure model for the Analysis Excel export (no DOM, no Node APIs, safe on Workers).
 * Every count is computed with the app's own split logic (incidentTypesOf / departmentsOf),
 * and every formula counts exact values in hidden Log helper columns (no wildcards).
 */
export const LOG_SHEET = "Log";
export const LOG_HEADER_ROW = 4;
export const LOG_FIRST_ROW = 5;
export const LOG_MAX_ROW = 1000;

export const HELPER_COLUMNS = {
  station: "BD",
  category: "BE",
  status: "BF",
  type1: "BG",
  type2: "BH",
  dept1: "BI",
  dept2: "BJ",
  month: "BK",
} as const;
export type HelperKey = keyof typeof HELPER_COLUMNS;

export const HELPER_HEADERS: Record<HelperKey, string> = {
  station: "H_Station",
  category: "H_Category",
  status: "H_Status",
  type1: "H_Type1",
  type2: "H_Type2",
  dept1: "H_Dept1",
  dept2: "H_Dept2",
  month: "H_Month",
};

export type HelperRow = {
  logRow: number;
  /** Excel row in the uploaded incident log (header on row 4), or null if unknown. */
  sourceRow: number | null;
  serialNo: number;
  ghr: string;
  title: string;
  date: string;
  station: string;
  category: string;
  status: "Closed" | "Not closed";
  rawStatus: string;
  type1: string;
  type2: string;
  dept1: string;
  dept2: string;
  monthKey: string;
};

export type GridCell = {
  v: string | number;
  /** Formula text without the leading "=" */
  f?: string;
  /** Internal link target such as "#Log!A12" */
  link?: string;
  /** Log rows that make up this number (for hover) */
  rows?: number[];
  kind?: "header" | "total" | "percent" | "month" | "hidden";
};

export type SheetModel = { name: string; title: string; note?: string; rows: GridCell[][] };

export type BreakdownItem = { label: string; value: number; rows: number[] };

export type AnalysisModel = {
  helpers: HelperRow[];
  stations: BreakdownItem[];
  categories: BreakdownItem[];
  types: BreakdownItem[];
  departments: BreakdownItem[];
  months: (BreakdownItem & { monthKey: string })[];
  notClosed: HelperRow[];
  checks: { incidents: number; typeEntries: number; deptEntries: number; closed: number; notClosed: number; serious: number };
  sheets: SheetModel[];
};

export function helperRange(key: HelperKey): string {
  const c = HELPER_COLUMNS[key];
  return `${LOG_SHEET}!$${c}$${LOG_FIRST_ROW}:$${c}$${LOG_MAX_ROW}`;
}

/** COUNTIFS over one or more helper columns, exact match on the item cell (no wildcards). */
export function countFormula(keys: HelperKey[], criteriaCell: string): string {
  return keys.map((k) => `COUNTIFS(${helperRange(k)},${criteriaCell})`).join("+");
}

export function firstRowLinkFormula(key: HelperKey, criteriaCell: string): string {
  return `IFERROR(HYPERLINK("#${LOG_SHEET}!A"&(MATCH(${criteriaCell},${helperRange(key)},0)+${LOG_FIRST_ROW - 1}),"Open in log"),"")`;
}

export function logLink(row: number): string {
  return `#${LOG_SHEET}!A${row}`;
}

function sourceRowOf(incident: Incident): number | null {
  const m = /^row-(\d+)-/.exec(incident.id);
  return m ? Number(m[1]) + 1 : null;
}

export function buildHelperRows(incidents: Incident[]): HelperRow[] {
  return incidents.map((inc, i) => {
    const types = incidentTypesOf(inc);
    const depts = departmentsOf(inc);
    return {
      logRow: LOG_FIRST_ROW + i,
      sourceRow: sourceRowOf(inc),
      serialNo: inc.serialNo,
      ghr: inc.ghrNumber,
      title: inc.title,
      date: inc.dateLabel,
      station: String(inc.station || "Unknown"),
      category: inc.category || "Not set",
      status: inc.status === "Closed" ? "Closed" : "Not closed",
      rawStatus: inc.status,
      type1: types[0] ?? "Not set",
      type2: types[1] ?? "",
      dept1: depts[0] ?? "Not set",
      dept2: depts[1] ?? "",
      monthKey: isValidMonthKey(inc.monthKey) ? inc.monthKey : "",
    };
  });
}

function tally(helpers: HelperRow[], pick: (h: HelperRow) => string[]): BreakdownItem[] {
  const map = new Map<string, number[]>();
  for (const h of helpers) {
    for (const v of pick(h)) {
      if (!v) continue;
      const list = map.get(v) ?? [];
      list.push(h.logRow);
      map.set(v, list);
    }
  }
  return [...map.entries()].map(([label, rows]) => ({ label, value: rows.length, rows }));
}

/** Count descending, then label; "Not set" (and "Unknown") always last. */
export function sortItems(items: BreakdownItem[]): BreakdownItem[] {
  const last = (l: string) => (l === "Not set" || l === "Unknown" ? 1 : 0);
  return [...items].sort((a, b) => last(a.label) - last(b.label) || b.value - a.value || a.label.localeCompare(b.label));
}

const CATEGORY_ORDER = ["CAT-A", "CAT-B", "CAT-C", "CAT-D", "NIL", "Not set"];

function breakdownSheet(
  name: string,
  title: string,
  items: BreakdownItem[],
  keys: HelperKey[],
  total: number,
  note?: string,
): SheetModel {
  const rows: GridCell[][] = [
    [{ v: "Item", kind: "header" }, { v: "Incidents", kind: "header" }, { v: "% of incidents", kind: "header" }, { v: "Link", kind: "header" }],
  ];
  items.forEach((it, i) => {
    const r = LOG_FIRST_ROW + i;
    rows.push([
      { v: it.label, link: it.rows[0] ? logLink(it.rows[0]) : undefined },
      { v: it.value, f: countFormula(keys, `A${r}`), rows: it.rows },
      { v: total ? Math.round((it.value / total) * 1000) / 1000 : 0, f: `IFERROR(B${r}/Dashboard!$B$5,0)`, kind: "percent" },
      { v: "Open in log", f: firstRowLinkFormula(keys[0]!, `A${r}`), link: it.rows[0] ? logLink(it.rows[0]) : undefined },
    ]);
  });
  const end = LOG_FIRST_ROW + items.length - 1;
  rows.push([
    { v: "Total", kind: "total" },
    { v: items.reduce((a, b) => a + b.value, 0), f: `SUM(B${LOG_FIRST_ROW}:B${end})`, kind: "total" },
    { v: "" },
    { v: "" },
  ]);
  return { name, title, note, rows };
}

export type ModelOptions = {
  /** Matrix written to the Log (masked when personal details are hidden). */
  sourceRows?: unknown[][];
  /** Personal-data columns shown in the Log preview. */
  personalColumns?: PersonalColumn[];
};

export function buildAnalysisModel(incidents: Incident[], options: ModelOptions = {}): AnalysisModel {
  const personal = options.personalColumns ?? [];
  const srcRows = options.sourceRows ?? [];
  const helpers = buildHelperRows(incidents);
  const total = helpers.length;

  // PA-13: same order as the Station-Wise page (Needs attention first ... Unknown last).
  const stationTally = new Map(tally(helpers, (h) => [h.station]).map((s) => [s.label, s]));
  const stations = buildStationSummaries(incidents)
    .map((s) => stationTally.get(String(s.station)))
    .filter((s): s is BreakdownItem => Boolean(s));
  const catMap = new Map(tally(helpers, (h) => [h.category]).map((c) => [c.label, c]));
  const categories = CATEGORY_ORDER.map((c) => catMap.get(c) ?? { label: c, value: 0, rows: [] });
  const types = sortItems(tally(helpers, (h) => [h.type1, h.type2]));
  const departments = sortItems(tally(helpers, (h) => [h.dept1, h.dept2]));
  const monthRows = new Map(tally(helpers, (h) => [h.monthKey]).map((m) => [m.label, m]));
  const months = dataMonthKeys(incidents).map((k) => {
    const m = monthRows.get(k);
    return { monthKey: k, label: monthLabelFromKey(k), value: m?.value ?? 0, rows: m?.rows ?? [] };
  });
  const notClosed = helpers.filter((h) => h.status === "Not closed");
  const closedRows = helpers.filter((h) => h.status === "Closed").map((h) => h.logRow);
  const seriousRows = helpers.filter((h) => h.category === "CAT-A" || h.category === "CAT-B").map((h) => h.logRow);

  const checks = {
    incidents: total,
    typeEntries: types.reduce((a, b) => a + b.value, 0),
    deptEntries: departments.reduce((a, b) => a + b.value, 0),
    closed: closedRows.length,
    notClosed: notClosed.length,
    serious: seriousRows.length,
  };

  const summary: SheetModel = {
    name: "Summary",
    title: "Bird Safety Incident Dashboard",
    note: "All figures are live formulas on the Log sheet.",
    rows: [
      [{ v: "Total incidents" }, { v: total, f: `COUNTA(${LOG_SHEET}!B${LOG_FIRST_ROW}:B${LOG_MAX_ROW})`, rows: helpers.map((h) => h.logRow) }],
      [{ v: "Closed" }, { v: checks.closed, f: `COUNTIFS(${helperRange("status")},"Closed")`, rows: closedRows }],
      [{ v: "Not closed" }, { v: checks.notClosed, f: `COUNTIFS(${helperRange("status")},"Not closed")`, rows: notClosed.map((h) => h.logRow) }],
      [{ v: "Serious (A+B)" }, { v: checks.serious, f: `COUNTIFS(${helperRange("category")},"CAT-A")+COUNTIFS(${helperRange("category")},"CAT-B")`, rows: seriousRows }],
      [{ v: "Closure rate" }, { v: total ? Math.round((checks.closed / total) * 1000) / 1000 : 0, f: "IFERROR(B6/B5,0)", kind: "percent" }],
    ],
  };

  const monthly: SheetModel = {
    name: "Monthly",
    title: "Incidents by month",
    rows: [
      [{ v: "Month", kind: "header" }, { v: "Incidents", kind: "header" }],
      ...months.map((m, i) => [
        { v: m.label, kind: "month" as const },
        { v: m.value, f: countFormula(["month"], `A${LOG_FIRST_ROW + i}`), rows: m.rows },
      ]),
    ],
  };

  const notClosedSheet: SheetModel = {
    name: "Not closed",
    title: "Incidents not closed",
    note: "Every incident whose status is not Closed. Click a row to open it in the Log.",
    rows: [
      ["S.No.", "GHR No.", "Incident Title", "Station", "Status", "Category", "Link"].map((v) => ({ v, kind: "header" as const })),
      ...notClosed.map((h) => [
        { v: h.serialNo },
        { v: h.ghr },
        { v: h.title },
        { v: h.station },
        { v: h.rawStatus || "Not set" },
        { v: h.category },
        { v: "Open in log", f: `HYPERLINK("${logLink(h.logRow)}","Open in log")`, link: logLink(h.logRow), rows: [h.logRow] },
      ]),
    ],
  };

  const log: SheetModel = {
    name: LOG_SHEET,
    title: "Incident log (helper columns BD–BK are hidden in the file)",
    rows: [
      ["Log row", "S.No.", "GHR No.", "Title", "Date", ...personal.map((p) => p.header), ...Object.values(HELPER_HEADERS)].map((v) => ({ v, kind: "header" as const })),
      ...helpers.map((h) => [
        { v: h.logRow, link: logLink(h.logRow) },
        { v: h.serialNo },
        { v: h.ghr },
        { v: h.title },
        { v: h.date },
        ...personal.map((p) => {
          const raw = h.sourceRow ? srcRows[h.sourceRow - 1]?.[p.index] : undefined;
          const v = raw == null ? "" : String(raw).trim();
          return v === HIDDEN ? { v, kind: "hidden" as const } : { v };
        }),
        { v: h.station },
        { v: h.category },
        { v: h.status },
        { v: h.type1 },
        { v: h.type2 },
        { v: h.dept1 },
        { v: h.dept2 },
        { v: h.monthKey ? monthLabelFromKey(h.monthKey) : "" },
      ]),
    ],
  };

  const sheets: SheetModel[] = [
    summary,
    breakdownSheet("Station", "Incidents by station", stations, ["station"], total),
    breakdownSheet("Category", "Incidents by category", categories, ["category"], total),
    breakdownSheet("Type", "Incidents by type (an incident can have 2 types)", types, ["type1", "type2"], total),
    breakdownSheet("Department", "Incidents by department (an incident can have 2)", departments, ["dept1", "dept2"], total),
    monthly,
    notClosedSheet,
    log,
  ];

  return { helpers, stations, categories, types, departments, months, notClosed, checks, sheets };
}
