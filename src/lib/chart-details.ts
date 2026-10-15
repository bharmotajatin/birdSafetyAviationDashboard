import type { ExpandableChartColumn } from "@/components/ui/ExpandableChart";
import { STATIONS } from "./constants";
import { buildStationStats, departmentsOf, incidentTypesOf } from "./analytics";
import { compareCountItems, isValidMonthKey, monthLabelFromKey } from "./parse/utils";
import { typeColor } from "./type-colors";
import type { Incident } from "./types";
import { summarizeGroup, type LinkFilters } from "./incident-links";
import { buildStationSummaries, STATION_STATUS_RULE } from "./station-summary";

/**
 * PA-07: every popup table and insight line is derived from the uploaded incidents
 * (previously these were hardcoded sample numbers that never matched the charts).
 */
export type ChartDetail = {
  insight: string;
  caption: string;
  columns: ExpandableChartColumn[];
  rows: Record<string, string | number>[];
};

type Row = Record<string, string | number>;

const CATS = ["CAT-A", "CAT-B", "CAT-C", "CAT-D"] as const;
const SEVERITY: Record<string, string> = { "CAT-A": "Critical", "CAT-B": "High", "CAT-C": "Medium", "CAT-D": "Low", NIL: "None", "Not set": "Not recorded" };
const WEIGHT: Record<string, number> = { "CAT-A": 4, "CAT-B": 3, "CAT-C": 2, "CAT-D": 1 };
const STATUS_MEANING: Record<string, string> = {
  Closed: "Fully investigated and resolved",
  Open: "Reported, no action started",
  "In Progress": "Under active investigation",
  Pending: "Awaiting review or sign-off",
  "Not set": "No status recorded in the sheet",
};
const DEPT_NAMES: Record<string, string> = { GSD: "Ground Support Dept", RAMP: "Ramp Operations", CARGO: "Cargo Handling", PAX: "Passenger Services" };
const MULTI_NOTE = "An incident can list more than one type, so % of incidents can add up to more than 100%.";

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "0%");
const count = (list: Incident[], fn: (i: Incident) => boolean) => list.filter(fn).length;
/** "Not closed" = any status other than Closed (Open, In Progress, Pending, or blank). */
const isNotClosed = (i: Incident) => i.status !== "Closed";
/** "1 incident has" / "3 incidents have". */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const isClosed = (i: Incident) => i.status === "Closed";
const unresolved = isNotClosed;

function mostCommon(values: string[]): string {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort(compareCountItems)[0]?.label ?? "-";
}

function groupMulti(incidents: Incident[], keysFn: (i: Incident) => string[]) {
  const map = new Map<string, Incident[]>();
  for (const inc of incidents) {
    for (const key of new Set(keysFn(inc))) {
      const list = map.get(key) ?? [];
      list.push(inc);
      map.set(key, list);
    }
  }
  return [...map.entries()]
    .map(([label, list]) => ({ label, value: list.length, list }))
    .sort(compareCountItems);
}

function riskLevelLabel(level: string): string {
  return level;
}

/** Per-type rows in chart-bar order ("Not set" last), with a colour dot matching the bar. */
export function buildTypeRows(incidents: Incident[]) {
  const total = incidents.length;
  return groupMulti(incidents, incidentTypesOf).map(({ label, value, list }) => ({
    __dot: typeColor(label),
    Type: label,
    Count: value,
    "% of incidents": pct(value, total),
    "Not closed": count(list, isNotClosed),
    Closed: count(list, isClosed),
    "CAT-A": count(list, (i) => i.category === "CAT-A"),
    list,
  }));
}

