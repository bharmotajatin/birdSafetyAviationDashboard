"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { AnimatedKpiCard } from "@/components/ui/AnimatedKpiCard";
import { KpiCardGrid } from "@/components/ui/KpiCardGrid";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { ExpandableChart } from "@/components/ui/ExpandableChart";
import { CountChart, RiskScatterChart, StackedStatusBar } from "@/components/charts/DashboardCharts";
import { fadeUp, stagger } from "@/lib/animations";
import { buildChartDetails } from "@/lib/chart-details";
import { chartLinks, incidentLogHref } from "@/lib/incident-links";
import {
  buildStationSummaries,
  CATEGORY_BAR,
  compareStations,
  STATION_STATUS_COLORS,
  STATION_STATUS_LEVEL,
  STATION_STATUS_RULE,
  type StationStatus,
  type StationSummary,
} from "@/lib/station-summary";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "rank" | "station" | "total" | "serious" | "notClosed" | "closed" | "closureRate";

export function StationWisePage() {
  return (
    <PageDataRequired>
      {(data) => <StationWiseContent data={data} />}
    </PageDataRequired>
  );
}

function StatusLabel({ status }: { status: StationStatus }) {
  const color = STATION_STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {status}
    </span>
  );
}

/** PA-08: one thin stacked bar per card (A, B, C, D, NIL, Not set) with hover counts. */
function CategoryStackBar({ summary }: { summary: StationSummary }) {
  return (
    <div className="mt-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-500/15">
        {CATEGORY_BAR.map(({ key, color }) => {
          const n = summary.categories[key] ?? 0;
          if (!n) return null;
          return (
            <span
              key={key}
              title={`${key}: ${n}`}
              style={{ width: `${(n / summary.total) * 100}%`, backgroundColor: color }}
            />
          );
        })}
      </div>
      <p className="mt-1 text-[10px] theme-text-muted">
        {CATEGORY_BAR.filter(({ key }) => summary.categories[key])
          .map(({ key }) => `${key.replace("CAT-", "")} ${summary.categories[key]}`)
          .join(" · ")}
      </p>
    </div>
  );
}

