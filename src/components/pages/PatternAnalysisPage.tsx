"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  ChevronDown,
  ChevronUp,
  GitMerge,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { InjuryExploreCard } from "@/components/pattern-analysis/InjuryExploreCard";
import { InjurySourceModal } from "@/components/pattern-analysis/InjurySourceModal";
import { AiAnalysisReportView } from "@/components/AiAnalysisReportView";
import { SafetyReportPDF } from "@/components/SafetyReportPDF";
import { IncidentDetailDrawer } from "@/components/dashboard/IncidentDetailDrawer";
import { usePageData } from "@/components/layout/PageDataRequired";
import {
  CountChart,
  GroupedBarChart,
} from "@/components/charts/DashboardCharts";
import { EmptyState, LoadingSkeleton } from "@/components/ui/dashboard-primitives";
import { CategoryBadge, StatusDot } from "@/components/ui/badges";
import { fadeUp, stagger } from "@/lib/animations";
import {
  AskGroqError,
  askGroq,
  type GroqMessage,
} from "@/lib/safety-bot/askGroq";
import {
  extractActivity,
  extractBodyPart,
  findLocationHotspots,
  findRecurringPatterns,
  findSimilarIncidents,
  findTimePatterns,
  type LocationHotspot,
  type PatternCluster,
  type SimilarityResult,
  type TimePattern,
} from "@/lib/analytics/patternEngine";
import { CATEGORY_COLORS } from "@/lib/constants";
import { normalizeIncidentType } from "@/lib/parse/utils";
import {
  formatTimeAgo,
  hoursSinceLastUpdated,
  loadAnalysisFromStorage,
  loadLastUpdatedFromStorage,
  saveAnalysisResult,
} from "@/lib/bfs-storage";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import {
  buildSafetyReportData,
  safeParseResult,
} from "@/lib/safety-report/parseAnalysisResult";
import type { SafetyAnalysisResult } from "@/lib/safety-report/types";
import { exportSafetyReportPdf } from "@/lib/safety-report/exportSafetyReportPdf";
import {
  buildActivityChartModalRows,
  buildBodyMapModalRows,
  buildBodyPartBarModalRows,
  type InjuryModalData,
} from "@/lib/injury-cluster-modal";
import type { DashboardData, Incident } from "@/lib/types";

const INJURY_GRAPH_CARD_STYLE = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: "12px",
  padding: "16px",
  width: "100%",
  boxSizing: "border-box" as const,
};

type PatternTab = "all" | "injury" | "location" | "time" | "ai";
type AlertTone = "red" | "amber";
type PatternAlert = {
  id: string;
  tone: AlertTone;
  message: string;
};
type AiFollowUp = {
  id: string;
  question: string;
  answer: string;
};

const CARD_CLASS =
  "rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0f172a]";
const MONTH_SEQUENCE = [
  "Jan 2025",
  "Feb 2025",
  "Mar 2025",
  "Apr 2025",
  "May 2025",
  "Jun 2025",
  "Jul 2025",
  "Aug 2025",
  "Sep 2025",
  "Oct 2025",
  "Nov 2025",
  "Dec 2025",
  "Jan 2026",
  "Feb 2026",
] as const;
const TABS: Array<{ id: PatternTab; label: string }> = [
  { id: "all", label: "All Patterns" },
  { id: "injury", label: "Injury Clusters" },
  { id: "location", label: "Location Hotspots" },
  { id: "time", label: "Time Patterns" },
  { id: "ai", label: "AI Deep Analysis" },
];
const BODY_REGIONS = [
  { id: "head", label: "Head", parts: ["head", "eye", "face", "nose", "ear", "neck"] },
  { id: "shoulders", label: "Shoulders", parts: ["shoulder"] },
  { id: "arms", label: "Arms", parts: ["arm", "elbow", "forearm"] },
  { id: "hands", label: "Hands", parts: ["hand", "finger", "thumb", "wrist", "palm", "knuckle"] },
  { id: "chest", label: "Chest", parts: ["chest", "rib", "abdomen", "waist"] },
  { id: "back", label: "Back", parts: ["back", "spine"] },
  { id: "legs", label: "Legs", parts: ["leg", "knee", "hip"] },
  { id: "feet", label: "Feet", parts: ["ankle", "foot", "toe", "heel"] },
] as const;

function regionIncludesBodyPart(parts: readonly string[], bodyPart: string): boolean {
  return parts.includes(bodyPart);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function getRiskRank(level: PatternCluster["riskLevel"]): number {
  return level === "HIGH" ? 3 : level === "MEDIUM" ? 2 : 1;
}

function getTrendGlyph(trend: PatternCluster["trend"]): { icon: string; color: string } {
  if (trend === "INCREASING") return { icon: "↗", color: "#dc2626" };
  if (trend === "DECREASING") return { icon: "↘", color: "#16a34a" };
  return { icon: "→", color: "#64748b" };
}

function PatternRiskBadge({ level }: { level: PatternCluster["riskLevel"] }) {
  const style =
    level === "HIGH"
      ? {
          background: "rgba(239,68,68,0.1)",
          color: "#dc2626",
          border: "1px solid rgba(239,68,68,0.2)",
        }
      : level === "MEDIUM"
        ? {
            background: "rgba(245,158,11,0.1)",
            color: "#d97706",
            border: "1px solid rgba(245,158,11,0.2)",
          }
        : {
            background: "rgba(34,197,94,0.1)",
            color: "#16a34a",
            border: "1px solid rgba(34,197,94,0.2)",
          };
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
      style={style}
    >
      {level}
    </span>
  );
}

function colorForBodyCount(count: number): string {
  if (count >= 10) return "#ef4444";
  if (count >= 6) return "#fb923c";
  if (count >= 3) return "#fde68a";
  if (count >= 1) return "#fef9c3";
  return "#f1f5f9";
}

function alphaGold(count: number, max: number): string {
  const opacity = max > 0 ? 0.12 + (count / max) * 0.48 : 0.08;
  return `rgba(212, 175, 55, ${Math.min(opacity, 0.65)})`;
}

function similarityBar(score: number): string {
  const filled = Math.max(1, Math.round(score * 10));
  return `${"|".repeat(filled)}${"_".repeat(Math.max(0, 10 - filled))}`;
}

