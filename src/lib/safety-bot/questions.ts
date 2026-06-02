import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calculator,
  Calendar,
  Clock,
  FolderOpen,
  MapPin,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { calcRiskScore } from "@/lib/analytics";
import { monthLabelFromKey } from "@/lib/parse/utils";
import type { DashboardData, Incident } from "@/lib/types";
import type { QuickQuestion } from "./types";

function catAByMonth(incidents: Incident[]) {
  const map = new Map<string, number>();
  for (const i of incidents.filter((x) => x.category === "CAT-A")) {
    if (i.monthKey === "unknown") continue;
    map.set(i.monthKey, (map.get(i.monthKey) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ month: monthLabelFromKey(k), count: v }));
}

function deptClosureRates(incidents: Incident[]) {
  const depts = ["RAMP", "GSD", "CARGO", "OTHER"];
  return depts
    .map((dept) => {
      const list = incidents.filter((i) => i.department === dept);
      const closed = list.filter((i) => i.status === "Closed").length;
      const rate = list.length ? Math.round((closed / list.length) * 1000) / 10 : 0;
      return { dept, total: list.length, rate };
    })
    .filter((d) => d.total > 0)
    .sort((a, b) => a.rate - b.rate);
}

function currentMonthIncidents(incidents: Incident[]) {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return incidents.filter((i) => i.monthKey === key);
}

function delRisk(data: DashboardData) {
  const del = data.incidents.filter((i) => i.station === "DEL");
  const catA = del.filter((i) => i.category === "CAT-A").length;
  const catB = del.filter((i) => i.category === "CAT-B").length;
  const catC = del.filter((i) => i.category === "CAT-C").length;
  const catD = del.filter((i) => i.category === "CAT-D").length;
  return calcRiskScore(catA, catB, catC, catD);
}

