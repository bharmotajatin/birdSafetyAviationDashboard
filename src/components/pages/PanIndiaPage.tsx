// Filter-blank fix applied — see git commit fix/filter-blank-pages.
"use client";

import { Suspense, useCallback, useMemo, useTransition } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { LoadingSkeleton, PageHeader } from "@/components/ui/dashboard-primitives";
import { AnimatedKpiCard } from "@/components/ui/AnimatedKpiCard";
import { KpiCardGrid } from "@/components/ui/KpiCardGrid";
import { ExpandableChart } from "@/components/ui/ExpandableChart";
import { FilterContentShell } from "@/components/ui/FilterContentShell";
import { RiskBadge } from "@/components/ui/badges";
import { CountChart, GroupedBarChart } from "@/components/charts/DashboardCharts";
import { fadeUp, stagger } from "@/lib/animations";
import { CHART_DETAILS } from "@/lib/chart-details";
import { resolveStationStats } from "@/lib/empty-dashboard";
import { normalizeIncidentType } from "@/lib/parse/utils";
import { CATEGORY_COLORS, RISK_COLORS, STATIONS } from "@/lib/constants";
import type { DashboardData, StationStats } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATION_CODES = [...STATIONS] as string[];

function isValidStation(code: string | null): code is string {
  return code !== null && STATION_CODES.includes(code);
}

function hexWithOpacity(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function barColorsForStations(
  labels: string[],
  baseColor: string,
  selectedStation: string,
): string[] {
  return labels.map((s) =>
    s === selectedStation ? baseColor : hexWithOpacity(baseColor, 0.35),
  );
}

function formatCellValue(total: number, value: number): string {
  return total === 0 ? "—" : String(value);
}

export function PanIndiaPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <PageDataRequired>
        {(data) => <PanIndiaContent data={data} />}
      </PageDataRequired>
    </Suspense>
  );
}

