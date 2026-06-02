import { monthLabelFromKey, normalizeIncidentType } from "@/lib/parse/utils";
import type { Incident } from "@/lib/types";

export interface SimilarityResult {
  incident: Incident;
  score: number;
  matchReasons: string[];
  sharedKeywords: string[];
}

export interface PatternCluster {
  id: string;
  label: string;
  incidentType: string;
  bodyPart: string;
  activity: string;
  department: string;
  incidents: Incident[];
  clusterSize: number;
  recurrenceRate: number;
  severity: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  trend: "INCREASING" | "DECREASING" | "STABLE";
  affectedMonths: string[];
  commonKeywords: string[];
  recommendation: string;
}

export interface LocationHotspot {
  location: string;
  count: number;
  dominantType: string;
  dominantCategory: string;
  incidents: Incident[];
}

export interface TimePattern {
  month: string;
  count: number;
  dominantType: string;
  isSpike: boolean;
  percentAboveAverage: number;
}

const CATEGORY_PRIORITY = ["CAT-A", "CAT-B", "CAT-C", "CAT-D"] as const;
const BODY_PARTS = [
  "hand",
  "finger",
  "thumb",
  "wrist",
  "arm",
  "elbow",
  "shoulder",
  "back",
  "spine",
  "neck",
  "head",
  "eye",
  "face",
  "nose",
  "ear",
  "leg",
  "knee",
  "ankle",
  "foot",
  "toe",
  "hip",
  "chest",
  "rib",
  "abdomen",
  "waist",
  "forearm",
  "palm",
  "knuckle",
  "heel",
] as const;
const ACTIVITY_KEYWORDS = [
  { keyword: "loading", label: "Loading/Unloading" },
  { keyword: "unloading", label: "Loading/Unloading" },
  { keyword: "pushback", label: "Aircraft Pushback" },
  { keyword: "refuel", label: "Refuelling" },
  { keyword: "towing", label: "Towing" },
  { keyword: "baggage", label: "Baggage Handling" },
  { keyword: "vehicle", label: "Vehicle Operation" },
  { keyword: "steps", label: "Aircraft Steps" },
  { keyword: "belt loader", label: "Belt Loader" },
  { keyword: "cargo", label: "Cargo Operations" },
  { keyword: "slip", label: "Slip/Trip/Fall" },
  { keyword: "trip", label: "Slip/Trip/Fall" },
  { keyword: "fall", label: "Slip/Trip/Fall" },
  { keyword: "gse", label: "GSE Operation" },
  { keyword: "forklift", label: "Forklift Operation" },
  { keyword: "pallet", label: "Pallet Handling" },
] as const;
const LOCATION_PATTERNS = [
  /\b(bay)\s+([a-z]?\d+[a-z]?)/i,
  /\b(gate)\s+([a-z]?\d+[a-z]?)/i,
  /\b(terminal)\s+([a-z0-9]+)/i,
  /\b(apron)\s+([a-z0-9]+)/i,
  /\b(ramp)\s+([a-z0-9]+)/i,
  /\b(hold)\s+([a-z0-9]+)/i,
  /\b(taxiway)\s+([a-z0-9]+)/i,
  /\b(runway)\s+([a-z0-9]+)/i,
  /\b(stand)\s+([a-z]?\d+[a-z]?)/i,
  /\b(pier)\s+([a-z0-9]+)/i,
  /\b(zone)\s+([a-z0-9]+)/i,
  /\b(area)\s+([a-z0-9]+)/i,
  /\b(parking)\s+([a-z0-9]+)/i,
] as const;
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "onto",
  "while",
  "during",
  "after",
  "before",
  "near",
  "been",
  "were",
  "was",
  "this",
  "that",
  "their",
  "they",
  "them",
  "there",
  "then",
  "when",
  "where",
  "which",
  "have",
  "has",
  "had",
  "been",
  "being",
  "operator",
  "staff",
  "incident",
  "reported",
  "caused",
  "case",
  "worker",
  "ground",
  "aircraft",
  "airport",
  "station",
  "department",
]);

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function uniqueKeywords(text: string): string[] {
  return [...new Set(tokenize(text))];
}

function monthLabel(monthKey: string): string {
  return /^\d{4}-\d{2}$/.test(monthKey) ? monthLabelFromKey(monthKey) : monthKey;
}

function monthCounts(incidents: Incident[]): Array<{ monthKey: string; count: number }> {
  const counts = new Map<string, number>();
  for (const incident of incidents) {
    if (!/^\d{4}-\d{2}$/.test(incident.monthKey)) continue;
    counts.set(incident.monthKey, (counts.get(incident.monthKey) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, count]) => ({ monthKey, count }));
}

