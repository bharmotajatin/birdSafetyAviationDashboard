import type { ExpandableChartColumn } from "@/components/ui/ExpandableChart";

type ChartDetail = {
  insight: string;
  caption: string;
  columns: ExpandableChartColumn[];
  rows: Record<string, string | number>[];
};

const STATION_ROWS = [
  { Station: "DEL", Total: 62, "CAT-A": 11, "CAT-B": 4, "CAT-C": 30, "CAT-D": 17, "Risk Score": 133, "Risk Level": "🔴 HIGH" },
  { Station: "CJB", Total: 0, "CAT-A": 0, "CAT-B": 0, "CAT-C": 0, "CAT-D": 0, "Risk Score": 0, "Risk Level": "✅ LOW" },
  { Station: "COK", Total: 0, "CAT-A": 0, "CAT-B": 0, "CAT-C": 0, "CAT-D": 0, "Risk Score": 0, "Risk Level": "✅ LOW" },
  { Station: "GOI", Total: 0, "CAT-A": 0, "CAT-B": 0, "CAT-C": 0, "CAT-D": 0, "Risk Score": 0, "Risk Level": "✅ LOW" },
  { Station: "HYD", Total: 0, "CAT-A": 0, "CAT-B": 0, "CAT-C": 0, "CAT-D": 0, "Risk Score": 0, "Risk Level": "✅ LOW" },
  { Station: "IMF", Total: 0, "CAT-A": 0, "CAT-B": 0, "CAT-C": 0, "CAT-D": 0, "Risk Score": 0, "Risk Level": "✅ LOW" },
  { Station: "IXA", Total: 0, "CAT-A": 0, "CAT-B": 0, "CAT-C": 0, "CAT-D": 0, "Risk Score": 0, "Risk Level": "✅ LOW" },
  { Station: "IXC", Total: 0, "CAT-A": 0, "CAT-B": 0, "CAT-C": 0, "CAT-D": 0, "Risk Score": 0, "Risk Level": "✅ LOW" },
  { Station: "MAA", Total: 0, "CAT-A": 0, "CAT-B": 0, "CAT-C": 0, "CAT-D": 0, "Risk Score": 0, "Risk Level": "✅ LOW" },
  { Station: "TRV", Total: 0, "CAT-A": 0, "CAT-B": 0, "CAT-C": 0, "CAT-D": 0, "Risk Score": 0, "Risk Level": "✅ LOW" },
  { Station: "TRZ", Total: 0, "CAT-A": 0, "CAT-B": 0, "CAT-C": 0, "CAT-D": 0, "Risk Score": 0, "Risk Level": "✅ LOW" },
];

const CATEGORY_ROWS: Record<string, string | number>[] = [
  { Category: "CAT-A", Severity: "Critical", Count: 11, "% Share": "17.7%", Open: 1, "Risk Weight": "×4", "Risk Points": 44 },
  { Category: "CAT-B", Severity: "High", Count: 4, "% Share": "6.5%", Open: 0, "Risk Weight": "×3", "Risk Points": 12 },
  { Category: "CAT-C", Severity: "Medium", Count: 30, "% Share": "48.4%", Open: 0, "Risk Weight": "×2", "Risk Points": 60 },
  { Category: "CAT-D", Severity: "Low", Count: 17, "% Share": "27.4%", Open: 0, "Risk Weight": "×1", "Risk Points": 17 },
  { Category: "TOTAL", Severity: "—", Count: 62, "% Share": "100%", Open: 1, "Risk Weight": "—", "Risk Points": 133 },
];

const CATEGORY_ROWS_GRAPH = CATEGORY_ROWS.map((r) => ({
  Category: r.Category,
  Severity: r.Severity,
  Count: r.Count,
  "% Share": r["% Share"],
  Unresolved: "Open" in r ? r.Open : "",
  "Risk Weight": r["Risk Weight"],
  "Risk Points": r["Risk Points"],
}));