export const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    id: "cat-a-count",
    icon: AlertTriangle,
    label: "CAT-A count",
    fullQuery:
      "How many CAT-A incidents are there? List each with GHR number, date, type, department, and status.",
    answer: (data) => {
      const catA = data.incidents.filter((i) => i.category === "CAT-A");
      const byMonth = catAByMonth(data.incidents);
      return {
        headline: `${catA.length} CAT-A critical incidents`,
        rows: [
          { label: "Total CAT-A", value: String(catA.length), highlight: true },
          ...byMonth.slice(0, 4).map((m) => ({
            label: m.month,
            value: String(m.count),
          })),
        ],
        summary: `There are ${catA.length} CAT-A incidents across ${byMonth.length || 0} month buckets in the loaded workbook.`,
      };
    },
  },
  {
    id: "peak-month",
    icon: Calendar,
    label: "Peak month",
    fullQuery:
      "Which month had the most incidents? Show the full monthly breakdown from January 2025 to February 2026 with incident counts and categories.",
    answer: (data) => {
      const peak = [...data.monthlyTrend]
        .filter((m) => m.monthKey !== "unknown")
        .sort((a, b) => b.total - a.total)[0];
      return {
        headline: peak ? `${peak.label} had the most incidents` : "No monthly data",
        rows: peak
          ? [
              { label: "Month", value: peak.label, highlight: true },
              { label: "Incidents", value: String(peak.total), highlight: true },
              { label: "CAT-A in month", value: String(peak.catA) },
            ]
          : [{ label: "Status", value: "Upload data first" }],
        summary: peak
          ? `${peak.label} (${peak.monthKey}) recorded ${peak.total} incidents, the highest in the trend.`
          : "Monthly trend data is not available yet.",
      };
    },
  },
  {
    id: "dept-closure",
    icon: Building2,
    label: "Dept closure",
    fullQuery: "Which dept has worst closure rate?",
    answer: (data) => {
      const rates = deptClosureRates(data.incidents);
      const worst = rates[0];
      const best = rates[rates.length - 1];
      return {
        headline: worst ? `${worst.dept} has the lowest closure rate` : "No department data",
        rows: rates.slice(0, 4).map((r) => ({
          label: r.dept,
          value: `${r.rate}% (${r.total} incidents)`,
          highlight: r.dept === worst?.dept,
        })),
        summary: worst
          ? `${worst.dept} closes ${worst.rate}% of ${worst.total} incidents — ${best ? `${best.dept} leads at ${best.rate}%` : ""}.`
          : "No incidents loaded to compare departments.",
      };
    },
  },
  {
    id: "near-miss",
    icon: ShieldAlert,
    label: "Near miss",
    fullQuery:
      "List all near miss incidents with GHR number, date, category, department, and current status. How many are CAT-A? Are any still open?",
    answer: (data) => {
      const list = data.incidents.filter((i) =>
        i.incidentType.toLowerCase().includes("near miss"),
      );
      return {
        headline: `${list.length} near-miss incidents`,
        rows: [
          { label: "Total near miss", value: String(list.length), highlight: true },
          {
            label: "Open",
            value: String(list.filter((i) => i.status === "Open").length),
          },
          {
            label: "CAT-A",
            value: String(list.filter((i) => i.category === "CAT-A").length),
          },
        ],
        summary: `Found ${list.length} incidents classified as Near Miss in the current dataset.`,
      };
    },
  },
  {
    id: "del-risk",
    icon: Calculator,
    label: "DEL risk score",
    fullQuery:
      "Calculate and explain the DEL station risk score. Show each category contribution: CAT-A×4, CAT-B×3, CAT-C×2, CAT-D×1. What level is this?",
    answer: (data) => {
      const score = delRisk(data);
      const delStat = data.stations.find((s) => s.station === "DEL");
      return {
        headline: `DEL risk score is ${score}`,
        rows: [
          { label: "Risk score", value: String(score), highlight: true },
          { label: "Formula", value: "(A×4)+(B×3)+(C×2)+(D×1)" },
          {
            label: "Risk level",
            value: delStat?.riskLevel ?? "—",
            highlight: true,
          },
          { label: "DEL incidents", value: String(delStat?.total ?? 0) },
        ],
        summary: `DEL station risk score is ${score} using live category weights from loaded incidents.`,
      };
    },
  },
  {
    id: "open-incidents",
    icon: FolderOpen,
    label: "Still open",
    fullQuery:
      "List all incidents that are currently In Progress or Open. Include GHR number, date, type, category, and department for each.",
    answer: (data) => {
      const open = data.incidents.filter((i) => i.status === "Open");
      return {
        headline: `${open.length} incidents remain Open`,
        rows: [
          { label: "Open count", value: String(open.length), highlight: true },
          {
            label: "CAT-A open",
            value: String(open.filter((i) => i.category === "CAT-A").length),
          },
          {
            label: "RAMP open",
            value: String(open.filter((i) => i.department === "RAMP").length),
          },
        ],
        summary: `${open.length} incidents are still Open and awaiting closure.`,
      };
    },
  },
  {
    id: "closure-this-month",
    icon: TrendingUp,
    label: "Closure rate",
    fullQuery:
      "What is the overall closure rate? Break it down by month showing which months had the lowest closure rates. Which incidents are still not closed?",
    answer: (data) => {
      const month = currentMonthIncidents(data.incidents);
      const closed = month.filter((i) => i.status === "Closed").length;
      const rate = month.length ? Math.round((closed / month.length) * 1000) / 10 : 0;
      const key = new Date();
      const label = monthLabelFromKey(
        `${key.getFullYear()}-${String(key.getMonth() + 1).padStart(2, "0")}`,
      );
      return {
        headline: `${rate}% closure rate in ${label}`,
        rows: [
          { label: "This month", value: label, highlight: true },
          { label: "Incidents", value: String(month.length) },
          { label: "Closed", value: String(closed) },
          { label: "Closure rate", value: `${rate}%`, highlight: true },
        ],
        summary: `Calendar month ${label}: ${closed} of ${month.length} incidents closed (${rate}%).`,
      };
    },
  },
  {
    id: "staff-injuries-2025",
    icon: Users,
    label: "Staff injuries",
    fullQuery:
      "How many staff injury incidents are there? Break them down by department and category. List the most severe ones (CAT-A or CAT-B) with GHR numbers.",
    answer: (data) => {
      const list = data.incidents.filter(
        (i) =>
          i.incidentType.toLowerCase().includes("staff injury") &&
          i.monthKey.startsWith("2025"),
      );
      return {
        headline: `${list.length} staff injury incidents in 2025`,
        rows: [
          { label: "2025 staff injuries", value: String(list.length), highlight: true },
          {
            label: "CAT-A",
            value: String(list.filter((i) => i.category === "CAT-A").length),
          },
          { label: "Open", value: String(list.filter((i) => i.status === "Open").length) },
        ],
        summary: `Found ${list.length} staff injury incidents with monthKey in 2025.`,
      };
    },
  },
  {
    id: "cat-a-by-month",
    icon: BarChart3,
    label: "CAT-A by month",
    fullQuery:
      "Show all CAT-A critical incidents grouped by month. List each one with GHR number, date, type, and brief description.",
    answer: (data) => {
      const breakdown = catAByMonth(data.incidents);
      return {
        headline: `CAT-A spread across ${breakdown.length} months`,
        rows: breakdown.slice(0, 6).map((m) => ({
          label: m.month,
          value: String(m.count),
          highlight: m.count === Math.max(...breakdown.map((x) => x.count), 0),
        })),
        summary: `CAT-A incidents grouped by month — highest month ${breakdown.sort((a, b) => b.count - a.count)[0]?.month ?? "n/a"}.`,
      };
    },
  },
  {
    id: "highest-risk-station",
    icon: MapPin,
    label: "Highest risk",
    fullQuery:
      "What is the risk score for DEL station? Show the full formula breakdown by category. What are the top 3 things that could reduce the risk score most?",
    answer: (data) => {
      const ranked = [...data.stations].sort((a, b) => b.riskScore - a.riskScore);
      const top = ranked[0];
      return {
        headline: top ? `${top.station} has highest risk` : "No station stats",
        rows: ranked.slice(0, 4).map((s) => ({
          label: String(s.station),
          value: `${s.riskScore} (${s.riskLevel})`,
          highlight: s.station === top?.station,
        })),
        summary: top
          ? `${top.station} leads with risk score ${top.riskScore} (${top.riskLevel}) across ${top.total} incidents.`
          : "Station statistics are unavailable.",
      };
    },
  },
  {
    id: "pending-count",
    icon: Clock,
    label: "Pending",
    fullQuery:
      "List all pending incidents that are awaiting sign-off or review. Include GHR number, date, type, and department. What action is needed to close them?",
    answer: (data) => {
      const pending = data.incidents.filter((i) => i.status === "Pending");
      return {
        headline: `${pending.length} incidents are Pending`,
        rows: [
          { label: "Pending", value: String(pending.length), highlight: true },
          {
            label: "CAT-A pending",
            value: String(pending.filter((i) => i.category === "CAT-A").length),
          },
          {
            label: "In progress",
            value: String(data.incidents.filter((i) => i.status === "In Progress").length),
          },
        ],
        summary: `${pending.length} incidents currently have Pending status.`,
      };
    },
  },
  {
    id: "monthly-average",
    icon: Calculator,
    label: "Monthly average",
    fullQuery:
      "What is the monthly average incident rate? Show the 3-month rolling average trend. Are incidents increasing or decreasing over the reporting period?",
    answer: (data) => {
      const validMonths = new Set(
        data.incidents
          .map((i) => i.monthKey)
          .filter((k) => k !== "unknown" && /^\d{4}-\d{2}$/.test(k)),
      );
      const distinct = validMonths.size || 1;
      const avg = Math.round((data.incidents.length / distinct) * 10) / 10;
      return {
        headline: `${avg} incidents per month on average`,
        rows: [
          { label: "Total incidents", value: String(data.incidents.length) },
          { label: "Distinct months", value: String(distinct) },
          { label: "Monthly average", value: String(avg), highlight: true },
          {
            label: "Sheet average",
            value: String(data.avgIncidentsPerMonth),
          },
        ],
        summary: `${data.incidents.length} incidents across ${distinct} months ≈ ${avg} per month.`,
      };
    },
  },
  {
    id: "closed-count",
    icon: FolderOpen,
    label: "Closed count",
    fullQuery:
      "How many incidents are closed? What is the closure rate by department — RAMP vs GSD? Which months had 100% closure and which did not?",
    answer: (data) => ({
      headline: `${data.kpis.closed} incidents closed`,
      rows: [
        { label: "Closed", value: String(data.kpis.closed), highlight: true },
        { label: "Closure rate", value: `${data.kpis.closureRate}%`, highlight: true },
        { label: "Open", value: String(data.kpis.open) },
      ],
      summary: `${data.kpis.closed} of ${data.kpis.total} incidents are Closed (${data.kpis.closureRate}% closure rate).`,
    }),
  },
  {
    id: "in-progress-count",
    icon: Clock,
    label: "In progress",
    fullQuery: "How many incidents are in progress?",
    answer: (data) => ({
      headline: `${data.kpis.inProgress} incidents In Progress`,
      rows: [
        { label: "In Progress", value: String(data.kpis.inProgress), highlight: true },
        { label: "Open", value: String(data.kpis.open) },
        { label: "Pending", value: String(data.kpis.pending) },
      ],
      summary: `${data.kpis.inProgress} incidents are actively In Progress.`,
    }),
  },
  {
    id: "cat-b-count",
    icon: AlertTriangle,
    label: "CAT-B count",
    fullQuery:
      "List all CAT-B high severity incidents with GHR numbers, dates, types, and current status. How do they compare to CAT-A incidents?",
    answer: (data) => ({
      headline: `${data.kpis.catB} CAT-B incidents`,
      rows: [
        { label: "CAT-B", value: String(data.kpis.catB), highlight: true },
        { label: "CAT-A", value: String(data.kpis.catA) },
        { label: "Total", value: String(data.kpis.total) },
      ],
      summary: `There are ${data.kpis.catB} CAT-B high-severity incidents in the dataset.`,
    }),
  },
  {
    id: "ramp-incidents",
    icon: Building2,
    label: "RAMP incidents",
    fullQuery: "How many RAMP department incidents?",
    answer: (data) => {
      const ramp = data.incidents.filter((i) => i.department === "RAMP");
      return {
        headline: `${ramp.length} RAMP incidents`,
        rows: [
          { label: "RAMP total", value: String(ramp.length), highlight: true },
          { label: "Open", value: String(ramp.filter((i) => i.status === "Open").length) },
          { label: "CAT-A", value: String(ramp.filter((i) => i.category === "CAT-A").length) },
        ],
        summary: `RAMP department has ${ramp.length} incidents across all statuses.`,
      };
    },
  },
  {
    id: "cargo-dept",
    icon: Building2,
    label: "CARGO dept",
    fullQuery: "Show CARGO department incidents",
    answer: (data) => {
      const cargo = data.incidents.filter((i) => i.department === "CARGO");
      return {
        headline: `${cargo.length} CARGO incidents`,
        rows: [
          { label: "CARGO", value: String(cargo.length), highlight: true },
          { label: "Closed", value: String(cargo.filter((i) => i.status === "Closed").length) },
          { label: "Near miss", value: String(cargo.filter((i) => i.incidentType.toLowerCase().includes("near miss")).length) },
        ],
        summary: `Found ${cargo.length} incidents in the CARGO department.`,
      };
    },
  },
  {
    id: "compare-ramp-gsd",
    icon: BarChart3,
    label: "RAMP vs GSD",
    fullQuery:
      "Compare RAMP and GSD departments. Which has more incidents, higher severity, worse closure rate? Show the numbers for both side by side.",
    answer: (data) => {
      const ramp = data.incidents.filter((i) => i.department === "RAMP");
      const gsd = data.incidents.filter((i) => i.department === "GSD");
      const rampClosed = ramp.filter((i) => i.status === "Closed").length;
      const gsdClosed = gsd.filter((i) => i.status === "Closed").length;
      const rampRate = ramp.length ? Math.round((rampClosed / ramp.length) * 1000) / 10 : 0;
      const gsdRate = gsd.length ? Math.round((gsdClosed / gsd.length) * 1000) / 10 : 0;
      return {
        headline: `RAMP vs GSD department comparison`,
        rows: [
          { label: "RAMP total", value: String(ramp.length) },
          { label: "GSD total", value: String(gsd.length) },
          { label: "RAMP closure", value: `${rampRate}%`, highlight: true },
          { label: "GSD closure", value: `${gsdRate}%`, highlight: true },
        ],
        summary: `Compare departments: RAMP ${ramp.length} incidents (${rampRate}% closed) vs GSD ${gsd.length} (${gsdRate}% closed).`,
      };
    },
  },
  {
    id: "gse-incidents",
    icon: ShieldAlert,
    label: "GSE incidents",
    fullQuery:
      "Show all GSE (Ground Support Equipment) incidents. Include GHR number, date, category, department, status, and brief description for each.",
    answer: (data) => {
      const list = data.incidents.filter((i) => i.incidentType.toLowerCase().includes("gse"));
      return {
        headline: `${list.length} GSE incidents`,
        rows: [
          { label: "GSE type", value: String(list.length), highlight: true },
          { label: "Open", value: String(list.filter((i) => i.status === "Open").length) },
          { label: "CAT-A", value: String(list.filter((i) => i.category === "CAT-A").length) },
        ],
        summary: `Found ${list.length} incidents with GSE in the incident type.`,
      };
    },
  },
  {
    id: "loading-errors",
    icon: AlertTriangle,
    label: "Loading errors",
    fullQuery:
      "Show all loading error incidents with full details. What categories are they? Which department? Are they resolved?",
    answer: (data) => {
      const list = data.incidents.filter((i) => i.incidentType.toLowerCase().includes("loading"));
      return {
        headline: `${list.length} loading-related incidents`,
        rows: [
          { label: "Loading errors", value: String(list.length), highlight: true },
          { label: "Open", value: String(list.filter((i) => i.status === "Open").length) },
          { label: "Pending", value: String(list.filter((i) => i.status === "Pending").length) },
        ],
        summary: `Found ${list.length} loading error / loading type incidents.`,
      };
    },
  },
];

