import { equipmentOf } from "../incident-links";
import type { Incident } from "../types";

import { istDayKey } from "./day";

export { istDayKey };

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
}

export function incidentDayKey(i: Incident): string | null {
  if (!i.date) return null;
  const d = i.date instanceof Date ? i.date : new Date(i.date as unknown as string);
  return Number.isNaN(d.getTime()) ? null : istDayKey(d);
}

export type Bucket = { label: string; count: number; ghrs: string[]; color: string };

function bucketize(labels: [string, string][], incidents: Incident[], pick: (i: Incident) => string): Bucket[] {
  const map = new Map(labels.map(([l, c]) => [l, { label: l, count: 0, ghrs: [] as string[], color: c }]));
  for (const i of incidents) {
    const b = map.get(pick(i));
    if (b) {
      b.count += 1;
      b.ghrs.push(i.ghrNumber);
    }
  }
  return [...map.values()];
}

// ---------------- Reporting delay
export const DELAY_LABELS = {
  same: "Same day",
  d12: "1-2 days",
  d37: "3-7 days",
  d7: "Over 7 days",
  none: "No report date",
  before: "Report before incident",
} as const;

export function reportingDelayDays(i: Incident): number | null | "before" {
  const inc = incidentDayKey(i);
  if (!inc || !i.reportDate) return null;
  const d = daysBetween(inc, i.reportDate);
  return d < 0 ? "before" : d;
}

export function delayBucketOf(i: Incident): string {
  const d = reportingDelayDays(i);
  if (d === null) return DELAY_LABELS.none;
  if (d === "before") return DELAY_LABELS.before;
  if (d === 0) return DELAY_LABELS.same;
  if (d <= 2) return DELAY_LABELS.d12;
  if (d <= 7) return DELAY_LABELS.d37;
  return DELAY_LABELS.d7;
}

export function reportingDelay(incidents: Incident[]) {
  const buckets = bucketize(
    [
      [DELAY_LABELS.same, "#16a34a"],
      [DELAY_LABELS.d12, "#eab308"],
      [DELAY_LABELS.d37, "#f97316"],
      [DELAY_LABELS.d7, "#dc2626"],
      [DELAY_LABELS.none, "#94a3b8"],
      [DELAY_LABELS.before, "#7c3aed"],
    ],
    incidents,
    delayBucketOf,
  );
  const valid = incidents
    .map((i) => ({ i, d: reportingDelayDays(i) }))
    .filter((x): x is { i: Incident; d: number } => typeof x.d === "number");
  const avg = valid.length ? valid.reduce((s, x) => s + x.d, 0) / valid.length : 0;
  const byStation = new Map<string, number[]>();
  for (const { i, d } of valid) {
    const k = String(i.station || "Unknown");
    byStation.set(k, [...(byStation.get(k) ?? []), d]);
  }
  const stations = [...byStation.entries()]
    .map(([station, ds]) => ({ station, count: ds.length, avg: ds.reduce((a, b) => a + b, 0) / ds.length, max: Math.max(...ds) }))
    .sort((a, b) => b.avg - a.avg || a.station.localeCompare(b.station));
  const late = valid.filter((x) => x.d > 0).sort((a, b) => b.d - a.d).map((x) => ({ incident: x.i, days: x.d }));
  return { buckets, avg, slowest: stations[0] ?? null, stations, late, sameDay: buckets[0]!.count };
}

// ---------------- Time of day
export const TIME_LABELS = ["Night 00-06", "Morning 06-12", "Afternoon 12-18", "Evening 18-24"] as const;
export const TIME_UNREADABLE = "Time not readable";

/** Hour 0-23 from "2350 hrs", "23:50", "11:50 PM", "0950", Excel day fraction; null when unreadable. */
export function parseHour(raw: string | null | undefined): number | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (/^0?\.\d+$/.test(s)) {
    const h = Math.floor(Number(s) * 24 + 1e-9);
    return h >= 0 && h < 24 ? h : null;
  }
  let m = /^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/.exec(s);
  if (!m) m = /^(\d{1,2})(\d{2})\s*(?:hrs?|hours?|h|lt|ist)?\.?\s*(am|pm)?\b/.exec(s);
  if (!m) {
    const ap = /^(\d{1,2})\s*(am|pm)\b/.exec(s);
    if (ap) m = [ap[0], ap[1]!, "00", ap[2]!] as unknown as RegExpExecArray;
  }
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.replace(/\./g, "");
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
  }
  if (h === 24 && min === 0) h = 0;
  return h >= 0 && h < 24 ? h : null;
}

export function timeBucketOf(i: Incident): string {
  const h = parseHour(i.time);
  if (h === null) return TIME_UNREADABLE;
  return TIME_LABELS[Math.floor(h / 6)]!;
}

