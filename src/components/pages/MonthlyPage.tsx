"use client";

import { motion } from "framer-motion";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { AnimatedKpiCard } from "@/components/ui/AnimatedKpiCard";
import { KpiCardGrid } from "@/components/ui/KpiCardGrid";
import { ExpandableChart } from "@/components/ui/ExpandableChart";
import {
  ComboTrendChart,
  CountChart,
  SingleSeriesAreaChart,
  StatusBreakdownChart,
} from "@/components/charts/DashboardCharts";
import { fadeUp, scaleIn, stagger } from "@/lib/animations";
import { CHART_DETAILS } from "@/lib/chart-details";
import { CATEGORY_COLORS } from "@/lib/constants";
import type { DashboardData } from "@/lib/types";

export function MonthlyPage() {
  return (
    <PageDataRequired>
      {(data) => <MonthlyContent data={data} />}
    </PageDataRequired>
  );
}

function MonthlyContent({ data }: { data: DashboardData }) {
  const kpis = data.kpis;
  const { monthlyTrend } = data;
  const details = CHART_DETAILS.monthly;
  const catAMonths = monthlyTrend.filter((m) => m.catA > 0);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Monthly Dashboard"
          subtitle="Month-by-month trend analysis from January 2025 to February 2026."
        />
      </motion.div>

      <KpiCardGrid columns={8}>
        <AnimatedKpiCard index={0} label="Total Incidents" value={kpis.total} tone="gold" />
        <AnimatedKpiCard index={1} label="Open" value={kpis.open} tone="red" />
        <AnimatedKpiCard index={2} label="In Progress" value={kpis.inProgress} tone="amber" />
        <AnimatedKpiCard index={3} label="Closed" value={kpis.closed} tone="green" />
        <AnimatedKpiCard index={4} label="Pending" value={kpis.pending} tone="purple" />
        <AnimatedKpiCard index={5} label="CAT-A Critical" value={kpis.catA} tone="red" />
        <AnimatedKpiCard index={6} label="CAT-B High" value={kpis.catB} tone="amber" />
        <AnimatedKpiCard index={7} label="CAT-C Medium" value={kpis.catC} tone="gold" />
      </KpiCardGrid>

      <motion.div variants={scaleIn} custom={8}>
        <ExpandableChart
          title="Monthly Combo Trend"
          subtitle="Bars = total · Line = CAT-A · Dashed = 3-month rolling avg"
          height={320}
          renderChart={() => (
            <ComboTrendChart
              labels={monthlyTrend.map((m) => m.label)}
              totals={monthlyTrend.map((m) => m.total)}
              catA={monthlyTrend.map((m) => m.catA)}
              rollingAvg={monthlyTrend.map((m) => m.rollingAvg3)}
            />
          )}
          {...details.combo}
        />
      </motion.div>

      <div className="my-6 grid gap-4 lg:grid-cols-2">
        <motion.div variants={scaleIn} custom={9}>
          <ExpandableChart
            title="Status Counts"
            renderChart={() => (
              <StatusBreakdownChart
                open={kpis.open}
                inProgress={kpis.inProgress}
                pending={kpis.pending}
                closed={kpis.closed}
              />
            )}
            {...CHART_DETAILS.incidentLog.status}
          />
        </motion.div>
        <motion.div variants={scaleIn} custom={10}>
          <ExpandableChart
            title="Category Counts"
            renderChart={() => (
              <CountChart
                labels={["CAT-A", "CAT-B", "CAT-C", "CAT-D"]}
                values={[kpis.catA, kpis.catB, kpis.catC, kpis.catD]}
                type="horizontal"
                colors={Object.values(CATEGORY_COLORS)}
              />
            )}
            {...CHART_DETAILS.incidentLog.category}
          />
        </motion.div>
      </div>

      <motion.div variants={scaleIn} custom={11}>
        <ExpandableChart
          title="Status & Category Overview"
          renderChart={() => (
            <CountChart
              labels={["Closed", "Open", "In Progress", "Pending", "CAT-A", "CAT-B", "CAT-C", "CAT-D"]}
              values={[kpis.closed, kpis.open, kpis.inProgress, kpis.pending, kpis.catA, kpis.catB, kpis.catC, kpis.catD]}
              type="horizontal"
            />
          )}
          {...details.statusCategory}
        />
      </motion.div>

      <motion.section variants={fadeUp} custom={12} className="glass-card interactive-card mb-6 mt-6 overflow-hidden">
        <div className="data-table-wrap overflow-auto">
          <table className="data-table w-full min-w-[960px]">
            <thead>
              <tr>
                <th>Month</th>
                <th>Total</th>
                <th>CAT-A</th>
                <th>CAT-B</th>
                <th>CAT-C</th>
                <th>CAT-D</th>
                <th>Closed</th>
                <th>Open</th>
                <th>Closure Rate</th>
                <th>Change</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTrend.map((m) => (
                <tr key={`month-${m.monthKey}`}>
                  <td>{m.label}</td>
                  <td>{m.total}</td>
                  <td>{m.catA}</td>
                  <td>{m.catB}</td>
                  <td>{m.catC}</td>
                  <td>{m.catD}</td>
                  <td>{m.closed}</td>
                  <td>{m.open}</td>
                  <td>{m.closureRate}%</td>
                  <td className={m.changeVsLast != null && m.changeVsLast >= 0 ? "text-green-600" : "text-red-600"}>
                    {m.changeVsLast == null ? "—" : `${m.changeVsLast >= 0 ? "↑" : "↓"} ${Math.abs(m.changeVsLast)}`}
                  </td>
                  <td className={m.trend === "UP" ? "text-green-600" : m.trend === "DOWN" ? "text-red-600" : "theme-text-muted"}>
                    {m.trend === "UP" ? "↗ UP" : m.trend === "DOWN" ? "↘ DOWN" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      <motion.div variants={scaleIn} custom={13}>
        <ExpandableChart
          title="CAT-A Monthly Focus"
          renderChart={() => (
            <SingleSeriesAreaChart
              labels={catAMonths.length ? catAMonths.map((m) => m.label) : ["No CAT-A months"]}
              values={catAMonths.length ? catAMonths.map((m) => m.catA) : [0]}
              label="CAT-A incidents"
              color="#ef4444"
            />
          )}
          insight="Months where CAT-A critical incidents occurred."
          caption="CAT-A count per month — track critical incident spikes over time."
          columns={[
            { key: "Month", label: "Month" },
            { key: "CAT-A", label: "CAT-A", align: "right" },
          ]}
          rows={catAMonths.map((m) => ({ Month: m.label, "CAT-A": m.catA }))}
        />
      </motion.div>
    </motion.div>
  );
}