function PanIndiaContent({ data }: { data: DashboardData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedStation = useMemo(() => {
    const fromUrl = searchParams.get("station");
    return isValidStation(fromUrl) ? fromUrl : "DEL";
  }, [searchParams]);
  const [isPending, startTransition] = useTransition();

  const labels = STATION_CODES;
  const stationMap = useMemo(
    () => new Map((data.stations ?? []).map((s) => [s.station, s])),
    [data.stations],
  );
  const details = CHART_DETAILS.panIndia;

  const stationData = useMemo(
    () => resolveStationStats(data.stations ?? [], selectedStation),
    [data.stations, selectedStation],
  );
  const hasData = (stationData?.total ?? 0) > 0;

  const selectStation = useCallback(
    (station: string) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("station", station);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const pageSubtitle = hasData
    ? "Side-by-side comparison of all 11 Indian airport stations."
    : `${selectedStation} — No incident data recorded in this period`;

  const selectedKpis = {
    total: stationData.total ?? 0,
    catA: stationData.catA ?? 0,
    catB: stationData.catB ?? 0,
    closureRate: stationData.closureRate ?? 0,
    nearMiss: stationData.nearMiss ?? 0,
    staffInjuries: stationData.staffInjuries ?? 0,
  };

  const selectedIncidents = useMemo(
    () => (data.incidents ?? []).filter((i) => i.station === selectedStation),
    [data.incidents, selectedStation],
  );

  const typeLabels = useMemo(
    () => [...new Set(selectedIncidents.map((i) => normalizeIncidentType(i.incidentType)))],
    [selectedIncidents],
  );
  const typeValues = useMemo(
    () =>
      typeLabels.map(
        (t) =>
          selectedIncidents.filter((i) => normalizeIncidentType(i.incidentType) === t).length,
      ),
    [selectedIncidents, typeLabels],
  );
  const hasTypeBreakdown = typeValues.some((v) => v > 0);

  const ranked = useMemo(
    () => [...(data.stations ?? [])].sort((a, b) => b.riskScore - a.riskScore),
    [data.stations],
  );

  const groupedSeries = useMemo(
    () => [
      {
        label: "CAT-A",
        data: labels.map((s) => stationMap.get(s)?.catA ?? 0),
        color: CATEGORY_COLORS["CAT-A"],
        barColors: barColorsForStations(labels, CATEGORY_COLORS["CAT-A"], selectedStation),
      },
      {
        label: "CAT-B",
        data: labels.map((s) => stationMap.get(s)?.catB ?? 0),
        color: CATEGORY_COLORS["CAT-B"],
        barColors: barColorsForStations(labels, CATEGORY_COLORS["CAT-B"], selectedStation),
      },
      {
        label: "CAT-C",
        data: labels.map((s) => stationMap.get(s)?.catC ?? 0),
        color: CATEGORY_COLORS["CAT-C"],
        barColors: barColorsForStations(labels, CATEGORY_COLORS["CAT-C"], selectedStation),
      },
      {
        label: "CAT-D",
        data: labels.map((s) => stationMap.get(s)?.catD ?? 0),
        color: CATEGORY_COLORS["CAT-D"],
        barColors: barColorsForStations(labels, CATEGORY_COLORS["CAT-D"], selectedStation),
      },
    ],
    [labels, selectedStation, stationMap],
  );

  const closureColors = useMemo(
    () =>
      labels.map((s) => {
        const rate = stationMap.get(s)?.closureRate ?? 0;
        const base = rate > 0 ? "#22c55e" : "#64748b";
        return s === selectedStation ? base : hexWithOpacity(base, 0.35);
      }),
    [labels, selectedStation, stationMap],
  );

  const pillTooltip = (code: string, stats: StationStats | undefined) => {
    const total = stats?.total ?? 0;
    if (total === 0) return "No incidents recorded";
    return `${total} incidents · Risk ${stats?.riskLevel ?? "LOW"}`;
  };

  const contentKey = `${selectedStation}-${hasData ? "data" : "empty"}`;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Pan India Stations"
          subtitle={pageSubtitle}
          subtitleClassName={hasData ? "mt-1 text-sm theme-text-muted" : "mt-1 text-sm text-[#94a3b8]"}
        />
      </motion.div>

      <motion.div variants={stagger} className="mb-6 flex flex-wrap gap-2">
        {labels.map((code, i) => {
          const stats = stationMap.get(code);
          const total = stats?.total ?? 0;
          const hasStationData = total > 0;
          const isSelected = selectedStation === code;
          return (
            <motion.button
              key={code}
              type="button"
              variants={fadeUp}
              custom={i}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              title={pillTooltip(code, stats)}
              onClick={() => selectStation(code)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                isSelected
                  ? "border-[var(--brand-navy)] bg-[var(--brand-navy)] text-[var(--brand-gold)]"
                  : hasStationData
                    ? "border-[var(--brand-navy)]/30 theme-text hover:border-[var(--brand-gold)] hover:bg-[var(--tab-hover-bg)]"
                    : "border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8] hover:border-[#cbd5e1]",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  isSelected || hasStationData ? "bg-[#d4af37]" : "bg-[#94a3b8]",
                )}
                aria-hidden
              />
              {code}
            </motion.button>
          );
        })}
      </motion.div>

      <FilterContentShell transitionKey={contentKey} isPending={isPending} minHeight={hasData ? 400 : 320}>
        {!hasData ? (
          <div className="mb-6 flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
            <MapPin size={48} style={{ color: "rgba(26,42,94,0.2)" }} aria-hidden />
            <p
              className="text-[2rem] font-bold leading-none"
              style={{ color: "rgba(26,42,94,0.3)" }}
            >
              {selectedStation}
            </p>
            <p className="max-w-[320px] text-sm text-[#64748b]">
              No incidents recorded for {selectedStation} in this reporting period
            </p>
            <p className="max-w-[320px] text-xs text-[#94a3b8]">
              All 11 stations are monitored — data appears here when incidents are logged and
              uploaded
            </p>
            <button
              type="button"
              onClick={() => selectStation("DEL")}
              className="mt-1 rounded-lg border border-[#d4af37] px-4 py-2 text-sm font-semibold text-[#1a2a5e] transition hover:bg-[#d4af37]/10 dark:text-[#d4af37]"
            >
              View DEL Station →
            </button>
          </div>
        ) : (
          <>
            <PanIndiaKpiSection hasData={hasData} selectedKpis={selectedKpis} />

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <div>
                <ExpandableChart
                  title="Station Comparison"
                  subtitle="All stations shown — selected station highlighted"
                  renderChart={() => (
                    <GroupedBarChart labels={labels} series={groupedSeries} />
                  )}
                  {...details.stationCompare}
                />
              </div>
              <div>
                <ExpandableChart
                  title="Risk Score Ranking"
                  renderChart={() => (
                    <CountChart
                      labels={ranked.map((s) => s.station) ?? []}
                      values={ranked.map((s) => s.riskScore) ?? []}
                      type="horizontal"
                      colors={ranked.map((s) => RISK_COLORS[s.riskLevel]) ?? []}
                    />
                  )}
                  {...details.riskRanking}
                />
              </div>
              <div>
                <ExpandableChart
                  title="Closure Rate Comparison"
                  subtitle={`All stations shown — ${selectedStation} highlighted`}
                  renderChart={() => (
                    <CountChart
                      labels={labels}
                      values={labels.map((s) => stationMap.get(s)?.closureRate ?? 0)}
                      type="bar"
                      yMax={100}
                      colors={closureColors}
                    />
                  )}
                  insight={`${selectedStation} closure rate is ${stationData.closureRate}% (${stationData.closed} closed of ${stationData.total}). Compare all stations below.`}
                  caption="Closure rate % per station based on closed ÷ total incidents."
                  columns={[
                    { key: "Station", label: "Station" },
                    { key: "Closure %", label: "Closure %", align: "right" },
                  ]}
                  rows={labels.map((s) => {
                    const st = stationMap.get(s);
                    const total = st?.total ?? 0;
                    return {
                      Station: s,
                      "Closure %": total > 0 ? `${st?.closureRate ?? 0}%` : "—",
                    };
                  })}
                />
              </div>
              <div>
                <ExpandableChart
                  title={`Incident Types — ${selectedStation}`}
                  previewHeight={260}
                  modalVariant="compact"
                  renderChart={() =>
                    hasTypeBreakdown ? (
                      <CountChart
                        labels={typeLabels ?? []}
                        values={typeValues ?? []}
                        type="pie"
                        legendVariant="wrap"
                      />
                    ) : (
                      <div className="flex h-[80px] items-center justify-center text-[13px] text-[#94a3b8]">
                        No incident type breakdown available
                      </div>
                    )
                  }
                  {...CHART_DETAILS.incidentLog.byType}
                />
              </div>
            </div>
          </>
        )}
      </FilterContentShell>

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
                const total = s?.total ?? 0;
                const isZeroRow = total === 0;
                const isSelectedRow = code === selectedStation;
                return (
                  <tr
                    key={code}
                    className={cn(
                      isSelectedRow && "bg-[rgba(212,175,55,0.06)]",
                      isZeroRow && "opacity-45 italic",
                    )}
                    style={
                      isSelectedRow
                        ? { borderLeft: "3px solid #d4af37" }
                        : undefined
                    }
                  >
                    <td className="font-semibold theme-text">{code}</td>
                    <td>{formatCellValue(total, total)}</td>
                    <td>{formatCellValue(total, s?.catA ?? 0)}</td>
                    <td>{formatCellValue(total, s?.catB ?? 0)}</td>
                    <td>{formatCellValue(total, s?.catC ?? 0)}</td>
                    <td>{formatCellValue(total, s?.catD ?? 0)}</td>
                    <td>{formatCellValue(total, s?.riskScore ?? 0)}</td>
                    <td>
                      {isZeroRow ? (
                        <span className="text-[#94a3b8]">No data</span>
                      ) : (
                        <RiskBadge level={s?.riskLevel ?? "LOW"} />
                      )}
                    </td>
                    <td>{formatCellValue(total, s?.closed ?? 0)}</td>
                    <td>{formatCellValue(total, s?.open ?? 0)}</td>
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

function PanIndiaKpiSection({
  hasData,
  selectedKpis,
}: {
  hasData: boolean;
  selectedKpis: {
    total: number;
    catA: number;
    catB: number;
    closureRate: number;
    nearMiss: number;
    staffInjuries: number;
  };
}) {
  if (!hasData) return null;

  return (
    <KpiCardGrid columns={6} className="mb-6">
      <AnimatedKpiCard index={0} label="Total Incidents" value={selectedKpis.total} tone="gold" />
      <AnimatedKpiCard index={1} label="CAT-A Critical" value={selectedKpis.catA} tone="red" />
      <AnimatedKpiCard index={2} label="CAT-B High" value={selectedKpis.catB} tone="amber" />
      <AnimatedKpiCard
        index={3}
        label="Closure Rate"
        value={selectedKpis.closureRate}
        tone="green"
        suffix="%"
        decimals={1}
      />
      <AnimatedKpiCard index={4} label="Near Miss" value={selectedKpis.nearMiss} />
      <AnimatedKpiCard index={5} label="Staff Injuries" value={selectedKpis.staffInjuries} />
    </KpiCardGrid>
  );
}
