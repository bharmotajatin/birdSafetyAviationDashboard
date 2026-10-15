import type { Incident } from "./types";

/** PA-12: filters shared by every tab, kept in the URL so they carry across tabs. */
export const SHARED_FILTER_KEYS = ["station", "month", "category", "status"] as const;
export type SharedFilterKey = (typeof SHARED_FILTER_KEYS)[number];
export type SharedFilters = Partial<Record<SharedFilterKey, string>>;

export const SHARED_FILTER_LABELS: Record<SharedFilterKey, string> = {
  station: "Station",
  month: "Month",
  category: "Category",
  status: "Status",
};

export const NOT_CLOSED = "Not closed";

type ParamsLike = { get: (key: string) => string | null };

export function readSharedFilters(params: ParamsLike | null | undefined): SharedFilters {
  const out: SharedFilters = {};
  if (!params) return out;
  for (const k of SHARED_FILTER_KEYS) {
    const v = params.get(k);
    if (v) out[k] = v;
  }
  return out;
}

export function hasSharedFilters(f: SharedFilters, ignore: SharedFilterKey[] = []): boolean {
  return SHARED_FILTER_KEYS.some((k) => !ignore.includes(k) && Boolean(f[k]));
}

export function matchesSharedFilters(inc: Incident, f: SharedFilters, ignore: SharedFilterKey[] = []): boolean {
  const on = (k: SharedFilterKey) => !ignore.includes(k) && Boolean(f[k]);
  if (on("station") && String(inc.station || "Unknown") !== f.station) return false;
  if (on("month") && inc.monthKey !== f.month) return false;
  if (on("category") && inc.category !== f.category) return false;
  if (on("status")) {
    if (f.status === NOT_CLOSED ? inc.status === "Closed" : inc.status !== f.status) return false;
  }
  return true;
}

export function applySharedFilters(incidents: Incident[], f: SharedFilters, ignore: SharedFilterKey[] = []): Incident[] {
  return hasSharedFilters(f, ignore) ? incidents.filter((i) => matchesSharedFilters(i, f, ignore)) : incidents;
}

/** Adds the current shared filters to a nav link (existing query on the link wins). */
export function withSharedFilters(href: string, params: ParamsLike | null | undefined): string {
  const f = readSharedFilters(params);
  const [path, query = ""] = href.split("?");
  const q = new URLSearchParams(query);
  for (const k of SHARED_FILTER_KEYS) if (f[k] && !q.has(k)) q.set(k, f[k]!);
  const s = q.toString();
  return s ? `${path}?${s}` : path!;
}
