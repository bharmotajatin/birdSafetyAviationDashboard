import { SHEET_CONFIG, STATIONS } from "../constants";
import type { Incident } from "../types";
import {
  detectHeaderRow,
  detectIncidentHeaderRow,
  findSheet,
  formatDisplayDate,
  getField,
  getRawField,
  matrixToRecords,
  monthKeyFromDate,
  normalizeCategory,
  normalizeDepartment,
  normalizeIncidentType,
  normalizeStation,
  normalizeStatus,
  parseFlexibleDate,
  parseNumber,
} from "./utils";

const INCIDENT_ALIASES = {
  serialNo: ["s.no", "sno", "sr no", "serial no", "serial", "#", "sl no", "sl.no"],
  title: [
    "incident title",
    "title of incident",
    "incident name",
    "incident description",
    "description of incident",
  ],
  ghrNumber: ["ghr number", "ghr no", "ghr no.", "ghr#", "ghr", "ghr id"],
  date: [
    "incident date",
    "date of incident",
    "occurrence date",
    "date reported",
    "reported date",
    "date",
  ],
  category: [
    "category",
    "cat",
    "severity category",
    "incident category",
    "severity",
    "cat.",
  ],
  incidentType: [
    "incident type",
    "type of incident",
    "event type",
    "classification",
  ],
  department: [
    "department involved",
    "department",
    "dept",
    "dept.",
    "department name",
    "division",
  ],
  status: ["status", "current status", "incident status", "case status"],
  station: [
    "station",
    "station code",
    "airport",
    "airport code",
    "location code",
    "base",
  ],
  brief: [
    "incident brief",
    "brief",
    "description",
    "details",
    "narrative",
    "incident details",
    "brief description",
  ],
  rootCause: ["root cause", "root cause analysis", "rca", "cause"],
  correctiveAction: [
    "corrective action",
    "corrective actions",
    "capa",
    "action taken",
    "corrective measure",
  ],
  immediateAction: [
    "immediate action",
    "immediate action taken",
    "immediate actions",
    "initial action",
  ],
  location: ["location of incident", "location", "area", "bay", "place", "exact location"],
  time: ["time", "incident time", "occurrence time", "time of incident"],
  personInvolved: [
    "person involved",
    "person",
    "employee",
    "staff name",
    "name of person",
  ],
  equipment: ["equipment", "equipment details", "asset", "gse", "equipment involved"],
  contributingFactor: [
    "contributing factor",
    "factor category",
    "factor",
    "contributing factors",
    "human factor",
  ],
};

export function parseIncidentLog(sheets: { name: string; rows: unknown[][] }[]): Incident[] {
  const sheet = findSheet(sheets, [...SHEET_CONFIG.incidentLog.names]);
  if (!sheet) return [];

  const headerRow = detectIncidentHeaderRow(sheet.rows, SHEET_CONFIG.incidentLog.headerRow);
  const headerCells = sheet.rows[headerRow] ?? [];
  const headers = headerCells.map((cell: unknown, index: number) => {
    const label = String(cell ?? "").trim();
    return label || `Column ${index + 1}`;
  });

  const incidents: Incident[] = [];
  const usedIds = new Set<string>();

  for (let i = headerRow + 1; i < sheet.rows.length; i++) {
    const rawRow = sheet.rows[i] ?? [];
    const row: Record<string, string> = {};
    headers.forEach((header: string, index: number) => {
      row[header] = String(rawRow[index] ?? "").trim();
    });

    const title = getField(row, INCIDENT_ALIASES.title);
    const ghr = getField(row, INCIDENT_ALIASES.ghrNumber);
    if (!title && !ghr) continue;

    const serialRaw = getField(row, INCIDENT_ALIASES.serialNo);
    const serialParsed = Number(String(serialRaw).replace(/[^0-9.-]/g, ""));
    // Skip header/footer/summary rows where S.No. is not a real number
    if (!serialRaw || !Number.isFinite(serialParsed) || serialParsed <= 0) continue;

    const rawDate = getRawField(
      Object.fromEntries(headers.map((header: string, index: number) => [header, rawRow[index]])),
      INCIDENT_ALIASES.date,
    );
    const date = parseFlexibleDate(rawDate);
    const serialNo = Math.trunc(serialParsed);
    const ghrNumber = ghr || `GHR-${serialNo}`;

    let id = `row-${i}-${ghrNumber}-${serialNo}`;
    if (usedIds.has(id)) {
      id = `${id}-dup`;
    }
    usedIds.add(id);

    const incident: Incident = {
      id,
      serialNo,
      title: title || `Incident ${serialNo}`,
      ghrNumber,
      date,
      dateLabel: formatDisplayDate(date),
      category: normalizeCategory(getField(row, INCIDENT_ALIASES.category)),
      incidentType: normalizeIncidentType(
        getField(row, INCIDENT_ALIASES.incidentType) || "Unknown",
      ),
      department: normalizeDepartment(getField(row, INCIDENT_ALIASES.department)),
      status: normalizeStatus(getField(row, INCIDENT_ALIASES.status)),
      station: normalizeStation(getField(row, INCIDENT_ALIASES.station) || "DEL"),
      brief: getField(row, INCIDENT_ALIASES.brief),
      rootCause: getField(row, INCIDENT_ALIASES.rootCause),
      correctiveAction: getField(row, INCIDENT_ALIASES.correctiveAction),
      immediateAction: getField(row, INCIDENT_ALIASES.immediateAction),
      location: getField(row, INCIDENT_ALIASES.location),
      time: getField(row, INCIDENT_ALIASES.time),
      personInvolved: getField(row, INCIDENT_ALIASES.personInvolved),
      equipment: getField(row, INCIDENT_ALIASES.equipment),
      contributingFactor: getField(row, INCIDENT_ALIASES.contributingFactor),
      monthKey: monthKeyFromDate(date),
    };

    incidents.push(incident);
  }

  return incidents;
}

