"use client";

import {
  patternCardTheme,
  riskBadgeStyle,
  riskLevelColor,
} from "@/lib/safety-report/parseAnalysisResult";
import type { ReportSeverity, SafetyAnalysisResult } from "@/lib/safety-report/types";

const NAVY = "#0D1F3C";
const GRAY = "#444444";
const MUTED = "#777777";

function injuryFillColor(count: number): string {
  if (count > 10) return "#C0392B";
  if (count > 5) return "#D4A017";
  return "#1A7A4A";
}

function locationDotColor(count: number): string {
  if (count >= 4) return "#C0392B";
  if (count >= 2) return "#D4A017";
  return "#1A7A4A";
}

type AiAnalysisReportViewProps = {
  data: SafetyAnalysisResult;
};

export function AiAnalysisReportView({ data }: AiAnalysisReportViewProps) {
  const patterns = data.top3RecurringRiskPatterns.length
    ? data.top3RecurringRiskPatterns
    : data.patternAnalysis.slice(0, 3);
  const injuries = data.injuryAnalysis.mostCommonInjuries;
  const maxInjury = Math.max(...injuries.map((item) => item.count), 1);
  const riskStyle = riskBadgeStyle(data.executiveSummary.riskLevel);

  const kpiItems = [
    { key: "totalIncidents", label: "Total Incidents", value: data.kpis.totalIncidents, color: "#FF6B6B" },
    { key: "recurringPatterns", label: "Recurring Patterns", value: data.kpis.recurringPatterns, color: "#FFD93D" },
    { key: "staffInjuries", label: "Staff Injuries", value: data.kpis.staffInjuries, color: "#FF6B6B" },
    { key: "hotspotLocations", label: "Hotspot Locations", value: data.kpis.hotspotLocations, color: "#FFD93D" },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* KPI bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          background: NAVY,
          padding: "16px 24px",
          borderRadius: "10px",
        }}
      >
        {kpiItems.map((item) => (
          <div key={item.key} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "9px",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {item.label}
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: item.color, marginTop: "4px" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Executive summary */}
      <div
        style={{
          borderLeft: `4px solid ${NAVY}`,
          background: "#F8FAFC",
          borderRadius: "8px",
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            fontSize: "9px",
            textTransform: "uppercase",
            letterSpacing: "2px",
            color: "#888888",
            marginBottom: "10px",
          }}
        >
          Executive Summary
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
          {data.executiveSummary.riskLevel}
        </span>
        <p style={{ margin: 0, fontSize: "13px", color: GRAY, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {data.executiveSummary.text}
        </p>
      </div>

      {/* Top 3 patterns */}
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: NAVY,
            marginBottom: "12px",
          }}
        >
          Top 3 Recurring Risk Patterns
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          {patterns.length > 0 ? (
            patterns.map((pattern) => {
              const theme = patternCardTheme(pattern.severity);
              return (
                <div
                  key={pattern.name}
                  style={{
                    borderRadius: "10px",
                    padding: "16px",
                    borderLeft: `4px solid ${theme.border}`,
                    background: theme.background,
                  }}
                >
                  <div
                    style={{
                      fontSize: "8px",
                      fontWeight: 800,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: theme.color,
                      marginBottom: "8px",
                    }}
                  >
                    {pattern.severity}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY, lineHeight: 1.4 }}>
                    {pattern.name}
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "11px", color: MUTED, lineHeight: 1.5 }}>
                    {pattern.detail}
                  </div>
                </div>
              );
            })
          ) : (
            <p style={{ fontSize: "12px", color: MUTED }}>No recurring patterns identified.</p>
          )}
        </div>
      </div>

      {/* Injury bars */}
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: NAVY,
            marginBottom: "12px",
          }}
        >
          Injury Analysis
        </div>
        {injuries.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {injuries.map((injury) => (
              <div key={injury.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "120px", textAlign: "right", fontSize: "11px", color: "#555555" }}>
                  {injury.label}
                </div>
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
                      width: `${(injury.count / maxInjury) * 100}%`,
                      height: "100%",
                      background: injuryFillColor(injury.count),
                      borderRadius: "5px",
                    }}
                  />
                </div>
                <div style={{ width: "30px", fontSize: "11px", fontWeight: 600, color: NAVY }}>
                  {injury.count}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "12px", color: MUTED }}>No injury data available.</p>
        )}
      </div>

      {/* Seasonal risk */}
      <div
        style={{
          background: "#FFFBF0",
          border: "1px solid #D4A017",
          borderRadius: "8px",
          padding: "14px",
        }}
      >
        <div
          style={{
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "#D4A017",
            marginBottom: "8px",
          }}
        >
          Seasonal Risk
        </div>
        {data.seasonalTimeRisk.peakMonths.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
            {data.seasonalTimeRisk.peakMonths.map((month) => (
              <span
                key={month}
                style={{
                  background: "#FEF9EE",
                  color: "#D4A017",
                  border: "1px solid #D4A017",
                  borderRadius: "999px",
                  padding: "2px 10px",
                  fontSize: "10px",
                  fontWeight: 600,
                }}
              >
                {month}
              </span>
            ))}
          </div>
        ) : null}
        <p style={{ margin: 0, fontSize: "12px", color: "#555555", lineHeight: 1.6 }}>
          {data.seasonalTimeRisk.reason || data.seasonalTimeRisk.summary}
        </p>
      </div>

      {/* Root cause */}
      <div
        style={{
          background: "#F5F7FF",
          borderLeft: `4px solid ${NAVY}`,
          borderRadius: "8px",
          padding: "16px",
        }}
      >
        <div
          style={{
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: NAVY,
            marginBottom: "8px",
          }}
        >
          Root Cause Hypothesis
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: GRAY, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {data.rootCauseHypothesis.text}
        </p>
      </div>

      {/* Locations */}
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: NAVY,
            marginBottom: "12px",
          }}
        >
          Location Risk Matrix
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
          {data.locationRiskMatrix.length > 0 ? (
            data.locationRiskMatrix.map((location) => (
              <div
                key={`${location.location}-${location.count}`}
                style={{
                  display: "flex",
                  gap: "12px",
                  border: "1px solid #eeeeee",
                  borderRadius: "8px",
                  padding: "12px",
                }}
              >
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: locationDotColor(location.count),
                    marginTop: "3px",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: NAVY }}>{location.location}</div>
                  <div style={{ fontSize: "10px", color: "#C0392B", fontWeight: 600, marginTop: "2px" }}>
                    {location.count} incidents
                  </div>
                  <div style={{ fontSize: "10px", color: MUTED, marginTop: "4px" }}>{location.reason}</div>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: "6px",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "9px",
                      fontWeight: 700,
                      ...riskBadgeStyle(location.severity as ReportSeverity),
                    }}
                  >
                    {location.severity}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: "12px", color: MUTED }}>No location risks identified.</p>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: NAVY,
            marginBottom: "12px",
          }}
        >
          Specific Recommendations
        </div>
        {data.specificRecommendations.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.specificRecommendations.map((item, index) => (
              <div key={`${index}-${item.text.slice(0, 20)}`} style={{ display: "flex", gap: "12px" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    background: NAVY,
                    color: "#ffffff",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: GRAY, lineHeight: 1.6 }}>{item.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "12px", color: MUTED }}>No recommendations generated.</p>
        )}
      </div>

      {/* Early warnings */}
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: NAVY,
            marginBottom: "12px",
          }}
        >
          Early Warning Indicators
        </div>
        {data.earlyWarningIndicators.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
            {data.earlyWarningIndicators.map((warning, index) => (
              <div
                key={`${index}-${warning.text.slice(0, 20)}`}
                style={{
                  background: "#FFFBF0",
                  borderLeft: "3px solid #D4A017",
                  borderRadius: "6px",
                  padding: "10px 14px",
                  fontSize: "11px",
                  color: "#555555",
                  lineHeight: 1.5,
                }}
              >
                ⚠ {warning.text}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "12px", color: MUTED }}>No early warning indicators identified.</p>
        )}
      </div>

      <div style={{ fontSize: "10px", color: "#999999", textAlign: "right" }}>
        Overall risk level:{" "}
        <span style={{ color: riskLevelColor(data.meta.riskLevel), fontWeight: 700 }}>
          {data.meta.riskLevel}
        </span>
      </div>
    </div>
  );
}