function monthlyRows(incidents: Incident[]) {
  const map = new Map<string, Incident[]>();
  for (const inc of incidents) {
    if (!isValidMonthKey(inc.monthKey)) continue;
    const list = map.get(inc.monthKey) ?? [];
    list.push(inc);
    map.set(inc.monthKey, list);
  }
  const keys = [...map.keys()].sort();
  const totals = keys.map((k) => map.get(k)!.length);
  const avg = totals.length ? totals.reduce((s, n) => s + n, 0) / totals.length : 0;
  const rows = keys.map((key, idx) => {
    const list = map.get(key)!;
    const prev = idx > 0 ? totals[idx - 1]! : null;
    const diff = prev == null ? null : list.length - prev;
    const window = totals.slice(Math.max(0, idx - 2), idx + 1);
    const closed = count(list, isClosed);
    return {
      Month: monthLabelFromKey(key),
      Total: list.length,
      "CAT-A": count(list, (i) => i.category === "CAT-A"),
      "CAT-B": count(list, (i) => i.category === "CAT-B"),
      "CAT-C": count(list, (i) => i.category === "CAT-C"),
      Closed: closed,
      "Closure %": list.length ? pct(closed, list.length) : "-",
      "vs Prior": diff == null ? "-" : diff > 0 ? `+${diff}` : String(diff),
      Trend: diff == null ? "-" : diff > 0 ? "UP" : diff < 0 ? "DOWN" : "FLAT",
      "3M Avg": idx >= 2 ? (window.reduce((s, n) => s + n, 0) / window.length).toFixed(1) : "-",
      "vs Average": `${list.length - avg >= 0 ? "+" : ""}${(list.length - avg).toFixed(1)}`,
    };
  });
  const peak = rows.reduce<(typeof rows)[number] | null>((best, r) => (!best || r.Total > best.Total ? r : best), null);
  const insight = peak
    ? `${peak.Month} is the peak at ${peak.Total} incidents, ${avg ? Math.round(((peak.Total - avg) / avg) * 100) : 0}% above the ${rows.length}-month average of ${avg.toFixed(1)}.`
    : "No dated incidents in the uploaded sheet.";
  return { rows, insight, avg };
}

/**
 * @param scope extra filters baked into every link (e.g. the selected station on station pages).
 */
