"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { AnimatedKpiCard } from "@/components/ui/AnimatedKpiCard";
import { KpiCardGrid } from "@/components/ui/KpiCardGrid";
import { ExpandableChart } from "@/components/ui/ExpandableChart";
import { RiskBadge } from "@/components/ui/badges";
import { CountChart, GroupedBarChart } from "@/components/charts/DashboardCharts";
import { fadeUp, stagger } from "@/lib/animations";
import { CHART_DETAILS } from "@/lib/chart-details";
import { normalizeIncidentType } from "@/lib/parse/utils";
import { CATEGORY_COLORS, RISK_COLORS, STATIONS } from "@/lib/constants";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PanIndiaPage() {
  return (
    <PageDataRequired>
      {(data) => <PanIndiaContent data={data} />}
    </PageDataRequired>
  );
}

function PanIndiaContent({ data }: { data: DashboardData }) {
  const [selected, setSelected] = useState("DEL");
  const labels = [...STATIONS];
  const stationMap = new Map(data.stations.map((s) => [s.station, s]));
  const details = CHART_DETAILS.panIndia;

  const selectedStats = stationMap.get(selected);

  const selectedKpis = {
    total: selectedStats?.total ?? 0,
    catA: selectedStats?.catA ?? 0,
    catB: selectedStats?.catB ?? 0,
    closureRate: selectedStats?.closureRate ?? 0,
    nearMiss: selectedStats?.nearMiss ?? 0,
    staffInjuries: selectedStats?.staffInjuries ?? 0,
  };

  const selectedIncidents = data.incidents.filter((i) => i.station === selected);
  const typeLabels = [
    ...new Set(selectedIncidents.map((i) => normalizeIncidentType(i.incidentType))),
  ];
  const typeValues = typeLabels.map(
    (t) =>
      selectedIncidents.filter(
        (i) => normalizeIncidentType(i.incidentType) === t,
      ).length,
  );
  const ranked = [...data.stations].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Pan India Stations"
          subtitle="Side-by-side comparison of all 11 Indian airport stations."
        />
      </motion.div>

      <motion.div variants={stagger} className="mb-6 flex flex-wrap gap-2">
        {labels.map((code, i) => (
          <motion.button
            key={code}
            type="button"
            variants={fadeUp}
            custom={i}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelected(code)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              selected === code
                ? "bg-[var(--brand-navy)] text-[var(--brand-gold)]"
                : "border theme-border theme-text-secondary hover:border-[var(--brand-gold)] hover:bg-[var(--tab-hover-bg)]",
            )}
          >
            {code}
          </motion.button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selected}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3 }}
        >
          <KpiCardGrid columns={6} className="mb-6">
            <AnimatedKpiCard index={0} label="Total Incidents" value={selectedKpis.total} tone="gold" />
            <AnimatedKpiCard index={1} label="CAT-A Critical" value={selectedKpis.catA} tone="red" />
            <AnimatedKpiCard index={2} label="CAT-B High" value={selectedKpis.catB} tone="amber" />
            <AnimatedKpiCard index={3} label="Closure Rate" value={selectedKpis.closureRate} tone="green" suffix="%" decimals={1} />
            <AnimatedKpiCard index={4} label="Near Miss" value={selectedKpis.nearMiss} />
            <AnimatedKpiCard index={5} label="Staff Injuries" value={selectedKpis.staffInjuries} />
          </KpiCardGrid>
        </motion.div>
      </AnimatePresence>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <motion.div variants={fadeUp} custom={12}>
          <ExpandableChart
            title="Station Comparison"
            subtitle="CAT-A through CAT-D by station"
            renderChart={() => (
              <GroupedBarChart
                labels={labels}
                series={[
                  { label: "CAT-A", data: labels.map((s) => stationMap.get(s)?.catA ?? 0), color: CATEGORY_COLORS["CAT-A"] },
                  { label: "CAT-B", data: labels.map((s) => stationMap.get(s)?.catB ?? 0), color: CATEGORY_COLORS["CAT-B"] },
                  { label: "CAT-C", data: labels.map((s) => stationMap.get(s)?.catC ?? 0), color: CATEGORY_COLORS["CAT-C"] },
                  { label: "CAT-D", data: labels.map((s) => stationMap.get(s)?.catD ?? 0), color: CATEGORY_COLORS["CAT-D"] },
                ]}
              />
            )}
            {...details.stationCompare}
          />
        </motion.div>
        <motion.div variants={fadeUp} custom={13}>
          <ExpandableChart
            title="Risk Score Ranking"
            renderChart={() => (
              <CountChart
                labels={ranked.map((s) => s.station)}
                values={ranked.map((s) => s.riskScore)}
                type="horizontal"
                colors={ranked.map((s) => RISK_COLORS[s.riskLevel])}
              />
            )}
            {...details.riskRanking}
          />
        </motion.div>
        <motion.div variants={fadeUp} custom={14}>
          <ExpandableChart
            title="Closure Rate Comparison"
            renderChart={() => (
              <CountChart
                labels={labels}
                values={labels.map((s) => stationMap.get(s)?.closureRate ?? 0)}
                type="bar"
                yMax={100}
                colors={labels.map((s) => {
                  const rate = stationMap.get(s)?.closureRate ?? 0;
                  return rate > 0 ? "#22c55e" : "#64748b";
                })}
              />
            )}
            insight="DEL closure rate is 91.9%. All other stations have no incidents to close."
            caption="Closure rate % per station based on closed ÷ total incidents."
            columns={[
              { key: "Station", label: "Station" },
              { key: "Closure %", label: "Closure %", align: "right" },
            ]}
            rows={labels.map((s) => ({
              Station: s,
              "Closure %": s === "DEL" ? "91.9%" : "—",
            }))}
          />
        </motion.div>
        <motion.div variants={fadeUp} custom={15}>
          <ExpandableChart
            title={`Incident Types — ${selected}`}
            previewHeight={260}
            renderChart={() => (
              <CountChart
                labels={typeLabels.length ? typeLabels : ["No data"]}
                values={typeValues.length ? typeValues : [0]}
                type="pie"
                legendVariant="wrap"
              />
            )}
            {...CHART_DETAILS.incidentLog.byType}
          />
        </motion.div>
      </div>

      <motion.section variants={fadeUp} custom={16} className="glass-card interactive-card overflow-hidden">
        <div className="data-table-wrap overflow-auto">
          <table className="data-table w-full min-w-[900px]">
            <thead>
              <tr>
                <th>Station</th>
                <th>Total</th>
                <th>CAT-A</th>
                <th>CAT-B</th>
                <th>CAT-C</th>
                <th>CAT-D</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Closed</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((code) => {
                const s = stationMap.get(code);
                return (
                  <tr key={code}>
                    <td className="font-semibold theme-text">{code}</td>
                    <td>{s?.total ?? 0}</td>
                    <td>{s?.catA ?? 0}</td>
                    <td>{s?.catB ?? 0}</td>
                    <td>{s?.catC ?? 0}</td>
                    <td>{s?.catD ?? 0}</td>
                    <td>{s?.riskScore ?? 0}</td>
                    <td><RiskBadge level={s?.riskLevel ?? "LOW"} /></td>
                    <td>{s?.closed ?? 0}</td>
                    <td>{s?.open ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.section>
    </motion.div>
  );
}
