// Filter-blank fix applied — see git commit fix/filter-blank-pages.
"use client";

import { motion } from "framer-motion";
import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { AnimatedKpiCard } from "@/components/ui/AnimatedKpiCard";
import { KpiCardGrid } from "@/components/ui/KpiCardGrid";
import { ExpandableChart } from "@/components/ui/ExpandableChart";
import { FilterContentShell } from "@/components/ui/FilterContentShell";
import {
  ComboTrendChart,
  CountChart,
  RadarMetricChart,
  RankedHorizontalBarChart,
} from "@/components/charts/DashboardCharts";
import { fadeUp, stagger } from "@/lib/animations";
import { buildChartDetails } from "@/lib/chart-details";
import { typeColor } from "@/lib/type-colors";
import { chartLinks } from "@/lib/incident-links";
import { buildMonthlyTrendForIncidents, departmentsOf, incidentTypesOf } from "@/lib/analytics";
import { compareCountItems } from "@/lib/parse/utils";
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
  // selected station lives in the URL (?view=BLR) so Back from a drill-down returns to it
  const router = useRouter();
  const pathname = usePathname() ?? "/station-analysis";
  const params = useSearchParams();
  const fromUrl = params?.get("view") ?? "";
  const selectedStation = (STATIONS as readonly string[]).includes(fromUrl) ? fromUrl : "DEL";
  const setSelectedStation = (code: string) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    next.set("view", code);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const [isPending, startTransition] = useTransition();

  const scopedIncidents = useMemo(() => {
    const incidents = data.incidents ?? [];
    if (!incidents.length) return [];
    return incidents.filter((i) => i.station === selectedStation);
  }, [data.incidents, selectedStation]);
  const allDetails = useMemo(
    () => buildChartDetails(scopedIncidents, { station: String(selectedStation) }),
    [scopedIncidents, selectedStation],
  );
  const details = allDetails.stationAnalysis;

  const scoped = useMemo(() => {
    const incidents = scopedIncidents;
    let ramp = 0;
    let gsd = 0;
    let closed = 0;
    let catA = 0;
    let catB = 0;
    let catC = 0;
    let catD = 0;

    const typeMap = new Map<
      string,
      { count: number; catA: number; catB: number; catC: number; catD: number; open: number; closed: number }
    >();
    const factorMap = new Map<string, number>();

    for (const inc of incidents) {
      const depts = departmentsOf(inc);
      if (depts.includes("RAMP")) ramp += 1;
      if (depts.includes("GSD")) gsd += 1;
      if (inc.status === "Closed") closed += 1;
      if (inc.category === "CAT-A") catA += 1;
      else if (inc.category === "CAT-B") catB += 1;
      else if (inc.category === "CAT-C") catC += 1;
      else if (inc.category === "CAT-D") catD += 1;

      for (const typeKey of new Set(incidentTypesOf(inc))) {
      const typeEntry = typeMap.get(typeKey) ?? {
        count: 0,
        catA: 0,
        catB: 0,
        catC: 0,
        catD: 0,
        open: 0,
        closed: 0,
      };
      typeEntry.count += 1;
      if (inc.category === "CAT-A") typeEntry.catA += 1;
      else if (inc.category === "CAT-B") typeEntry.catB += 1;
      else if (inc.category === "CAT-C") typeEntry.catC += 1;
      else if (inc.category === "CAT-D") typeEntry.catD += 1;
      if (inc.status === "Open") typeEntry.open += 1;
      else if (inc.status === "Closed") typeEntry.closed += 1;
      typeMap.set(typeKey, typeEntry);
      }

      if (inc.contributingFactor) {
        factorMap.set(inc.contributingFactor, (factorMap.get(inc.contributingFactor) ?? 0) + 1);
      }
    }

    const types = [...typeMap.entries()]
      .map(([label, entry]) => ({ label, value: entry.count }))
      .sort(compareCountItems);
    const factors = [...factorMap.entries()].map(([label, value]) => ({ label, value }));
    const monthly = buildMonthlyTrendForIncidents(incidents);

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
      breakdown: [...typeMap.entries()].map(([incidentType, entry]) => ({
        incidentType,
        count: entry.count,
        pct: incidents.length ? Math.round((entry.count / incidents.length) * 1000) / 10 : 0,
        catA: entry.catA,
        catB: entry.catB,
        catC: entry.catC,
        catD: entry.catD,
        open: entry.open,
        closed: entry.closed,
      })),
    };
  }, [scopedIncidents]);

  const typeLabels = scoped.types.map((t) => t.label) ?? [];
  const typeValues = scoped.types.map((t) => t.value) ?? [];
  const monthlyLabels = scoped.monthly.map((m) => m.label) ?? [];
  const monthlyTotals = scoped.monthly.map((m) => m.total) ?? [];
  const monthlyCatA = scoped.monthly.map((m) => m.catA) ?? [];
  const monthlyRolling = scoped.monthly.map((m) => m.rollingAvg3) ?? [];
  const factorLabels = scoped.factors.map((f) => f.label) ?? [];
  const factorValues = scoped.factors.map((f) => f.value) ?? [];

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
          value={selectedStation}
          onChange={(e) => {
            startTransition(() => {
              setSelectedStation(e.target.value);
            });
          }}
          className="theme-input rounded-md px-3 py-2 text-sm"
        >
          {STATIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </motion.div>

      <FilterContentShell transitionKey={selectedStation} isPending={isPending} minHeight={400}>
        <KpiCardGrid>
          <AnimatedKpiCard index={0} label="Total Incidents" value={scoped.total} tone="gold" />
          <AnimatedKpiCard index={1} label="RAMP Department" value={scoped.ramp} />
          <AnimatedKpiCard index={2} label="GSD Department" value={scoped.gsd} />
          <AnimatedKpiCard index={3} label="CAT-A Critical" value={scoped.catA} tone="red" />
          <AnimatedKpiCard
            index={4}
            label="Closure Rate"
            value={scoped.closureRate}
            tone="green"
            suffix="%"
            decimals={1}
          />
          <AnimatedKpiCard
            index={5}
            label="Avg / Month"
            value={data.avgIncidentsPerMonth ?? 0}
            decimals={1}
          />
        </KpiCardGrid>

        <div className="mb-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div>
            <ExpandableChart
              title="Department Split"
              subtitle="RAMP vs GSD"
              renderChart={() => (
                <CountChart
                  labels={["RAMP", "GSD"]}
                  values={[scoped.ramp, scoped.gsd]}
                  type="doughnut"
                  colors={[DEPT_COLORS.RAMP, DEPT_COLORS.GSD]}
                />
              )}
              modalVariant="compact"
              {...details.department}
            />
          </div>
          <div>
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
              {...allDetails.incidentLog.category}
            />
          </div>
          <div>
            <ExpandableChart
              title="Incident Types Ranked"
              renderChart={() => (
                <RankedHorizontalBarChart
                  labels={typeLabels}
                  values={typeValues}
                  colors={typeLabels.map(typeColor)}
                  {...chartLinks(scopedIncidents, "type", { station: String(selectedStation) })}
                />
              )}
              {...details.typesRanked}
            />
          </div>
          <div className="lg:col-span-2">
            <ExpandableChart
              title="Monthly Trend"
              height={300}
              renderChart={() => (
                <ComboTrendChart
                  labels={monthlyLabels}
                  totals={monthlyTotals}
                  catA={monthlyCatA}
                  rollingAvg={monthlyRolling}
                />
              )}
              {...details.monthly}
            />
          </div>
          {scoped.factors.length > 0 ? (
            <div>
              <ExpandableChart
                title="Contributing Factors"
                renderChart={() => (
                  <RadarMetricChart
                    labels={factorLabels}
                    values={factorValues}
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
            </div>
          ) : null}
        </div>
      </FilterContentShell>

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
              {scoped.breakdown.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-sm text-[#94a3b8]">
                    No incident types recorded for {selectedStation} in this period
                  </td>
                </tr>
              ) : (
                scoped.breakdown.map((row, index) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </motion.div>
  );
}
