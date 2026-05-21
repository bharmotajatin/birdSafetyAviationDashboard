"use client";

import { motion } from "framer-motion";
import { Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { IncidentDetailDrawer } from "@/components/dashboard/IncidentDetailDrawer";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { AnimatedKpiCard } from "@/components/ui/AnimatedKpiCard";
import { KpiCardGrid } from "@/components/ui/KpiCardGrid";
import { ExpandableChart } from "@/components/ui/ExpandableChart";
import { CategoryBadge, DeptPill, StatusDot } from "@/components/ui/badges";
import { CountChart, StatusBreakdownChart } from "@/components/charts/DashboardCharts";
import { fadeUp, stagger } from "@/lib/animations";
import { CHART_DETAILS } from "@/lib/chart-details";
import { filterIncidents } from "@/lib/analytics";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import type { DashboardData } from "@/lib/types";

export function IncidentLogPage() {
  return (
    <PageDataRequired>
      {(data) => <IncidentLogContent data={data} />}
    </PageDataRequired>
  );
}

function IncidentLogContent({ data }: { data: DashboardData }) {
  const setSelectedIncident = useDashboardStore((s) => s.setSelectedIncident);
  const selectedIncident = useDashboardStore((s) => s.selectedIncident);
  const kpis = data.kpis;

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(
    () =>
      filterIncidents(data.incidents, {
        search,
        department,
        category,
        status,
        dateFrom,
        dateTo,
      }),
    [data.incidents, search, department, category, status, dateFrom, dateTo],
  );

  const typeLabels = data.incidentTypes.map((i) => i.label);
  const typeValues = data.incidentTypes.map((i) => i.value);
  const details = CHART_DETAILS.incidentLog;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Incident Log"
          subtitle="Complete log of all safety incidents with search, filters, and detailed views."
        />
      </motion.div>

      <KpiCardGrid>
        <AnimatedKpiCard index={0} label="Total Incidents" value={kpis.total} tone="gold" />
        <AnimatedKpiCard index={1} label="Open" value={kpis.open} tone="red" />
        <AnimatedKpiCard index={2} label="In Progress" value={kpis.inProgress} tone="amber" />
        <AnimatedKpiCard index={3} label="Closed" value={kpis.closed} tone="green" />
        <AnimatedKpiCard index={4} label="Pending" value={kpis.pending} tone="purple" />
      </KpiCardGrid>

      <motion.div variants={fadeUp} custom={5} className="glass-card interactive-card mb-6 grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or GHR…"
          className="theme-input rounded-md px-3 py-2 text-sm"
        />
        <FilterSelect value={department} onChange={setDepartment} options={["All", "RAMP", "GSD", "CARGO"]} />
        <FilterSelect value={category} onChange={setCategory} options={["All", "CAT-A", "CAT-B", "CAT-C", "CAT-D"]} />
        <FilterSelect value={status} onChange={setStatus} options={["All", "Open", "In Progress", "Closed", "Pending"]} />
        <div className="flex gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="theme-input w-full rounded-md px-2 py-2 text-xs" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="theme-input w-full rounded-md px-2 py-2 text-xs" />
        </div>
      </motion.div>

      <motion.section variants={fadeUp} custom={6} className="glass-card interactive-card mb-6 overflow-hidden">
        <div className="data-table-wrap max-h-[520px] overflow-auto">
          <table className="data-table incident-log-table w-full">
            <colgroup>
              <col style={{ width: "4%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "4%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Incident</th>
                <th>Date</th>
                <th>Category</th>
                <th>Type</th>
                <th>Department</th>
                <th>Status</th>
                <th>Station</th>
                <th className="sr-only">View</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((incident, index) => (
                <tr
                  key={`incident-row-${index}`}
                  className="cursor-pointer"
                  onClick={() => setSelectedIncident(incident)}
                >
                  <td className="tabular-nums">{incident.serialNo}</td>
                  <td>
                    <div className="incident-log-cell-stack">
                      <p className="font-medium leading-snug theme-text">{incident.title}</p>
                      <p className="text-xs leading-snug theme-text-muted">{incident.ghrNumber}</p>
                    </div>
                  </td>
                  <td className="whitespace-nowrap">{incident.dateLabel}</td>
                  <td><CategoryBadge category={incident.category} /></td>
                  <td className="incident-log-type">{incident.incidentType}</td>
                  <td><DeptPill department={incident.department} /></td>
                  <td><StatusDot status={incident.status} /></td>
                  <td>{incident.station}</td>
                  <td className="text-center">
                    <Eye className="mx-auto h-4 w-4 text-[#d4af37]" aria-hidden />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t theme-border px-4 py-2 text-xs theme-text-muted">
          Showing {filtered.length} of {data.incidents.length} incidents
        </p>
      </motion.section>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div variants={fadeUp} custom={7}>
          <ExpandableChart
            title="Incidents by Type"
            renderChart={() => <CountChart labels={typeLabels} values={typeValues} type="horizontal" />}
            {...details.byType}
          />
        </motion.div>
        <motion.div variants={fadeUp} custom={8}>
          <ExpandableChart
            title="Category Split"
            renderChart={() => (
              <CountChart
                labels={["CAT-A", "CAT-B", "CAT-C", "CAT-D"]}
                values={[kpis.catA, kpis.catB, kpis.catC, kpis.catD]}
                type="doughnut"
                centerText={String(kpis.total)}
              />
            )}
            {...details.category}
          />
        </motion.div>
        <motion.div variants={fadeUp} custom={9}>
          <ExpandableChart
            title="Status Breakdown"
            renderChart={() => (
              <StatusBreakdownChart
                open={kpis.open}
                inProgress={kpis.inProgress}
                pending={kpis.pending}
                closed={kpis.closed}
              />
            )}
            {...details.status}
          />
        </motion.div>
      </div>

      <IncidentDetailDrawer incident={selectedIncident} onClose={() => setSelectedIncident(null)} />
    </motion.div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="theme-input rounded-md px-3 py-2 text-sm"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
