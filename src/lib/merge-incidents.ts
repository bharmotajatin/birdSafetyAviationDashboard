import { ensureUniqueIncidentIds } from "@/lib/parse/incidents";
import type { Incident } from "@/lib/types";

/** Dedupe key: GHR No. + S.No. (normalized) */
export function incidentDedupeKey(incident: Incident): string {
  const ghr = incident.ghrNumber.trim().toUpperCase();
  const serial = String(incident.serialNo);
  return `${ghr}::${serial}`;
}

export function mergeIncidents(
  existing: Incident[],
  incoming: Incident[],
): { merged: Incident[]; added: number; skipped: number } {
  const keys = new Set(existing.map(incidentDedupeKey));
  const toAdd: Incident[] = [];

  for (const incident of incoming) {
    const key = incidentDedupeKey(incident);
    if (keys.has(key)) continue;
    keys.add(key);
    toAdd.push(incident);
  }

  const merged = ensureUniqueIncidentIds([...existing, ...toAdd]);
  return {
    merged,
    added: toAdd.length,
    skipped: incoming.length - toAdd.length,
  };
}
