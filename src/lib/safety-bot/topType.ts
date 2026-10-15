import { incidentTypesOf } from "@/lib/analytics";
import { countByMulti, isNotSetLabel } from "@/lib/parse/utils";
import type { Incident } from "@/lib/types";

/** PA-07: most common incident type in the uploaded data (no hardcoded type names). */
export function topIncidentType(incidents: Incident[]): { label: string; list: Incident[] } {
  const top = countByMulti(incidents, incidentTypesOf).find((t) => !isNotSetLabel(t.label));
  if (!top) return { label: "", list: [] };
  return { label: top.label, list: incidents.filter((i) => incidentTypesOf(i).includes(top.label)) };
}

/** Distinct incident types present in the data, for matching free-text questions. */
export function knownIncidentTypes(incidents: Incident[]): string[] {
  return [...new Set(incidents.flatMap(incidentTypesOf))].filter((t) => !isNotSetLabel(t));
}