const DEPARTMENT_ROWS: Record<string, string | number>[] = [
  { Dept: "GSD", "Full Name": "Ground Support Dept", Count: 29, "% Share": "47%", "CAT-A": 7, Closed: 27, "Closure Rate": "93%" },
  { Dept: "RAMP", "Full Name": "Ramp Operations", Count: 26, "% Share": "42%", "CAT-A": 4, Closed: 24, "Closure Rate": "92%" },
  { Dept: "CARGO", "Full Name": "Cargo Handling", Count: 4, "% Share": "6%", "CAT-A": 0, Closed: 4, "Closure Rate": "100%" },
  { Dept: "PAX", "Full Name": "Passenger Services", Count: 2, "% Share": "3%", "CAT-A": 0, Closed: 2, "Closure Rate": "100%" },
  { Dept: "Other", "Full Name": "Other / Unknown", Count: 1, "% Share": "2%", "CAT-A": 0, Closed: 0, "Closure Rate": "0%" },
];

const TYPES_RANKED_ROWS: Record<string, string | number>[] = [
  { Rank: 1, Type: "Staff Injury", Count: 32, "% Total": "51.6%", "Cumulative %": "51.6%", "Typical Cat": "CAT-C", "Main Dept": "RAMP" },
  { Rank: 2, Type: "Near Miss", Count: 10, "% Total": "16.1%", "Cumulative %": "67.7%", "Typical Cat": "CAT-A", "Main Dept": "GSD" },
  { Rank: 3, Type: "GSE Incident", Count: 8, "% Total": "12.9%", "Cumulative %": "80.6%", "Typical Cat": "CAT-C", "Main Dept": "GSD" },
  { Rank: 4, Type: "Loading Error", Count: 5, "% Total": "8.1%", "Cumulative %": "88.7%", "Typical Cat": "CAT-D", "Main Dept": "RAMP" },
  { Rank: 5, Type: "Slip/Trip", Count: 4, "% Total": "6.5%", "Cumulative %": "95.2%", "Typical Cat": "CAT-C", "Main Dept": "RAMP" },
  { Rank: 6, Type: "A/C Damage", Count: 1, "% Total": "1.6%", "Cumulative %": "96.8%", "Typical Cat": "CAT-B", "Main Dept": "RAMP" },
  { Rank: 7, Type: "Other", Count: 2, "% Total": "3.2%", "Cumulative %": "100%", "Typical Cat": "CAT-D", "Main Dept": "Various" },
];

const MONTHLY_ROWS = [
  { Month: "Jan 2025", Total: 2, "CAT-A": 0, "CAT-B": 0, "CAT-C": 1, Closed: 1, "Closure %": "50%", "vs Prior": "—", Trend: "—", "3M Avg": "—" },
  { Month: "Feb 2025", Total: 5, "CAT-A": 0, "CAT-B": 0, "CAT-C": 3, Closed: 5, "Closure %": "100%", "vs Prior": "+3", Trend: "↗ UP", "3M Avg": "—" },
  { Month: "Mar 2025", Total: 4, "CAT-A": 0, "CAT-B": 0, "CAT-C": 2, Closed: 4, "Closure %": "100%", "vs Prior": "-1", Trend: "↘ DOWN", "3M Avg": "3.7" },
  { Month: "Apr 2025", Total: 3, "CAT-A": 0, "CAT-B": 0, "CAT-C": 2, Closed: 3, "Closure %": "100%", "vs Prior": "-1", Trend: "↘ DOWN", "3M Avg": "4.0" },
  { Month: "May 2025", Total: 8, "CAT-A": 4, "CAT-B": 0, "CAT-C": 3, Closed: 8, "Closure %": "100%", "vs Prior": "+5", Trend: "↗ UP", "3M Avg": "5.0" },
  { Month: "Jun 2025", Total: 4, "CAT-A": 1, "CAT-B": 1, "CAT-C": 1, Closed: 3, "Closure %": "75%", "vs Prior": "-4", Trend: "↘ DOWN", "3M Avg": "5.0" },
  { Month: "Jul 2025", Total: 3, "CAT-A": 1, "CAT-B": 0, "CAT-C": 1, Closed: 3, "Closure %": "100%", "vs Prior": "-1", Trend: "↘ DOWN", "3M Avg": "5.0" },
  { Month: "Aug 2025", Total: 6, "CAT-A": 1, "CAT-B": 0, "CAT-C": 4, Closed: 6, "Closure %": "100%", "vs Prior": "+3", Trend: "↗ UP", "3M Avg": "4.3" },
  { Month: "Sep 2025", Total: 3, "CAT-A": 0, "CAT-B": 0, "CAT-C": 2, Closed: 3, "Closure %": "100%", "vs Prior": "-3", Trend: "↘ DOWN", "3M Avg": "4.0" },
  { Month: "Oct 2025", Total: 5, "CAT-A": 1, "CAT-B": 1, "CAT-C": 1, Closed: 5, "Closure %": "100%", "vs Prior": "+2", Trend: "↗ UP", "3M Avg": "4.7" },
  { Month: "Nov 2025", Total: 6, "CAT-A": 0, "CAT-B": 1, "CAT-C": 5, Closed: 6, "Closure %": "100%", "vs Prior": "+1", Trend: "↗ UP", "3M Avg": "4.7" },
  { Month: "Dec 2025", Total: 10, "CAT-A": 2, "CAT-B": 0, "CAT-C": 4, Closed: 7, "Closure %": "70%", "vs Prior": "+4", Trend: "↗ UP", "3M Avg": "7.0" },
  { Month: "Jan 2026", Total: 0, "CAT-A": 0, "CAT-B": 0, "CAT-C": 0, Closed: 0, "Closure %": "—", "vs Prior": "-10", Trend: "↘ DOWN", "3M Avg": "5.3" },
  { Month: "Feb 2026", Total: 3, "CAT-A": 1, "CAT-B": 1, "CAT-C": 1, Closed: 3, "Closure %": "100%", "vs Prior": "+3", Trend: "↗ UP", "3M Avg": "4.3" },
];

