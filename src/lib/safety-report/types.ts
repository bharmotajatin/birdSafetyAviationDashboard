export type ReportSeverity = "Critical" | "High" | "Medium" | "LOW" | "HIGH" | "MEDIUM";
export type ReportRiskLevel = "CRITICAL" | "HIGH" | "MEDIUM-HIGH" | "MEDIUM" | "LOW";

export type SafetyReportKpis = {
  totalIncidents: number;
  recurringPatterns: number;
  staffInjuries: number;
  hotspotLocations: number;
};

export type SafetyReportMeta = {
  station: string;
  period: string;
  reportDate: string;
  riskLevel: ReportRiskLevel;
};

export type SafetyReportExecutiveSummary = {
  text: string;
  riskLevel: ReportRiskLevel;
};

export type SafetyPatternCard = {
  name: string;
  severity: ReportSeverity;
  detail: string;
};

export type SafetyInjuryBar = {
  label: string;
  count: number;
  severity: ReportSeverity;
};

export type SafetyLocationRisk = {
  location: string;
  count: number;
  reason: string;
  severity: ReportSeverity;
};

export type SafetyRecommendation = {
  text: string;
};

export type SeasonalTimeRisk = {
  peakMonths: string[];
  riskLevel?: string;
  reason: string;
  summary: string;
};

export type RootCauseHypothesis = {
  text: string;
};

export type DepartmentBreakdownRow = {
  name: string;
  role?: string;
  count: number;
};

export type SafetyAnalysisResult = {
  executiveSummary: SafetyReportExecutiveSummary;
  departmentBreakdown?: DepartmentBreakdownRow[];
  top3RecurringRiskPatterns: SafetyPatternCard[];
  patternAnalysis: SafetyPatternCard[];
  injuryAnalysis: {
    mostCommonInjuries: SafetyInjuryBar[];
  };
  locationRiskMatrix: SafetyLocationRisk[];
  locationRiskAssessment?: string;
  seasonalTimeRisk: SeasonalTimeRisk;
  rootCauseHypothesis: RootCauseHypothesis;
  specificRecommendations: SafetyRecommendation[];
  earlyWarningIndicators: SafetyRecommendation[];
  kpis: SafetyReportKpis;
  meta: SafetyReportMeta;
};
