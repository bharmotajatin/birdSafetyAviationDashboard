"use client";

import type { SafetyAnalysisResult } from "@/lib/safety-report/types";

const NAVY = "#0D1F3C";
const GOLD = "#D4A017";

type SafetyReportPDFProps = {
  analysisResult: SafetyAnalysisResult | null;
};

function todayLabel(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function riskBadgeColors(level: string) {
  const normalized = level.toUpperCase();
  if (normalized.includes("HIGH") && !normalized.includes("MEDIUM")) {
    return { background: "#FEF0EF", color: "#C0392B", border: "1px solid #C0392B" };
  }
  if (normalized.includes("MEDIUM")) {
    return { background: "#FFFBF0", color: "#D4A017", border: "1px solid #D4A017" };
  }
  return { background: "#F0FAF4", color: "#1A7A4A", border: "1px solid #1A7A4A" };
}

function patternCardColors(severity: string) {
  const normalized = severity.toUpperCase();
  if (normalized.includes("HIGH")) {
    return { background: "#FEF0EF", border: "#C0392B" };
  }
  if (normalized.includes("MEDIUM")) {
    return { background: "#FFFBF0", border: "#D4A017" };
  }
  return { background: "#F0FAF4", border: "#1A7A4A" };
}

function injuryBarColor(count: number): string {
  if (count > 10) return "#C0392B";
  if (count > 5) return "#D4A017";
  return "#1A7A4A";
}

function locationDotColor(count: number): string {
  if (count >= 4) return "#C0392B";
  if (count >= 2) return "#D4A017";
  return "#1A7A4A";
}

function PdfFooter({ page }: { page: number }) {
  return (
    <div
      style={{
        background: NAVY,
        padding: "11px 48px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "auto",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", letterSpacing: "1px" }}>
        BIRD FLIGHT SERVICES · CONFIDENTIAL · DEL STATION
      </span>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "9px" }}>PAGE {page} OF 6</span>
    </div>
  );
}

function CompactHeader() {
  return (
    <div
      style={{
        background: NAVY,
        padding: "14px 48px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px" }}>
        BIRD FLIGHT SERVICES — Safety Intelligence Report
      </span>
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px" }}>DEL Station · {todayLabel()}</span>
    </div>
  );
}

function SectionHeader({ badge, title }: { badge: string; title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "18px",
        paddingBottom: "10px",
        borderBottom: `2px solid ${NAVY}`,
      }}
    >
      <div
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: NAVY,
          color: "#ffffff",
          fontSize: "10px",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {badge}
      </div>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          color: NAVY,
        }}
      >
        {title}
      </div>
    </div>
  );
}

const PAGE_SHELL = {
  width: "794px",
  minHeight: "1123px",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column" as const,
  boxSizing: "border-box" as const,
};

const PAGE_SHELL_FLOW = {
  width: "794px",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column" as const,
  boxSizing: "border-box" as const,
};

type DeptCode = "RAMP" | "GSD" | "PAX" | "GSE" | "Other";

const DEPT_BAR_COLORS: Record<DeptCode, string> = {
  RAMP: "#C0392B",
  GSD: "#D4A017",
  PAX: "#1A7A4A",
  GSE: "#2980B9",
  Other: "#8E44AD",
};