export const CHART_DETAILS = {
  incidentLog: {
    byType: {
      insight:
        "Staff Injury leads at 32 incidents (51%). Combined with Near Miss (10), the top 2 types account for 68% of all incidents — manual handling and hazard awareness are the priority intervention areas.",
      caption:
        "Each row is one incident type. Count = how many logged. Open = still unresolved. CAT-A = critical severity incidents within that type.",
      columns: [
        { key: "Type", label: "Type" },
        { key: "Count", label: "Count", align: "right" },
        { key: "% Total", label: "% Total", align: "right" },
        { key: "Open", label: "Open", align: "right" },
        { key: "Closed", label: "Closed", align: "right" },
        { key: "CAT-A", label: "CAT-A", align: "right" },
      ],
      rows: [
        { Type: "Staff Injury", Count: 32, "% Total": "51%", Open: 0, Closed: 32, "CAT-A": 0 },
        { Type: "Near Miss", Count: 10, "% Total": "16%", Open: 1, Closed: 9, "CAT-A": 10 },
        { Type: "GSE Incident", Count: 8, "% Total": "13%", Open: 0, Closed: 8, "CAT-A": 0 },
        { Type: "Loading Error", Count: 5, "% Total": "8%", Open: 1, Closed: 4, "CAT-A": 0 },
        { Type: "Slip/Trip", Count: 4, "% Total": "6%", Open: 0, Closed: 4, "CAT-A": 0 },
        { Type: "A/C Damage", Count: 1, "% Total": "2%", Open: 0, Closed: 1, "CAT-A": 0 },
        { Type: "Other", Count: 2, "% Total": "3%", Open: 0, Closed: 2, "CAT-A": 1 },
        { Type: "TOTAL", Count: 62, "% Total": "100%", Open: 2, Closed: 60, "CAT-A": 11 },
      ],
    },
    category: {
      insight:
        "CAT-C Medium dominates at 48%. CAT-A Critical at 18% (11 incidents) signals the highest-priority backlog — each CAT-A incident carries 4× weight in the risk score.",
      caption:
        "Severity classification of all 62 incidents. Risk Weight shows how each category multiplies in the station risk score formula.",
      columns: [
        { key: "Category", label: "Category" },
        { key: "Severity", label: "Severity" },
        { key: "Count", label: "Count", align: "right" },
        { key: "% Share", label: "% Share", align: "right" },
        { key: "Open", label: "Open", align: "right" },
        { key: "Risk Weight", label: "Risk Weight", align: "center" },
        { key: "Risk Points", label: "Risk Points", align: "right" },
      ],
      rows: CATEGORY_ROWS,
    },
    status: {
      insight:
        "91.9% closure rate is excellent. 1 open + 2 in-progress cases need active follow-up. 2 pending cases are awaiting management sign-off.",
      caption: "Shows the current resolution stage of all 62 incidents.",
      columns: [
        { key: "Status", label: "Status" },
        { key: "Count", label: "Count", align: "right" },
        { key: "%", label: "%", align: "right" },
        { key: "Meaning", label: "Meaning" },
      ],
      rows: [
        { Status: "Closed", Count: 57, "%": "91.9%", Meaning: "Fully investigated and resolved" },
        { Status: "Open", Count: 1, "%": "1.6%", Meaning: "Reported — no action started" },
        { Status: "In Progress", Count: 2, "%": "3.2%", Meaning: "Under active investigation" },
        { Status: "Pending", Count: 2, "%": "3.2%", Meaning: "Awaiting review or sign-off" },
      ],
    },
  },
  panIndia: {
    stationCompare: {
      insight:
        "DEL accounts for 100% of all logged incidents. All other 10 stations show 0 — this either reflects DEL-only operations or indicates under-reporting at other stations that should be investigated.",
      caption:
        "Each row = one station. CAT columns show incident count per severity. Risk Score = weighted total. Risk Level is banded: ≥8 HIGH, 5–7 MEDIUM, ≤4 LOW.",
      columns: [
        { key: "Station", label: "Station" },
        { key: "Total", label: "Total", align: "right" },
        { key: "CAT-A", label: "CAT-A", align: "right" },
        { key: "CAT-B", label: "CAT-B", align: "right" },
        { key: "CAT-C", label: "CAT-C", align: "right" },
        { key: "CAT-D", label: "CAT-D", align: "right" },
        { key: "Risk Score", label: "Risk Score", align: "right" },
        { key: "Risk Level", label: "Risk Level", align: "center" },
      ],
      rows: STATION_ROWS,
    },
    riskRanking: {
      insight:
        "DEL's risk score of 133 is driven by its 30 CAT-C incidents (60 pts) and 11 CAT-A incidents (44 pts). Eliminating one CAT-A incident reduces the score by 4 points — the highest leverage action.",
      caption:
        "Risk contribution breakdown per station. Each category's column = count × weight multiplier.",
      columns: [
        { key: "Station", label: "Station" },
        { key: "Total", label: "Total", align: "right" },
        { key: "CAT-A ×4", label: "CAT-A ×4", align: "right" },
        { key: "CAT-B ×3", label: "CAT-B ×3", align: "right" },
        { key: "CAT-C ×2", label: "CAT-C ×2", align: "right" },
        { key: "CAT-D ×1", label: "CAT-D ×1", align: "right" },
        { key: "Total Score", label: "Total Score", align: "right" },
        { key: "Level", label: "Level", align: "center" },
      ],
      rows: [
        { Station: "DEL", Total: 62, "CAT-A ×4": 44, "CAT-B ×3": 12, "CAT-C ×2": 60, "CAT-D ×1": 17, "Total Score": 133, Level: "🔴 HIGH" },
        { Station: "All others", Total: 0, "CAT-A ×4": 0, "CAT-B ×3": 0, "CAT-C ×2": 0, "CAT-D ×1": 0, "Total Score": 0, Level: "✅ LOW" },
      ],
    },
  },
  stationAnalysis: {
    department: {
      insight:
        "GSD leads with 29 incidents vs RAMP's 26. Both departments are nearly equal, suggesting systemic ground operations risk rather than one team being at fault.",
      caption:
        "Incident count per operational department. Closure Rate = Closed ÷ Total incidents for that department.",
      columns: [
        { key: "Dept", label: "Dept" },
        { key: "Full Name", label: "Full Name" },
        { key: "Count", label: "Count", align: "right" },
        { key: "% Share", label: "% Share", align: "right" },
        { key: "CAT-A", label: "CAT-A", align: "right" },
        { key: "Closed", label: "Closed", align: "right" },
        { key: "Closure Rate", label: "Closure Rate", align: "right" },
      ],
      rows: DEPARTMENT_ROWS,
    },
    monthly: {
      insight:
        "December 2025 is the clear peak at 10 incidents — 128% above the 14-month average of 4.4. May 2025 (8) is the second peak. January 2026 recorded zero incidents.",
      caption:
        "Month-by-month incident count. vs Prior = change from previous month. Green = fewer incidents (improving). Red = more (worsening).",
      columns: [
        { key: "Month", label: "Month" },
        { key: "Total", label: "Total", align: "right" },
        { key: "CAT-A", label: "CAT-A", align: "right" },
        { key: "CAT-C", label: "CAT-C", align: "right" },
        { key: "Closed", label: "Closed", align: "right" },
        { key: "Closure %", label: "Closure %", align: "right" },
        { key: "vs Prior", label: "vs Prior", align: "right" },
        { key: "Trend", label: "Trend", align: "center" },
      ],
      rows: MONTHLY_ROWS.map(({ Month, Total, "CAT-A": catA, "CAT-C": catC, Closed, "Closure %": closure, "vs Prior": vsPrior, Trend }) => ({
        Month,
        Total,
        "CAT-A": catA,
        "CAT-C": catC,
        Closed,
        "Closure %": closure,
        "vs Prior": vsPrior,
        Trend,
      })),
    },
    typesRanked: {
      insight:
        "Staff Injury (32) + Near Miss (10) = 68% of all incidents. Targeting these two types through training and hazard-spotting programs would have the greatest overall impact.",
      caption:
        "Ranked by frequency. Cumulative % shows how quickly the top types accumulate toward 100% of all incidents (Pareto principle).",
      columns: [
        { key: "Rank", label: "Rank", align: "right" },
        { key: "Type", label: "Type" },
        { key: "Count", label: "Count", align: "right" },
        { key: "% Total", label: "% Total", align: "right" },
        { key: "Cumulative %", label: "Cumulative %", align: "right" },
        { key: "Typical Cat", label: "Typical Cat" },
        { key: "Main Dept", label: "Main Dept" },
      ],
      rows: TYPES_RANKED_ROWS,
    },
  },
  stationWise: {
    riskScore: {
      insight:
        "DEL's risk score of 133 is entirely from its own incidents. The 11 CAT-A incidents contribute 44 points — reducing just one CAT-A per month would cut the annual risk score by 48 points.",
      caption:
        "Risk score per station. Contribution columns show how each category adds to the total score.",
      columns: [
        { key: "Station", label: "Station" },
        { key: "Total Inc", label: "Total Inc", align: "right" },
        { key: "CAT-A ×4", label: "CAT-A ×4", align: "right" },
        { key: "CAT-B ×3", label: "CAT-B ×3", align: "right" },
        { key: "CAT-C ×2", label: "CAT-C ×2", align: "right" },
        { key: "CAT-D ×1", label: "CAT-D ×1", align: "right" },
        { key: "Score", label: "Score", align: "right" },
        { key: "Level", label: "Level", align: "center" },
        { key: "Action Required", label: "Action Required" },
      ],
      rows: [
        { Station: "DEL", "Total Inc": 62, "CAT-A ×4": 44, "CAT-B ×3": 12, "CAT-C ×2": 60, "CAT-D ×1": 17, Score: 133, Level: "🔴 HIGH", "Action Required": "Immediate executive review" },
        { Station: "All others", "Total Inc": 0, "CAT-A ×4": 0, "CAT-B ×3": 0, "CAT-C ×2": 0, "CAT-D ×1": 0, Score: 0, Level: "✅ LOW", "Action Required": "Continue standard monitoring" },
      ],
    },
    openClosed: {
      insight:
        "DEL's 91.9% closure rate is strong. The 1 open case and 2 in-progress cases are the active priority. The 2 pending cases require management sign-off to move to Closed.",
      caption:
        "Resolution status breakdown per station. Unresolved = Open + In Progress + Pending.",
      columns: [
        { key: "Station", label: "Station" },
        { key: "Total", label: "Total", align: "right" },
        { key: "Closed", label: "Closed", align: "right" },
        { key: "Open", label: "Open", align: "right" },
        { key: "In Progress", label: "In Progress", align: "right" },
        { key: "Pending", label: "Pending", align: "right" },
        { key: "Closure Rate", label: "Closure Rate", align: "right" },
        { key: "Unresolved", label: "Unresolved", align: "right" },
      ],
      rows: [
        { Station: "DEL", Total: 62, Closed: 57, Open: 1, "In Progress": 2, Pending: 2, "Closure Rate": "91.9%", Unresolved: 5 },
        { Station: "All others", Total: 0, Closed: 0, Open: 0, "In Progress": 0, Pending: 0, "Closure Rate": "—", Unresolved: 0 },
      ],
    },
  },
  monthly: {
    combo: {
      insight:
        "December 2025 (10 incidents) is 128% above the 14-month average of 4.4. The 3-month rolling average peaked in Q4 2025 and is declining into 2026 — a positive safety trend.",
      caption:
        "Bars = total incidents per month. Line = CAT-A critical only. Dashed line = 3-month rolling average. vs Prior shows month-over-month change.",
      columns: [
        { key: "Month", label: "Month" },
        { key: "Total", label: "Total", align: "right" },
        { key: "CAT-A", label: "CAT-A", align: "right" },
        { key: "CAT-B", label: "CAT-B", align: "right" },
        { key: "Closed", label: "Closed", align: "right" },
        { key: "Closure %", label: "Closure %", align: "right" },
        { key: "vs Prior", label: "vs Prior", align: "right" },
        { key: "3M Avg", label: "3M Avg", align: "right" },
        { key: "Trend", label: "Trend", align: "center" },
      ],
      rows: MONTHLY_ROWS,
    },
    statusCategory: {
      insight:
        "57 of 62 incidents are closed (91.9%). CAT-C Medium is the largest category. The ratio of CAT-A to total (17.7%) is the key safety benchmark to watch each month.",
      caption:
        "Left bars show resolution status counts. Right bars show severity category counts. Both draw from the same 62 incidents.",
      columns: [
        { key: "Label", label: "Label" },
        { key: "Count", label: "Count", align: "right" },
        { key: "%", label: "%", align: "right" },
        { key: "Context", label: "Context" },
      ],
      rows: [
        { Label: "— STATUS —", Count: "", "%": "", Context: "" },
        { Label: "Closed", Count: 57, "%": "91.9%", Context: "Fully resolved" },
        { Label: "Open", Count: 1, "%": "1.6%", Context: "Needs action" },
        { Label: "In Progress", Count: 2, "%": "3.2%", Context: "Being investigated" },
        { Label: "Pending", Count: 2, "%": "3.2%", Context: "Awaiting sign-off" },
        { Label: "— CATEGORY —", Count: "", "%": "", Context: "" },
        { Label: "CAT-A", Count: 11, "%": "17.7%", Context: "Critical severity" },
        { Label: "CAT-B", Count: 4, "%": "6.5%", Context: "High severity" },
        { Label: "CAT-C", Count: 30, "%": "48.4%", Context: "Medium severity" },
        { Label: "CAT-D", Count: 17, "%": "27.4%", Context: "Low severity" },
      ],
    },
  },
  graphs: {
    station: {
      insight:
        "DEL at 62 is the sole active reporting station. All others at 0. Clicking any bar navigates to that station's detail page.",
      caption:
        "Total incidents per Pan India station. DEL is the only station with logged data in this reporting period.",
      columns: [
        { key: "Station", label: "Station" },
        { key: "Total", label: "Total", align: "right" },
        { key: "CAT-A", label: "CAT-A", align: "right" },
        { key: "Risk Score", label: "Risk Score", align: "right" },
        { key: "Risk Level", label: "Risk Level", align: "center" },
      ],
      rows: STATION_ROWS.map((r) => ({
        Station: r.Station,
        Total: r.Total,
        "CAT-A": r["CAT-A"],
        "Risk Score": r["Risk Score"],
        "Risk Level": r["Risk Level"],
      })),
    },
    category: {
      insight:
        "CAT-C (48%) and CAT-D (27%) together make up 75% of incidents — mostly manageable severity. But the 11 CAT-A incidents (18%) demand priority attention.",
      caption:
        "Severity distribution of all 62 incidents. The donut centre shows total count. Risk Points = count × weight.",
      columns: [
        { key: "Category", label: "Category" },
        { key: "Severity", label: "Severity" },
        { key: "Count", label: "Count", align: "right" },
        { key: "% Share", label: "% Share", align: "right" },
        { key: "Unresolved", label: "Unresolved", align: "right" },
        { key: "Risk Weight", label: "Risk Weight", align: "center" },
        { key: "Risk Points", label: "Risk Points", align: "right" },
      ],
      rows: CATEGORY_ROWS_GRAPH,
    },
    status: {
      insight:
        "91.9% closure demonstrates a strong resolution culture. 5 incidents remain active — 1 open, 2 in-progress, 2 pending.",
      caption:
        "Current resolution state of all incidents. Closed = fully signed off. Pending = completed but awaiting formal sign-off.",
      columns: [
        { key: "Status", label: "Status" },
        { key: "Count", label: "Count", align: "right" },
        { key: "%", label: "%", align: "right" },
        { key: "Definition", label: "Definition" },
      ],
      rows: [
        { Status: "Closed", Count: 57, "%": "91.9%", Definition: "Investigated, actioned, signed off" },
        { Status: "In Progress", Count: 2, "%": "3.2%", Definition: "Active investigation underway" },
        { Status: "Pending", Count: 2, "%": "3.2%", Definition: "Complete but awaiting formal closure" },
        { Status: "Open", Count: 1, "%": "1.6%", Definition: "Reported, not yet actioned" },
      ],
    },
    department: {
      insight:
        "GSD (29) and RAMP (26) are almost equal in incident volume. This suggests a systemic operational issue rather than one department being outlier.",
      caption:
        "Incidents split by operational department. Closure Rate shows how effectively each department resolves its own incidents.",
      columns: [
        { key: "Dept", label: "Dept" },
        { key: "Count", label: "Count", align: "right" },
        { key: "% Share", label: "% Share", align: "right" },
        { key: "CAT-A", label: "CAT-A", align: "right" },
        { key: "Closed", label: "Closed", align: "right" },
        { key: "Closure Rate", label: "Closure Rate", align: "right" },
      ],
      rows: DEPARTMENT_ROWS,
    },
    monthlyArea: {
      insight:
        "Dec 2025 peak (10) is 128% above average. The 3-month rolling average is declining from its Q4 peak — an encouraging early trend heading into 2026.",
      caption:
        "Filled area = total monthly incidents. Line = CAT-A critical incidents. Dashed = 3-month rolling average. Reference line at 4.4 monthly average.",
      columns: [
        { key: "Month", label: "Month" },
        { key: "Total", label: "Total", align: "right" },
        { key: "CAT-A", label: "CAT-A", align: "right" },
        { key: "3M Avg", label: "3M Avg", align: "right" },
        { key: "vs Average", label: "vs Average", align: "right" },
      ],
      rows: MONTHLY_ROWS.map((r) => ({
        Month: r.Month,
        Total: r.Total,
        "CAT-A": r["CAT-A"],
        "3M Avg": r["3M Avg"],
        "vs Average":
          typeof r.Total === "number" && r.Total > 0
            ? r.Total > 4.4
              ? `+${(r.Total - 4.4).toFixed(1)}`
              : `${(r.Total - 4.4).toFixed(1)}`
            : "—",
      })),
    },
    typeFrequency: {
      insight:
        "Top 3 types (Staff Injury + Near Miss + GSE) = 79% of all incidents. Pareto principle applies — fix these 3 and reduce total volume by ~80%.",
      caption:
        "Sorted largest to smallest. Cumulative % shows how quickly the top types dominate. Focus resources on types above 80% cumulative.",
      columns: [
        { key: "Rank", label: "Rank", align: "right" },
        { key: "Type", label: "Type" },
        { key: "Count", label: "Count", align: "right" },
        { key: "% Total", label: "% Total", align: "right" },
        { key: "Cumulative %", label: "Cumulative %", align: "right" },
        { key: "Typical Cat", label: "Typical Cat" },
        { key: "Main Dept", label: "Main Dept" },
      ],
      rows: TYPES_RANKED_ROWS,
    },
  },
} satisfies Record<string, Record<string, ChartDetail>>;

export const REFERENCE_KPIS = {
  total: 62,
  open: 1,
  inProgress: 2,
  closed: 57,
  pending: 2,
  catA: 11,
  catB: 4,
  catC: 30,
  catD: 17,
  ramp: 26,
  gsd: 29,
  staffInjuries: 32,
  nearMiss: 10,
  closureRate: 91.9,
  riskScoreDel: 133,
} as const;
