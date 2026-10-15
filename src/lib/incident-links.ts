import { departmentsOf, incidentTypesOf } from "./analytics";
import type { Incident } from "./types";

/** PA-07: Incident Log URL filters. Same split/normalise helpers as the charts, so counts match bars. */
export const LINK_FILTER_KEYS = ["type", "department", "station", "category", "status", "equipment", "ghr"] as const;
export type LinkFilterKey = (typeof LINK_FILTER_KEYS)[number];
export type LinkFilters = Partial<Record<LinkFilterKey, string>>;

export const LINK_FILTER_LABELS: Record<LinkFilterKey, string> = {
  type: "Type",
  department: "Department",
  station: "Station",
  category: "Category",
  status: "Status",
  equipment: "Equipment",
  ghr: "Incidents",
};

export function equipmentOf(incident: Incident): string {
  return incident.equipment.replace(/\s+/g, " ").trim() || "Not set";
}

function valuesFor(incident: Incident, key: LinkFilterKey): string[] {
  switch (key) {
    case "type":
      return incidentTypesOf(incident);
    case "department":
      return departmentsOf(incident);
    case "station":
      return [String(incident.station || "Unknown")];
    case "category":
      return [incident.category];
    case "status":
      // PA-12: the shared filter bar offers "Not closed" (any status except Closed).
      return incident.status === "Closed" ? [incident.status] : [incident.status, "Not closed"];
    case "equipment":
      return [equipmentOf(incident)];
    case "ghr":
      return [incident.ghrNumber];
  }
}

export function matchesLinkFilters(incident: Incident, filters: LinkFilters): boolean {
  return LINK_FILTER_KEYS.every((key) => {
    const want = filters[key];
    // "ghr" holds a comma-separated list of GHR numbers (analysis bars link to exactly those rows).
    if (key === "ghr" && want) return want.split(",").includes(incident.ghrNumber);
    return !want || valuesFor(incident, key).includes(want);
  });
}

/** e.g. /incident-log?type=A%2FC%20Damage */
export function incidentLogHref(filters: LinkFilters): string {
  const parts = LINK_FILTER_KEYS.filter((k) => filters[k]).map(
    (k) => `${k}=${encodeURIComponent(filters[k]!)}`,
  );
  return parts.length ? `/incident-log?${parts.join("&")}` : "/incident-log";
}

export function readLinkFilters(params: { get: (key: string) => string | null }): LinkFilters {
  const out: LinkFilters = {};
  for (const key of LINK_FILTER_KEYS) {
    const v = params.get(key);
    if (v) out[key] = v;
  }
  return out;
}

export type GroupSummary = {
  label: string;
  count: number;
  pctOfIncidents: string;
  notClosed: number;
  closed: number;
  catA: number;
  catB: number;
  catC: number;
  catD: number;
  href: string;
};

export function summarizeGroup(
  incidents: Incident[],
  filters: LinkFilters,
  label: string,
  scope: LinkFilters = {},
): GroupSummary {
  const list = incidents.filter((i) => matchesLinkFilters(i, filters));
  const n = (fn: (i: Incident) => boolean) => list.filter(fn).length;
  return {
    label,
    count: list.length,
    pctOfIncidents: incidents.length ? `${((list.length / incidents.length) * 100).toFixed(1)}%` : "0%",
    notClosed: n((i) => i.status !== "Closed"),
    closed: n((i) => i.status === "Closed"),
    catA: n((i) => i.category === "CAT-A"),
    catB: n((i) => i.category === "CAT-B"),
    catC: n((i) => i.category === "CAT-C"),
    catD: n((i) => i.category === "CAT-D"),
    href: incidentLogHref({ ...scope, ...filters }),
  };
}

/** Lines for a chart-bar tooltip body. */
export function summaryLines(s: GroupSummary): string[] {
  return [
    `Count: ${s.count} (${s.pctOfIncidents} of incidents)`,
    `Not closed: ${s.notClosed} · Closed: ${s.closed}`,
    `CAT-A ${s.catA} · B ${s.catB} · C ${s.catC} · D ${s.catD}`,
  ];
}

export const CLICK_HINT = "Click to view in Incident Log →";

/** Props for CountChart/RankedHorizontalBarChart/StatusBreakdownChart: bars link + tooltip for one filter key. */
export function chartLinks(incidents: Incident[], key: LinkFilterKey, scope: LinkFilters = {}) {
  const cache = new Map<string, GroupSummary>();
  const get = (label: string) => {
    let s = cache.get(label);
    if (!s) {
      s = summarizeGroup(incidents, { [key]: label }, label, scope);
      cache.set(label, s);
    }
    return s;
  };
  return {
    linkFor: (label: string) => get(label).href,
    tooltipFor: (label: string) => summaryLines(get(label)),
  };
}
