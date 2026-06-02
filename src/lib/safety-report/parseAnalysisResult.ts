import type {
  LocationHotspot,
  PatternCluster,
} from "@/lib/analytics/patternEngine";
import type { Incident } from "@/lib/types";
import { safeParseResult } from "@/lib/safety-report/safeParseResult";
import type {
  ReportRiskLevel,
  ReportSeverity,
  RootCauseHypothesis,
  SafetyAnalysisResult,
  SafetyInjuryBar,
  SafetyLocationRisk,
  SafetyPatternCard,
  SafetyRecommendation,
  SeasonalTimeRisk,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSeverity(value: unknown, fallback: ReportSeverity = "Medium"): ReportSeverity {
  const raw = asString(value).toLowerCase();
  if (raw.includes("crit")) return "Critical";
  if (raw.includes("high")) return "High";
  if (raw.includes("med")) return "Medium";
  return fallback;
}

function clusterSeverity(level: PatternCluster["riskLevel"]): ReportSeverity {
  if (level === "HIGH") return "Critical";
  if (level === "MEDIUM") return "High";
  return "Medium";
}

function normalizeRiskLevel(value: unknown, fallback: ReportRiskLevel = "MEDIUM"): ReportRiskLevel {
  const raw = asString(value).toUpperCase().replace(/_/g, "-");
  if (!raw) return fallback;
  if (raw.includes("CRITICAL")) return "CRITICAL";
  if (raw.includes("MEDIUM") && raw.includes("HIGH")) return "MEDIUM-HIGH";
  if (raw.includes("HIGH")) return "HIGH";
  if (raw.includes("MEDIUM")) return "MEDIUM";
  if (raw.includes("LOW")) return "LOW";
  return fallback;
}

function riskFromSeverity(severity: ReportSeverity): ReportRiskLevel {
  if (severity === "Critical") return "CRITICAL";
  if (severity === "High") return "HIGH";
  return "MEDIUM";
}

function highestRiskLevel(levels: ReportRiskLevel[]): ReportRiskLevel {
  const rank: Record<ReportRiskLevel, number> = {
    CRITICAL: 5,
    HIGH: 4,
    "MEDIUM-HIGH": 3,
    MEDIUM: 2,
    LOW: 1,
  };
  return levels.sort((a, b) => rank[b] - rank[a])[0] ?? "LOW";
}

function mapPatternItems(source: unknown[]): SafetyPatternCard[] {
  return source
    .map((item, index) => {
      const record = asRecord(item);
      if (!record) {
        const text = asString(item);
        if (!text) return null;
        return {
          name: `Pattern ${index + 1}`,
          severity: normalizeSeverity(text, "Medium"),
          detail: text,
        };
      }
      return {
        name: asString(record.name ?? record.pattern ?? record.title) || `Pattern ${index + 1}`,
        severity: normalizeSeverity(record.severity ?? record.riskLevel, "Medium"),
        detail: asString(record.detail ?? record.description ?? record.summary) || asString(record.name),
      };
    })
    .filter((item): item is SafetyPatternCard => Boolean(item));
}

function parseSections(displayText: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = displayText.split(/\r?\n/);
  let currentKey = "";
  let body: string[] = [];

  const flush = () => {
    if (!currentKey) return;
    sections[currentKey] = body.join("\n").trim();
    body = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+\.\s+[A-Z][A-Z /-]+$/.test(trimmed)) {
      flush();
      currentKey = trimmed;
      continue;
    }
    if (currentKey) body.push(line);
  }
  flush();
  return sections;
}

function bulletsFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);
}

function patternsFromText(text: string): SafetyPatternCard[] {
  const chunks = text.split(/\n{2,}/).filter(Boolean);
  return chunks.slice(0, 6).map((chunk, index) => {
    const lines = chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const name = lines[0]?.replace(/^[-*•\d.)]+\s*/, "") ?? `Pattern ${index + 1}`;
    const detail = lines.slice(1).join(" ") || chunk;
    const severity = normalizeSeverity(
      /critical|high|medium/i.exec(chunk)?.[0] ?? "",
      index === 0 ? "Critical" : index === 1 ? "High" : "Medium",
    );
    return { name, severity, detail };
  });
}