export function ensureUniqueIncidentIds(incidents: Incident[]): Incident[] {
  const seen = new Set<string>();
  return incidents.map((incident, index) => {
    if (!seen.has(incident.id)) {
      seen.add(incident.id);
      return incident;
    }
    const uniqueId = `${incident.id}::${index}`;
    seen.add(uniqueId);
    return { ...incident, id: uniqueId };
  });
}

export function parseMonthlyTrendFromSheet(
  sheets: { name: string; rows: unknown[][] }[],
): {
  monthKey: string;
  total: number;
  catA: number;
  catB: number;
  catC: number;
  catD: number;
  closed: number;
  open: number;
  closureRate: number;
}[] {
  const sheet = findSheet(sheets, [...SHEET_CONFIG.monthlyTrend.names]);
  if (!sheet) return [];

  // Config headerRow is 1-based Excel row; detectHeaderRow converts to 0-index.
  const headerRow = detectHeaderRow(sheet.rows, SHEET_CONFIG.monthlyTrend.headerRow + 1);
  // Prefer exact index 10 when it looks like a header (user workbook layout).
  const preferred = SHEET_CONFIG.monthlyTrend.headerRow;
  const preferredCells = (sheet.rows[preferred] ?? []).map((c) =>
    String(c ?? "").toLowerCase(),
  );
  const usePreferred =
    preferredCells.some((c) => c.includes("month")) &&
    preferredCells.some((c) => c.includes("total"));
  const resolvedHeader = usePreferred ? preferred : headerRow;
  const { rows } = matrixToRecords(sheet.rows, resolvedHeader);

  return rows
    .map((row) => {
      const month = getField(row, ["month", "period", "month year"]);
      if (!month) return null;
      const total = parseNumber(
        getField(row, ["total incidents", "total", "incidents"]),
      );
      if (!total && !getField(row, ["cat-a", "cata", "cat a", "cat-a critical"])) {
        return null;
      }
      const date = parseFlexibleDate(`01 ${month}`);
      return {
        monthKey: date ? monthKeyFromDate(date) : month,
        total,
        catA: parseNumber(getField(row, ["cat-a critical", "cat-a", "cata", "cat a", "critical"])),
        catB: parseNumber(getField(row, ["cat-b high", "cat-b", "catb", "cat b"])),
        catC: parseNumber(getField(row, ["cat-c medium", "cat-c", "catc", "cat c"])),
        catD: parseNumber(getField(row, ["cat-d low", "cat-d", "catd", "cat d"])),
        closed: parseNumber(getField(row, ["closed"])),
        open: parseNumber(getField(row, ["open", "open cases"])),
        closureRate: parseNumber(getField(row, ["closure rate", "closure"])),
      };
    })
    .filter(
      (
        item,
      ): item is {
        monthKey: string;
        total: number;
        catA: number;
        catB: number;
        catC: number;
        catD: number;
        closed: number;
        open: number;
        closureRate: number;
      } => !!item,
    );
}

export function parsePanIndiaStationCodes(
  sheets: { name: string; rows: unknown[][] }[],
): string[] {
  const sheet = findSheet(sheets, [...SHEET_CONFIG.panIndia.names]);
  if (!sheet) return [...STATIONS];

  const row = sheet.rows[SHEET_CONFIG.panIndia.stationRow] ?? [];
  const codes: string[] = row
    .map((cell: unknown) => normalizeStation(String(cell ?? "")))
    .filter((code: string) => /^[A-Z]{3}$/.test(code));

  return codes.length > 0 ? [...new Set(codes)] : [...STATIONS];
}

export function parseContributingFactorsFromSheet(
  sheets: { name: string; rows: unknown[][] }[],
): { label: string; value: number }[] {
  const sheet = findSheet(sheets, [...SHEET_CONFIG.stationAnalysis.names], [
    ...SHEET_CONFIG.stationAnalysis.exclude,
  ]);
  if (!sheet) return [];

  const headerRow = detectHeaderRow(
    sheet.rows,
    SHEET_CONFIG.stationAnalysis.headerRow,
  );
  const { rows } = matrixToRecords(sheet.rows, headerRow);

  const factors = rows
    .map((row) => ({
      label: getField(row, ["contributing factor", "factor", "factor category"]),
      value: parseNumber(getField(row, ["count", "total", "incidents"])),
    }))
    .filter((item) => item.label && item.value > 0);

  return factors.length > 0 ? factors : [];
}
