"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { IncidentDetailDrawer } from "@/components/dashboard/IncidentDetailDrawer";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { ExpandableChart } from "@/components/ui/ExpandableChart";
import {
  AreaTrendChart,
  CountChart,
  IncidentTimeline,
  RankedHorizontalBarChart,
  StatusBreakdownChart,
} from "@/components/charts/DashboardCharts";
import { fadeUp, stagger } from "@/lib/animations";
import { CHART_DETAILS } from "@/lib/chart-details";
import { filterIncidents } from "@/lib/analytics";
import { normalizeIncidentType, isValidMonthKey, monthLabelFromKey } from "@/lib/parse/utils";
import { DEPT_COLORS, STATIONS } from "@/lib/constants";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import type { DashboardData } from "@/lib/types";

const CATEGORY_ORDER = ["CAT-A", "CAT-B", "CAT-C", "CAT-D"];

export function GraphsPage() {
  return (
    <PageDataRequired>
      {(data) => <GraphsContent data={data} />}
    </PageDataRequired>
  );
}

function GraphsContent({ data }: { data: DashboardData }) {
  const router = useRouter();
  const kpis = data.kpis;
  const filters = useDashboardStore((s) => s.graphFilters);
  const setGraphFilters = useDashboardStore((s) => s.setGraphFilters);
  const selectedIncident = useDashboardStore((s) => s.selectedIncident);
  const setSelectedIncident = useDashboardStore((s) => s.setSelectedIncident);
  const details = CHART_DETAILS.graphs;

  const filtered = useMemo(
    () =>
      filterIncidents(data.incidents, {
        year: filters.year,
        month: filters.month,
        station: filters.station,
        department: filters.department,
        category: filters.category,
      }),
    [data.incidents, filters],
  );

  const derived = useMemo(() => {
    const stations = [...STATIONS];
    const stationTotals = stations.map((s) => filtered.filter((i) => i.station === s).length);
    const types = [...new Set(filtered.map((i) => normalizeIncidentType(i.incidentType)))]
      .map((label) => ({
        label,
        value: filtered.filter(
          (i) => normalizeIncidentType(i.incidentType) === label,
        ).length,
      }))
      .sort((a, b) => b.value - a.value);

    const monthMap = new Map<string, { total: number; catA: number; label: string }>();
    filtered.forEach((incident) => {
      if (!isValidMonthKey(incident.monthKey)) return;
      const current = monthMap.get(incident.monthKey) ?? {
        total: 0,
        catA: 0,
        label: monthLabelFromKey(incident.monthKey),
      };
      current.total += 1;
      if (incident.category === "CAT-A") current.catA += 1;
      monthMap.set(incident.monthKey, current);
    });
    const months = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b));

    const timeline = filtered
      .filter((i) => i.date)
      .map((i) => ({
        id: i.id,
        dateLabel: i.dateLabel,
        category: i.category,
        title: i.title,
        ghrNumber: i.ghrNumber,
        brief: i.brief,
        x: i.date!.getTime(),
        y: CATEGORY_ORDER.indexOf(i.category),
      }));

    const avgMonthly = months.length
      ? months.reduce((sum, [, m]) => sum + m.total, 0) / months.length
      : 4.4;

    return { stations, stationTotals, types, months, timeline, avgMonthly };
  }, [filtered]);

  const filterKey = `${filters.year}-${filters.month}-${filters.station}-${filters.department}-${filters.category}`;
  const monthOptions = ["All", ...data.monthlyTrend.map((m) => m.monthKey)];

  const showKpis = filters.station === "All" || filters.station === "DEL";
  const catA = showKpis ? kpis.catA : filtered.filter((i) => i.category === "CAT-A").length;
  const catB = showKpis ? kpis.catB : filtered.filter((i) => i.category === "CAT-B").length;
  const catC = showKpis ? kpis.catC : filtered.filter((i) => i.category === "CAT-C").length;
  const catD = showKpis ? kpis.catD : filtered.filter((i) => i.category === "CAT-D").length;
  const open = showKpis ? kpis.open : filtered.filter((i) => i.status === "Open").length;
  const inProgress = showKpis ? kpis.inProgress : filtered.filter((i) => i.status === "In Progress").length;
  const closed = showKpis ? kpis.closed : filtered.filter((i) => i.status === "Closed").length;
  const pending = showKpis ? kpis.pending : filtered.filter((i) => i.status === "Pending").length;
  const ramp = showKpis ? kpis.ramp : filtered.filter((i) => i.department === "RAMP").length;
  const gsd = showKpis ? kpis.gsd : filtered.filter((i) => i.department === "GSD").length;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Graphs Dashboard"
          subtitle="Visual analytics hub with live filters across all incident dimensions."
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card interactive-card mb-6 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5"
      >
        <FilterSelect label="Year" value={filters.year} options={["All", "2025", "2026"]} onChange={(year) => setGraphFilters({ year: year as typeof filters.year })} />
        <FilterSelect label="Month" value={filters.month} options={monthOptions} onChange={(month) => setGraphFilters({ month })} />
        <FilterSelect label="Station" value={filters.station} options={["All", ...STATIONS]} onChange={(station) => setGraphFilters({ station })} />
        <FilterSelect label="Department" value={filters.department} options={["All", "RAMP", "GSD", "CARGO"]} onChange={(department) => setGraphFilters({ department })} />
        <FilterSelect label="Category" value={filters.category} options={["All", "CAT-A", "CAT-B", "CAT-C", "CAT-D"]} onChange={(category) => setGraphFilters({ category })} />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={filterKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="grid gap-4 lg:grid-cols-2"
        >
          <motion.div variants={fadeUp} custom={0}>
            <ExpandableChart
              title="Station Incidents"
              renderChart={() => <CountChart labels={derived.stations} values={derived.stationTotals} />}
              {...details.station}
            />
          </motion.div>
          <motion.div variants={fadeUp} custom={1}>
            <ExpandableChart
              title="Category Severity"
              renderChart={() => (
                <CountChart
                  labels={["CAT-A", "CAT-B", "CAT-C", "CAT-D"]}
                  values={[catA, catB, catC, catD]}
                  type="doughnut"
                  centerText={String(filtered.length)}
                />
              )}
              {...details.category}
            />
          </motion.div>
          <motion.div variants={fadeUp} custom={2}>
            <ExpandableChart
              title="Incident Status"
              renderChart={() => (
                <StatusBreakdownChart
                  open={open}
                  inProgress={inProgress}
                  pending={pending}
                  closed={closed}
                />
              )}
              {...details.status}
            />
          </motion.div>
          <motion.div variants={fadeUp} custom={3}>
            <ExpandableChart
              title="Department Split"
              renderChart={() => (
                <CountChart
                  labels={["RAMP", "GSD"]}
                  values={[ramp, gsd]}
                  type="horizontal"
                  colors={[DEPT_COLORS.RAMP, DEPT_COLORS.GSD]}
                />
              )}
              {...details.department}
            />
          </motion.div>
          <motion.div variants={fadeUp} custom={4}>
            <ExpandableChart
              title="Monthly Trend Area"
              renderChart={() => (
                <AreaTrendChart
                  labels={derived.months.map(([, m]) => m.label)}
                  totals={derived.months.map(([, m]) => m.total)}
                  catA={derived.months.map(([, m]) => m.catA)}
                  averageLine={Math.round(derived.avgMonthly * 10) / 10}
                />
              )}
              {...details.monthlyArea}
            />
          </motion.div>
          <motion.div variants={fadeUp} custom={5}>
            {/* Was: horizontal bar (incident type). Department Split already uses horizontal bar on this page — treemap ranks types by volume without a second horizontal count chart. */}
            <ExpandableChart
              title="Incident Type Frequency"
              renderChart={() => (
                <RankedHorizontalBarChart
                  labels={derived.types.map((t) => t.label)}
                  values={derived.types.map((t) => t.value)}
                />
              )}
              {...details.typeFrequency}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <motion.div variants={fadeUp} custom={6} className="mt-4">
        {/* Was: bubble timeline. No second bubble on this page, but scatter gives fixed-size points for date×category positioning (clearer than variable-radius bubbles at dashboard scale). */}
        <ExpandableChart
          title="Incident Timeline"
          height={320}
          renderChart={() => (
            <IncidentTimeline
              incidents={derived.timeline}
              onSelect={(id) => {
                const incident = data.incidents.find((i) => i.id === id);
                if (incident) setSelectedIncident(incident);
              }}
            />
          )}
          insight="Each dot is one incident positioned by date (X) and severity category (Y). Click a dot to open the incident detail drawer."
          caption="Timeline of all filtered incidents from Jan 2025 to Feb 2026."
          columns={[
            { key: "GHR", label: "GHR" },
            { key: "Title", label: "Title" },
            { key: "Date", label: "Date" },
            { key: "Category", label: "Category" },
          ]}
          rows={derived.timeline.slice(0, 20).map((t) => ({
            GHR: t.ghrNumber,
            Title: t.title,
            Date: t.dateLabel,
            Category: t.category,
          }))}
        />
      </motion.div>

      <div className="mt-4 flex flex-wrap gap-2">
        <motion.button
          type="button"
          variants={fadeUp}
          whileHover={{ scale: 1.05 }}
          onClick={() => router.push("/station-analysis")}
          className="rounded-md border theme-border px-3 py-1 text-xs theme-text-secondary hover:border-[var(--brand-gold)]"
        >
          View DEL station analysis →
        </motion.button>
      </div>

      <IncidentDetailDrawer incident={selectedIncident} onClose={() => setSelectedIncident(null)} />
    </motion.div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs theme-text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="theme-input mt-1 block w-full rounded-md px-3 py-2 text-sm"
      >
        {options.map((opt, index) => (
          <option key={`${label}-${opt}-${index}`} value={opt}>
            {opt === "All" ? "All" : opt.startsWith("20") ? monthLabelFromKey(opt) : opt}
          </option>
        ))}
      </select>
    </label>
  );
}