function injuriesFromText(text: string): SafetyInjuryBar[] {
  const lines = bulletsFromText(text);
  return lines.slice(0, 8).map((line, index) => {
    const countMatch = line.match(/(\d+)\s*(?:incident|case|×|x)/i);
    const count = countMatch ? Number(countMatch[1]) : Math.max(1, 8 - index);
    const label = line.replace(/(\d+)\s*(?:incident|case|×|x).*/i, "").trim() || line;
    return {
      label: label.slice(0, 48),
      count,
      severity: index < 2 ? "Critical" : index < 4 ? "High" : "Medium",
    };
  });
}

function locationsFromText(text: string): SafetyLocationRisk[] {
  const lines = bulletsFromText(text);
  return lines.slice(0, 8).map((line, index) => {
    const countMatch = line.match(/(\d+)/);
    const count = countMatch ? Number(countMatch[1]) : Math.max(1, 6 - index);
    const [location, ...rest] = line.split(/[—–:-]/);
    return {
      location: (location ?? line).trim().slice(0, 40),
      count,
      reason: rest.join(" ").trim() || "Recurring incidents at this location",
      severity: index < 2 ? "Critical" : index < 4 ? "High" : "Medium",
    };
  });
}

function recommendationsFromText(text: string): SafetyRecommendation[] {
  return bulletsFromText(text).slice(0, 10).map((text) => ({ text }));
}

function formatReportPeriod(incidents: Incident[]): string {
  const dates: Date[] = [];

  for (const incident of incidents) {
    if (incident.monthKey && /^\d{4}-\d{2}$/.test(incident.monthKey)) {
      const [year, month] = incident.monthKey.split("-").map(Number);
      dates.push(new Date(year, month - 1, 1));
      continue;
    }
    if (incident.date) {
      const parsed = new Date(incident.date);
      if (!Number.isNaN(parsed.getTime())) dates.push(parsed);
    }
  }

  if (dates.length === 0) {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const fmt = (value: Date) =>
      value.toLocaleString("default", { month: "short", year: "numeric" });
    return `${fmt(startOfYear)} – ${fmt(now)}`;
  }

  dates.sort((a, b) => a.getTime() - b.getTime());
  const fmt = (value: Date) => value.toLocaleString("default", { month: "short", year: "numeric" });
  const start = dates[0];
  const end = dates[dates.length - 1];
  return `${fmt(start)} – ${fmt(end)}`;
}