export const QUICK_QUESTIONS_POOL_SIZE = QUICK_QUESTIONS.length;

export function getQuestionById(id: string) {
  return QUICK_QUESTIONS.find((q) => q.id === id);
}

const INCIDENT_QUESTION_IDS = [
  "cat-a-count",
  "cat-b-count",
  "open-incidents",
  "near-miss",
  "pending-count",
  "staff-injuries-2025",
  "closed-count",
  "in-progress-count",
  "ramp-incidents",
  "cargo-dept",
  "gse-incidents",
  "loading-errors",
] as const;
const TREND_QUESTION_IDS = [
  "peak-month",
  "monthly-average",
  "cat-a-by-month",
  "closure-this-month",
] as const;
const RISK_QUESTION_IDS = [
  "dept-closure",
  "highest-risk-station",
  "del-risk",
  "compare-ramp-gsd",
] as const;

function uniqueById(questions: QuickQuestion[]): QuickQuestion[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });
}

export function pickRotatedQuestions(seed: number, count = 6): QuickQuestion[] {
  const pool = [...QUICK_QUESTIONS];
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const incident = pool.filter((q) =>
    (INCIDENT_QUESTION_IDS as readonly string[]).includes(q.id),
  );
  const trend = pool.filter((q) => (TREND_QUESTION_IDS as readonly string[]).includes(q.id));
  const risk = pool.filter((q) => (RISK_QUESTION_IDS as readonly string[]).includes(q.id));
  const pickOne = (arr: QuickQuestion[]) => arr[Math.floor(rand() * arr.length)] ?? arr[0]!;
  const pickedIds = new Set<string>();
  const take = (q: QuickQuestion | undefined) => {
    if (!q || pickedIds.has(q.id)) return;
    pickedIds.add(q.id);
    result.push(q);
  };
  const result: QuickQuestion[] = [];
  take(pickOne(incident.length ? incident : pool));
  take(pickOne(trend.length ? trend : pool));
  take(pickOne(risk.length ? risk : pool));
  for (const q of pool) {
    if (result.length >= count) break;
    take(q);
  }
  return uniqueById(result).slice(0, count);
}