function buildPatternAnalysisPrompt(
  clusters: PatternCluster[],
  hotspots: LocationHotspot[],
  timePatterns: TimePattern[],
  incidents: Incident[],
): string {
  return `You are an expert aviation ground handling safety analyst. Analyse these incident patterns from DEL station and provide deep insights.

=== RECURRING PATTERN CLUSTERS ===
${clusters
  .map(
    (cluster) => `
CLUSTER: ${cluster.label}
Size: ${cluster.clusterSize} incidents | Risk: ${cluster.riskLevel} | Trend: ${cluster.trend}
Type: ${cluster.incidentType} | Body Part: ${cluster.bodyPart} | Activity: ${cluster.activity} | Dept: ${cluster.department}
Months: ${cluster.affectedMonths.join(", ")}
Keywords: ${cluster.commonKeywords.join(", ")}
Sample incidents: ${cluster.incidents
  .slice(0, 3)
  .map((incident) => `${incident.ghrNumber} (${incident.category}): ${incident.brief.slice(0, 80)}`)
  .join(" | ")}
`,
  )
  .join("\n")}

=== LOCATION HOTSPOTS ===
${hotspots
  .map((hotspot) => `${hotspot.location}: ${hotspot.count} incidents, mainly ${hotspot.dominantType} (${hotspot.dominantCategory})`)
  .join("\n")}

=== TIME PATTERNS ===
${timePatterns
  .map(
    (pattern) =>
      `${pattern.month}: ${pattern.count} incidents${pattern.isSpike ? ` SPIKE (+${pattern.percentAboveAverage}% above avg)` : ""}`,
  )
  .join("\n")}

=== INCIDENT SAMPLES ===
${incidents
  .slice(0, 20)
  .map(
    (incident) =>
      `${incident.ghrNumber} | ${incident.dateLabel} | ${normalizeIncidentType(incident.incidentType)} | ${incident.category} | ${incident.status} | ${incident.brief.slice(0, 90)}`,
  )
  .join("\n")}

=== YOUR ANALYSIS TASK ===
Provide a structured safety intelligence report with these exact sections:

1. EXECUTIVE SUMMARY

2. TOP 3 RECURRING RISK PATTERNS

3. INJURY PATTERN DEEP DIVE

4. LOCATION RISK ASSESSMENT

5. SEASONAL / TIME RISK

6. ROOT CAUSE HYPOTHESIS

7. SPECIFIC RECOMMENDATIONS

8. EARLY WARNING INDICATORS

Use the actual GHR numbers, months, and data from above. Be specific and analytical. This is a professional safety report.

Respond ONLY with valid JSON (no markdown fences) using this exact schema:
{
  "executiveSummary": { "text": "string", "riskLevel": "HIGH|MEDIUM-HIGH|MEDIUM|LOW" },
  "top3RecurringRiskPatterns": [{ "name": "string", "severity": "HIGH|MEDIUM|LOW", "detail": "string" }],
  "patternAnalysis": [{ "name": "string", "severity": "HIGH|MEDIUM|LOW", "detail": "string" }],
  "injuryAnalysis": { "mostCommonInjuries": [{ "label": "string", "count": 0, "severity": "HIGH|MEDIUM|LOW" }] },
  "locationRiskMatrix": [{ "location": "string", "count": 0, "reason": "string", "severity": "HIGH|MEDIUM|LOW" }],
  "seasonalTimeRisk": { "peakMonths": ["string"], "reason": "string", "summary": "string" },
  "rootCauseHypothesis": { "text": "string" },
  "specificRecommendations": [{ "text": "string" }],
  "earlyWarningIndicators": [{ "text": "string" }],
  "kpis": { "totalIncidents": 0, "recurringPatterns": 0, "staffInjuries": 0, "hotspotLocations": 0 }
}`;
}

function buildSimilarityTarget(query: string, data: DashboardData): Incident {
  const lower = query.toLowerCase();
  const matchedType =
    data.incidentTypes.find((item) => lower.includes(item.label.toLowerCase()))?.label ?? "";
  const matchedCategory =
    (["CAT-A", "CAT-B", "CAT-C", "CAT-D"] as const).find((category) =>
      lower.includes(category.toLowerCase()),
    ) ?? "CAT-D";
  const matchedDepartment = ["RAMP", "GSD", "CARGO"].find((department) =>
    lower.includes(department.toLowerCase()),
  );
  return {
    id: "synthetic-pattern-query",
    serialNo: 0,
    title: query,
    ghrNumber: "QUERY",
    date: null,
    dateLabel: "Search query",
    category: matchedCategory,
    incidentType: matchedType,
    department: matchedDepartment ?? "",
    status: "Open",
    station: "DEL",
    brief: query,
    rootCause: "",
    correctiveAction: "",
    immediateAction: "",
    location: "",
    time: "",
    personInvolved: "",
    equipment: "",
    contributingFactor: "",
    monthKey: "",
  };
}

function buildPatternQuestion(cluster: PatternCluster): string {
  return `Analyse the pattern of ${cluster.label}. There are ${cluster.clusterSize} incidents in this cluster occurring in months ${cluster.affectedMonths.join(", ")}. The incidents involve ${cluster.bodyPart} injuries during ${cluster.activity} in ${cluster.department}. What is the likely root cause and what specific preventive measures should be taken?`;
}