function parseStructuredJson(raw: Record<string, unknown>): Partial<SafetyAnalysisResult> {
  const executiveRaw = asRecord(raw.executiveSummary) ?? asRecord(raw.executive_summary);
  const executiveText =
    asString(executiveRaw?.text) ||
    asString(executiveRaw?.summary) ||
    asString(executiveRaw?.content) ||
    (typeof raw.executiveSummary === "string" ? asString(raw.executiveSummary) : "") ||
    asString(raw.executive_summary);

  const executiveRiskLevel = normalizeRiskLevel(
    executiveRaw?.riskLevel ?? executiveRaw?.risk_level ?? raw.riskLevel,
    "MEDIUM-HIGH",
  );

  const topPatternsRaw = raw.topPatterns ?? raw.top_patterns;
  let top3RecurringRiskPatterns = mapPatternItems(
    asArray(
      raw.top3RecurringRiskPatterns ??
        raw.top_3_recurring_risk_patterns ??
        raw.top3Patterns,
    ),
  );
  let patternAnalysis = mapPatternItems(asArray(raw.patternAnalysis ?? raw.pattern_analysis));

  if (!patternAnalysis.length && top3RecurringRiskPatterns.length) {
    patternAnalysis = top3RecurringRiskPatterns;
  }
  if (!top3RecurringRiskPatterns.length) {
    top3RecurringRiskPatterns = patternAnalysis.slice(0, 3);
  }
  if (!patternAnalysis.length && typeof topPatternsRaw === "string" && topPatternsRaw.trim()) {
    patternAnalysis = patternsFromText(topPatternsRaw);
    top3RecurringRiskPatterns = patternAnalysis.slice(0, 3);
  }

  const injuryRaw = asRecord(raw.injuryAnalysis ?? raw.injury_analysis);
  const injuryDeepDiveRaw = raw.injuryDeepDive ?? raw.injury_deep_dive;
  const injuryList = asArray(
    injuryRaw?.mostCommonInjuries ??
      injuryRaw?.most_common_injuries ??
      raw.mostCommonInjuries,
  );
  let mostCommonInjuries = injuryList
    .map((item, index) => {
      const record = asRecord(item);
      if (!record) {
        const text = asString(item);
        if (!text) return null;
        return {
          label: text.slice(0, 48),
          count: Math.max(1, 8 - index),
          severity: normalizeSeverity(text, "Medium"),
        };
      }
      return {
        label: asString(record.label ?? record.bodyPart ?? record.name) || `Injury ${index + 1}`,
        count: Number(record.count ?? record.incidents ?? 1) || 1,
        severity: normalizeSeverity(record.severity, "Medium"),
      };
    })
    .filter((item): item is SafetyInjuryBar => Boolean(item));

  if (!mostCommonInjuries.length && typeof injuryDeepDiveRaw === "string" && injuryDeepDiveRaw.trim()) {
    mostCommonInjuries = injuriesFromText(injuryDeepDiveRaw);
  }

  const locationRaw = raw.locationRisk ?? raw.location_risk;
  const locationList = asArray(
    raw.locationRiskMatrix ?? raw.location_risk_matrix ?? raw.locationRisk,
  );
  const locationRiskMatrix = locationList
    .map((item, index) => {
      const record = asRecord(item);
      if (!record) {
        const text = asString(item);
        if (!text) return null;
        return {
          location: text.slice(0, 40),
          count: Math.max(1, 5 - index),
          reason: "Elevated incident concentration",
          severity: normalizeSeverity(text, "Medium"),
        };
      }
      return {
        location: asString(record.location ?? record.name) || `Location ${index + 1}`,
        count: Number(record.count ?? record.incidents ?? 1) || 1,
        reason: asString(record.reason ?? record.assessment) || "Recurring safety concern",
        severity: normalizeSeverity(record.severity, "Medium"),
      };
    })
    .filter((item): item is SafetyLocationRisk => Boolean(item));

  if (!locationRiskMatrix.length && typeof locationRaw === "string" && locationRaw.trim()) {
    locationRiskMatrix.push(...locationsFromText(locationRaw));
  }

  const recommendationsRaw = raw.recommendations ?? raw.specific_recommendations;
  const earlyWarningsRaw = asArray(
    raw.earlyWarningIndicators ?? raw.early_warning_indicators ?? raw.earlyWarnings,
  );
  const earlyWarningIndicators = earlyWarningsRaw
    .map((item) => {
      const record = asRecord(item);
      const text = record
        ? asString(record.text ?? record.indicator ?? record.warning)
        : asString(item);
      return text ? { text } : null;
    })
    .filter((item): item is SafetyRecommendation => Boolean(item));

  const earlyWarningsText = raw.earlyWarnings ?? raw.early_warnings;
  if (!earlyWarningIndicators.length && typeof earlyWarningsText === "string" && earlyWarningsText.trim()) {
    earlyWarningIndicators.push(...recommendationsFromText(earlyWarningsText));
  }

  const actionsRaw = asArray(
    raw.specificRecommendations ??
      raw.specific_recommendations ??
      raw.immediateActions ??
      raw.immediate_actions ??
      raw.recommendations,
  );
  const specificRecommendations = actionsRaw
    .map((item) => {
      const record = asRecord(item);
      const text = record ? asString(record.text ?? record.action ?? record.recommendation) : asString(item);
      return text ? { text } : null;
    })
    .filter((item): item is SafetyRecommendation => Boolean(item));

  if (!specificRecommendations.length && typeof recommendationsRaw === "string" && recommendationsRaw.trim()) {
    specificRecommendations.push(...recommendationsFromText(recommendationsRaw));
  }

  const seasonalRaw = asRecord(raw.seasonalTimeRisk ?? raw.seasonal_time_risk);
  const timeRiskText = asString(raw.timeRisk ?? raw.seasonal_time_risk);
  const seasonalTimeRisk: SeasonalTimeRisk | undefined = seasonalRaw
    ? {
        peakMonths: asArray(seasonalRaw.peakMonths ?? seasonalRaw.peak_months)
          .map((month) => asString(month))
          .filter(Boolean),
        reason: asString(seasonalRaw.reason ?? seasonalRaw.assessment),
        summary: asString(seasonalRaw.summary ?? seasonalRaw.reason),
      }
    : timeRiskText
      ? { peakMonths: [], reason: timeRiskText, summary: timeRiskText }
      : undefined;

  const rootRaw = raw.rootCauseHypothesis ?? raw.root_cause_hypothesis;
  const rootRecord = asRecord(rootRaw);
  const rootCauseHypothesis: RootCauseHypothesis | undefined = rootRecord
    ? { text: asString(rootRecord.text ?? rootRecord.hypothesis ?? rootRecord.summary) }
    : asString(rootRaw)
      ? { text: asString(rootRaw) }
      : undefined;

  const kpisRaw = asRecord(raw.kpis);
  const kpis = kpisRaw
    ? {
        totalIncidents: Number(kpisRaw.totalIncidents ?? kpisRaw.total_incidents ?? 0),
        recurringPatterns: Number(kpisRaw.recurringPatterns ?? kpisRaw.recurring_patterns ?? 0),
        staffInjuries: Number(kpisRaw.staffInjuries ?? kpisRaw.staff_injuries ?? 0),
        hotspotLocations: Number(kpisRaw.hotspotLocations ?? kpisRaw.hotspot_locations ?? 0),
      }
    : undefined;

  return {
    executiveSummary: executiveText
      ? {
          text: executiveText,
          riskLevel: executiveRiskLevel,
        }
      : undefined,
    top3RecurringRiskPatterns: top3RecurringRiskPatterns.length ? top3RecurringRiskPatterns : undefined,
    patternAnalysis: patternAnalysis.length ? patternAnalysis : undefined,
    seasonalTimeRisk,
    rootCauseHypothesis,
    injuryAnalysis: mostCommonInjuries.length ? { mostCommonInjuries } : undefined,
    locationRiskMatrix: locationRiskMatrix.length ? locationRiskMatrix : undefined,
    specificRecommendations: specificRecommendations.length ? specificRecommendations : undefined,
    earlyWarningIndicators: earlyWarningIndicators.length ? earlyWarningIndicators : undefined,
    kpis:
      kpis && (kpis.totalIncidents || kpis.recurringPatterns)
        ? {
            totalIncidents: kpis.totalIncidents || 0,
            recurringPatterns: kpis.recurringPatterns || 0,
            staffInjuries: kpis.staffInjuries || 0,
            hotspotLocations: kpis.hotspotLocations || 0,
          }
        : undefined,
  };
}