function StationWiseContent({ data }: { data: DashboardData }) {
  const kpis = data.kpis;
  const incidents = useMemo(() => data.incidents ?? [], [data.incidents]);
  const details = useMemo(() => buildChartDetails(incidents).stationWise, [incidents]);
  const summaries = useMemo(() => buildStationSummaries(incidents), [incidents]);
  const stationLinks = useMemo(() => chartLinks(incidents, "station"), [incidents]);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(false);

  const notClosedTotal = summaries.reduce((sum, s) => sum + s.notClosed, 0);
  const needingAttention = summaries.filter((s) => s.status === "Needs attention");

  const sortedRows = useMemo(() => {
    const list = [...summaries];
    if (sortKey === "rank") return sortAsc ? list.reverse() : list;
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const diff =
        typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return (sortAsc ? diff : -diff) || compareStations(a, b);
    });
    return list;
  }, [summaries, sortKey, sortAsc]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Station-Wise Analysis"
          subtitle="Which stations need attention, based on serious and not-closed incidents."
        />
      </motion.div>

      <KpiCardGrid className="mb-4">
        <AnimatedKpiCard index={0} label="Total Incidents Logged" value={kpis.total} tone="gold" />
        <AnimatedKpiCard index={1} label="Overall Closure Rate" value={kpis.closureRate} tone="green" suffix="%" decimals={1} />
        <a href="#station-cards" className="block" aria-label="Scroll to stations needing attention">
          <AnimatedKpiCard index={2} label="Stations needing attention" value={needingAttention.length} tone="red" />
        </a>
        <AnimatedKpiCard index={3} label="Not closed" value={notClosedTotal} tone="red" />
        <AnimatedKpiCard index={4} label="CAT-A Critical Total" value={kpis.catA} tone="red" />
      </KpiCardGrid>

      <motion.p variants={fadeUp} custom={5} className="glass-card mb-4 px-4 py-2 text-xs theme-text-secondary">
        {STATION_STATUS_RULE}
      </motion.p>

      <div id="station-cards" className="station-card-grid scroll-mt-24">
        {summaries.map((s) => (
          <Link
            key={`card-${s.station}`}
            href={incidentLogHref({ station: s.station })}
            className="block h-full min-w-0"
            title={`View ${s.total} ${s.station} incidents in Incident Log`}
          >
            <div
              className={cn(
                "glass-card interactive-card station-card-shell h-full w-full",
                `station-risk-card--${STATION_STATUS_LEVEL[s.status]}`,
              )}
            >
              <div className="station-card-content">
                <div className="station-card-header">
                  <p className="station-card-code">{s.station}</p>
                  <StatusLabel status={s.status} />
                </div>
                <div className="station-card-body">
                  <p className="station-card-score">
                    <AnimatedCounter value={s.total} />
                  </p>
                  <p className="station-card-footer">
                    Serious {s.serious} · Not closed {s.notClosed} · Closed {s.closed}
                  </p>
                  <CategoryStackBar summary={s} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mb-6 mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <ExpandableChart
            title="Serious Incidents by Station"
            subtitle="Serious = CAT-A + CAT-B"
            renderChart={() => (
              <CountChart
                labels={summaries.map((s) => s.station)}
                values={summaries.map((s) => s.serious)}
                type="horizontal"
                colors={summaries.map((s) => STATION_STATUS_COLORS[s.status])}
                {...stationLinks}
              />
            )}
            {...details.stations}
          />
        </div>
        <div>
          <ExpandableChart
            title="Not closed vs Closed"
            renderChart={() => (
              <StackedStatusBar
                labels={summaries.map((s) => s.station)}
                open={summaries.map((s) => s.notClosed)}
                closed={summaries.map((s) => s.closed)}
                openLabel="Not closed"
              />
            )}
            {...details.openClosed}
          />
        </div>
        <div className="lg:col-span-2">
          <ExpandableChart
            title="Serious vs Volume"
            renderChart={() => (
              <RiskScatterChart
                points={summaries.map((s) => ({
                  x: s.total,
                  y: s.serious,
                  r: Math.max(4, s.notClosed * 2),
                  label: s.station,
                }))}
              />
            )}
            insight={details.stations.insight}
            caption="X = incidents, Y = serious (CAT-A + CAT-B). Point size reflects not-closed count."
            columns={details.stations.columns}
            rows={details.stations.rows}
          />
        </div>
      </div>

      <motion.section variants={fadeUp} custom={15} className="glass-card interactive-card overflow-hidden">
        <div className="data-table-wrap overflow-auto">
          <table className="data-table w-full min-w-[760px]">
            <thead>
              <tr>
                {(
                  [
                    ["rank", "Priority"],
                    ["station", "Station"],
                    ["total", "Incidents"],
                    ["serious", "Serious"],
                    ["notClosed", "Not closed"],
                    ["closed", "Closed"],
                    ["closureRate", "Closure %"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        if (sortKey === key) setSortAsc(!sortAsc);
                        else {
                          setSortKey(key);
                          setSortAsc(false);
                        }
                      }}
                      className="theme-text hover:text-[var(--brand-gold)]"
                    >
                      {label}
                    </button>
                  </th>
                ))}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((s) => (
                <tr
                  key={`row-${s.station}`}
                  className={cn(s.status === "Needs attention" && "bg-red-500/10")}
                >
                  <td>{summaries.indexOf(s) + 1}</td>
                  <td className="font-semibold">
                    <Link href={incidentLogHref({ station: s.station })} className="hover:underline">
                      {s.station}
                    </Link>
                  </td>
                  <td>{s.total}</td>
                  <td>{s.serious}</td>
                  <td>{s.notClosed}</td>
                  <td>{s.closed}</td>
                  <td>{s.closureRate}%</td>
                  <td>
                    <StatusLabel status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>
    </motion.div>
  );
}