import type { DashboardData } from "@/lib/types";
import { monthLabelFromKey } from "@/lib/parse/utils";

export type ProactiveAlert = {
  id: string;
  message: string;
};

const SHOWN_KEY = "bfs_bot_alerts_shown";

export function getProactiveAlerts(data: DashboardData): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];
  const { kpis } = data;

  if (kpis.open > 0) {
    alerts.push({
      id: "open",
      message: `⚠ Alert: ${kpis.open} incident(s) are still Open and require immediate action`,
    });
  }

  const validTrend = data.monthlyTrend.filter((m) => m.monthKey !== "unknown");
  const avg =
    validTrend.length > 0
      ? validTrend.reduce((s, m) => s + m.total, 0) / validTrend.length
      : data.avgIncidentsPerMonth;
  const recent = validTrend[validTrend.length - 1];
  if (recent && avg > 0 && recent.total > avg * 1.5) {
    const pct = Math.round(((recent.total - avg) / avg) * 100);
    alerts.push({
      id: "spike",
      message: `📈 Spike detected: ${recent.label} had ${recent.total} incidents — ${pct}% above average`,
    });
  }

  if (kpis.catA > 10) {
    alerts.push({
      id: "cat-a",
      message: `🔴 Critical: ${kpis.catA} CAT-A incidents on record — review recommended`,
    });
  }

  if (kpis.closureRate < 85) {
    const unresolved = kpis.open + kpis.pending + kpis.inProgress;
    alerts.push({
      id: "closure",
      message: `⚠ Closure rate below 85% threshold — ${unresolved} cases unresolved`,
    });
  }

  return alerts;
}

export function shouldShowProactiveAlerts(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SHOWN_KEY) !== "1";
}

export function markProactiveAlertsShown() {
  if (typeof window !== "undefined") sessionStorage.setItem(SHOWN_KEY, "1");
}

export function formatRecentMonthKey(data: DashboardData): string {
  const keys = data.incidents
    .map((i) => i.monthKey)
    .filter((k) => k !== "unknown")
    .sort();
  const last = keys[keys.length - 1];
  return last ? monthLabelFromKey(last) : "Recent";
}