export type BuildReportDataInput = {
  rawReport?: string;
  displayReport?: string;
  parsed?: Record<string, unknown> | null;
  incidents: Incident[];
  recurringClusters: PatternCluster[];
  injuryClusters: PatternCluster[];
  hotspots: LocationHotspot[];
  timePatterns: { month: string; count: number; isSpike: boolean }[];
  highestRiskCluster: PatternCluster | undefined;
};

export function buildSafetyReportData(input: BuildReportDataInput): SafetyAnalysisResult {
  const {
    rawReport = "",
    displayReport = "",
    incidents,
    recurringClusters,
    injuryClusters,
    hotspots,
    timePatterns,
    highestRiskCluster,
  } = input;

  const json =
    input.parsed ??
    safeParseResult(rawReport) ??
    safeParseResult(displayReport);
  const parsed: Partial<SafetyAnalysisResult> = json ? parseStructuredJson(json) : {};

  const sections = parseSections(displayReport || rawReport);
  const executiveText =
    parsed.executiveSummary?.text ||
    sections["1. EXECUTIVE SUMMARY"] ||
    displayReport.slice(0, 1200);

  const patternAnalysis =
    parsed.patternAnalysis?.length
      ? parsed.patternAnalysis
      : patternsFromText(sections["2. TOP 3 RECURRING RISK PATTERNS"] || "").length
        ? patternsFromText(sections["2. TOP 3 RECURRING RISK PATTERNS"])
        : recurringClusters.slice(0, 6).map((cluster) => ({
            name: cluster.label,
            severity: clusterSeverity(cluster.riskLevel),
            detail: `${cluster.clusterSize} incidents · ${cluster.department} · ${cluster.activity} · Trend ${cluster.trend}`,
          }));

  const top3RecurringRiskPatterns =
    parsed.top3RecurringRiskPatterns?.length
      ? parsed.top3RecurringRiskPatterns
      : patternAnalysis.slice(0, 3);

  const mostCommonInjuries =
    parsed.injuryAnalysis?.mostCommonInjuries?.length
      ? parsed.injuryAnalysis.mostCommonInjuries
      : injuriesFromText(sections["3. INJURY PATTERN DEEP DIVE"] || "").length
        ? injuriesFromText(sections["3. INJURY PATTERN DEEP DIVE"])
        : injuryClusters.slice(0, 8).map((cluster, index) => ({
            label: cluster.bodyPart === "unspecified" ? cluster.incidentType : cluster.bodyPart,
            count: cluster.clusterSize,
            severity: clusterSeverity(cluster.riskLevel),
          }));

  const locationRiskMatrix =
    parsed.locationRiskMatrix?.length
      ? parsed.locationRiskMatrix
      : locationsFromText(sections["4. LOCATION RISK ASSESSMENT"] || "").length
        ? locationsFromText(sections["4. LOCATION RISK ASSESSMENT"])
        : hotspots.slice(0, 8).map((hotspot, index) => ({
            location: hotspot.location,
            count: hotspot.count,
            reason: `Dominant type: ${hotspot.dominantType} (${hotspot.dominantCategory})`,
            severity: (index < 2 ? "Critical" : index < 4 ? "High" : "Medium") as ReportSeverity,
          }));

  const specificRecommendations =
    parsed.specificRecommendations?.length
      ? parsed.specificRecommendations
      : recommendationsFromText(sections["7. SPECIFIC RECOMMENDATIONS"] || "").length
        ? recommendationsFromText(sections["7. SPECIFIC RECOMMENDATIONS"])
        : recurringClusters.slice(0, 5).map((cluster) => ({
            text: cluster.recommendation || `Review controls for ${cluster.label}`,
          }));

  const earlyWarningIndicators =
    parsed.earlyWarningIndicators?.length
      ? parsed.earlyWarningIndicators
      : recommendationsFromText(sections["8. EARLY WARNING INDICATORS"] || "").length
        ? recommendationsFromText(sections["8. EARLY WARNING INDICATORS"])
        : [];

  const seasonalTimeRisk: SeasonalTimeRisk = parsed.seasonalTimeRisk?.summary
    ? parsed.seasonalTimeRisk
    : {
        peakMonths: timePatterns.filter((pattern) => pattern.isSpike).map((pattern) => pattern.month),
        reason:
          sections["5. SEASONAL / TIME RISK"] ||
          "Review monthly incident spikes and seasonal staffing levels.",
        summary: sections["5. SEASONAL / TIME RISK"] || "Seasonal patterns require continued monitoring.",
      };

  const rootCauseHypothesis: RootCauseHypothesis = parsed.rootCauseHypothesis?.text
    ? parsed.rootCauseHypothesis
    : {
        text:
          sections["6. ROOT CAUSE HYPOTHESIS"] ||
          "Insufficient control of recurring operational hazards across high-frequency clusters.",
      };

  const staffInjuries =
    injuryClusters.reduce((sum, cluster) => sum + cluster.clusterSize, 0) ||
    incidents.filter((incident) => /injur|hurt|wound|fracture/i.test(`${incident.brief} ${incident.title}`))
      .length;

  const station =
    incidents.find((incident) => incident.station)?.station?.toString() || "DEL";

  const period = formatReportPeriod(incidents);

  const riskLevel = highestRiskLevel([
    parsed.executiveSummary?.riskLevel ??
      (highestRiskCluster?.riskLevel === "HIGH"
        ? "HIGH"
        : highestRiskCluster?.riskLevel === "MEDIUM"
          ? "MEDIUM-HIGH"
          : "LOW"),
    ...patternAnalysis.map((pattern) => riskFromSeverity(pattern.severity)),
    ...locationRiskMatrix.map((location) => riskFromSeverity(location.severity)),
  ]);

  const kpis = {
    totalIncidents:
      parsed.kpis?.totalIncidents && parsed.kpis.totalIncidents > 0
        ? parsed.kpis.totalIncidents
        : incidents.length,
    recurringPatterns:
      parsed.kpis?.recurringPatterns && parsed.kpis.recurringPatterns > 0
        ? parsed.kpis.recurringPatterns
        : recurringClusters.length,
    staffInjuries:
      parsed.kpis?.staffInjuries && parsed.kpis.staffInjuries > 0
        ? parsed.kpis.staffInjuries
        : staffInjuries,
    hotspotLocations:
      parsed.kpis?.hotspotLocations && parsed.kpis.hotspotLocations > 0
        ? parsed.kpis.hotspotLocations
        : hotspots.filter((hotspot) => hotspot.count >= 2).length,
  };

  return {
    executiveSummary: {
      text: executiveText,
      riskLevel: parsed.executiveSummary?.riskLevel ?? riskLevel,
    },
    top3RecurringRiskPatterns,
    patternAnalysis,
    injuryAnalysis: { mostCommonInjuries },
    locationRiskMatrix,
    locationRiskAssessment: sections["4. LOCATION RISK ASSESSMENT"] || undefined,
    seasonalTimeRisk,
    rootCauseHypothesis,
    specificRecommendations,
    earlyWarningIndicators,
    kpis,
    meta: {
      station: String(station),
      period,
      reportDate: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      riskLevel,
    },
  };
}

