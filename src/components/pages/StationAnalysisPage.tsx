"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { AnimatedKpiCard } from "@/components/ui/AnimatedKpiCard";
import { KpiCardGrid } from "@/components/ui/KpiCardGrid";
import { ExpandableChart } from "@/components/ui/ExpandableChart";
import {
  ComboTrendChart,
  CountChart,
  RadarMetricChart,
  RankedHorizontalBarChart,
} from "@/components/charts/DashboardCharts";
import { fadeUp, scaleIn, stagger } from "@/lib/animations";
import { CHART_DETAILS } from "@/lib/chart-details";
import { buildMonthlyTrendForIncidents } from "@/lib/analytics";
import { normalizeIncidentType } from "@/lib/parse/utils";
import { CATEGORY_COLORS, DEPT_COLORS, STATIONS } from "@/lib/constants";
import type { DashboardData } from "@/lib/types";

export function StationAnalysisPage() {
  return (
    <PageDataRequired>
      {(data) => <StationAnalysisContent data={data} />}
    </PageDataRequired>
  );
}

function StationAnalysisContent({ data }: { data: DashboardData }) {
  const [station, setStation] = useState("DEL");
  const details = CHART_DETAILS.stationAnalysis;

  const scoped = useMemo(() => {
    const incidents = data.incidents.filter((i) => i.station === station);
    const ramp = incidents.filter((i) => i.department === "RAMP").length;
    const gsd = incidents.filter((i) => i.department === "GSD").length;
    const closed = incidents.filter((i) => i.status === "Closed").length;
    const catA = incidents.filter((i) => i.category === "CAT-A").length;
    const catB = incidents.filter((i) => i.category === "CAT-B").length;
    const catC = incidents.filter((i) => i.category === "CAT-C").length;
    const catD = incidents.filter((i) => i.category === "CAT-D").length;
    const types = [
      ...new Set(incidents.map((i) => normalizeIncidentType(i.incidentType))),
    ].map((label) => ({
      label,
      value: incidents.filter(
        (i) => normalizeIncidentType(i.incidentType) === label,
      ).length,
    }));
    const monthly = buildMonthlyTrendForIncidents(incidents);
    const factors = [...new Set(incidents.map((i) => i.contributingFactor).filter(Boolean))].map(
      (label) => ({
        label,
        value: incidents.filter((i) => i.contributingFactor === label).length,
      }),
    );

    return {
      incidents,
      ramp,
      gsd,
      catA,
      catB,
      catC,
      catD,
      total: incidents.length,
      closureRate: incidents.length ? Math.round((closed / incidents.length) * 1000) / 10 : 0,
      types,
      monthly,
      factors,
      breakdown: types.map(({ label, value }) => {
        const list = incidents.filter(
          (i) => normalizeIncidentType(i.incidentType) === label,
        );
        return {
          incidentType: label,
          count: value,
          pct: incidents.length ? Math.round((value / incidents.length) * 1000) / 10 : 0,
          catA: list.filter((i) => i.category === "CAT-A").length,
          catB: list.filter((i) => i.category === "CAT-B").length,
          catC: list.filter((i) => i.category === "CAT-C").length,
          catD: list.filter((i) => i.category === "CAT-D").length,
          open: list.filter((i) => i.status === "Open").length,
          closed: list.filter((i) => i.status === "Closed").length,
        };
      }),
    };
  }, [data, station]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Station Analysis"
          subtitle="Deep operational breakdown for a selected station."
        />
      </motion.div>

      <motion.div variants={fadeUp} custom={1} className="mb-6">
        <select
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className="theme-input rounded-md px-3 py-2 text-sm"
        >
          {STATIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </motion.div>

      <KpiCardGrid>
        <AnimatedKpiCard index={0} label="Total Incidents" value={scoped.total} tone="gold" />
        <AnimatedKpiCard index={1} label="RAMP Department" value={scoped.ramp} />
        <AnimatedKpiCard index={2} label="GSD Department" value={scoped.gsd} />
        <AnimatedKpiCard index={3} label="CAT-A Critical" value={scoped.catA} tone="red" />
        <AnimatedKpiCard index={4} label="Closure Rate" value={scoped.closureRate} tone="green" suffix="%" decimals={1} />
        <AnimatedKpiCard index={5} label="Avg / Month" value={data.avgIncidentsPerMonth} decimals={1} />
      </KpiCardGrid>

      <div className="mb-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <motion.div variants={scaleIn} custom={6}>
          <ExpandableChart
            title="Department Split"
            subtitle="RAMP vs GSD"
            renderChart={() => <CountChart labels={["RAMP", "GSD"]} values={[scoped.ramp, scoped.gsd]} type="doughnut" colors={[DEPT_COLORS.RAMP, DEPT_COLORS.GSD]} />}
            {...details.department}
          />
        </motion.div>
        <motion.div variants={scaleIn} custom={7}>
          <ExpandableChart
            title="Category Distribution"
            renderChart={() => (
              <CountChart
                labels={["CAT-A", "CAT-B", "CAT-C", "CAT-D"]}
                values={[scoped.catA, scoped.catB, scoped.catC, scoped.catD]}
                type="horizontal"
                colors={Object.values(CATEGORY_COLORS)}
              />
            )}
            {...CHART_DETAILS.incidentLog.category}
          />
        </motion.div>
        <motion.div variants={scaleIn} custom={8}>
          {/* Was: vertical bar (incident type counts). Category Distribution already uses horizontal bar for count-by-label on this page — treemap for types avoids two bar charts showing categorical frequency. */}
          <ExpandableChart
            title="Incident Types Ranked"
            renderChart={() => (
              <RankedHorizontalBarChart
                labels={scoped.types.map((t) => t.label)}
                values={scoped.types.map((t) => t.value)}
              />
            )}
            {...details.typesRanked}
          />
        </motion.div>
        <motion.div variants={scaleIn} custom={9} className="lg:col-span-2">
          <ExpandableChart
            title="Monthly Trend"
            height={300}
            renderChart={() => (
              <ComboTrendChart
                labels={scoped.monthly.map((m) => m.label)}
                totals={scoped.monthly.map((m) => m.total)}
                catA={scoped.monthly.map((m) => m.catA)}
                rollingAvg={scoped.monthly.map((m) => m.rollingAvg3)}
              />
            )}
            {...details.monthly}
          />
        </motion.div>
        {scoped.factors.length > 0 ? (
          <motion.div variants={scaleIn} custom={10}>
            {/* Was: horizontal bar (factor counts). Category Distribution already uses horizontal bar on this page — radar compares factor weights without duplicating horizontal bar + count dimension. */}
            <ExpandableChart
              title="Contributing Factors"
              renderChart={() => (
                <RadarMetricChart
                  labels={scoped.factors.map((f) => f.label)}
                  values={scoped.factors.map((f) => f.value)}
                  datasetLabel="Incidents"
                />
              )}
              insight="Contributing factor categories from incident records at this station."
              caption="Count of incidents tagged with each factor category."
              columns={[
                { key: "Factor", label: "Factor" },
                { key: "Count", label: "Count", align: "right" },
              ]}
              rows={scoped.factors.map((f) => ({ Factor: f.label, Count: f.value }))}
            />
          </motion.div>
        ) : null}
      </div>

      <motion.section variants={fadeUp} custom={11} className="glass-card interactive-card overflow-hidden">
        <div className="data-table-wrap overflow-auto">
          <table className="data-table w-full min-w-[900px]">
            <thead>
              <tr>
                <th>Incident Type</th>
                <th>Count</th>
                <th>%</th>
                <th>CAT-A</th>
                <th>CAT-B</th>
                <th>CAT-C</th>
                <th>CAT-D</th>
                <th>Open</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {scoped.breakdown.map((row, index) => (
                <tr key={`${row.incidentType}-${index}`}>
                  <td>{row.incidentType}</td>
                  <td>{row.count}</td>
                  <td>{row.pct}%</td>
                  <td>{row.catA}</td>
                  <td>{row.catB}</td>
                  <td>{row.catC}</td>
                  <td>{row.catD}</td>
                  <td>{row.open}</td>
                  <td>{row.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>
    </motion.div>
  );
}
