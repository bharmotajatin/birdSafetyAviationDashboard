// Filter-blank fix applied — see git commit fix/filter-blank-pages.
"use client";

import { motion } from "framer-motion";
import { dataMonthSpan, dataYears } from "@/lib/month-range";
import { useDeferredValue, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IncidentDetailDrawer } from "@/components/dashboard/IncidentDetailDrawer";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { ExpandableChart } from "@/components/ui/ExpandableChart";
import { FilterContentShell } from "@/components/ui/FilterContentShell";
import {
  AreaTrendChart,
  CountChart,
  IncidentTimeline,
  RankedHorizontalBarChart,
  StatusBreakdownChart,
} from "@/components/charts/DashboardCharts";
import { fadeUp, stagger } from "@/lib/animations";
import { buildChartDetails } from "@/lib/chart-details";
import { typeColor } from "@/lib/type-colors";
import { chartLinks } from "@/lib/incident-links";
import { filterIncidents } from "@/lib/analytics";
import { compareCountItems, isValidMonthKey, monthLabelFromKey } from "@/lib/parse/utils";
import { departmentsOf, incidentTypesOf } from "@/lib/analytics";
import { DEPT_COLORS, STATIONS } from "@/lib/constants";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import type { DashboardData, GraphFilters } from "@/lib/types";

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
  const [isPending, startTransition] = useTransition();

  const incidents = useMemo(() => data.incidents ?? [], [data.incidents]);

  const filteredIncidents = useMemo(() => {
    if (!incidents.length) return [];
    return filterIncidents(incidents, {
      year: filters.year,
      month: filters.month,
      station: filters.station,
      department: filters.department,
      category: filters.category,
    });
  }, [incidents, filters]);

  const deferredFiltered = useDeferredValue(filteredIncidents);
  const isFilterPending = isPending || deferredFiltered !== filteredIncidents;
  // PA-07: popup tables/insights come from the same (filtered) incidents as the charts.
  const details = useMemo(() => buildChartDetails(deferredFiltered).graphs, [deferredFiltered]);
  const links = useMemo(
    () => ({
      type: chartLinks(deferredFiltered, "type"),
      station: chartLinks(deferredFiltered, "station"),
      category: chartLinks(deferredFiltered, "category"),
      status: chartLinks(deferredFiltered, "status"),
      department: chartLinks(deferredFiltered, "department"),
    }),
    [deferredFiltered],
  );

  const grouped = useMemo(() => {
    const byStation = deferredFiltered.reduce((map, inc) => {
      const key = String(inc.station);
      const group = map.get(key) ?? [];
      group.push(inc);
      map.set(key, group);
      return map;
    }, new Map<string, typeof deferredFiltered>());

    // PA-04: an incident listing several types counts in each type's bar.
    const byType = deferredFiltered.reduce((map, inc) => {
      for (const key of new Set(incidentTypesOf(inc))) {
        const group = map.get(key) ?? [];
        group.push(inc);
        map.set(key, group);
      }
      return map;
    }, new Map<string, typeof deferredFiltered>());

    return { byStation, byType };
  }, [deferredFiltered]);

  const derived = useMemo(() => {
    const stations: string[] = [...STATIONS];
    // Stations present in the sheet but not in the configured list (e.g. BLR), then Unknown last.
    const extra = [...grouped.byStation.keys()]
      .filter((s) => s !== "Unknown" && !stations.includes(s))
      .sort();
    stations.push(...extra);
    const unknownStation = grouped.byStation.get("Unknown")?.length ?? 0;
    if (unknownStation > 0) stations.push("Unknown");
    const stationTotals = stations.map(
      (s) => grouped.byStation.get(s)?.length ?? 0,
    );
    const types = [...grouped.byType.entries()]
      .map(([label, list]) => ({ label, value: list.length }))
      .sort(compareCountItems);

    const monthMap = new Map<string, { total: number; catA: number; label: string }>();
    deferredFiltered.forEach((incident) => {
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

    const timeline = deferredFiltered
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
  }, [deferredFiltered, grouped]);

  const monthOptions = ["All", ...(data.monthlyTrend ?? []).map((m) => m.monthKey)];

  // Use the global KPIs only when no filter narrows the list (previously DEL wrongly showed all-station totals).
  const showKpis = deferredFiltered.length === incidents.length;
  const catA = showKpis ? kpis.catA : deferredFiltered.filter((i) => i.category === "CAT-A").length;
  const catB = showKpis ? kpis.catB : deferredFiltered.filter((i) => i.category === "CAT-B").length;
  const catC = showKpis ? kpis.catC : deferredFiltered.filter((i) => i.category === "CAT-C").length;
  const catD = showKpis ? kpis.catD : deferredFiltered.filter((i) => i.category === "CAT-D").length;
  const open = showKpis ? kpis.open : deferredFiltered.filter((i) => i.status === "Open").length;
  const inProgress = showKpis
    ? kpis.inProgress
    : deferredFiltered.filter((i) => i.status === "In Progress").length;
  const closed = showKpis ? kpis.closed : deferredFiltered.filter((i) => i.status === "Closed").length;
  const pending = showKpis
    ? kpis.pending
    : deferredFiltered.filter((i) => i.status === "Pending").length;
  const ramp = showKpis ? kpis.ramp : deferredFiltered.filter((i) => departmentsOf(i).includes("RAMP")).length;
  const gsd = showKpis ? kpis.gsd : deferredFiltered.filter((i) => departmentsOf(i).includes("GSD")).length;
  const catNil = deferredFiltered.filter((i) => i.category === "NIL").length;
  const catNotSet = deferredFiltered.filter((i) => i.category === "Not set").length;
  const statusNotSet = deferredFiltered.filter((i) => i.status === "Not set").length;
  const catLabels = ["CAT-A", "CAT-B", "CAT-C", "CAT-D", ...(catNil ? ["NIL"] : []), ...(catNotSet ? ["Not set"] : [])];
  const catValues = [catA, catB, catC, catD, ...(catNil ? [catNil] : []), ...(catNotSet ? [catNotSet] : [])];

  const applyFilter = (partial: Partial<GraphFilters>) => {
    startTransition(() => {
      setGraphFilters(partial);
    });
  };

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
        <FilterSelect
          label="Year"
          value={filters.year}
          options={["All", ...dataYears(incidents)]}
          onChange={(year) => applyFilter({ year: year as GraphFilters["year"] })}
        />
        <FilterSelect
          label="Month"
          value={filters.month}
          options={monthOptions}
          onChange={(month) => applyFilter({ month })}
        />
        <FilterSelect
          label="Station"
          value={filters.station}
          options={["All", ...STATIONS]}
          onChange={(station) => applyFilter({ station })}
        />
        <FilterSelect
          label="Department"
          value={filters.department}
          options={["All", "RAMP", "GSD", "CARGO"]}
          onChange={(department) => applyFilter({ department })}
        />
        <FilterSelect
          label="Category"
          value={filters.category}
          options={["All", "CAT-A", "CAT-B", "CAT-C", "CAT-D"]}
          onChange={(category) => applyFilter({ category })}
        />
      </motion.div>

      <FilterContentShell
        transitionKey="graphs-charts"
        isPending={isFilterPending}
        minHeight={400}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <ExpandableChart
              title="Station Incidents"
              renderChart={() => (
                <CountChart
                  labels={derived.stations ?? []}
                  values={derived.stationTotals ?? []}
                  {...links.station}
                />
              )}
              {...details.station}
            />
          </div>
          <div>
            <ExpandableChart
              title="Category Severity"
              modalVariant="compact"
              renderChart={() => (
                <CountChart
                  labels={catLabels}
                  values={catValues}
                  type="doughnut"
                  centerText={String(deferredFiltered.length)}
                  {...links.category}
                />
              )}
              {...details.category}
            />
          </div>
          <div>
            <ExpandableChart
              title="Incident Status"
              renderChart={() => (
                <StatusBreakdownChart
                  open={open}
                  inProgress={inProgress}
                  pending={pending}
                  closed={closed}
                  notSet={statusNotSet}
                  {...links.status}
                />
              )}
              {...details.status}
            />
          </div>
          <div>
            <ExpandableChart
              title="Department Split"
              subtitle="An incident can appear in more than one bar."
              renderChart={() => (
                <CountChart
                  labels={["RAMP", "GSD"]}
                  values={[ramp, gsd]}
                  type="horizontal"
                  colors={[DEPT_COLORS.RAMP, DEPT_COLORS.GSD]}
                  {...links.department}
                />
              )}
              {...details.department}
            />
          </div>
          <div>
            <ExpandableChart
              title="Monthly Trend Area"
              renderChart={() => (
                <AreaTrendChart
                  labels={derived.months.map(([, m]) => m.label) ?? []}
                  totals={derived.months.map(([, m]) => m.total) ?? []}
                  catA={derived.months.map(([, m]) => m.catA) ?? []}
                  averageLine={Math.round(derived.avgMonthly * 10) / 10}
                />
              )}
              {...details.monthlyArea}
            />
          </div>
          <div>
            <ExpandableChart
              title="Incident Type Frequency"
              subtitle="An incident can appear in more than one bar."
              renderChart={() => (
                <RankedHorizontalBarChart
                  labels={derived.types.map((t) => t.label) ?? []}
                  values={derived.types.map((t) => t.value) ?? []}
                  colors={derived.types.map((t) => typeColor(t.label))}
                  {...links.type}
                />
              )}
              {...details.typeFrequency}
            />
          </div>
        </div>
      </FilterContentShell>

      <div className="mt-4">
        <ExpandableChart
          title="Incident Timeline"
          height={320}
          renderChart={() => (
            <IncidentTimeline
              incidents={derived.timeline ?? []}
              onSelect={(id) => {
                const incident = incidents.find((i) => i.id === id);
                if (incident) setSelectedIncident(incident);
              }}
            />
          )}
          insight="Each dot is one incident positioned by date (X) and severity category (Y). Click a dot to open the incident detail drawer."
          caption={`Timeline of all filtered incidents${dataMonthSpan(incidents) ? ` from ${dataMonthSpan(incidents)}` : ""}.`}
          columns={[
            { key: "GHR", label: "GHR" },
            { key: "Title", label: "Title" },
            { key: "Date", label: "Date" },
            { key: "Category", label: "Category" },
          ]}
          rows={(derived.timeline ?? []).slice(0, 20).map((t) => ({
            GHR: t.ghrNumber,
            Title: t.title,
            Date: t.dateLabel,
            Category: t.category,
          }))}
        />
      </div>

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
        suppressHydrationWarning
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
