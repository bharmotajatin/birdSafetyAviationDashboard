// Filter-blank fix applied — see git commit fix/filter-blank-pages.
"use client";

import { motion } from "framer-motion";
import { Eye } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { ghrRowId } from "@/lib/injury-cluster-modal";
import { IncidentDetailDrawer } from "@/components/dashboard/IncidentDetailDrawer";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { AnimatedKpiCard } from "@/components/ui/AnimatedKpiCard";
import { KpiCardGrid } from "@/components/ui/KpiCardGrid";
import { ExpandableChart } from "@/components/ui/ExpandableChart";
import { FilterContentShell } from "@/components/ui/FilterContentShell";
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
  const searchParams = useSearchParams();
  const highlightGHR = searchParams.get("highlight");
  const setSelectedIncident = useDashboardStore((s) => s.setSelectedIncident);
  const selectedIncident = useDashboardStore((s) => s.selectedIncident);
  const botFilter = useDashboardStore((s) => s.botIncidentFilters);
  const clearBotFilter = useDashboardStore((s) => s.clearBotFilter);
  const kpis = data.kpis;
  const [isPending, startTransition] = useTransition();
  const [blinkingGHR, setBlinkingGHR] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput);
  const [department, setDepartment] = useState("All");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [station, setStation] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const incidents = useMemo(() => data.incidents ?? [], [data.incidents]);

  const displayedIncidents = useMemo(() => {
    if (!incidents.length) return [];
    return filterIncidents(incidents, {
      search: deferredSearch,
      department,
      category,
      status,
      station,
      dateFrom,
      dateTo,
    });
  }, [incidents, deferredSearch, department, category, status, station, dateFrom, dateTo]);

  const typeLabels = (data.incidentTypes ?? []).map((i) => i.label) ?? [];
  const typeValues = (data.incidentTypes ?? []).map((i) => i.value) ?? [];
  const details = CHART_DETAILS.incidentLog;

  const updateFilter = (fn: () => void) => {
    startTransition(fn);
  };

  useEffect(() => {
    if (!botFilter) return;
    startTransition(() => {
      if (botFilter.category) setCategory(botFilter.category);
      if (botFilter.status) setStatus(botFilter.status);
      if (botFilter.department) setDepartment(botFilter.department);
      if (botFilter.station) setStation(botFilter.station);
      if (botFilter.search) setSearchInput(botFilter.search);
    });
    clearBotFilter();
  }, [botFilter, clearBotFilter]);

  useEffect(() => {
    if (!highlightGHR) return;

    setBlinkingGHR(highlightGHR);
    setSearchInput(highlightGHR);

    const scrollTimer = window.setTimeout(() => {
      const row = document.getElementById(ghrRowId(highlightGHR));
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);

    const blinkTimer = window.setTimeout(() => setBlinkingGHR(null), 4000);
    const searchTimer = window.setTimeout(() => setSearchInput(""), 5000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(blinkTimer);
      window.clearTimeout(searchTimer);
    };
  }, [highlightGHR]);

  const isHighlightedRow = useCallback(
    (ghrNumber: string) => highlightGHR != null && highlightGHR === String(ghrNumber),
    [highlightGHR],
  );

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      <style>{`
        @keyframes ghrBlink {
          0%   { background: #FFF9E6; }
          25%  { background: #FFD700; }
          50%  { background: #FFF9E6; }
          75%  { background: #FFD700; }
          100% { background: #FFFBF0; }
        }

        .ghr-highlight-blink {
          animation: ghrBlink 0.6s ease 3;
          background: #FFFBF0 !important;
          border-left: 4px solid #D4A017 !important;
          position: relative;
        }

        .ghr-highlight-blink::before {
          content: '← Viewing this incident';
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: #D4A017;
          color: #fff;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          z-index: 2;
        }
      `}</style>
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Incident Log"
          subtitle="Complete log of all safety incidents with search, filters, and detailed views."
        />
      </motion.div>

      <KpiCardGrid>
        <AnimatedKpiCard index={0} label="Total Incidents" value={kpis.total ?? 0} tone="gold" />
        <AnimatedKpiCard index={1} label="Open" value={kpis.open ?? 0} tone="red" />
        <AnimatedKpiCard index={2} label="In Progress" value={kpis.inProgress ?? 0} tone="amber" />
        <AnimatedKpiCard index={3} label="Closed" value={kpis.closed ?? 0} tone="green" />
        <AnimatedKpiCard index={4} label="Pending" value={kpis.pending ?? 0} tone="purple" />
      </KpiCardGrid>

      <motion.div
        variants={fadeUp}
        custom={5}
        className="glass-card interactive-card incident-log-filters mb-6 overflow-hidden p-4"
      >
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title or GHR…"
            className="theme-input min-w-0 rounded-md px-3 py-2 text-sm sm:col-span-2 lg:col-span-4 xl:col-span-2"
          />
          <FilterSelect
            value={department}
            onChange={(v) => updateFilter(() => setDepartment(v))}
            options={["All", "RAMP", "GSD", "CARGO"]}
          />
          <FilterSelect
            value={category}
            onChange={(v) => updateFilter(() => setCategory(v))}
            options={["All", "CAT-A", "CAT-B", "CAT-C", "CAT-D"]}
          />
          <FilterSelect
            value={status}
            onChange={(v) => updateFilter(() => setStatus(v))}
            options={["All", "Open", "In Progress", "Closed", "Pending"]}
          />
          <div className="flex min-w-0 gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => updateFilter(() => setDateFrom(e.target.value))}
              aria-label="From date"
              className="theme-input incident-log-date-input min-w-0 flex-1 rounded-md px-2 py-2 text-xs"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => updateFilter(() => setDateTo(e.target.value))}
              aria-label="To date"
              className="theme-input incident-log-date-input min-w-0 flex-1 rounded-md px-2 py-2 text-xs"
            />
          </div>
        </div>
      </motion.div>

      <FilterContentShell
        transitionKey="incident-log-table"
        isPending={isPending}
        minHeight={320}
      >
        <motion.section className="glass-card interactive-card mb-6 overflow-hidden">
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
                {displayedIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-sm text-[#94a3b8]">
                      No incidents match your filters
                    </td>
                  </tr>
                ) : (
                  displayedIncidents.map((incident, index) => {
                    const highlighted = isHighlightedRow(incident.ghrNumber);
                    const blinking = blinkingGHR != null && blinkingGHR === String(incident.ghrNumber);
                    return (
                    <tr
                      key={`incident-row-${incident.id}-${index}`}
                      id={ghrRowId(incident.ghrNumber)}
                      className={`cursor-pointer ${blinking ? "ghr-highlight-blink" : ""}`}
                      style={{
                        background: highlighted && !blinking ? "#FFFBF0" : undefined,
                        borderLeft: highlighted ? "4px solid #D4A017" : "4px solid transparent",
                        transition: "all 0.3s ease",
                      }}
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
                      <td>
                        <CategoryBadge category={incident.category} />
                      </td>
                      <td className="incident-log-type">{incident.incidentType}</td>
                      <td>
                        <DeptPill department={incident.department} />
                      </td>
                      <td>
                        <StatusDot status={incident.status} />
                      </td>
                      <td>{incident.station}</td>
                      <td className="text-center">
                        <Eye className="mx-auto h-4 w-4 text-[#d4af37]" aria-hidden />
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t theme-border px-4 py-2 text-xs theme-text-muted">
            Showing {displayedIncidents.length} of {incidents.length} incidents
          </p>
        </motion.section>
      </FilterContentShell>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <ExpandableChart
            title="Incidents by Type"
            renderChart={() => (
              <CountChart labels={typeLabels} values={typeValues} type="horizontal" />
            )}
            {...details.byType}
          />
        </div>
        <div>
          <ExpandableChart
            title="Category Split"
            height={360}
            previewHeight={240}
            maxModalChartHeight={300}
            modalVariant="compact"
            renderChart={() => (
              <CountChart
                labels={["CAT-A", "CAT-B", "CAT-C", "CAT-D"]}
                values={[kpis.catA ?? 0, kpis.catB ?? 0, kpis.catC ?? 0, kpis.catD ?? 0]}
                type="doughnut"
                centerText={String(kpis.total ?? 0)}
              />
            )}
            {...details.category}
          />
        </div>
        <div>
          <ExpandableChart
            title="Status Breakdown"
            renderChart={() => (
              <StatusBreakdownChart
                open={kpis.open ?? 0}
                inProgress={kpis.inProgress ?? 0}
                pending={kpis.pending ?? 0}
                closed={kpis.closed ?? 0}
              />
            )}
            {...details.status}
          />
        </div>
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
      className="theme-input min-w-0 w-full rounded-md px-3 py-2 text-sm"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