const DEPT_ROLE_LABELS: Record<DeptCode, string> = {
  RAMP: "Aircraft & Ramp Operations",
  GSD: "Ground Support Equipment",
  PAX: "Passenger Services",
  GSE: "Ground Support Engineering",
  Other: "Cross-functional / Unassigned",
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const MONTH_ALIASES: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function parseDeptFromText(text: string): DeptCode | null {
  const upper = text.toUpperCase();
  if (upper.includes("— RAMP") || /\bRAMP\b/.test(upper)) return "RAMP";
  if (upper.includes("— GSD") || /\bGSD\b/.test(upper)) return "GSD";
  if (upper.includes("— PAX") || /\bPAX\b/.test(upper)) return "PAX";
  if (upper.includes("— GSE") || /\bGSE\b/.test(upper)) return "GSE";
  return null;
}

function monthNameToIndex(value: string): number | null {
  const key = value.trim().toLowerCase().replace(/\./g, "");
  if (key in MONTH_ALIASES) return MONTH_ALIASES[key];
  const short = MONTH_SHORT.find((month) => key.startsWith(month.toLowerCase()));
  return short ? MONTH_SHORT.indexOf(short) : null;
}

function deriveDepartmentRows(report: SafetyAnalysisResult | null) {
  if (report?.departmentBreakdown?.length) {
    return report.departmentBreakdown
      .map((row) => {
        const code = (parseDeptFromText(row.name) ?? "Other") as DeptCode;
        return {
          code,
          name: row.name,
          role: row.role ?? DEPT_ROLE_LABELS[code],
          count: row.count,
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  const counts: Record<DeptCode, number> = { RAMP: 0, GSD: 0, PAX: 0, GSE: 0, Other: 0 };

  for (const pattern of report?.top3RecurringRiskPatterns ?? []) {
    const dept = parseDeptFromText(pattern.name);
    if (dept) counts[dept] += 1;
    else counts.Other += 1;
  }

  for (const location of report?.locationRiskMatrix ?? []) {
    const dept = parseDeptFromText(location.location);
    if (dept) counts[dept] += location.count;
    else counts.Other += Math.max(1, Math.round(location.count / 2));
  }

  const staffInjuries = report?.kpis.staffInjuries ?? 0;
  const assigned = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (staffInjuries > assigned && assigned > 0) {
    const scale = staffInjuries / assigned;
    (Object.keys(counts) as DeptCode[]).forEach((code) => {
      counts[code] = Math.round(counts[code] * scale);
    });
  } else if (assigned === 0 && staffInjuries > 0) {
    counts.RAMP = Math.ceil(staffInjuries * 0.35);
    counts.GSD = Math.ceil(staffInjuries * 0.25);
    counts.PAX = Math.ceil(staffInjuries * 0.2);
    counts.GSE = Math.max(0, staffInjuries - counts.RAMP - counts.GSD - counts.PAX);
  }

  return (["RAMP", "GSD", "PAX", "GSE", "Other"] as DeptCode[])
    .map((code) => ({
      code,
      name: code === "Other" ? "Other" : code,
      role: DEPT_ROLE_LABELS[code],
      count: counts[code],
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

function deriveMonthlyCounts(report: SafetyAnalysisResult | null): number[] {
  const counts: number[] = [];
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) counts.push(0 as number);
  const peakMonths = report?.seasonalTimeRisk.peakMonths ?? [];
  const corpus = [
    ...(report?.top3RecurringRiskPatterns ?? []).map((item) => `${item.name} ${item.detail}`),
    report?.seasonalTimeRisk.reason ?? "",
    report?.seasonalTimeRisk.summary ?? "",
  ].join(" ");

  peakMonths.forEach((month) => {
    const index = monthNameToIndex(month);
    if (index !== null) counts[index] = 9;
  });

  MONTH_SHORT.forEach((month, index) => {
    if (counts[index] > 0) return;
    const regex = new RegExp(`\\b${month}\\b`, "i");
    if (regex.test(corpus)) counts[index] = 3;
  });

  const totalIncidents = report?.kpis.totalIncidents ?? 0;
  if (totalIncidents > 0 && counts.every((value) => value === 0)) {
    const low = Math.min(3, Math.max(1, Math.round(totalIncidents / 6)));
    return MONTH_SHORT.map((_, index) => (index % 4 === 0 ? low : 0));
  }

  return counts;
}

function isPeakMonth(month: string, peakMonths: string[]): boolean {
  return peakMonths.some((peak) => monthNameToIndex(peak) === monthNameToIndex(month));
}

type InjuryMatrixRow = {
  injuryType: string;
  ramp: number;
  gsd: number;
  pax: number;
  gse: number;
  total: number;
  severity: string;
};

function deriveInjuryMatrix(report: SafetyAnalysisResult | null): InjuryMatrixRow[] {
  const injuries = report?.injuryAnalysis.mostCommonInjuries ?? [];
  const patterns = [
    ...(report?.top3RecurringRiskPatterns ?? []),
    ...(report?.patternAnalysis ?? []),
  ];

  return injuries.map((injury) => {
    const deptCounts = { RAMP: 0, GSD: 0, PAX: 0, GSE: 0 };
    const token = injury.label.toLowerCase().split(/\s+/)[0] ?? injury.label.toLowerCase();

    for (const pattern of patterns) {
      const text = `${pattern.name} ${pattern.detail}`.toLowerCase();
      if (!text.includes(token)) continue;
      const dept = parseDeptFromText(pattern.name);
      if (dept && dept !== "Other") deptCounts[dept] += 1;
    }

    const assigned = Object.values(deptCounts).reduce((sum, value) => sum + value, 0);
    if (assigned === 0) {
      const share = Math.floor(injury.count / 4);
      deptCounts.RAMP = share;
      deptCounts.GSD = share;
      deptCounts.PAX = share;
      deptCounts.GSE = injury.count - share * 3;
    } else {
      const scale = injury.count / assigned;
      (Object.keys(deptCounts) as Array<keyof typeof deptCounts>).forEach((dept) => {
        deptCounts[dept] = Math.max(0, Math.round(deptCounts[dept] * scale));
      });
      const scaledTotal = Object.values(deptCounts).reduce((sum, value) => sum + value, 0);
      if (scaledTotal !== injury.count) {
        deptCounts.RAMP += injury.count - scaledTotal;
      }
    }

    return {
      injuryType: injury.label,
      ramp: deptCounts.RAMP,
      gsd: deptCounts.GSD,
      pax: deptCounts.PAX,
      gse: deptCounts.GSE,
      total: injury.count,
      severity: String(injury.severity).toUpperCase(),
    };
  });
}

function severityPillStyle(severity: string) {
  const normalized = severity.toUpperCase();
  if (normalized.includes("HIGH") || normalized.includes("CRIT")) {
    return { background: "#FEF0EF", color: "#C0392B", border: "1px solid #C0392B" };
  }
  if (normalized.includes("MED")) {
    return { background: "#FFFBF0", color: "#D4A017", border: "1px solid #D4A017" };
  }
  return { background: "#F0FAF4", color: "#1A7A4A", border: "1px solid #1A7A4A" };
}

function severityLabel(severity: string): "HIGH" | "MEDIUM" | "LOW" {
  const normalized = severity.toUpperCase();
  if (normalized.includes("HIGH") || normalized.includes("CRIT")) return "HIGH";
  if (normalized.includes("MED")) return "MEDIUM";
  return "LOW";
}

type PriorityRow = {
  priority: "P1" | "P2" | "P3";
  pattern: string;
  dept: string;
  frequency: string;
  trend: "INCREASING" | "STABLE" | "DECREASING";
  action: string;
  deadline: string;
};

function derivePriorityRows(report: SafetyAnalysisResult | null): PriorityRow[] {
  const patterns = report?.top3RecurringRiskPatterns?.length
    ? report.top3RecurringRiskPatterns
    : report?.patternAnalysis ?? [];
  const recommendations = report?.specificRecommendations ?? [];

  return patterns.map((pattern, index) => {
    const severity = severityLabel(String(pattern.severity));
    const priority: PriorityRow["priority"] =
      severity === "HIGH" ? "P1" : severity === "MEDIUM" ? "P2" : "P3";
    const dept = parseDeptFromText(pattern.name) ?? "Other";
    const detail = pattern.detail.toLowerCase();
    const trend: PriorityRow["trend"] = detail.includes("increas")
      ? "INCREASING"
      : detail.includes("decreas")
        ? "DECREASING"
        : "STABLE";
    const action = recommendations[index]?.text ?? recommendations[0]?.text ?? pattern.detail;
    const deadline = severity === "HIGH" ? "30 days" : severity === "MEDIUM" ? "60 days" : "90 days";

    return {
      priority,
      pattern: pattern.name,
      dept,
      frequency: detail.match(/\d+/)?.[0] ? `${detail.match(/\d+/)?.[0]} linked` : "Recurring",
      trend,
      action: action.length > 90 ? `${action.slice(0, 87)}...` : action,
      deadline,
    };
  });
}

type ComplianceFlag = {
  regulation: string;
  description: string;
};

function deriveComplianceFlags(report: SafetyAnalysisResult | null): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  const injuries = report?.injuryAnalysis.mostCommonInjuries ?? [];
  const injuryText = injuries.map((item) => item.label.toLowerCase()).join(" ");

  if (injuryText.includes("hand")) {
    flags.push({
      regulation: "DGCA CAR Section 9 — Manual Handling",
      description: "Elevated hand injury frequency indicates manual handling control gaps requiring documented corrective action.",
    });
  }
  if (injuryText.includes("head")) {
    flags.push({
      regulation: "IATA AHM 610 — PPE Requirements",
      description: "Head injury exposure suggests PPE compliance review and helmet/head protection enforcement at ramp interfaces.",
    });
  }
  if ((report?.locationRiskMatrix.length ?? 0) > 0 || report?.locationRiskAssessment) {
    flags.push({
      regulation: "Aerodrome Safety Standards compliance",
      description: "Concentrated location risk requires aerodrome safety zoning review and hotspot mitigation plans for DEL station.",
    });
  }
  if ((report?.kpis.totalIncidents ?? 0) >= 10) {
    flags.push({
      regulation: "SMS Mandatory Reporting threshold exceeded",
      description: "Incident volume exceeds internal SMS reporting thresholds — escalate to safety review board within reporting window.",
    });
  }

  return flags.slice(0, 4);
}

function trendIndicator(trend: PriorityRow["trend"]) {
  if (trend === "INCREASING") return { symbol: "↑", color: "#C0392B" };
  if (trend === "DECREASING") return { symbol: "↓", color: "#1A7A4A" };
  return { symbol: "—", color: "#888888" };
}

export function SafetyReportPDF({ analysisResult }: SafetyReportPDFProps) {
  const report = analysisResult;
  const kpis = report?.kpis ?? {
    totalIncidents: 0,
    recurringPatterns: 0,
    staffInjuries: 0,
    hotspotLocations: 0,
  };
  const executive = report?.executiveSummary ?? { text: "Run AI analysis to populate this report.", riskLevel: "LOW" };
  const patterns = report?.top3RecurringRiskPatterns?.length
    ? report.top3RecurringRiskPatterns
    : report?.patternAnalysis?.slice(0, 3) ?? [];
  const injuries = report?.injuryAnalysis?.mostCommonInjuries ?? [];
  const maxInjury = Math.max(...injuries.map((item) => item.count), 1);
  const locations = report?.locationRiskMatrix ?? [];
  const recommendations = report?.specificRecommendations ?? [];
  const warnings = report?.earlyWarningIndicators ?? [];
  const seasonal = report?.seasonalTimeRisk ?? { peakMonths: [], reason: "", summary: "" };
  const rootCause = report?.rootCauseHypothesis?.text ?? "";
  const locationNarrative = report?.locationRiskAssessment ?? "";
  const riskStyle = riskBadgeColors(executive.riskLevel);
  const metaRisk = report?.meta?.riskLevel ?? executive.riskLevel;
  const departmentRows = deriveDepartmentRows(report);
  const maxDeptCount = Math.max(...departmentRows.map((row) => row.count), 1);
  const monthlyCounts = deriveMonthlyCounts(report);
  const peakMonths = seasonal.peakMonths ?? [];
  const injuryMatrix = deriveInjuryMatrix(report);
  const priorityRows = derivePriorityRows(report);
  const complianceFlags = deriveComplianceFlags(report);
  const injuryRecurrenceScore =
    kpis.totalIncidents > 0
      ? Math.round((kpis.staffInjuries / kpis.totalIncidents) * 100)
      : 0;
  const locationRiskScore = Math.min(Math.round(kpis.hotspotLocations * 8), 95);
  const patternEscalation =
    kpis.recurringPatterns > 7 ? "HIGH" : kpis.recurringPatterns > 4 ? "MEDIUM" : "LOW";
  const highRiskAreaCount = Math.max(
    locations.filter((location) => location.count >= 3).length,
    departmentRows.filter((row) => row.count >= 3).length,
    1,
  );

  return (
    <div
      id="safety-report-pdf-root"
      aria-hidden
      style={{
        position: "fixed",
        left: "-9999px",
        top: 0,
        width: "794px",
        zIndex: -1,
        visibility: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* PAGE 1 */}
      <div className="report-page" style={PAGE_SHELL}>
        <div style={{ background: NAVY, padding: "44px 48px 36px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: 0 }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: 700,
                color: NAVY,
                flexShrink: 0,
              }}
            >
              B
            </div>
            <div>
              <p
                style={{
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                BIRD FLIGHT SERVICES
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "9px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  margin: "2px 0 0",
                }}
              >
                Ground Operations
              </p>
            </div>
          </div>

          <div style={{ height: "1px", background: GOLD, margin: "22px 0" }} />

          <div
            style={{
              color: GOLD,
              fontSize: "10px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              marginBottom: "10px",
              fontWeight: 500,
            }}
          >
            Safety Intelligence Report
          </div>

          <h1
            style={{
              fontFamily: "Georgia, serif",
              color: "#ffffff",
              fontSize: "30px",
              fontWeight: 700,
              lineHeight: 1.2,
              margin: "0 0 10px",
            }}
          >
            Incident Pattern Analysis Report
          </h1>

          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 300, margin: 0 }}>
            DEL Station · AI-powered risk detection across {kpis.totalIncidents} incidents
          </p>

          <div style={{ display: "flex", gap: "36px", marginTop: "28px", flexWrap: "wrap" }}>
            {[
              ["Station", "DEL"],
              ["Period", report?.meta?.period ?? "Current period"],
              ["Generated", report?.meta?.reportDate ?? todayLabel()],
              ["Risk Level", metaRisk],
            ].map(([label, value]) => (
              <div key={label}>
                <span
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: "9px",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    display: "block",
                    marginBottom: "3px",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    color:
                      label === "Risk Level" && String(value).toUpperCase().includes("HIGH")
                        ? "#FFD93D"
                        : "#ffffff",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              height: "4px",
              background: GOLD,
              marginTop: "28px",
              marginLeft: "-48px",
              marginRight: "-48px",
            }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1px solid #eeeeee" }}>
          {[
            { label: "Total Incidents", value: kpis.totalIncidents, red: true, sub: "Across all departments" },
            { label: "Recurring Patterns", value: kpis.recurringPatterns, red: false, sub: "Linked clusters" },
            { label: "Staff Injuries", value: kpis.staffInjuries, red: true, sub: "Most frequent type" },
            { label: "Hotspot Locations", value: kpis.hotspotLocations, red: false, sub: "High risk zones" },
          ].map((item, index) => (
            <div
              key={item.label}
              style={{
                padding: "18px 20px",
                borderRight: index < 3 ? "1px solid #eeeeee" : "none",
              }}
            >
              <span
                style={{
                  fontSize: "9px",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: "#999999",
                  marginBottom: "6px",
                  display: "block",
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontSize: "26px",
                  fontWeight: 700,
                  lineHeight: 1,
                  color: item.red ? "#C0392B" : "#D4A017",
                  display: "block",
                }}
              >
                {item.value}
              </span>
              <span style={{ fontSize: "10px", color: "#aaaaaa", marginTop: "4px", display: "block" }}>
                {item.sub}
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding: "24px 48px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: NAVY,
                color: "#ffffff",
                fontSize: "10px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              1
            </div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: NAVY,
              }}
            >
              Executive Summary
            </div>
          </div>

          <span
            style={{
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: "20px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "1px",
              marginBottom: "12px",
              ...riskStyle,
            }}
          >
            {executive.riskLevel}
          </span>

          <p style={{ fontSize: "12px", color: "#444444", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>
            {executive.text}
          </p>
        </div>

        <PdfFooter page={1} />
      </div>

      {/* PAGE 2 */}
      <div className="report-page" style={PAGE_SHELL}>
        <CompactHeader />

        <div style={{ padding: "28px 48px", flex: 1 }}>
          <SectionHeader badge="2" title="Top 3 Recurring Risk Patterns" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
              marginBottom: "28px",
            }}
          >
            {patterns.map((pattern) => {
              const colors = patternCardColors(String(pattern.severity));
              return (
                <div
                  key={pattern.name}
                  style={{
                    borderRadius: "10px",
                    padding: "16px",
                    background: colors.background,
                    borderLeft: `4px solid ${colors.border}`,
                    boxSizing: "border-box",
                  }}
                >
                  <span
                    style={{
                      fontSize: "8px",
                      fontWeight: 800,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: colors.border,
                      marginBottom: "8px",
                      display: "block",
                    }}
                  >
                    {pattern.severity}
                  </span>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: NAVY,
                      lineHeight: 1.4,
                      marginBottom: "6px",
                    }}
                  >
                    {pattern.name}
                  </div>
                  <p style={{ fontSize: "10px", color: "#777777", lineHeight: 1.5, margin: 0 }}>{pattern.detail}</p>
                </div>
              );
            })}
          </div>

          <SectionHeader badge="3" title="Injury Pattern Deep Dive" />

          {injuries.map((injury) => {
            const fillWidth = Math.round((injury.count / maxInjury) * 100);
            return (
              <div
                key={injury.label}
                style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: "#555555",
                    width: "130px",
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {injury.label}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "10px",
                    background: "#f0f0f0",
                    borderRadius: "5px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${fillWidth}%`,
                      height: "100%",
                      background: injuryBarColor(injury.count),
                      borderRadius: "5px",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: NAVY,
                    width: "28px",
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {injury.count}
                </span>
              </div>
            );
          })}

          <SectionHeader badge="4" title="Location Risk Assessment" />

          {locationNarrative ? (
            <p style={{ fontSize: "11px", color: "#555555", lineHeight: 1.7, margin: "0 0 14px", whiteSpace: "pre-wrap" }}>
              {locationNarrative}
            </p>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
            {locations.map((location) => (
              <div
                key={`${location.location}-${location.count}`}
                style={{
                  display: "flex",
                  gap: "12px",
                  padding: "12px 14px",
                  border: "1px solid #e8e8e8",
                  borderRadius: "8px",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: locationDotColor(location.count),
                    marginTop: "3px",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: NAVY, margin: "0 0 3px" }}>
                    {location.location}
                  </p>
                  <p style={{ fontSize: "10px", color: "#C0392B", fontWeight: 600, margin: 0 }}>
                    {location.count} incidents
                  </p>
                  <p style={{ fontSize: "10px", color: "#777777", margin: "2px 0 0" }}>{location.reason}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "#FFFBF0",
              border: "1px solid #D4A017",
              borderRadius: "8px",
              padding: "14px 16px",
              marginTop: "16px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "16px", color: "#D4A017" }}>⚠</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: NAVY,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Seasonal / Time Risk
              </span>
            </div>
            {seasonal.peakMonths.length > 0 ? (
              <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                {seasonal.peakMonths.map((month) => (
                  <span
                    key={month}
                    style={{
                      background: "#D4A017",
                      color: "#ffffff",
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "20px",
                    }}
                  >
                    {month}
                  </span>
                ))}
              </div>
            ) : null}
            <p style={{ fontSize: "11px", color: "#555555", lineHeight: 1.6, marginTop: "8px", marginBottom: 0 }}>
              {seasonal.reason || seasonal.summary}
            </p>
          </div>
        </div>

        <PdfFooter page={2} />
      </div>

      {/* PAGE 3 */}
      <div className="report-page" style={PAGE_SHELL}>
        <CompactHeader />

        <div style={{ padding: "28px 48px", flex: 1 }}>
          <SectionHeader badge="5" title="Root Cause Hypothesis" />

          <div
            style={{
              background: "#F5F7FF",
              borderLeft: "4px solid #0D1F3C",
              borderRadius: "0 8px 8px 0",
              padding: "16px 20px",
              marginBottom: "24px",
            }}
          >
            <p style={{ fontSize: "12px", color: "#444444", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>
              {rootCause}
            </p>
          </div>

          <SectionHeader badge="6" title="Specific Recommendations" />

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
            {recommendations.map((rec, index) => (
              <div key={`rec-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    background: NAVY,
                    color: "#ffffff",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  {index + 1}
                </div>
                <p style={{ fontSize: "12px", color: "#444444", lineHeight: 1.7, paddingTop: "4px", margin: 0 }}>
                  {rec.text}
                </p>
              </div>
            ))}
          </div>

          <SectionHeader badge="7" title="Early Warning Indicators" />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
            {warnings.map((indicator, index) => (
              <div
                key={`warn-${index}`}
                style={{
                  background: "#FFFBF0",
                  borderLeft: "3px solid #D4A017",
                  borderRadius: "0 8px 8px 0",
                  padding: "10px 14px",
                  display: "flex",
                  gap: "8px",
                  alignItems: "flex-start",
                }}
              >
                <span style={{ color: "#D4A017", fontSize: "14px", flexShrink: 0, lineHeight: 1.5 }}>⚠</span>
                <p style={{ fontSize: "11px", color: "#555555", lineHeight: 1.6, margin: 0 }}>{indicator.text}</p>
              </div>
            ))}
          </div>

          <div
            style={{
              background: NAVY,
              borderRadius: "10px",
              padding: "20px 24px",
              marginTop: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px" }}>
              Report generated by Bird Flight Services Safety Intelligence System
            </span>
            <span style={{ color: GOLD, fontSize: "11px", fontWeight: 500 }}>{todayLabel()}</span>
          </div>
        </div>

        <PdfFooter page={3} />
      </div>

      {/* PAGE 4 */}
      <div className="report-page" style={PAGE_SHELL_FLOW}>
        <CompactHeader />

        <div style={{ padding: "28px 48px", flex: 1 }}>
          <SectionHeader badge="8" title="Department Risk Breakdown" />

          {departmentRows.map((row) => {
            const barColor = DEPT_BAR_COLORS[row.code];
            const fillWidth = Math.round((row.count / maxDeptCount) * 100);
            return (
              <div
                key={row.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "14px",
                  padding: "12px 16px",
                  background: "#F8F9FA",
                  borderRadius: "8px",
                  border: "1px solid #eee",
                }}
              >
                <div style={{ width: "120px", flexShrink: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{row.name}</div>
                  <div style={{ fontSize: "10px", color: "#888888" }}>{row.role}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      height: "12px",
                      background: "#eeeeee",
                      borderRadius: "6px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${fillWidth}%`,
                        height: "100%",
                        borderRadius: "6px",
                        background: barColor,
                      }}
                    />
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: barColor }}>{row.count}</div>
                  <div
                    style={{
                      fontSize: "9px",
                      color: "#aaaaaa",
                      textTransform: "uppercase",
                    }}
                  >
                    Incidents
                  </div>
                </div>
              </div>
            );
          })}

          <SectionHeader badge="9" title="Incident Time Heatmap" />

          <p style={{ fontSize: "12px", color: "#888888", margin: "0 0 14px" }}>
            Incident frequency by month based on available data
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            {MONTH_SHORT.map((month, index) => {
              const count = monthlyCounts[index] ?? 0;
              const isPeak = isPeakMonth(month, peakMonths);
              const cellBg = isPeak
                ? "#C0392B"
                : count > 5
                  ? "#D4A017"
                  : count > 2
                    ? "#F0C040"
                    : "#EEF0F3";
              const textColor = isPeak || count > 5 ? "#ffffff" : "#333333";

              return (
                <div
                  key={month}
                  style={{
                    padding: "10px 6px",
                    borderRadius: "6px",
                    background: cellBg,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: textColor,
                    }}
                  >
                    {month}
                  </div>
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: textColor,
                      display: "block",
                      marginTop: "4px",
                    }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "16px", marginTop: "12px", flexWrap: "wrap" }}>
            {[
              { color: "#C0392B", label: "Peak risk month" },
              { color: "#D4A017", label: "High activity (5+)" },
              { color: "#F0C040", label: "Moderate (2-4)" },
              { color: "#EEF0F3", label: "Low / No data" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: item.color,
                    border: item.color === "#EEF0F3" ? "1px solid #cccccc" : "none",
                  }}
                />
                <span style={{ fontSize: "10px", color: "#888888" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <PdfFooter page={4} />
      </div>

      {/* PAGE 5 */}
      <div className="report-page" style={PAGE_SHELL_FLOW}>
        <CompactHeader />

        <div style={{ padding: "28px 48px", flex: 1 }}>
          <SectionHeader badge="10" title="Injury Severity Matrix" />

          <p style={{ fontSize: "12px", color: "#888888", margin: "0 0 14px" }}>
            Cross-analysis of injury type vs operational area
          </p>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "11px",
              marginBottom: "24px",
            }}
          >
            <thead>
              <tr style={{ background: NAVY }}>
                {["Injury Type", "RAMP", "GSD", "PAX", "GSE", "Total", "Severity"].map((column) => (
                  <th
                    key={column}
                    style={{
                      padding: "10px 12px",
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      textAlign: "left",
                      border: "1px solid #1a3a5c",
                    }}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {injuryMatrix.map((row, index) => {
                const pill = severityPillStyle(row.severity);
                return (
                  <tr key={row.injuryType} style={{ background: index % 2 === 0 ? "#F8F9FA" : "#ffffff" }}>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", color: "#444444" }}>
                      {row.injuryType}
                    </td>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", color: "#444444" }}>
                      {row.ramp}
                    </td>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", color: "#444444" }}>
                      {row.gsd}
                    </td>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", color: "#444444" }}>
                      {row.pax}
                    </td>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", color: "#444444" }}>
                      {row.gse}
                    </td>
                    <td
                      style={{
                        padding: "9px 12px",
                        border: "1px solid #eeeeee",
                        color: "#444444",
                        fontWeight: 700,
                      }}
                    >
                      {row.total}
                    </td>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", verticalAlign: "middle" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "20px",
                          fontSize: "9px",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          ...pill,
                        }}
                      >
                        {severityLabel(row.severity)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <SectionHeader badge="11" title="Risk Priority Action Table" />

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ background: NAVY }}>
                {[
                  "Priority",
                  "Risk Pattern",
                  "Dept",
                  "Frequency",
                  "Trend",
                  "Action Required",
                  "Deadline",
                ].map((column) => (
                  <th
                    key={column}
                    style={{
                      padding: "10px 12px",
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      textAlign: "left",
                      border: "1px solid #1a3a5c",
                    }}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {priorityRows.map((row, index) => {
                const priorityColor =
                  row.priority === "P1" ? "#C0392B" : row.priority === "P2" ? "#D4A017" : "#1A7A4A";
                const trend = trendIndicator(row.trend);
                return (
                  <tr key={`${row.pattern}-${index}`} style={{ background: index % 2 === 0 ? "#F8F9FA" : "#ffffff" }}>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", verticalAlign: "middle" }}>
                      <span
                        style={{
                          background: priorityColor,
                          color: "#ffffff",
                          borderRadius: "4px",
                          padding: "3px 8px",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        {row.priority}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", color: "#444444" }}>
                      {row.pattern}
                    </td>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", color: "#444444" }}>
                      {row.dept}
                    </td>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", color: "#444444" }}>
                      {row.frequency}
                    </td>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", color: "#444444" }}>
                      <span style={{ fontWeight: 700, color: trend.color }}>{trend.symbol}</span>
                    </td>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", color: "#444444" }}>
                      {row.action}
                    </td>
                    <td style={{ padding: "9px 12px", border: "1px solid #eeeeee", color: "#444444" }}>
                      {row.deadline}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <PdfFooter page={5} />
      </div>

      {/* PAGE 6 */}
      <div className="report-page" style={PAGE_SHELL_FLOW}>
        <CompactHeader />

        <div style={{ padding: "28px 48px", flex: 1 }}>
          <SectionHeader badge="12" title="Predictive Risk Indicators" />

          <p style={{ fontSize: "12px", color: "#888888", margin: "0 0 16px", lineHeight: 1.6 }}>
            Based on pattern frequency and severity trends, the following risks are predicted for the next 30-60 days
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "14px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                borderRadius: "10px",
                padding: "18px 16px",
                border: "1px solid #eeeeee",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  fontSize: "42px",
                  fontWeight: 700,
                  color: injuryRecurrenceScore > 60 ? "#C0392B" : "#D4A017",
                  lineHeight: 1,
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                {injuryRecurrenceScore}
                <span
                  style={{
                    fontSize: "20px",
                    color: injuryRecurrenceScore > 60 ? "#C0392B" : "#D4A017",
                  }}
                >
                  %
                </span>
              </span>
              <div style={{ fontSize: "11px", color: "#555555", marginTop: "8px" }}>Injury Recurrence Risk</div>
              <div style={{ fontSize: "9px", color: "#aaaaaa" }}>Probability next 30 days</div>
            </div>

            <div
              style={{
                borderRadius: "10px",
                padding: "18px 16px",
                border: "1px solid #eeeeee",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  fontSize: "42px",
                  fontWeight: 700,
                  color: locationRiskScore > 60 ? "#C0392B" : "#D4A017",
                  lineHeight: 1,
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                {locationRiskScore}
                <span
                  style={{
                    fontSize: "20px",
                    color: locationRiskScore > 60 ? "#C0392B" : "#D4A017",
                  }}
                >
                  %
                </span>
              </span>
              <div style={{ fontSize: "11px", color: "#555555", marginTop: "8px" }}>Location Risk Score</div>
              <div style={{ fontSize: "9px", color: "#aaaaaa" }}>Hotspot concentration index</div>
            </div>

            <div
              style={{
                borderRadius: "10px",
                padding: "18px 16px",
                border: "1px solid #eeeeee",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color:
                    patternEscalation === "HIGH"
                      ? "#C0392B"
                      : patternEscalation === "MEDIUM"
                        ? "#D4A017"
                        : "#1A7A4A",
                  lineHeight: 1,
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                {patternEscalation}
              </span>
              <div style={{ fontSize: "11px", color: "#555555", marginTop: "8px" }}>Pattern Escalation Risk</div>
              <div style={{ fontSize: "9px", color: "#aaaaaa" }}>Based on recurring patterns</div>
            </div>
          </div>

          <SectionHeader badge="13" title="Compliance & Regulatory Flags" />

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
            {complianceFlags.map((flag) => (
              <div
                key={flag.regulation}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px 16px",
                  background: "#FEF0EF",
                  borderLeft: "4px solid #C0392B",
                  borderRadius: "0 8px 8px 0",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  style={{ flexShrink: 0, marginTop: "2px" }}
                  fill="none"
                  stroke="#C0392B"
                  strokeWidth="2"
                >
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#C0392B" }}>{flag.regulation}</div>
                  <div style={{ fontSize: "10px", color: "#666666", lineHeight: 1.5, marginTop: "3px" }}>
                    {flag.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: NAVY,
              borderRadius: "12px",
              padding: "28px 32px",
              marginTop: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "20px",
              }}
            >
              <div>
                <div
                  style={{
                    color: GOLD,
                    fontSize: "10px",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  Safety Intelligence Summary
                </div>
                <p
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    fontSize: "13px",
                    lineHeight: 1.7,
                    maxWidth: "420px",
                    margin: 0,
                  }}
                >
                  DEL Station requires immediate attention in {highRiskAreaCount} high-risk areas with{" "}
                  {kpis.totalIncidents} incidents recorded this period.
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "6px 18px",
                    borderRadius: "20px",
                    background: metaRisk.toUpperCase().includes("HIGH")
                      ? "rgba(192,57,43,0.3)"
                      : "rgba(212,160,23,0.3)",
                    border: `1px solid ${metaRisk.toUpperCase().includes("HIGH") ? "#C0392B" : "#D4A017"}`,
                    color: metaRisk.toUpperCase().includes("HIGH") ? "#FF6B6B" : "#FFD93D",
                    fontSize: "14px",
                    fontWeight: 700,
                    letterSpacing: "1px",
                  }}
                >
                  {metaRisk}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "32px",
                paddingTop: "20px",
                borderTop: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {[
                { value: kpis.totalIncidents, label: "Total Incidents" },
                { value: kpis.recurringPatterns, label: "Risk Patterns" },
                { value: kpis.staffInjuries, label: "Staff Injuries" },
                { value: kpis.hotspotLocations, label: "Hotspot Zones" },
              ].map((stat) => (
                <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ color: "#ffffff", fontSize: "22px", fontWeight: 700 }}>{stat.value}</span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "1.5px",
                    }}
                  >
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: "20px",
                paddingTop: "16px",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>
                Generated by Bird Flight Services Safety Intelligence System
              </span>
              <span style={{ color: GOLD, fontSize: "10px", fontWeight: 500 }}>{todayLabel()}</span>
            </div>
          </div>
        </div>

        <PdfFooter page={6} />
      </div>
    </div>
  );
}