export function buildChartDetails(incidents: Incident[], scope: LinkFilters = {}) {
  const total = incidents.length;
  // Hidden "__" fields drive the popup row tooltip + click-through link (see ExpandableChart DataTable).
  const link = (filters: LinkFilters, label: string): Row => {
    const s = summarizeGroup(incidents, filters, label, scope);
    return {
      __href: s.href,
      __label: label,
      __count: s.count,
      __pct: s.pctOfIncidents,
      __notClosed: s.notClosed,
      __closed: s.closed,
      __catA: s.catA,
    };
  };
  const typeRows = buildTypeRows(incidents);
  const realTypes = typeRows.filter((r) => r.Type !== "Not set");

  // Category
  const catLabels: string[] = [...CATS, ...(["NIL", "Not set"] as const).filter((c) => incidents.some((i) => i.category === c))];
  const catCounts = catLabels.map((c) => ({ c, n: count(incidents, (i) => i.category === c), open: count(incidents, (i) => i.category === c && unresolved(i)) }));
  const catPoints = catCounts.reduce((s, x) => s + x.n * (WEIGHT[x.c] ?? 0), 0);
  const categoryRows: Row[] = [
    ...catCounts.map(({ c, n, open }) => ({
      ...link({ category: c }, c),
      Category: c,
      Severity: SEVERITY[c] ?? "-",
      Count: n,
      "% Share": pct(n, total),
      "Not closed": open,
      "Risk Weight": WEIGHT[c] ? `x${WEIGHT[c]}` : "-",
      "Risk Points": n * (WEIGHT[c] ?? 0),
    })),
    { Category: "TOTAL", Severity: "-", Count: total, "% Share": "100%", "Not closed": count(incidents, unresolved), "Risk Weight": "-", "Risk Points": catPoints },
  ];
  const topCat = [...catCounts].filter((x) => (CATS as readonly string[]).includes(x.c)).sort((a, b) => b.n - a.n)[0];
  const catA = catCounts.find((x) => x.c === "CAT-A")?.n ?? 0;
  const categoryInsight = total
    ? `${topCat?.c ?? "-"} (${SEVERITY[topCat?.c ?? ""] ?? ""}) is the largest category at ${topCat?.n ?? 0} of ${total} incidents (${pct(topCat?.n ?? 0, total)}). CAT-A critical: ${catA} (${pct(catA, total)}).`
    : "No incidents uploaded yet.";

  // Status
  const statusLabels = ["Closed", "Open", "In Progress", "Pending", ...(incidents.some((i) => i.status === "Not set") ? ["Not set"] : [])];
  const statusRows: Row[] = statusLabels.map((s) => {
    const n = count(incidents, (i) => i.status === s);
    return { ...link({ status: s }, s), Status: s, Count: n, "%": pct(n, total), Meaning: STATUS_MEANING[s] ?? "", Definition: STATUS_MEANING[s] ?? "" };
  });
  const closedN = count(incidents, isClosed);
  const sc = (s: string) => count(incidents, (i) => i.status === s);
  const statusInsight = total
    ? `${closedN} of ${plural(total, "incident", "incidents")} ${closedN === 1 ? "is" : "are"} closed (${pct(closedN, total)}). ${plural(total - closedN, "incident is", "incidents are")} not closed (${sc("Open")} open, ${sc("In Progress")} in progress, ${sc("Pending")} pending${sc("Not set") ? `, ${plural(sc("Not set"), "has", "have")} no status recorded` : ""}).`
    : "No incidents uploaded yet.";

  // Department
  const deptGroups = groupMulti(incidents, departmentsOf);
  const deptRows: Row[] = deptGroups.map(({ label, value, list }) => {
    const closed = count(list, isClosed);
    return {
      ...link({ department: label }, label),
      Dept: label,
      "Full Name": DEPT_NAMES[label] ?? label,
      Count: value,
      "% Share": pct(value, total),
      "CAT-A": count(list, (i) => i.category === "CAT-A"),
      Closed: closed,
      "Closure Rate": pct(closed, value),
    };
  });
  const deptInsight = deptGroups.length
    ? `${deptGroups[0]!.label} leads with ${deptGroups[0]!.value} incidents${deptGroups[1] ? `, followed by ${deptGroups[1].label} (${deptGroups[1].value})` : ""}. An incident can list more than one department.`
    : "No department data.";

  // Types
  const typeInsight = realTypes.length
    ? `${realTypes[0]!.Type} leads at ${realTypes[0]!.Count} incidents (${realTypes[0]!["% of incidents"]} of ${total}).${realTypes[1] ? ` ${realTypes[1].Type} (${realTypes[1].Count})${realTypes[2] ? ` and ${realTypes[2].Type} (${realTypes[2].Count})` : ""} follow.` : ""} Highest CAT-A count: ${[...realTypes].sort((a, b) => b["CAT-A"] - a["CAT-A"])[0]!.Type} (${[...realTypes].sort((a, b) => b["CAT-A"] - a["CAT-A"])[0]!["CAT-A"]}).`
    : "No incident types in the uploaded sheet.";
  const byTypeRows: Row[] = typeRows.map((r) => ({
    __dot: r.__dot,
    Type: r.Type,
    Count: r.Count,
    "% of incidents": r["% of incidents"],
    "Not closed": r["Not closed"],
    Closed: r.Closed,
    "CAT-A": r["CAT-A"],
    ...link({ type: r.Type }, r.Type),
  }));
  let cumulative = 0;
  const rankedRows: Row[] = typeRows.map((r, idx) => {
    cumulative += r.Count;
    return {
      ...link({ type: r.Type }, r.Type),
      __dot: r.__dot,
      Rank: idx + 1,
      Type: r.Type,
      Count: r.Count,
      "% of incidents": r["% of incidents"],
      "Cumulative %": pct(cumulative, total),
      "Typical Cat": mostCommon(r.list.map((i) => i.category)),
      "Main Dept": mostCommon(r.list.flatMap(departmentsOf)),
    };
  });
  const top3 = realTypes.slice(0, 3);
  const top3Incidents = new Set(top3.flatMap((t) => t.list.map((i) => i.id))).size;
  const rankedInsight = top3.length
    ? `Top ${top3.length} types (${top3.map((t) => `${t.Type} ${t.Count}`).join(", ")}) cover ${top3Incidents} of ${total} incidents (${pct(top3Incidents, total)}).`
    : "No incident types in the uploaded sheet.";

  // Stations
  const present = new Set(incidents.map((i) => String(i.station)));
  // Include stations present in the sheet but missing from the configured list (e.g. BLR); Unknown last.
  const extra = [...present].filter((s) => s !== "Unknown" && !(STATIONS as readonly string[]).includes(s)).sort();
  const stationCodes = [...STATIONS, ...extra, ...(present.has("Unknown") ? ["Unknown"] : [])];
  const stats = buildStationStats(incidents, stationCodes);
  const stationRows: Row[] = stats.map((s) => ({
    ...link({ station: String(s.station) }, String(s.station)),
    Station: s.station,
    Total: s.total,
    "CAT-A": s.catA,
    "CAT-B": s.catB,
    "CAT-C": s.catC,
    "CAT-D": s.catD,
    "Risk Score": s.riskScore,
    "Risk Level": riskLevelLabel(s.riskLevel),
  }));
  const active = [...stats].filter((s) => s.total > 0 && s.station !== "Unknown").sort((a, b) => b.total - a.total);
  const idle = stats.filter((s) => s.total === 0).map((s) => s.station);
  const stationInsight = active.length
    ? `${active.slice(0, 3).map((s) => `${s.station} ${s.total}`).join(", ")} lead incident volume across ${active.length} reporting stations.${idle.length ? ` No incidents logged at ${idle.join(", ")}.` : ""}${present.has("Unknown") ? ` ${count(incidents, (i) => i.station === "Unknown")} incidents have no station.` : ""}`
    : "No station data.";
  const riskRows: Row[] = stats.map((s) => ({
    ...link({ station: String(s.station) }, String(s.station)),
    Station: s.station,
    Total: s.total,
    "Total Inc": s.total,
    "CAT-A x4": s.catA * 4,
    "CAT-B x3": s.catB * 3,
    "CAT-C x2": s.catC * 2,
    "CAT-D x1": s.catD,
    "Total Score": s.riskScore,
    Score: s.riskScore,
    Level: riskLevelLabel(s.riskLevel),
    "Action Required": s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL" ? "Immediate executive review" : s.riskLevel === "MEDIUM" ? "Targeted follow-up" : "Continue standard monitoring",
  }));
  const topRisk = [...stats].sort((a, b) => b.riskScore - a.riskScore)[0];
  const riskInsight = topRisk && topRisk.riskScore > 0
    ? `${topRisk.station} has the highest risk score (${topRisk.riskScore}, ${topRisk.riskLevel}) from ${topRisk.catA} CAT-A and ${topRisk.catC} CAT-C incidents. Each CAT-A incident adds 4 points.`
    : "No risk recorded yet.";

  const monthly = monthlyRows(incidents);
  const statusCategoryRows: Row[] = [
    { Label: "STATUS", Count: "", "%": "", Context: "" },
    ...statusRows.map((r) => ({ ...link({ status: String(r.Status) }, String(r.Status)), Label: r.Status!, Count: r.Count!, "%": r["%"]!, Context: r.Meaning! })),
    { Label: "CATEGORY", Count: "", "%": "", Context: "" },
    ...catCounts.map(({ c, n }) => ({ ...link({ category: c }, c), Label: c, Count: n, "%": pct(n, total), Context: `${SEVERITY[c] ?? ""} severity` })),
  ];

  const typeColumns: ExpandableChartColumn[] = [
    { key: "Type", label: "Type", dotKey: "__dot" },
    { key: "Count", label: "Count", align: "right" },
    { key: "% of incidents", label: "% of incidents", align: "right" },
    { key: "Not closed", label: "Not closed", align: "right" },
    { key: "Closed", label: "Closed", align: "right" },
    { key: "CAT-A", label: "CAT-A", align: "right" },
  ];
  const rankedColumns: ExpandableChartColumn[] = [
    { key: "Rank", label: "Rank", align: "right" },
    { key: "Type", label: "Type", dotKey: "__dot" },
    { key: "Count", label: "Count", align: "right" },
    { key: "% of incidents", label: "% of incidents", align: "right" },
    { key: "Cumulative %", label: "Cumulative %", align: "right" },
    { key: "Typical Cat", label: "Typical Cat" },
    { key: "Main Dept", label: "Main Dept" },
  ];
  const categoryColumns = (): ExpandableChartColumn[] => [
    { key: "Category", label: "Category" },
    { key: "Severity", label: "Severity" },
    { key: "Count", label: "Count", align: "right" },
    { key: "% Share", label: "% Share", align: "right" },
    { key: "Not closed", label: "Not closed", align: "right" },
    { key: "Risk Weight", label: "Risk Weight", align: "center" },
    { key: "Risk Points", label: "Risk Points", align: "right" },
  ];
  const deptColumns = (full: boolean): ExpandableChartColumn[] => [
    { key: "Dept", label: "Dept" },
    ...(full ? [{ key: "Full Name", label: "Full Name" }] : []),
    { key: "Count", label: "Count", align: "right" as const },
    { key: "% Share", label: "% Share", align: "right" as const },
    { key: "CAT-A", label: "CAT-A", align: "right" as const },
    { key: "Closed", label: "Closed", align: "right" as const },
    { key: "Closure Rate", label: "Closure Rate", align: "right" as const },
  ];
  const riskColumns = (extra: boolean): ExpandableChartColumn[] => [
    { key: "Station", label: "Station" },
    { key: extra ? "Total Inc" : "Total", label: extra ? "Total Inc" : "Total", align: "right" },
    { key: "CAT-A x4", label: "CAT-A x4", align: "right" },
    { key: "CAT-B x3", label: "CAT-B x3", align: "right" },
    { key: "CAT-C x2", label: "CAT-C x2", align: "right" },
    { key: "CAT-D x1", label: "CAT-D x1", align: "right" },
    { key: extra ? "Score" : "Total Score", label: extra ? "Score" : "Total Score", align: "right" },
    { key: "Level", label: "Level", align: "center" },
    ...(extra ? [{ key: "Action Required", label: "Action Required" }] : []),
  ];
  const statusColumns = (def: "Meaning" | "Definition"): ExpandableChartColumn[] => [
    { key: "Status", label: "Status" },
    { key: "Count", label: "Count", align: "right" },
    { key: "%", label: "%", align: "right" },
    { key: def, label: def },
  ];
  const monthCols = (keys: string[]): ExpandableChartColumn[] =>
    keys.map((k) => ({ key: k, label: k, align: k === "Month" ? "left" : k === "Trend" ? "center" : "right" }));

  const byType: ChartDetail = {
    insight: typeInsight,
    caption: `Each row is one incident type, in the same order as the bars. Not closed (any status other than Closed, including blank), Closed and CAT-A count the incidents of that type. ${MULTI_NOTE}`,
    columns: typeColumns,
    rows: byTypeRows,
  };
  const category = (): ChartDetail => ({
    insight: categoryInsight,
    caption: `Severity classification of all ${total} incidents. Risk Points = count x weight.`,
    columns: categoryColumns(),
    rows: categoryRows,
  });
  const status = (def: "Meaning" | "Definition"): ChartDetail => ({
    insight: statusInsight,
    caption: `Current resolution stage of all ${total} incidents.`,
    columns: statusColumns(def),
    rows: statusRows,
  });
  const department = (full: boolean): ChartDetail => ({
    insight: deptInsight,
    caption: "Incidents per department. Closure Rate = Closed / incidents for that department. An incident listing two departments counts in both.",
    columns: deptColumns(full),
    rows: deptRows,
  });
  const typesRanked: ChartDetail = {
    insight: rankedInsight,
    caption: `Ranked by frequency, same order as the bars. ${MULTI_NOTE}`,
    columns: rankedColumns,
    rows: rankedRows,
  };
  const riskRanking = (extra: boolean): ChartDetail => ({
    insight: riskInsight,
    caption: "Risk contribution per station. Each category column = count x weight.",
    columns: riskColumns(extra),
    rows: riskRows,
  });

  // PA-08: Station-Wise popups use the same plain-language station summaries as the cards.
  const summaries = buildStationSummaries(incidents);
  const attention = summaries.filter((s) => s.status === "Needs attention");
  const stationWiseRows: Row[] = summaries.map((s) => ({
    ...link({ station: s.station }, s.station),
    Station: s.station,
    Status: s.status,
    Incidents: s.total,
    Serious: s.serious,
    "Not closed": s.notClosed,
    Closed: s.closed,
    "CAT-A": s.categories["CAT-A"] ?? 0,
    "CAT-B": s.categories["CAT-B"] ?? 0,
    "CAT-C": s.categories["CAT-C"] ?? 0,
    "CAT-D": s.categories["CAT-D"] ?? 0,
    NIL: s.categories.NIL ?? 0,
    "Not set": s.categories["Not set"] ?? 0,
    "Closure Rate": `${s.closureRate}%`,
  }));
  const mostNotClosed = [...summaries].sort((a, b) => b.notClosed - a.notClosed)[0];
  const stationWise = {
    stations: {
      insight: attention.length
        ? `${plural(attention.length, "station needs", "stations need")} attention: ${attention.map((s) => `${s.station} (${s.serious} serious, ${s.notClosed} not closed)`).join(", ")}.`
        : "No station needs attention.",
      caption: `Stations with incidents, most urgent first. Serious = CAT-A + CAT-B. ${STATION_STATUS_RULE}`,
      columns: ["Station", "Status", "Incidents", "Serious", "Not closed", "Closed", "CAT-A", "CAT-B", "CAT-C", "CAT-D", "NIL", "Not set"].map((k) => ({ key: k, label: k, align: k === "Station" || k === "Status" ? "left" : "right" })),
      rows: stationWiseRows,
    } as ChartDetail,
    openClosed: {
      insight: `Overall closure rate is ${pct(closedN, total)}.${mostNotClosed && mostNotClosed.notClosed > 0 ? ` ${mostNotClosed.station} has the most not-closed incidents (${mostNotClosed.notClosed}).` : ""}`,
      caption: "Not closed = every incident whose status is not Closed (including blank).",
      columns: ["Station", "Incidents", "Closed", "Not closed", "Closure Rate"].map((k) => ({ key: k, label: k, align: k === "Station" ? "left" : "right" })),
      rows: stationWiseRows,
    } as ChartDetail,
  };

  return {
    incidentLog: { byType, category: category(), status: status("Meaning") },
    panIndia: {
      stationCompare: {
        insight: stationInsight,
        caption: "Each row = one station. CAT columns show incident count per severity. Risk Score = weighted total.",
        columns: ["Station", "Total", "CAT-A", "CAT-B", "CAT-C", "CAT-D", "Risk Score", "Risk Level"].map((k) => ({ key: k, label: k, align: k === "Station" ? "left" : k === "Risk Level" ? "center" : "right" })),
        rows: stationRows,
      } as ChartDetail,
      riskRanking: riskRanking(false),
    },
    stationAnalysis: {
      department: department(true),
      monthly: {
        insight: monthly.insight,
        caption: "Month-by-month incident count. vs Prior = change from previous month.",
        columns: monthCols(["Month", "Total", "CAT-A", "CAT-C", "Closed", "Closure %", "vs Prior", "Trend"]),
        rows: monthly.rows,
      } as ChartDetail,
      typesRanked,
    },
    stationWise,
    monthly: {
      combo: {
        insight: monthly.insight,
        caption: "Bars = total incidents per month. Line = CAT-A only. 3M Avg = 3-month rolling average.",
        columns: monthCols(["Month", "Total", "CAT-A", "CAT-B", "Closed", "Closure %", "vs Prior", "3M Avg", "Trend"]),
        rows: monthly.rows,
      } as ChartDetail,
      statusCategory: {
        insight: `${statusInsight} ${categoryInsight}`,
        caption: `Status and severity counts, both from the same ${total} incidents.`,
        columns: [
          { key: "Label", label: "Label" },
          { key: "Count", label: "Count", align: "right" },
          { key: "%", label: "%", align: "right" },
          { key: "Context", label: "Context" },
        ],
        rows: statusCategoryRows,
      } as ChartDetail,
    },
    graphs: {
      station: {
        insight: stationInsight,
        caption: "Total incidents per station.",
        columns: ["Station", "Total", "CAT-A", "Risk Score", "Risk Level"].map((k) => ({ key: k, label: k, align: k === "Station" ? "left" : k === "Risk Level" ? "center" : "right" })),
        rows: stationRows,
      } as ChartDetail,
      category: category(),
      status: status("Definition"),
      department: department(false),
      monthlyArea: {
        insight: monthly.insight,
        caption: `Filled area = monthly incidents. Line = CAT-A. Average = ${monthly.avg.toFixed(1)} per month.`,
        columns: monthCols(["Month", "Total", "CAT-A", "3M Avg", "vs Average"]),
        rows: monthly.rows,
      } as ChartDetail,
      typeFrequency: typesRanked,
    },
  } satisfies Record<string, Record<string, ChartDetail>>;
}
