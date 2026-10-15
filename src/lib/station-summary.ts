import type { Incident } from "./types";

/** PA-08: plain-language station status used by the Station-Wise page and its popups. */
export type StationStatus = "Needs attention" | "Watch" | "On track";

export const STATION_STATUS_COLORS: Record<StationStatus, string> = {
  "Needs attention": "#ef4444",
  Watch: "#f59e0b",
  "On track": "#22c55e",
};

/** Maps to the existing card styling classes (station-risk-card--HIGH/MEDIUM/LOW). */
export const STATION_STATUS_LEVEL: Record<StationStatus, "HIGH" | "MEDIUM" | "LOW"> = {
  "Needs attention": "HIGH",
  Watch: "MEDIUM",
  "On track": "LOW",
};

export const STATION_STATUS_RULE =
  "Needs attention = any CAT-A or 3+ serious (CAT-A + CAT-B) · Watch = any incident not closed, or 1–2 serious · On track = all closed and no serious.";

/** Fixed order and colours for the per-card category bar. */
export const CATEGORY_BAR = [
  { key: "CAT-A", color: "#ef4444" },
  { key: "CAT-B", color: "#f59e0b" },
  { key: "CAT-C", color: "#fbbf24" },
  { key: "CAT-D", color: "#22c55e" },
  { key: "NIL", color: "#94a3b8" },
  { key: "Not set", color: "#64748b" },
] as const;

export type StationSummary = {
  station: string;
  total: number;
  categories: Record<string, number>;
  catA: number;
  catB: number;
  serious: number;
  notClosed: number;
  closed: number;
  closureRate: number;
  status: StationStatus;
};

const STATUS_RANK: Record<StationStatus, number> = { "Needs attention": 0, Watch: 1, "On track": 2 };

export function stationStatus(s: Pick<StationSummary, "catA" | "serious" | "notClosed">): StationStatus {
  if (s.catA > 0 || s.serious >= 3) return "Needs attention";
  if (s.notClosed > 0 || s.serious > 0) return "Watch";
  return "On track";
}

/** Needs attention first, then Watch, then On track; ties by serious, not closed, incidents. Unknown last. */
export function compareStations(a: StationSummary, b: StationSummary): number {
  const ua = a.station === "Unknown" ? 1 : 0;
  const ub = b.station === "Unknown" ? 1 : 0;
  if (ua !== ub) return ua - ub;
  return (
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    b.serious - a.serious ||
    b.notClosed - a.notClosed ||
    b.total - a.total ||
    a.station.localeCompare(b.station)
  );
}

/** One summary per station that has incidents (stations with 0 incidents are omitted). */
export function buildStationSummaries(incidents: Incident[]): StationSummary[] {
  const groups = new Map<string, Incident[]>();
  for (const inc of incidents) {
    const key = String(inc.station || "Unknown");
    const list = groups.get(key) ?? [];
    list.push(inc);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([station, list]) => {
      const categories: Record<string, number> = {};
      for (const c of CATEGORY_BAR) categories[c.key] = list.filter((i) => i.category === c.key).length;
      const catA = categories["CAT-A"] ?? 0;
      const catB = categories["CAT-B"] ?? 0;
      const closed = list.filter((i) => i.status === "Closed").length;
      const base = {
        station,
        total: list.length,
        categories,
        catA,
        catB,
        serious: catA + catB,
        notClosed: list.length - closed,
        closed,
        closureRate: list.length ? Math.round((closed / list.length) * 1000) / 10 : 0,
      };
      return { ...base, status: stationStatus(base) };
    })
    .sort(compareStations);
}
