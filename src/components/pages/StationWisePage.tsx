"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { AnimatedKpiCard } from "@/components/ui/AnimatedKpiCard";
import { KpiCardGrid } from "@/components/ui/KpiCardGrid";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { ExpandableChart } from "@/components/ui/ExpandableChart";
import { RiskBadge } from "@/components/ui/badges";
import { CountChart, RiskScatterChart, StackedStatusBar } from "@/components/charts/DashboardCharts";
import { FlippableCard } from "@/components/ui/FlippableCard";
import { fadeUp, scaleIn, stagger } from "@/lib/animations";
import { CHART_DETAILS } from "@/lib/chart-details";
import { calcRiskScore } from "@/lib/analytics";
import { CATEGORY_COLORS, RISK_COLORS, STATIONS } from "@/lib/constants";
import type { DashboardData, StationStats } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = keyof Pick<
  StationStats,
  "station" | "total" | "catA" | "catB" | "catC" | "catD" | "riskScore" | "closureRate" | "open" | "closed"
>;

export function StationWisePage() {
  return (
    <PageDataRequired>
      {(data) => <StationWiseContent data={data} />}
    </PageDataRequired>
  );
}

function StationWiseContent({ data }: { data: DashboardData }) {
  const kpis = data.kpis;
  const details = CHART_DETAILS.stationWise;
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [sortAsc, setSortAsc] = useState(false);

  const stationMap = useMemo(
    () => new Map(data.stations.map((s) => [s.station, s])),
    [data.stations],
  );

  const delStats = stationMap.get("DEL");
  const delRiskScore = delStats?.riskScore ?? calcRiskScore(kpis.catA, kpis.catB, kpis.catC, kpis.catD);

  const allStations = useMemo(
    () =>
      STATIONS.map((code) => {
        const stats = stationMap.get(code);
        if (stats) return stats;
        return {
          station: code,
          total: 0,
          catA: 0,
          catB: 0,
          catC: 0,
          catD: 0,
          riskScore: 0,
          riskLevel: "LOW" as const,
          closed: 0,
          open: 0,
          inProgress: 0,
          pending: 0,
          closureRate: 0,
          nearMiss: 0,
          staffInjuries: 0,
        };
      }),
    [stationMap],
  );

  const sortedStations = useMemo(() => {
    const list = [...allStations];
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return list;
  }, [allStations, sortKey, sortAsc]);

  const highestRisk = "DEL";
  const ranked = [...allStations].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Station-Wise Analysis"
          subtitle="Risk intelligence and scoring across all stations."
        />
      </motion.div>

      <KpiCardGrid className="mb-4">
        <AnimatedKpiCard index={0} label="Total Incidents Logged" value={kpis.total} tone="gold" />
        <AnimatedKpiCard index={1} label="Overall Closure Rate" value={kpis.closureRate} tone="green" suffix="%" decimals={1} />
        <AnimatedKpiCard index={2} label="Best Station (Lowest Risk)" textValue={data.bestStation} />
        <AnimatedKpiCard index={3} label="Total Open Cases" value={kpis.open} tone="red" />
        <AnimatedKpiCard index={4} label="CAT-A Critical Total" value={kpis.catA} tone="red" />
      </KpiCardGrid>

      <motion.div variants={fadeUp} custom={5} className="glass-card interactive-card mb-6 p-4 text-sm theme-text-secondary">
        <strong className="text-[var(--brand-gold)]">Risk Score</strong> = (CAT-A × 4) + (CAT-B × 3) + (CAT-C × 2) + (CAT-D × 1).
        {" "}For DEL: {delStats?.catA ?? kpis.catA}×4 + {delStats?.catB ?? kpis.catB}×3 + {delStats?.catC ?? kpis.catC}×2 + {delStats?.catD ?? kpis.catD}×1 ={" "}
        <span className="font-semibold theme-text">{delRiskScore}</span>
      </motion.div>

      <div className="station-card-grid">
        {sortedStations.map((s, i) => (
          <motion.div key={`card-${s.station}`} variants={scaleIn} custom={i} className="h-full min-w-0">
            <FlippableCard
              className="h-full"
              innerClassName={`glass-card interactive-card station-card-shell station-risk-card--${s.riskLevel} h-full w-full`}
              front={
                <div className="station-card-content">
                  <div className="station-card-header">
                    <p className="station-card-code">{s.station}</p>
                    <RiskBadge level={s.riskLevel} compact />
                  </div>
                  <div className="station-card-body">
                    <p className="station-card-score">
                      <AnimatedCounter value={s.riskScore} />
                    </p>
                    <div className="station-cat-badges">
                      {(["CAT-A", "CAT-B", "CAT-C", "CAT-D"] as const).map((cat, idx) => {
                        const counts = [s.catA, s.catB, s.catC, s.catD];
                        return (
                          <span
                            key={cat}
                            className="station-cat-badge"
                            style={{
                              backgroundColor: `${CATEGORY_COLORS[cat]}33`,
                              color: CATEGORY_COLORS[cat],
                            }}
                          >
                            {cat.split("-")[1]}:{counts[idx]}
                          </span>
                        );
                      })}
                    </div>
                    <p className="station-card-footer">
                      Closed {s.closed} · Open {s.open}
                    </p>
                  </div>
                </div>
              }
              back={
                <div className="flip-back-content">
                  {`${s.station} breakdown\nTotal: ${s.total}\nCAT-A: ${s.catA} | CAT-B: ${s.catB}\nCAT-C: ${s.catC} | CAT-D: ${s.catD}\nClosure: ${s.closureRate}%`}
                </div>
              }
            />
          </motion.div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <motion.div variants={scaleIn} custom={12}>
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
            {...details.riskScore}
          />
        </motion.div>
        <motion.div variants={scaleIn} custom={13}>
          <ExpandableChart
            title="Open vs Closed"
            renderChart={() => (
              <StackedStatusBar
                labels={allStations.map((s) => s.station)}
                open={allStations.map((s) => s.open)}
                closed={allStations.map((s) => s.closed)}
              />
            )}
            {...details.openClosed}
          />
        </motion.div>
        <motion.div variants={scaleIn} custom={14} className="lg:col-span-2">
          {/* Was: bubble (risk vs volume). Risk Score Ranking already uses horizontal bar for risk score on this page — scatter plot separates volume×risk relationship without a second bubble/bars for risk score alone. */}
          <ExpandableChart
            title="Risk vs Volume"
            renderChart={() => (
              <RiskScatterChart
                points={allStations.map((s) => ({
                  x: s.total,
                  y: s.riskScore,
                  r: Math.max(4, s.catA * 2),
                  label: s.station,
                }))}
              />
            )}
            insight={details.riskScore.insight}
            caption="Point size reflects CAT-A count. Only DEL has active incident volume."
            columns={details.riskScore.columns}
            rows={details.riskScore.rows}
          />
        </motion.div>
      </div>

      <motion.section variants={fadeUp} custom={15} className="glass-card interactive-card overflow-hidden">
        <div className="data-table-wrap overflow-auto">
          <table className="data-table w-full min-w-[960px]">
            <thead>
              <tr>
                {(
                  [
                    ["station", "Station"],
                    ["total", "Total"],
                    ["catA", "CAT-A"],
                    ["catB", "CAT-B"],
                    ["catC", "CAT-C"],
                    ["catD", "CAT-D"],
                    ["riskScore", "Risk Score"],
                    ["closed", "Closed"],
                    ["open", "Open"],
                    ["closureRate", "Closure %"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key}>
                    <button type="button" onClick={() => {
                      if (sortKey === key) setSortAsc(!sortAsc);
                      else { setSortKey(key); setSortAsc(false); }
                    }} className="theme-text hover:text-[var(--brand-gold)]">
                      {label}
                    </button>
                  </th>
                ))}
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {sortedStations.map((s) => (
                <tr key={`row-${s.station}`} className={cn(s.station === highestRisk && s.total > 0 && "bg-red-500/10")}>
                  <td className="font-semibold">{s.station}</td>
                  <td>{s.total}</td>
                  <td>{s.catA}</td>
                  <td>{s.catB}</td>
                  <td>{s.catC}</td>
                  <td>{s.catD}</td>
                  <td>{s.riskScore}</td>
                  <td>{s.closed}</td>
                  <td>{s.open}</td>
                  <td>{s.closureRate}%</td>
                  <td><RiskBadge level={s.riskLevel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>
    </motion.div>
  );
}
