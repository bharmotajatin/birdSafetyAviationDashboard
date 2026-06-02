import type { IncidentLogBotFilters } from "@/lib/safety-bot/incident-log-nav";

/** Filters to pre-apply on Incident Log when navigating from the bot. */
export function navigateFiltersForQuestion(questionId: string): IncidentLogBotFilters {
  const map: Record<string, IncidentLogBotFilters> = {
    "cat-a-count": { category: "CAT-A" },
    "cat-b-count": { category: "CAT-B" },
    "near-miss": { search: "near miss" },
    "open-incidents": { status: "Open" },
    "pending-count": { status: "Pending" },
    "in-progress-count": { status: "In Progress" },
    "closed-count": { status: "Closed" },
    "staff-injuries-2025": { search: "staff injury" },
    "ramp-incidents": { department: "RAMP" },
    "cargo-dept": { department: "CARGO" },
    "gse-incidents": { search: "gse" },
    "loading-errors": { search: "loading" },
    "del-risk": { station: "DEL" },
    "highest-risk-station": { station: "DEL" },
  };
  return map[questionId] ?? {};
}

export function navigateFiltersFromQueryParts(parts: {
  category?: string;
  status?: string;
  department?: string;
  typeTerms?: string[];
}): IncidentLogBotFilters {
  const filters: IncidentLogBotFilters = {};
  if (parts.category) filters.category = parts.category;
  if (parts.status) filters.status = parts.status;
  if (parts.department) filters.department = parts.department;
  if (parts.typeTerms?.length === 1) {
    filters.search = parts.typeTerms[0];
  } else if (parts.typeTerms && parts.typeTerms.length > 1) {
    filters.search = parts.typeTerms.join(" ");
  }
  return filters;
}
