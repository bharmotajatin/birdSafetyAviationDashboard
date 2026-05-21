import type { DashboardData, Incident } from "@/lib/types";

export function totalIncidentsBack(kpis: DashboardData["kpis"]) {
  return `RAMP: ${kpis.ramp} | GSD: ${kpis.gsd}\nCAT-A: ${kpis.catA} | CAT-B: ${kpis.catB}\nCAT-C: ${kpis.catC} | CAT-D: ${kpis.catD}`;
}

export function openIncidentsBack(incidents: Incident[]) {
  const open = incidents.filter((i) => i.status === "Open");
  if (!open.length) return "No open incidents.";
  return open
    .slice(0, 8)
    .map((i) => `${i.ghrNumber} — ${i.title}`)
    .join("\n");
}

export function closureRateBack(monthly: DashboardData["monthlyTrend"]) {
  if (!monthly.length) return "No monthly closure data.";
  return monthly
    .slice(-6)
    .map((m) => `${m.label}: ${m.closureRate}%`)
    .join("\n");
}

export function catAMonthsBack(incidents: Incident[]) {
  const months = [
    ...new Set(
      incidents
        .filter((i) => i.category === "CAT-A" && i.monthKey !== "unknown")
        .map((i) => i.monthKey),
    ),
  ].sort();
  if (!months.length) return "No CAT-A incidents recorded.";
  return months.join(", ");
}

export function statusListBack(
  incidents: Incident[],
  status: Incident["status"],
  limit = 8,
) {
  const list = incidents.filter((i) => i.status === status);
  if (!list.length) return `No ${status.toLowerCase()} incidents.`;
  return list
    .slice(0, limit)
    .map((i) => `${i.ghrNumber} — ${i.title}`)
    .join("\n");
}