function PatternMiniTimeline({
  months,
  incidents,
}: {
  months: readonly string[];
  incidents: Incident[];
}) {
  const monthCategory = new Map<string, Incident["category"]>();
  for (const incident of incidents) {
    const label = incident.monthKey && /^\d{4}-\d{2}$/.test(incident.monthKey)
      ? incident.dateLabel.includes(" ")
        ? incident.dateLabel
        : incident.monthKey
      : "";
    const normalized =
      /^\d{4}-\d{2}$/.test(incident.monthKey)
        ? incident.monthKey
        : undefined;
    const month = normalized ? incident.monthKey : undefined;
    if (!month) continue;
    const display = monthLabelToSequence(month);
    if (!display) continue;
    const existing = monthCategory.get(display);
    if (!existing || severityWeight(incident.category) > severityWeight(existing)) {
      monthCategory.set(display, incident.category);
    }
    void label;
  }

  return (
    <div className="rounded-lg border border-[#e2e8f0] p-3 dark:border-white/10">
      <p className="mb-2 text-xs font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Pattern timeline</p>
      <div className="grid grid-cols-7 gap-2 md:grid-cols-14">
        {months.map((month) => {
          const category = monthCategory.get(month);
          return (
            <div key={month} className="flex flex-col items-center gap-1">
              <span
                className="h-3 w-3 rounded-full border"
                style={{
                  background: category ? CATEGORY_COLORS[category] : "#e2e8f0",
                  borderColor: category ? CATEGORY_COLORS[category] : "#cbd5e1",
                }}
                title={month}
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{month.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function monthLabelToSequence(monthKey: string): string | null {
  const mapping: Record<string, string> = {
    "2025-01": "Jan 2025",
    "2025-02": "Feb 2025",
    "2025-03": "Mar 2025",
    "2025-04": "Apr 2025",
    "2025-05": "May 2025",
    "2025-06": "Jun 2025",
    "2025-07": "Jul 2025",
    "2025-08": "Aug 2025",
    "2025-09": "Sep 2025",
    "2025-10": "Oct 2025",
    "2025-11": "Nov 2025",
    "2025-12": "Dec 2025",
    "2026-01": "Jan 2026",
    "2026-02": "Feb 2026",
  };
  return mapping[monthKey] ?? null;
}

function severityWeight(category: Incident["category"]): number {
  return category === "CAT-A" ? 4 : category === "CAT-B" ? 3 : category === "CAT-C" ? 2 : 1;
}

function AreaPatternChart({
  timePatterns,
}: {
  timePatterns: TimePattern[];
}) {
  if (timePatterns.length === 0) {
    return <EmptyState message="No monthly time pattern data available." />;
  }

  const width = 900;
  const height = 260;
  const padding = 36;
  const max = Math.max(...timePatterns.map((item) => item.count), 1);
  const step = timePatterns.length > 1 ? (width - padding * 2) / (timePatterns.length - 1) : 0;
  const points = timePatterns.map((item, index) => {
    const x = padding + index * step;
    const y = height - padding - (item.count / max) * (height - padding * 2);
    return { ...item, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;

  return (
    <div className={`${CARD_CLASS} overflow-x-auto`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[720px]">
        <defs>
          <linearGradient id="patternAreaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(26,42,94,0.35)" />
            <stop offset="100%" stopColor="rgba(26,42,94,0.04)" />
          </linearGradient>
        </defs>
        <polyline fill="url(#patternAreaFill)" stroke="none" points={area} />
        <polyline
          fill="none"
          stroke="#1a2a5e"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={line}
        />
        {points.map((point) => (
          <g key={point.month}>
            {point.isSpike ? (
              <>
                <line
                  x1={point.x}
                  x2={point.x}
                  y1={padding}
                  y2={height - padding}
                  stroke="#ef4444"
                  strokeDasharray="6 4"
                />
                <text x={point.x + 6} y={padding + 12} fontSize="11" fill="#dc2626" fontWeight="700">
                  {`SPIKE: ${point.count}`}
                </text>
              </>
            ) : null}
            <circle cx={point.x} cy={point.y} r="5" fill={point.isSpike ? "#ef4444" : "#d4af37"} />
            <text x={point.x} y={height - 10} textAnchor="middle" fontSize="10" fill="#64748b">
              {point.month.slice(0, 3)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function BodyMap({
  regionCounts,
  selectedRegion,
  onSelect,
  shellClassName = CARD_CLASS,
}: {
  regionCounts: Record<string, number>;
  selectedRegion: string;
  onSelect: (region: string) => void;
  shellClassName?: string;
}) {
  const regionFill = (region: string) => colorForBodyCount(regionCounts[region] ?? 0);
  const activeStroke = (region: string) => (selectedRegion === region ? "#1a2a5e" : "#94a3b8");

  return (
    <div className={shellClassName}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Body impact map</p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect("all");
          }}
          className="text-xs font-semibold text-slate-500 hover:text-[#d4af37]"
        >
          Reset
        </button>
      </div>
      <svg viewBox="0 0 180 320" className="mx-auto h-[320px] w-full max-w-[220px]">
        <circle cx="90" cy="32" r="18" fill={regionFill("head")} stroke={activeStroke("head")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("head"); }} style={{ cursor: "pointer" }} />
        <rect x="58" y="58" width="64" height="24" rx="12" fill={regionFill("shoulders")} stroke={activeStroke("shoulders")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("shoulders"); }} style={{ cursor: "pointer" }} />
        <rect x="64" y="84" width="52" height="46" rx="16" fill={regionFill("chest")} stroke={activeStroke("chest")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("chest"); }} style={{ cursor: "pointer" }} />
        <rect x="68" y="132" width="44" height="44" rx="16" fill={regionFill("back")} stroke={activeStroke("back")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("back"); }} style={{ cursor: "pointer" }} />
        <rect x="30" y="82" width="22" height="86" rx="11" fill={regionFill("arms")} stroke={activeStroke("arms")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("arms"); }} style={{ cursor: "pointer" }} />
        <rect x="128" y="82" width="22" height="86" rx="11" fill={regionFill("arms")} stroke={activeStroke("arms")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("arms"); }} style={{ cursor: "pointer" }} />
        <rect x="22" y="168" width="30" height="18" rx="9" fill={regionFill("hands")} stroke={activeStroke("hands")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("hands"); }} style={{ cursor: "pointer" }} />
        <rect x="128" y="168" width="30" height="18" rx="9" fill={regionFill("hands")} stroke={activeStroke("hands")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("hands"); }} style={{ cursor: "pointer" }} />
        <rect x="68" y="178" width="18" height="84" rx="9" fill={regionFill("legs")} stroke={activeStroke("legs")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("legs"); }} style={{ cursor: "pointer" }} />
        <rect x="94" y="178" width="18" height="84" rx="9" fill={regionFill("legs")} stroke={activeStroke("legs")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("legs"); }} style={{ cursor: "pointer" }} />
        <rect x="62" y="264" width="30" height="20" rx="8" fill={regionFill("feet")} stroke={activeStroke("feet")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("feet"); }} style={{ cursor: "pointer" }} />
        <rect x="92" y="264" width="30" height="20" rx="8" fill={regionFill("feet")} stroke={activeStroke("feet")} strokeWidth="2" onClick={(event) => { event.stopPropagation(); onSelect("feet"); }} style={{ cursor: "pointer" }} />
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {BODY_REGIONS.map((region) => (
          <button
            key={region.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(region.id);
            }}
            className="flex items-center justify-between rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-left hover:border-[#d4af37] dark:border-white/10"
          >
            <span className="text-slate-600 dark:text-slate-300">{region.label}</span>
            <span className="font-semibold text-[#1a2a5e] dark:text-[#d4af37]">{regionCounts[region.id] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function readInitialAnalysis(): SafetyAnalysisResult | null {
  if (typeof window === "undefined") return null;
  return loadAnalysisFromStorage();
}

function PatternAnalysisContent({ data }: { data: DashboardData }) {
  const router = useRouter();
  const incidents = useMemo(() => data.incidents ?? [], [data.incidents]);
  const selectedIncident = useDashboardStore((state) => state.selectedIncident);
  const setSelectedIncident = useDashboardStore((state) => state.setSelectedIncident);
  const [activeTab, setActiveTab] = useState<PatternTab>("all");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [selectedBodyRegion, setSelectedBodyRegion] = useState("all");
  const [similarityQuery, setSimilarityQuery] = useState("");
  const [similarityIncidentId, setSimilarityIncidentId] = useState("");
  const [similarityResults, setSimilarityResults] = useState<SimilarityResult[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem("pattern-analysis-dismissed-alerts");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SafetyAnalysisResult | null>(readInitialAnalysis);
  const [aiReportRaw, setAiReportRaw] = useState("");
  const [analysisParseError, setAnalysisParseError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() =>
    typeof window === "undefined" ? null : loadLastUpdatedFromStorage(),
  );
  const [pdfExporting, setPdfExporting] = useState(false);
  const autoAnalysisStarted = useRef(false);
  const [aiFollowUpInput, setAiFollowUpInput] = useState("");
  const [aiFollowUps, setAiFollowUps] = useState<AiFollowUp[]>([]);
  const [aiNeedsKeySetup, setAiNeedsKeySetup] = useState(false);
  const [modalData, setModalData] = useState<InjuryModalData | null>(null);

  const clusters = useMemo(() => findRecurringPatterns(incidents), [incidents]);
  const recurringClusters = useMemo(
    () => clusters.filter((cluster) => cluster.clusterSize >= 2),
    [clusters],
  );
  const injuryClusters = useMemo(
    () =>
      clusters.filter(
        (cluster) =>
          cluster.bodyPart !== "unspecified" || /injur/i.test(cluster.incidentType),
      ),
    [clusters],
  );
  const hotspots = useMemo(() => findLocationHotspots(incidents), [incidents]);
  const timePatterns = useMemo(() => findTimePatterns(incidents), [incidents]);

  const highestRiskCluster = useMemo(
    () =>
      [...clusters].sort(
        (a, b) =>
          getRiskRank(b.riskLevel) - getRiskRank(a.riskLevel) ||
          b.clusterSize - a.clusterSize,
      )[0],
    [clusters],
  );

  const mostRepeatedIncidentType = useMemo(
    () =>
      [...(data.incidentTypes ?? [])].sort((a, b) => b.value - a.value)[0] ?? null,
    [data.incidentTypes],
  );

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const region of BODY_REGIONS) counts[region.id] = 0;
    for (const incident of incidents) {
      const bodyPart = extractBodyPart(
        `${incident.brief} ${incident.title} ${incident.personInvolved}`,
      );
      for (const region of BODY_REGIONS) {
        if (regionIncludesBodyPart(region.parts, bodyPart)) {
          counts[region.id] += 1;
        }
      }
    }
    return counts;
  }, [incidents]);

  const injuryClustersFiltered = useMemo(() => {
    if (selectedBodyRegion === "all") return injuryClusters;
    const parts = BODY_REGIONS.find((region) => region.id === selectedBodyRegion)?.parts ?? [];
    return injuryClusters.filter((cluster) => regionIncludesBodyPart(parts, cluster.bodyPart));
  }, [injuryClusters, selectedBodyRegion]);

  const injuryBodyPartBars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cluster of injuryClusters) {
      counts.set(cluster.bodyPart, (counts.get(cluster.bodyPart) ?? 0) + cluster.clusterSize);
    }
    return [...counts.entries()]
      .filter(([bodyPart]) => bodyPart !== "unspecified")
      .sort((a, b) => b[1] - a[1]);
  }, [injuryClusters]);

  const injuryModalRows = useMemo(() => buildBodyMapModalRows(incidents), [incidents]);

  const navigateToGHR = useCallback(
    (ghrNumber: string | number) => {
      if (!ghrNumber) return;
      setModalData(null);
      router.push(`/incident-log?highlight=${encodeURIComponent(String(ghrNumber))}`);
    },
    [router],
  );

  const activitySeveritySeries = useMemo(() => {
    const allInjuryIncidents = injuryClusters.flatMap((cluster) => cluster.incidents);
    const activities = [...new Set(allInjuryIncidents.map((incident) => extractActivity(incident.brief)))];
    return {
      labels: activities,
      series: (["CAT-A", "CAT-B", "CAT-C", "CAT-D"] as const).map((category) => ({
        label: category,
        color: CATEGORY_COLORS[category],
        data: activities.map(
          (activity) =>
            allInjuryIncidents.filter(
              (incident) =>
                extractActivity(incident.brief) === activity &&
                incident.category === category,
            ).length,
        ),
      })),
    };
  }, [injuryClusters]);

  const timePatternSummary = useMemo(() => {
    const lines: string[] = [];
    for (const pattern of timePatterns.filter((item) => item.isSpike)) {
      lines.push(
        `${pattern.dominantType} incidents spike in ${pattern.month} with ${pattern.count} cases (${formatPercent(pattern.percentAboveAverage)} above monthly average).`,
      );
    }

    const typeByMonth = new Map<string, string[]>();
    for (const incident of incidents) {
      const type = normalizeIncidentType(incident.incidentType);
      const month = monthLabelToSequence(incident.monthKey);
      if (!month) continue;
      const key = type;
      const current = typeByMonth.get(key) ?? [];
      current.push(month);
      typeByMonth.set(key, current);
    }
    for (const [type, months] of typeByMonth.entries()) {
      const uniqueMonths = [...new Set(months)];
      if (uniqueMonths.length >= 2) {
        lines.push(`${type} incidents cluster in ${uniqueMonths.slice(0, 3).join(", ")}.`);
      }
    }
    return [...new Set(lines)].slice(0, 6);
  }, [incidents, timePatterns]);

  const allLocationTypes = useMemo(
    () =>
      [...new Set(hotspots.flatMap((hotspot) => hotspot.incidents.map((incident) => normalizeIncidentType(incident.incidentType))))].slice(0, 6),
    [hotspots],
  );

  const alerts = useMemo(() => {
    const nextAlerts: PatternAlert[] = [];
    for (const cluster of recurringClusters) {
      if (cluster.trend === "INCREASING" && cluster.clusterSize >= 3) {
        nextAlerts.push({
          id: `inc-${cluster.id}`,
          tone: "red",
          message: `ESCALATING PATTERN: ${cluster.label} is increasing — ${cluster.clusterSize} incidents across ${cluster.affectedMonths.length} months`,
        });
      }
      if (cluster.recurrenceRate > 1) {
        nextAlerts.push({
          id: `freq-${cluster.id}`,
          tone: "amber",
          message: `HIGH FREQUENCY: ${cluster.label} occurring ${cluster.recurrenceRate.toFixed(1)} times per month`,
        });
      }
    }
    for (const region of BODY_REGIONS) {
      const count = regionCounts[region.id] ?? 0;
      if (count >= 5) {
        const departments = [
          ...new Set(
            incidents
              .filter((incident) =>
                regionIncludesBodyPart(
                  region.parts,
                  extractBodyPart(`${incident.brief} ${incident.title}`),
                ),
              )
              .map((incident) => incident.department),
          ),
        ];
        nextAlerts.push({
          id: `body-${region.id}`,
          tone: "amber",
          message: `INJURY HOTSPOT: ${region.label.toLowerCase()} injuries recurring — ${count} cases across ${departments.join(", ") || "multiple departments"}`,
        });
      }
    }
    for (const hotspot of hotspots) {
      if (hotspot.count >= 3) {
        nextAlerts.push({
          id: `loc-${hotspot.location}`,
          tone: "amber",
          message: `LOCATION RISK: ${hotspot.location} has ${hotspot.count} incidents — review area safety`,
        });
      }
    }
    return nextAlerts.filter((alert) => !dismissedAlerts.includes(alert.id));
  }, [dismissedAlerts, hotspots, incidents, recurringClusters, regionCounts]);

  const aiSystemPrompt = useMemo(
    () => buildPatternAnalysisPrompt(recurringClusters, hotspots, timePatterns, incidents),
    [hotspots, incidents, recurringClusters, timePatterns],
  );

  const safetyReportData = analysisResult;

  const summaryCards = [
    {
      label: "Recurring Patterns Found",
      value: String(recurringClusters.length),
      helper: "Clusters with 2+ linked incidents",
    },
    {
      label: "Highest Risk Cluster",
      value: highestRiskCluster?.label ?? "No cluster",
      helper: highestRiskCluster?.riskLevel ?? "LOW",
    },
    {
      label: "Most Repeated Incident",
      value: mostRepeatedIncidentType
        ? `${mostRepeatedIncidentType.label} (${mostRepeatedIncidentType.value}×)`
        : "No incidents",
      helper: "Most frequent incident type",
    },
    {
      label: "Hotspot Location",
      value: hotspots[0] ? `${hotspots[0].location} (${hotspots[0].count} incidents)` : "No hotspot",
      helper: "Top extracted location mention",
    },
  ];

  const dismissAlert = useCallback((alertId: string) => {
    setDismissedAlerts((prev) => {
      const next = [...prev, alertId];
      sessionStorage.setItem("pattern-analysis-dismissed-alerts", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleCluster = useCallback((clusterId: string) => {
    setExpandedIds((prev) => ({ ...prev, [clusterId]: !prev[clusterId] }));
  }, []);

  const runSimilaritySearch = useCallback(() => {
    const selectedIncidentRow = incidents.find((incident) => incident.id === similarityIncidentId);
    const target =
      selectedIncidentRow ??
      (similarityQuery.trim()
        ? buildSimilarityTarget(similarityQuery.trim(), data)
        : null);
    if (!target) {
      setSimilarityResults([]);
      return;
    }
    const results = findSimilarIncidents(target, incidents, selectedIncidentRow ? 0.35 : 0.18);
    setSimilarityResults(results);
  }, [data, incidents, similarityIncidentId, similarityQuery]);

  const handleExportPDF = useCallback(async () => {
    if (!safetyReportData) {
      toast.error("Run AI analysis first to generate a report for export.");
      return;
    }

    setPdfExporting(true);
    try {
      await exportSafetyReportPdf();
      toast.success("Branded safety report PDF downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export PDF.");
    } finally {
      setPdfExporting(false);
    }
  }, [safetyReportData]);

  const submitToBot = useCallback((query: string) => {
    window.dispatchEvent(
      new CustomEvent("safety-bot-submit", {
        detail: { query },
      }),
    );
  }, []);

  const runAiReport = useCallback(
    async (question: string, mode: "report" | "followup") => {
      setActiveTab("ai");
      setAiLoading(true);
      try {
        setAiNeedsKeySetup(false);
        if (mode === "report") {
          setAnalysisResult(null);
          setAnalysisParseError(null);
        }

        const messages: GroqMessage[] =
          mode === "report"
            ? [{ role: "user", content: question }]
            : [
                {
                  role: "assistant",
                  content: JSON.stringify(analysisResult ?? safeParseResult(aiReportRaw) ?? {}),
                },
                { role: "user", content: question },
              ];

        const result = await askGroq({
          system: aiSystemPrompt,
          messages,
          jsonMode: mode === "report",
        });

        if (mode === "report") {
          setAiReportRaw(result.text);
          const parsed =
            result.parsed ??
            safeParseResult(result.text);
          if (!parsed) {
            setAnalysisParseError(
              "Could not parse the AI response as structured JSON. Please run analysis again.",
            );
            setAnalysisResult(null);
            return;
          }
          const report = buildSafetyReportData({
            rawReport: result.text,
            parsed,
            incidents,
            recurringClusters,
            injuryClusters,
            hotspots,
            timePatterns,
            highestRiskCluster,
          });
          setAnalysisResult(report);
          saveAnalysisResult(report);
          setLastUpdated(new Date());
          setAnalysisParseError(null);
          setAiFollowUps([]);
        } else {
          setAiFollowUps((prev) => [
            ...prev,
            {
              id: `followup-${Date.now()}`,
              question,
              answer: result.text,
            },
          ]);
        }
      } catch (error) {
        if (error instanceof AskGroqError && error.code === "NO_KEY") {
          setAiNeedsKeySetup(true);
          if (mode === "report") {
            setAnalysisResult(null);
            setAnalysisParseError(null);
          } else {
            setAiFollowUps((prev) => [
              ...prev,
              {
                id: `followup-${Date.now()}`,
                question,
                answer:
                  "AI key missing. Add GROQ_API_KEY=gsk_... to .env.local at the project root, restart the dev server, then retry.",
              },
            ]);
          }
          return;
        }

        const message =
          error instanceof AskGroqError
            ? error.userMessage
            : error instanceof Error
              ? error.message
              : "AI analysis failed.";
        if (mode === "report") {
          setAnalysisParseError(message);
          setAnalysisResult(null);
        } else {
          setAiFollowUps((prev) => [
            ...prev,
            {
              id: `followup-${Date.now()}`,
              question,
              answer: message,
            },
          ]);
        }
      } finally {
        setAiLoading(false);
      }
    },
    [
      aiReportRaw,
      aiSystemPrompt,
      analysisResult,
      highestRiskCluster,
      hotspots,
      incidents,
      injuryClusters,
      recurringClusters,
      timePatterns,
    ],
  );

  useEffect(() => {
    if (autoAnalysisStarted.current || incidents.length === 0 || analysisResult) return;
    const hoursAgo = hoursSinceLastUpdated();
    if (hoursAgo == null || hoursAgo >= 24) return;
    if (loadAnalysisFromStorage()) return;

    autoAnalysisStarted.current = true;
    const timer = window.setTimeout(() => {
      void runAiReport("Generate the structured safety report using the exact 8 sections.", "report");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [analysisResult, incidents.length, runAiReport]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2
            className="font-bold"
            style={{ fontSize: "1.8rem", fontWeight: 700, color: "#1a2a5e" }}
          >
            Incident Pattern Intelligence
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            AI-powered similarity detection across {incidents.length} incidents — identifying recurring risks before they escalate
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runAiReport("Generate the structured safety report using the exact 8 sections.", "report")}
          className="inline-flex items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2 text-sm font-semibold text-[#1a2a5e] shadow-sm transition hover:brightness-105"
        >
          <Brain size={16} />
          Run AI Deep Analysis
        </button>
      </motion.div>

      {lastUpdated ? <p className="text-xs text-slate-500">Pattern report last updated {formatTimeAgo(lastUpdated)}</p> : null}

      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm"
              style={{
                background: alert.tone === "red" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                color: alert.tone === "red" ? "#991b1b" : "#92400e",
              }}
            >
              <p>{alert.message}</p>
              <button type="button" onClick={() => dismissAlert(alert.id)} className="shrink-0">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <motion.div variants={fadeUp} className="grid gap-4 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={CARD_CLASS}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {card.label}
            </p>
            <p className="mt-2 text-lg font-semibold text-[#1a2a5e] dark:text-[#d4af37]">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.helper}</p>
          </div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              activeTab === tab.id
                ? "border-[#1a2a5e] bg-[#1a2a5e] text-[#d4af37]"
                : "border-[#e2e8f0] bg-white text-slate-600 hover:border-[#d4af37] dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} variants={fadeUp} initial="hidden" animate="visible" exit="hidden">
          {activeTab === "all" ? (
            <div className="space-y-4">
              <div className={CARD_CLASS}>
                <div className="mb-3 flex items-center gap-2">
                  <Search size={16} className="text-[#1a2a5e] dark:text-[#d4af37]" />
                  <p className="text-sm font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Find Similar Incidents</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_auto]">
                  <input
                    value={similarityQuery}
                    onChange={(event) => setSimilarityQuery(event.target.value)}
                    placeholder="staff injured hand while loading baggage"
                    className="theme-input rounded-lg px-3 py-2 text-sm"
                  />
                  <select
                    value={similarityIncidentId}
                    onChange={(event) => setSimilarityIncidentId(event.target.value)}
                    className="theme-input rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select an existing incident</option>
                    {incidents.map((incident) => (
                      <option key={incident.id} value={incident.id}>
                        {incident.ghrNumber} — {incident.title.slice(0, 48)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={runSimilaritySearch}
                    className="rounded-lg bg-[#1a2a5e] px-4 py-2 text-sm font-semibold text-[#d4af37]"
                  >
                    Analyse
                  </button>
                </div>
                {similarityResults.length > 0 ? (
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="mt-4 space-y-3">
                    {similarityResults.map((result, index) => (
                      <motion.div key={result.incident.id} variants={fadeUp} custom={index} className="rounded-lg border border-[#e2e8f0] p-3 dark:border-white/10">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-[#1a2a5e] dark:text-[#d4af37]">
                              {result.incident.ghrNumber} · {normalizeIncidentType(result.incident.incidentType)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{result.incident.dateLabel}</p>
                          </div>
                          <div className="text-right text-sm font-semibold text-[#1a2a5e] dark:text-[#d4af37]">
                            <span className="font-mono">{similarityBar(result.score)}</span>{" "}
                            {Math.round(result.score * 100)}% match
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <CategoryBadge category={result.incident.category} />
                          {result.matchReasons.map((reason) => (
                            <span key={`${result.incident.id}-${reason}`} className="rounded-full bg-[#d4af37]/15 px-2 py-0.5 text-[11px] text-[#92680a]">
                              {reason}
                            </span>
                          ))}
                          {result.sharedKeywords.map((keyword) => (
                            <span key={`${result.incident.id}-${keyword}`} className="rounded-full border border-[#d4af37]/40 px-2 py-0.5 text-[11px] text-[#d4af37]">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : null}
              </div>

              <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
                {recurringClusters.map((cluster, index) => {
                  const isOpen = Boolean(expandedIds[cluster.id]);
                  const trend = getTrendGlyph(cluster.trend);
                  return (
                    <motion.div key={cluster.id} variants={fadeUp} custom={index} className={CARD_CLASS}>
                      <button
                        type="button"
                        onClick={() => toggleCluster(cluster.id)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#1a2a5e] dark:text-[#d4af37]">{cluster.label}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <PatternRiskBadge level={cluster.riskLevel} />
                          <span className="rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-0.5 text-xs font-semibold text-[#92680a]">
                            {cluster.clusterSize} incidents
                          </span>
                          <span className="text-lg" style={{ color: trend.color }}>
                            {trend.icon}
                          </span>
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </button>

                      {isOpen ? (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                              <p><span className="font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Incident type:</span> {cluster.incidentType}</p>
                              <p><span className="font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Body part:</span> {cluster.bodyPart}</p>
                              <p><span className="font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Activity:</span> {cluster.activity}</p>
                              <p><span className="font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Department:</span> {cluster.department}</p>
                              <p><span className="font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Affected months:</span> {cluster.affectedMonths.join(", ") || "None"}</p>
                            </div>
                            <PatternMiniTimeline months={MONTH_SEQUENCE} incidents={cluster.incidents} />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {cluster.commonKeywords.map((keyword) => (
                              <span key={`${cluster.id}-${keyword}`} className="rounded-full bg-[#d4af37]/15 px-2.5 py-1 text-xs font-semibold text-[#92680a]">
                                {keyword}
                              </span>
                            ))}
                          </div>

                          <div className="rounded-xl border border-amber-300/50 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                            <p className="mb-1 font-semibold">Recommendation</p>
                            <p>{cluster.recommendation}</p>
                          </div>

                          <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10">
                            <div className="max-h-56 overflow-y-auto">
                              {cluster.incidents.map((incident) => (
                                <button
                                  key={incident.id}
                                  type="button"
                                  onClick={() => setSelectedIncident(incident)}
                                  className="grid w-full grid-cols-[96px_92px_100px_90px_1fr] items-center gap-2 border-b border-[#e2e8f0] px-3 py-2 text-left text-xs hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                                >
                                  <span className="font-medium text-[#1a2a5e] dark:text-[#d4af37]">{incident.ghrNumber}</span>
                                  <span className="text-slate-500 dark:text-slate-400">{incident.dateLabel}</span>
                                  <CategoryBadge category={incident.category} />
                                  <StatusDot status={incident.status} />
                                  <span className="truncate text-slate-600 dark:text-slate-300">{incident.brief.slice(0, 60)}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => submitToBot(buildPatternQuestion(cluster))}
                            className="text-sm font-semibold text-[#1a2a5e] hover:text-[#d4af37] dark:text-[#d4af37]"
                          >
                            Ask AI about this pattern →
                          </button>
                        </div>
                      ) : null}
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          ) : null}

          {activeTab === "injury" ? (
            <div style={{ width: "100%" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "16px",
                  marginBottom: "24px",
                  alignItems: "start",
                }}
              >
                <div style={INJURY_GRAPH_CARD_STYLE}>
                  <InjuryExploreCard
                    onExplore={() =>
                      setModalData({
                        type: "bodymap",
                        title: "Body Impact Map — Source Data",
                        data: injuryModalRows,
                      })
                    }
                  >
                    <BodyMap
                      regionCounts={regionCounts}
                      selectedRegion={selectedBodyRegion}
                      onSelect={setSelectedBodyRegion}
                      shellClassName=""
                    />
                  </InjuryExploreCard>
                </div>

                <div style={INJURY_GRAPH_CARD_STYLE}>
                  <InjuryExploreCard
                    onExplore={() =>
                      setModalData({
                        type: "barchart",
                        title: "Injuries by Body Part — Source Incidents",
                        data: buildBodyPartBarModalRows(incidents),
                      })
                    }
                  >
                    <p className="mb-3 text-sm font-semibold text-[#1a2a5e] dark:text-[#d4af37]">
                      Injuries by body part
                    </p>
                    <div style={{ height: 280 }}>
                      <CountChart
                        labels={injuryBodyPartBars.map(([label]) => label)}
                        values={injuryBodyPartBars.map(([, count]) => count)}
                        type="horizontal"
                        colors={injuryBodyPartBars.map(([, count]) => colorForBodyCount(count))}
                      />
                    </div>
                  </InjuryExploreCard>
                </div>

                <div style={INJURY_GRAPH_CARD_STYLE}>
                  <InjuryExploreCard
                    onExplore={() =>
                      setModalData({
                        type: "activitychart",
                        title: "Injury Activity Context — Source Data",
                        data: buildActivityChartModalRows(incidents),
                      })
                    }
                  >
                    <p className="mb-3 text-sm font-semibold text-[#1a2a5e] dark:text-[#d4af37]">
                      Injury activity context
                    </p>
                    <div style={{ height: 320 }}>
                      <GroupedBarChart
                        labels={activitySeveritySeries.labels}
                        series={activitySeveritySeries.series}
                      />
                    </div>
                  </InjuryExploreCard>
                </div>
              </div>

              <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4" style={{ width: "100%" }}>
                {injuryClustersFiltered.map((cluster, index) => {
                  const isOpen = Boolean(expandedIds[cluster.id]);
                  return (
                    <motion.div key={cluster.id} variants={fadeUp} custom={index} className={CARD_CLASS}>
                      <button type="button" onClick={() => toggleCluster(cluster.id)} className="flex w-full items-center justify-between gap-3 text-left">
                        <div>
                          <p className="font-semibold text-[#1a2a5e] dark:text-[#d4af37]">{cluster.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{cluster.activity} · {cluster.department}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <PatternRiskBadge level={cluster.riskLevel} />
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </button>
                      {isOpen ? (
                        <div className="mt-3 space-y-3">
                          <p className="text-sm text-slate-600 dark:text-slate-300">{cluster.recommendation}</p>
                          <PatternMiniTimeline months={MONTH_SEQUENCE} incidents={cluster.incidents} />
                          <button
                            type="button"
                            onClick={() => submitToBot(buildPatternQuestion(cluster))}
                            className="text-sm font-semibold text-[#1a2a5e] hover:text-[#d4af37] dark:text-[#d4af37]"
                          >
                            Ask AI about this pattern →
                          </button>
                        </div>
                      ) : null}
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          ) : null}

          {activeTab === "location" ? (
            <div className="space-y-4">
              <div className={CARD_CLASS}>
                <p className="mb-3 text-sm font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Location hotspot ranking</p>
                <div style={{ height: 320 }}>
                  <CountChart
                    labels={hotspots.map((hotspot) => hotspot.location)}
                    values={hotspots.map((hotspot) => hotspot.count)}
                    type="horizontal"
                    colors={hotspots.map((_, index) => (index === 0 ? "#ef4444" : "#d4af37"))}
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {hotspots.map((hotspot) => {
                  const categoryCounts = (["CAT-A", "CAT-B", "CAT-C", "CAT-D"] as const).map((category) =>
                    hotspot.incidents.filter((incident) => incident.category === category).length,
                  );
                  return (
                    <div key={hotspot.location} className={CARD_CLASS}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#1a2a5e] dark:text-[#d4af37]">{hotspot.location}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{hotspot.dominantType}</p>
                        </div>
                        <span className="rounded-full bg-[#d4af37]/15 px-2 py-1 text-xs font-semibold text-[#92680a]">
                          {hotspot.count}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-1">
                        {categoryCounts.map((count, index) => (
                          <span
                            key={`${hotspot.location}-${index}`}
                            className="h-4 flex-1 rounded"
                            style={{
                              background: count > 0
                                ? `${Object.values(CATEGORY_COLORS)[index]}`
                                : "#e2e8f0",
                              opacity: count > 0 ? Math.min(1, 0.3 + count / hotspot.count) : 1,
                            }}
                            title={`${Object.keys(CATEGORY_COLORS)[index]}: ${count}`}
                          />
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {hotspot.incidents.map((incident) => (
                          <span key={`${hotspot.location}-${incident.id}`} className="rounded border border-[#e2e8f0] px-2 py-0.5 text-[11px] text-slate-600 dark:border-white/10 dark:text-slate-300">
                            {incident.ghrNumber}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={CARD_CLASS}>
                <p className="mb-3 text-sm font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Location × incident type heatmap</p>
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-500">Location</th>
                        {allLocationTypes.map((type) => (
                          <th key={type} className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-500">{type}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hotspots.map((hotspot) => {
                        const max = Math.max(
                          ...allLocationTypes.map(
                            (type) =>
                              hotspot.incidents.filter(
                                (incident) => normalizeIncidentType(incident.incidentType) === type,
                              ).length,
                          ),
                          1,
                        );
                        return (
                          <tr key={hotspot.location} className="border-t border-[#e2e8f0] dark:border-white/10">
                            <td className="px-3 py-2 font-medium text-[#1a2a5e] dark:text-[#d4af37]">{hotspot.location}</td>
                            {allLocationTypes.map((type) => {
                              const count = hotspot.incidents.filter(
                                (incident) => normalizeIncidentType(incident.incidentType) === type,
                              ).length;
                              return (
                                <td
                                  key={`${hotspot.location}-${type}`}
                                  className="px-3 py-2 text-right"
                                  style={{ background: count > 0 ? alphaGold(count, max) : "transparent" }}
                                >
                                  {count || "—"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "time" ? (
            <div className="space-y-4">
              <AreaPatternChart timePatterns={timePatterns} />
              <div className={CARD_CLASS}>
                <p className="mb-3 text-sm font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Pattern detection summary</p>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {timePatternSummary.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="text-[#d4af37]">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={CARD_CLASS}>
                <p className="mb-3 text-sm font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Month × incident type heatmap</p>
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-500">Month</th>
                        {data.incidentTypes.map((type) => (
                          <th key={type.label} className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-500">
                            {type.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timePatterns.map((pattern) => {
                        const monthKey = data.monthlyTrend.find((point) => point.label === pattern.month)?.monthKey;
                        return (
                          <tr key={pattern.month} className="border-t border-[#e2e8f0] dark:border-white/10">
                            <td className="px-3 py-2 font-medium text-[#1a2a5e] dark:text-[#d4af37]">{pattern.month}</td>
                            {data.incidentTypes.map((type) => {
                              const count = incidents.filter(
                                (incident) =>
                                  incident.monthKey === monthKey &&
                                  normalizeIncidentType(incident.incidentType) === type.label,
                              ).length;
                              return (
                                <td
                                  key={`${pattern.month}-${type.label}`}
                                  className="px-3 py-2 text-right"
                                  style={{
                                    background:
                                      count > 0
                                        ? alphaGold(count, Math.max(type.value, 1))
                                        : "transparent",
                                  }}
                                >
                                  {count || "—"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "ai" ? (
            <div className="space-y-4">
              <div className={`${CARD_CLASS} flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <p className="text-sm font-semibold text-[#1a2a5e] dark:text-[#d4af37]">AI deep analysis report</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Generate the structured safety intelligence report and ask follow-up questions with the same pattern context.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void runAiReport("Generate the structured safety report using the exact 8 sections.", "report")}
                    className="rounded-lg bg-[#1a2a5e] px-3 py-2 text-sm font-semibold text-[#d4af37]"
                  >
                    {aiLoading ? "Analysing..." : "Run analysis"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportPDF()}
                    disabled={!safetyReportData || pdfExporting}
                    className="rounded-lg border border-[#d4af37]/40 px-3 py-2 text-sm font-semibold text-[#1a2a5e] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#d4af37]"
                    style={{
                      opacity: !safetyReportData || pdfExporting ? 0.6 : 1,
                      cursor: pdfExporting ? "wait" : "pointer",
                    }}
                  >
                    {pdfExporting ? "Exporting PDF..." : "Export AI Report as PDF"}
                  </button>
                </div>
              </div>

              {aiNeedsKeySetup ? (
                <div className={`${CARD_CLASS} border-amber-400/60 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-950/30`}>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Groq API key required
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-950/90 dark:text-amber-100/90">
                    Add{" "}
                    <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/60">
                      GROQ_API_KEY=gsk_...
                    </code>{" "}
                    to <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/60">.env.local</code>{" "}
                    at the project root, then restart the dev server.
                  </p>
                </div>
              ) : null}

              {analysisParseError ? (
                <div className={`${CARD_CLASS} border-red-300/60 bg-red-50/80 dark:border-red-500/40 dark:bg-red-950/30`}>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">Analysis could not be displayed</p>
                  <p className="mt-2 text-sm leading-6 text-red-700/90 dark:text-red-100/90">{analysisParseError}</p>
                </div>
              ) : null}

              {analysisResult ? (
                <div className={CARD_CLASS}>
                  <AiAnalysisReportView data={analysisResult} />
                </div>
              ) : !analysisParseError ? (
                <EmptyState message="Run AI Deep Analysis to generate a structured safety intelligence report." />
              ) : null}

              {aiFollowUps.length > 0 ? (
                <div className="space-y-3">
                  {aiFollowUps.map((item) => (
                    <div key={item.id} className={CARD_CLASS}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-up</p>
                      <p className="mt-1 font-medium text-[#1a2a5e] dark:text-[#d4af37]">{item.question}</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{item.answer}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className={CARD_CLASS}>
                <p className="mb-2 text-sm font-semibold text-[#1a2a5e] dark:text-[#d4af37]">Ask Follow-up</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={aiFollowUpInput}
                    onChange={(event) => setAiFollowUpInput(event.target.value)}
                    placeholder="Which of these clusters is most likely due to manual handling?"
                    className="theme-input flex-1 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!aiFollowUpInput.trim()) return;
                      const question = aiFollowUpInput.trim();
                      setAiFollowUpInput("");
                      void runAiReport(question, "followup");
                    }}
                    className="rounded-lg bg-[#d4af37] px-4 py-2 text-sm font-semibold text-[#1a2a5e]"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <SafetyReportPDF analysisResult={safetyReportData} />

      {modalData ? (
        <InjurySourceModal
          modalData={modalData}
          onClose={() => setModalData(null)}
          onNavigateGhr={navigateToGHR}
        />
      ) : null}

      <IncidentDetailDrawer incident={selectedIncident} onClose={() => setSelectedIncident(null)} />
    </motion.div>
  );
}

export function PatternAnalysisPage() {
  const data = usePageData();
  if (!data) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!data || data.incidents.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1a2a5e] text-[#d4af37]">
              <GitMerge size={20} />
            </div>
            <div>
              <h2
                className="font-bold"
                style={{ fontSize: "1.8rem", fontWeight: 700, color: "#1a2a5e" }}
              >
                Incident Pattern Intelligence
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                No incident data is available yet.
              </p>
            </div>
          </div>
        </div>
        <EmptyState message="No incidents match the current filters." />
      </div>
    );
  }

  return <PatternAnalysisContent data={data} />;
}