export function severityColor(severity: ReportSeverity): string {
  if (severity === "Critical") return "#C0392B";
  if (severity === "High") return "#D4A017";
  return "#1A7A4A";
}

export function riskLevelColor(level: ReportRiskLevel): string {
  if (level === "CRITICAL") return "#C0392B";
  if (level === "HIGH") return "#FF6B6B";
  if (level === "MEDIUM-HIGH") return "#FFD93D";
  if (level === "MEDIUM") return "#1A7A4A";
  return "#6BFF9E";
}

export function riskBadgeStyle(level: ReportRiskLevel | string): {
  background: string;
  color: string;
  border: string;
} {
  const normalized = asString(level).toUpperCase();
  if (normalized.includes("CRITICAL") || normalized === "HIGH") {
    return { background: "#FEF0EF", color: "#C0392B", border: "1px solid #C0392B" };
  }
  if (normalized.includes("MEDIUM-HIGH") || normalized === "MEDIUM") {
    return { background: "#FEF9EE", color: "#D4A017", border: "1px solid #D4A017" };
  }
  return { background: "#EEF7F2", color: "#1A7A4A", border: "1px solid #1A7A4A" };
}

export function patternCardTheme(severity: ReportSeverity) {
  const raw = asString(severity).toUpperCase();
  if (raw.includes("HIGH") || raw.includes("CRIT")) {
    return { background: "#FEF0EF", border: "#C0392B", color: "#C0392B" };
  }
  if (raw.includes("MED")) {
    return { background: "#FFFBF0", border: "#D4A017", color: "#D4A017" };
  }
  return { background: "#F0FAF4", border: "#1A7A4A", color: "#1A7A4A" };
}

export { safeParseResult };
