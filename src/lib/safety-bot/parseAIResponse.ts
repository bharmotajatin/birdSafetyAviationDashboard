import type { Incident } from "@/lib/types";

const GHR_PATTERN = /(DEL\d{4}\/\w+)/gi;
const DATE_LINE_PATTERN = /\d{2}\s+\w{3}\s+\d{4}/;
const INCIDENT_LINE_HINT = /\b(DEL\d{4}|GHR\b)/i;

export type ParsedAIResponse = {
  summaryText: string;
  extractedIncidents: Incident[];
  useIncidentList: boolean;
};

function countIncidentLikeLines(text: string): number {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  return lines.filter(
    (line) =>
      INCIDENT_LINE_HINT.test(line) ||
      GHR_PATTERN.test(line) ||
      DATE_LINE_PATTERN.test(line),
  ).length;
}

export function parseAIResponse(text: string, incidents: Incident[]): ParsedAIResponse {
  const incidentLikeLines = countIncidentLikeLines(text);
  const ghrMatches = [...text.matchAll(GHR_PATTERN)].map((m) => m[1]!.toUpperCase());

  if (incidentLikeLines < 3 && ghrMatches.length < 3) {
    return {
      summaryText: text,
      extractedIncidents: [],
      useIncidentList: false,
    };
  }

  const byGhr = new Map(incidents.map((i) => [i.ghrNumber.toUpperCase(), i]));
  const found: Incident[] = [];
  const seen = new Set<string>();

  for (const ghr of ghrMatches) {
    const key = ghr.toUpperCase();
    if (seen.has(key)) continue;
    const inc = byGhr.get(key);
    if (inc) {
      seen.add(key);
      found.push(inc);
    }
  }

  if (found.length === 0) {
    return {
      summaryText: text,
      extractedIncidents: [],
      useIncidentList: false,
    };
  }

  const lines = text.split(/\n/);
  const summaryLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (GHR_PATTERN.test(trimmed) && found.some((i) => trimmed.includes(i.ghrNumber))) {
      continue;
    }
    summaryLines.push(line);
  }

  const summaryText =
    summaryLines.join("\n").trim() || (text.split("\n")[0] ?? text);

  return {
    summaryText,
    extractedIncidents: found,
    useIncidentList: true,
  };
}
