import type { Incident } from "@/lib/types";

export type ResponseType = "risk" | "monthly" | "list" | "comparison" | "summary" | "default";

const MONTH_NAMES =
  /january|february|march|april|may|june|july|august|september|october|november|december|month|trend|monthly/i;

export function detectResponseType(
  text: string,
  options?: { matchedCount?: number; questionId?: string },
): ResponseType {
  if ((options?.matchedCount ?? 0) > 0) {
    return "list";
  }

  const lower = text.toLowerCase();
  if (lower.includes("risk score") || options?.questionId === "del-risk" || options?.questionId === "highest-risk-station") {
    return "risk";
  }
  if (MONTH_NAMES.test(lower) || options?.questionId === "peak-month" || options?.questionId === "monthly-average" || options?.questionId === "cat-a-by-month") {
    return "monthly";
  }
  if (
    lower.includes(" vs ") ||
    lower.includes("compare") ||
    lower.includes("department") ||
    lower.includes("closure rate") ||
    options?.questionId === "dept-closure" ||
    options?.questionId === "compare-ramp-gsd"
  ) {
    return "comparison";
  }
  if (/(^|\n)\s*[•\-]\s+/m.test(text) || lower.includes("executive") || lower.includes("summary:")) {
    return "summary";
  }
  return "default";
}

export function dashboardRouteForResponseType(type: ResponseType): string {
  switch (type) {
    case "risk":
      return "/station-wise";
    case "monthly":
      return "/monthly";
    case "list":
      return "/incident-log";
    case "comparison":
      return "/station-analysis";
    default:
      return "/";
  }
}

export function extractRiskScore(text: string, rows: { value: string }[]): number {
  const row = rows.find((r) => r.value && /^\d+$/.test(r.value));
  if (row) return Number(row.value);
  const m = text.match(/risk score (?:is )?(\d+)/i) ?? text.match(/score (\d+)/i);
  return m ? Number(m[1]) : 0;
}

export function parseBulletLines(text: string): string[] {
  return text
    .split(/\n/)
    .map((line) => line.replace(/^\s*[•\-]\s+/, "").trim())
    .filter((line) => line.length > 0);
}

export function statusDotColor(status: Incident["status"]): string {
  switch (status) {
    case "Open":
      return "#ef4444";
    case "In Progress":
      return "#f59e0b";
    case "Pending":
      return "#a855f7";
    default:
      return "#22c55e";
  }
}

export function categoryBadgeClass(category: Incident["category"]): string {
  switch (category) {
    case "CAT-A":
      return "bg-red-500/20 text-red-300";
    case "CAT-B":
      return "bg-orange-500/20 text-orange-300";
    case "CAT-C":
      return "bg-amber-500/20 text-amber-200";
    default:
      return "bg-slate-500/20 text-slate-300";
  }
}
