import type { Incident } from "@/lib/types";
import { navigateFiltersFromQueryParts } from "./navigateFilters";
import type { NaturalQueryResult } from "./types";

const MONTH_ALIASES: Record<string, string> = {
  january: "01",
  jan: "01",
  february: "02",
  feb: "02",
  march: "03",
  mar: "03",
  april: "04",
  apr: "04",
  may: "05",
  june: "06",
  jun: "06",
  july: "07",
  jul: "07",
  august: "08",
  aug: "08",
  september: "09",
  sep: "09",
  sept: "09",
  october: "10",
  oct: "10",
  november: "11",
  nov: "11",
  december: "12",
  dec: "12",
};

type ParsedFilters = {
  category?: Incident["category"];
  status?: Incident["status"];
  department?: string;
  monthKeys: string[];
  years: string[];
  typeTerms: string[];
  intent: "count" | "list" | "which" | "show";
};

function normalizeText(query: string) {
  return query.toLowerCase().replace(/[^a-z0-9\s/-]/g, " ");
}

function extractCategory(text: string): Incident["category"] | undefined {
  if (/\b(cat[\s-]?a|critical)\b/.test(text)) return "CAT-A";
  if (/\b(cat[\s-]?b|high)\b/.test(text)) return "CAT-B";
  if (/\b(cat[\s-]?c|medium)\b/.test(text)) return "CAT-C";
  if (/\b(cat[\s-]?d|low)\b/.test(text)) return "CAT-D";
  return undefined;
}

function extractStatus(text: string): Incident["status"] | undefined {
  if (/\bin[\s-]?progress\b/.test(text)) return "In Progress";
  if (/\bopen\b/.test(text)) return "Open";
  if (/\bclosed\b/.test(text)) return "Closed";
  if (/\bpending\b/.test(text)) return "Pending";
  return undefined;
}

function extractDepartment(text: string): string | undefined {
  if (/\bramp\b/.test(text)) return "RAMP";
  if (/\bgsd\b/.test(text)) return "GSD";
  if (/\bcargo\b/.test(text)) return "CARGO";
  if (/\bpax\b|\bpassenger\b/.test(text)) return "PAX";
  return undefined;
}

function extractMonthParts(text: string): string[] {
  const months: string[] = [];
  for (const [alias, mm] of Object.entries(MONTH_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(text)) months.push(mm);
  }
  return months;
}

function buildMonthKeys(text: string, years: string[]): string[] {
  const months = extractMonthParts(text);
  if (months.length === 0) return [];
  if (years.length === 0) return months.map((mm) => `-${mm}`);
  return years.flatMap((y) => months.map((mm) => `${y}-${mm}`));
}

function extractYears(text: string): string[] {
  return [...new Set([...text.matchAll(/\b(20\d{2})\b/g)].map((m) => m[1]))];
}

function extractTypeTerms(text: string): string[] {
  const terms: string[] = [];
  if (/\bnear[\s-]?miss\b/.test(text)) terms.push("near miss");
  if (/\bstaff[\s-]?injur/.test(text)) terms.push("staff injury");
  if (/\bgse\b/.test(text)) terms.push("gse");
  if (/\bloading[\s-]?error\b/.test(text)) terms.push("loading error");
  if (/\ba\/?c[\s-]?damage\b|\baircraft[\s-]?damage\b/.test(text)) terms.push("a/c damage");
  if (/\bslip\b/.test(text)) terms.push("slip");
  return terms;
}

function extractIntent(text: string): ParsedFilters["intent"] {
  if (/\bhow many\b|\bcount\b|\bnumber of\b/.test(text)) return "count";
  if (/\bwhich\b|\bhighest\b|\blowest\b|\bworst\b|\bbest\b/.test(text)) return "which";
  if (/\bshow\b|\blist\b|\bdisplay\b/.test(text)) return "show";
  return "show";
}

function parseFilters(query: string): ParsedFilters {
  const text = normalizeText(query);
  return {
    category: extractCategory(text),
    status: extractStatus(text),
    department: extractDepartment(text),
    monthKeys: buildMonthKeys(text, extractYears(text)),
    years: extractYears(text),
    typeTerms: extractTypeTerms(text),
    intent: extractIntent(text),
  };
}

function refineMonthMatch(incident: Incident, filters: ParsedFilters) {
  if (filters.monthKeys.length > 0) {
    return filters.monthKeys.some((mk) => {
      if (/^\d{4}-\d{2}$/.test(mk)) return incident.monthKey === mk;
      if (mk.startsWith("-")) return incident.monthKey.endsWith(mk);
      return false;
    });
  }
  if (filters.years.length > 0) {
    return filters.years.some((y) => incident.monthKey.startsWith(y));
  }
  return true;
}

function buildFilterDescription(filters: ParsedFilters): string {
  const parts: string[] = [];
  if (filters.category) parts.push(filters.category);
  if (filters.status) parts.push(filters.status);
  if (filters.department) parts.push(filters.department);
  if (filters.typeTerms.length) parts.push(filters.typeTerms.join(", "));
  if (filters.monthKeys.length) parts.push(`months ${filters.monthKeys.join(", ")}`);
  else if (filters.years.length) parts.push(`year ${filters.years.join(", ")}`);
  return parts.length ? parts.join(" · ") : "all incidents";
}

export function parseNaturalQuery(query: string, incidents: Incident[]): NaturalQueryResult {
  const filters = parseFilters(query);
  const matchedIncidents = incidents.filter((incident) => {
    if (filters.category && incident.category !== filters.category) return false;
    if (filters.status && incident.status !== filters.status) return false;
    if (filters.department && incident.department !== filters.department) return false;
    if (!refineMonthMatch(incident, filters)) return false;
    if (filters.typeTerms.length > 0) {
      const hay = incident.incidentType.toLowerCase();
      if (!filters.typeTerms.some((t) => hay.includes(t))) return false;
    }
    return true;
  });

  const filterDescription = buildFilterDescription(filters);
  const count = matchedIncidents.length;

  let summary: string;
  if (count === 0) {
    summary = `Found 0 incidents matching ${filterDescription}.`;
  } else if (filters.intent === "count" || /\bhow many\b/i.test(query)) {
    summary = `Found ${count} incident${count === 1 ? "" : "s"} for ${filterDescription}.`;
  } else if (filters.intent === "which") {
    const top = [...matchedIncidents]
      .slice(0, 5)
      .map((i) => i.title)
      .join("; ");
    summary = `Top matches (${count} total) for ${filterDescription}: ${top || "n/a"}.`;
  } else {
    summary = `Found ${count} incident${count === 1 ? "" : "s"} matching ${filterDescription}.`;
  }

  const navigateFilters = navigateFiltersFromQueryParts({
    category: filters.category,
    status: filters.status,
    department: filters.department,
    typeTerms: filters.typeTerms,
  });

  return { matchedIncidents, filterDescription, summary, navigateFilters };
}

export function naturalQueryToRows(
  result: NaturalQueryResult,
): { label: string; value: string; highlight?: boolean }[] {
  return [
    { label: "Matches", value: String(result.matchedIncidents.length), highlight: true },
    { label: "Filters", value: result.filterDescription },
  ];
}