export function timeOfDay(incidents: Incident[]) {
  const buckets = bucketize(
    [
      [TIME_LABELS[0], "#1e3a8a"],
      [TIME_LABELS[1], "#f59e0b"],
      [TIME_LABELS[2], "#ea580c"],
      [TIME_LABELS[3], "#7c3aed"],
      [TIME_UNREADABLE, "#94a3b8"],
    ],
    incidents,
    timeBucketOf,
  );
  const readable = buckets.slice(0, 4);
  const busiest = [...readable].sort((a, b) => b.count - a.count)[0]!;
  const nightShare = incidents.length ? buckets[0]!.count / incidents.length : 0;
  const hours = Array.from({ length: 24 }, (_, h) => incidents.filter((i) => parseHour(i.time) === h).length);
  const serious = (label: string) =>
    incidents.filter((i) => timeBucketOf(i) === label && (i.category === "CAT-A" || i.category === "CAT-B")).length;
  return { buckets, busiest, nightShare, hours, serious };
}

// ---------------- Open incident age
export const AGE_BANDS: [string, string][] = [
  ["0-30 days", "#16a34a"],
  ["31-90 days", "#f59e0b"],
  ["91-180 days", "#ea580c"],
  ["Over 180 days", "#dc2626"],
  ["No incident date", "#94a3b8"],
];

export function isNotClosed(i: Incident): boolean {
  return i.status !== "Closed";
}

export function ageBandOf(days: number | null): string {
  if (days === null) return AGE_BANDS[4]![0];
  if (days <= 30) return AGE_BANDS[0]![0];
  if (days <= 90) return AGE_BANDS[1]![0];
  if (days <= 180) return AGE_BANDS[2]![0];
  return AGE_BANDS[3]![0];
}

export function ageColor(days: number | null): string {
  return AGE_BANDS.find(([l]) => l === ageBandOf(days))![1];
}

export function openAge(incidents: Incident[], todayKey = istDayKey(new Date())) {
  const open = incidents
    .filter(isNotClosed)
    .map((incident) => {
      const k = incidentDayKey(incident);
      return { incident, days: k ? daysBetween(k, todayKey) : null };
    })
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
  const ages = open.map((o) => o.days).filter((d): d is number => d !== null);
  const bands = AGE_BANDS.map(([label, color]) => {
    const list = open.filter((o) => ageBandOf(o.days) === label);
    return { label, color, count: list.length, ghrs: list.map((o) => o.incident.ghrNumber) };
  });
  return {
    open,
    total: open.length,
    oldest: ages.length ? Math.max(...ages) : null,
    youngest: ages.length ? Math.min(...ages) : null,
    over90: ages.filter((d) => d > 90).length,
    over30: ages.filter((d) => d > 30).length,
    bands,
  };
}

// ---------------- Repeats
const PLACEHOLDER = /^(|-+|0+|nil|none|na|n\/a|not set|unknown|tbd|null)$/i;

/** Uppercase, letters/digits only, leading zeros dropped from each number ("TUG-01" -> "TUG1"). */
export function normalizeId(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (PLACEHOLDER.test(s)) return "";
  return s.toUpperCase().replace(/\d+/g, (m) => String(Number(m))).replace(/[^A-Z0-9]/g, "");
}

export type RepeatGroup = { kind: "Equipment" | "Staff"; key: string; label: string; station: string; count: number; incidents: Incident[] };

function groupRepeats(incidents: Incident[], kind: RepeatGroup["kind"], keyOf: (i: Incident) => { key: string; label: string } | null): RepeatGroup[] {
  const map = new Map<string, RepeatGroup>();
  for (const i of incidents) {
    const k = keyOf(i);
    if (!k) continue;
    const g = map.get(k.key) ?? { kind, key: k.key, label: k.label, station: String(i.station || "Unknown"), count: 0, incidents: [] };
    g.count += 1;
    g.incidents.push(i);
    map.set(k.key, g);
  }
  return [...map.values()].filter((g) => g.count > 1).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Equipment repeats match type + station + number together; staff repeats match the staff number. */
export function repeats(incidents: Incident[]) {
  const equipment = groupRepeats(incidents, "Equipment", (i) => {
    const num = normalizeId(i.equipmentNo);
    if (!num) return null;
    const type = equipmentOf(i);
    const station = String(i.station || "Unknown");
    return { key: `${normalizeId(type)}|${station}|${num}`, label: `${type} ${String(i.equipmentNo).trim()} (${station})` };
  });
  const staff = groupRepeats(incidents, "Staff", (i) => {
    const num = normalizeId(i.staffNo);
    return num ? { key: num, label: String(i.staffNo).trim() } : null;
  });
  const bareNumber = groupRepeats(incidents, "Equipment", (i) => {
    const num = normalizeId(i.equipmentNo);
    return num ? { key: num, label: num } : null;
  });
  return { equipment, staff, all: [...equipment, ...staff], bareNumberGroups: bareNumber.length };
}

// ---------------- Category table (dashboard export)
export const CATEGORY_ROWS = ["CAT-A", "CAT-B", "CAT-C", "CAT-D", "Not set"] as const;

/** Counts per category; NIL, blank and anything unrecognised go to "Not set" so the rows add up to the total. */
export function categoryCounts(incidents: Incident[]): { label: (typeof CATEGORY_ROWS)[number]; count: number; ghrs: string[] }[] {
  return CATEGORY_ROWS.map((label) => {
    const list = incidents.filter((i) =>
      label === "Not set" ? !(CATEGORY_ROWS.slice(0, 4) as readonly string[]).includes(i.category) : i.category === label,
    );
    return { label, count: list.length, ghrs: list.map((i) => i.ghrNumber) };
  });
}
