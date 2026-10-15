import type { Incident } from "./types";
import { isValidMonthKey, monthLabelFromKey } from "./parse/utils";

/** Continuous yyyy-mm keys from the first to the last month that has data (no future padding). */
export function dataMonthKeys(incidents: Pick<Incident, "monthKey">[]): string[] {
  const keys = incidents.map((i) => i.monthKey).filter(isValidMonthKey).sort();
  if (keys.length === 0) return [];
  const [fy, fm] = keys[0]!.split("-").map(Number);
  const [ly, lm] = keys[keys.length - 1]!.split("-").map(Number);
  const out: string[] = [];
  for (let y = fy!, m = fm!; y < ly! || (y === ly && m <= lm!); m === 12 ? ((m = 1), (y += 1)) : (m += 1)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

export function dataMonthLabels(incidents: Pick<Incident, "monthKey">[]): string[] {
  return dataMonthKeys(incidents).map(monthLabelFromKey);
}

export function dataYears(incidents: Pick<Incident, "monthKey">[]): string[] {
  return [...new Set(dataMonthKeys(incidents).map((k) => k.slice(0, 4)))];
}

/** e.g. "Jan 2026 to Sep 2026", or "" when there is no dated data. */
export function dataMonthSpan(incidents: Pick<Incident, "monthKey">[]): string {
  const labels = dataMonthLabels(incidents);
  if (labels.length === 0) return "";
  return labels.length === 1 ? labels[0]! : `${labels[0]} to ${labels[labels.length - 1]}`;
}