function dominantCategory(incidents: Incident[]): string {
  const counts = CATEGORY_PRIORITY.map((category) => ({
    category,
    count: incidents.filter((incident) => incident.category === category).length,
  }));
  counts.sort((a, b) => b.count - a.count || CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category));
  return counts[0]?.category ?? "CAT-D";
}

function clusterRiskLevel(incidents: Incident[]): "HIGH" | "MEDIUM" | "LOW" {
  if (incidents.some((incident) => incident.category === "CAT-A") || incidents.length >= 5) {
    return "HIGH";
  }
  if (incidents.length >= 3) return "MEDIUM";
  return "LOW";
}

function clusterTrend(incidents: Incident[]): "INCREASING" | "DECREASING" | "STABLE" {
  const counts = monthCounts(incidents);
  if (counts.length <= 1) return "STABLE";
  const midpoint = Math.ceil(counts.length / 2);
  const early = counts.slice(0, midpoint).reduce((sum, item) => sum + item.count, 0);
  const late = counts.slice(midpoint).reduce((sum, item) => sum + item.count, 0);
  if (late >= early + 2 || (early > 0 && late / early >= 1.3)) return "INCREASING";
  if (early >= late + 2 || (late > 0 && early / late >= 1.3)) return "DECREASING";
  return "STABLE";
}

function topKeywords(incidents: Incident[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const incident of incidents) {
    for (const word of uniqueKeywords(`${incident.brief} ${incident.rootCause} ${incident.correctiveAction}`)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function buildRecommendation(
  incidentType: string,
  bodyPart: string,
  activity: string,
  department: string,
  riskLevel: PatternCluster["riskLevel"],
): string {
  const riskText =
    riskLevel === "HIGH"
      ? "Immediate supervisor review and targeted control measures are needed."
      : riskLevel === "MEDIUM"
        ? "Schedule a focused toolbox talk and verify control compliance."
        : "Monitor this pattern and reinforce the current safe-work method.";
  if (bodyPart !== "unspecified") {
    return `${riskText} Review ${bodyPart} injury exposure during ${activity.toLowerCase()} in ${department}, add task-specific PPE checks, and validate manual-handling posture before each shift.`;
  }
  if (/near miss/i.test(incidentType)) {
    return `${riskText} Review precursor conditions and strengthen near-miss reporting quality for ${activity.toLowerCase()} in ${department}.`;
  }
  return `${riskText} Audit the ${department} workflow for ${activity.toLowerCase()}, remove repeat triggers, and confirm staff briefings are happening before the task starts.`;
}

function formatClusterLabel(incidentType: string, bodyPart: string, activity: string, department: string): string {
  if (bodyPart !== "unspecified") {
    return `${toTitleCase(bodyPart)} ${incidentType.toLowerCase()} during ${activity} — ${department}`;
  }
  return `${incidentType} during ${activity} — ${department}`;
}

function extractLocationMentions(text: string): string[] {
  const matches = new Set<string>();
  for (const pattern of LOCATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const label = `${match[1]} ${match[2]}`.trim();
      matches.add(toTitleCase(label));
    }
  }
  return [...matches];
}

export function extractBodyPart(text: string): string {
  const lower = text.toLowerCase();
  return BODY_PARTS.find((bodyPart) => lower.includes(bodyPart)) ?? "unspecified";
}

export function extractActivity(text: string): string {
  const lower = text.toLowerCase();
  return ACTIVITY_KEYWORDS.find((activity) => lower.includes(activity.keyword))?.label ?? "General Operations";
}

export function findSimilarIncidents(
  targetIncident: Incident,
  allIncidents: Incident[],
  threshold = 0.35,
): SimilarityResult[] {
  const targetKeywords = uniqueKeywords(
    `${targetIncident.title} ${targetIncident.incidentType} ${targetIncident.brief}`,
  );

  return allIncidents
    .filter((incident) => incident.id !== targetIncident.id)
    .map((incident) => {
      let score = 0;
      const reasons: string[] = [];
      const incidentKeywords = uniqueKeywords(`${incident.title} ${incident.incidentType} ${incident.brief}`);
      const sharedKeywords = targetKeywords.filter((keyword) => incidentKeywords.includes(keyword));
      const uniqueUnion = new Set([...targetKeywords, ...incidentKeywords]);

      if (
        targetIncident.incidentType &&
        normalizeIncidentType(targetIncident.incidentType) === normalizeIncidentType(incident.incidentType)
      ) {
        score += 0.35;
        reasons.push(`Same type: ${normalizeIncidentType(incident.incidentType)}`);
      }
      if (targetIncident.category && targetIncident.category === incident.category) {
        score += 0.2;
        reasons.push(`Same category: ${incident.category}`);
      }
      if (targetIncident.department && targetIncident.department === incident.department) {
        score += 0.15;
        reasons.push(`Same dept: ${incident.department}`);
      }
      if (targetIncident.station && targetIncident.station === incident.station) {
        score += 0.1;
        reasons.push(`Same station: ${incident.station}`);
      }

      const keywordScore =
        uniqueUnion.size > 0 ? (sharedKeywords.length / uniqueUnion.size) * 0.2 : 0;
      score += keywordScore;
      if (sharedKeywords.length > 0) {
        reasons.push(`Keyword match: ${sharedKeywords.slice(0, 4).join(", ")}`);
      }

      return {
        incident,
        score: Math.min(1, Number(score.toFixed(3))),
        matchReasons: reasons,
        sharedKeywords,
      };
    })
    .filter((result) => result.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

export function findRecurringPatterns(incidents: Incident[]): PatternCluster[] {
  const groups = new Map<string, Incident[]>();

  for (const incident of incidents) {
    const incidentType = normalizeIncidentType(incident.incidentType);
    const bodyPart = extractBodyPart(`${incident.brief} ${incident.title} ${incident.personInvolved}`);
    const activity = extractActivity(`${incident.brief} ${incident.location} ${incident.equipment}`);
    const department = incident.department || "UNKNOWN";
    const key = [incidentType, bodyPart, activity, department].join("|");
    const current = groups.get(key) ?? [];
    current.push(incident);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, clusterIncidents]) => {
      const [incidentType, bodyPart, activity, department] = key.split("|");
      const months = monthCounts(clusterIncidents);
      const affectedMonths = months.map((item) => monthLabel(item.monthKey));
      const recurrenceRate =
        months.length > 0 ? Number((clusterIncidents.length / months.length).toFixed(2)) : clusterIncidents.length;
      const severity = dominantCategory(clusterIncidents);
      const riskLevel = clusterRiskLevel(clusterIncidents);
      return {
        id: `pattern-${incidentType}-${bodyPart}-${activity}-${department}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase(),
        label: formatClusterLabel(incidentType, bodyPart, activity, department),
        incidentType,
        bodyPart,
        activity,
        department,
        incidents: [...clusterIncidents].sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
        clusterSize: clusterIncidents.length,
        recurrenceRate,
        severity,
        riskLevel,
        trend: clusterTrend(clusterIncidents),
        affectedMonths,
        commonKeywords: topKeywords(clusterIncidents),
        recommendation: buildRecommendation(incidentType, bodyPart, activity, department, riskLevel),
      } satisfies PatternCluster;
    })
    .sort((a, b) => b.clusterSize - a.clusterSize || b.recurrenceRate - a.recurrenceRate);
}

export function findLocationHotspots(incidents: Incident[]): LocationHotspot[] {
  const groups = new Map<string, Incident[]>();

  for (const incident of incidents) {
    const text = `${incident.location} ${incident.brief}`;
    const mentions = extractLocationMentions(text);
    for (const location of mentions) {
      const current = groups.get(location) ?? [];
      current.push(incident);
      groups.set(location, current);
    }
  }

  return [...groups.entries()]
    .map(([location, hotspotIncidents]) => {
      const typeCounts = new Map<string, number>();
      for (const incident of hotspotIncidents) {
        const type = normalizeIncidentType(incident.incidentType);
        typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      }
      const dominantType =
        [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

      return {
        location,
        count: hotspotIncidents.length,
        dominantType,
        dominantCategory: dominantCategory(hotspotIncidents),
        incidents: [...hotspotIncidents],
      } satisfies LocationHotspot;
    })
    .sort((a, b) => b.count - a.count || a.location.localeCompare(b.location));
}

export function findTimePatterns(incidents: Incident[]): TimePattern[] {
  const monthly = monthCounts(incidents);
  const average = monthly.length > 0 ? monthly.reduce((sum, item) => sum + item.count, 0) / monthly.length : 0;

  return monthly.map((item) => {
    const incidentsInMonth = incidents.filter((incident) => incident.monthKey === item.monthKey);
    const dominantType =
      [...new Set(incidentsInMonth.map((incident) => normalizeIncidentType(incident.incidentType)))]
        .map((type) => ({
          type,
          count: incidentsInMonth.filter((incident) => normalizeIncidentType(incident.incidentType) === type).length,
        }))
        .sort((a, b) => b.count - a.count)[0]?.type ?? "Unknown";
    const percentAboveAverage =
      average > 0 ? Number((((item.count - average) / average) * 100).toFixed(1)) : 0;
    return {
      month: monthLabel(item.monthKey),
      count: item.count,
      dominantType,
      isSpike: average > 0 ? item.count > average * 1.5 : false,
      percentAboveAverage,
    } satisfies TimePattern;
  });
}
