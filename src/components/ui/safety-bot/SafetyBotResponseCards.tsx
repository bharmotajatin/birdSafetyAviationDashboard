"use client";

import type { BotAnswerRow } from "@/lib/safety-bot/types";
import { getCategoryStyle, getStatusDotColor } from "@/lib/safety-bot/categoryStyles";
import {
  extractRiskScore,
  parseBulletLines,
  type ResponseType,
} from "@/lib/safety-bot/detectResponseType";
import type { DashboardData, Incident } from "@/lib/types";

type Props = {
  type: ResponseType;
  summary: string;
  rows: BotAnswerRow[];
  data: DashboardData;
  matchedIncidents: Incident[];
  onIncidentClick?: (incident: Incident) => void;
};

function DefaultCard({ rows }: { rows: BotAnswerRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="safety-bot-answer-card rounded-lg border border-[#d4af37]/60">
      <p className="safety-bot-answer-card-headline">Key metrics</p>
      <table className="w-full">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="safety-bot-muted pr-2">{row.label}</td>
              <td
                className={`text-right font-semibold ${
                  row.highlight ? "text-[#d4af37]" : "safety-bot-text"
                }`}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskGaugeCard({ summary, rows }: { summary: string; rows: BotAnswerRow[] }) {
  const score = Math.min(250, extractRiskScore(summary, rows));
  const pct = (score / 250) * 100;
  return (
    <div className="safety-bot-answer-card space-y-2 rounded-lg border border-[#d4af37]/60">
      <p className="safety-bot-answer-card-headline">Risk score</p>
      <div className="safety-bot-risk-gauge">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/30"
          style={{ width: "20%" }}
        />
        <div
          className="absolute inset-y-0 rounded-full bg-amber-500/30"
          style={{ left: "20%", width: "20%" }}
        />
        <div
          className="absolute inset-y-0 rounded-full bg-red-500/30"
          style={{ left: "40%", width: "60%" }}
        />
        <div
          className="absolute top-0 bottom-0 w-1.5 rounded-full bg-[#d4af37] shadow-[0_0_6px_#d4af37]"
          style={{ left: `clamp(0px, calc(${pct}% - 3px), calc(100% - 6px))` }}
        />
      </div>
      <p className="text-center text-sm font-bold text-[#d4af37]">{score}</p>
      <DefaultCard rows={rows} />
    </div>
  );
}

function MonthlySparklineCard({ data, rows }: { data: DashboardData; rows: BotAnswerRow[] }) {
  const points = data.monthlyTrend.filter((m) => m.monthKey !== "unknown").slice(-14);
  const max = Math.max(...points.map((p) => p.total), 1);
  const peakTotal = Math.max(...points.map((p) => p.total), 0);
  return (
    <div className="safety-bot-answer-card rounded-lg border border-[#d4af37]/60">
      <p className="safety-bot-answer-card-headline">Monthly trend</p>
      <div className="safety-bot-sparkline">
        {points.map((p) => {
          const h = Math.max(8, Math.round((p.total / max) * 100));
          const isPeak = p.total === peakTotal && peakTotal > 0;
          return (
            <div key={p.monthKey} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div
                className={`safety-bot-sparkline-bar w-full ${isPeak ? "bg-red-500" : "bg-[#d4af37]"}`}
                style={{ height: `${h}%` }}
                title={`${p.label}: ${p.total}`}
              />
              <span className="w-full truncate text-center text-[8px] safety-bot-muted">
                {p.label.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
      {rows.length > 0 ? (
        <div className="mt-2 border-t border-[#d4af37]/20 pt-2">
          <DefaultCard rows={rows} />
        </div>
      ) : null}
    </div>
  );
}

function IncidentListCard({
  incidents,
  onIncidentClick,
}: {
  incidents: Incident[];
  onIncidentClick?: (incident: Incident) => void;
}) {
  const list = incidents.slice(0, 50);
  return (
    <div className="safety-bot-answer-card safety-bot-incident-list rounded-lg border border-[#d4af37]/60">
      <p className="safety-bot-answer-card-headline">Matching incidents</p>
      <div
        className="safety-bot-incident-list-header grid gap-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide safety-bot-muted"
        style={{
          gridTemplateColumns: "44px 90px 1fr 12px",
          background: "var(--safety-bot-bubble)",
          borderBottom: "0.5px solid rgba(26, 42, 94, 0.12)",
        }}
      >
        <span>Category</span>
        <span>GHR No.</span>
        <span>Type</span>
        <span className="sr-only">Status</span>
      </div>
      <div className="safety-bot-incident-list-body">
        {list.map((inc, idx) => (
          <button
            key={inc.id}
            type="button"
            onClick={() => onIncidentClick?.(inc)}
            className="safety-bot-incident-row grid w-full gap-2 px-2.5 py-1.5 text-left transition hover:bg-[#d4af37]/10"
            style={{
              gridTemplateColumns: "44px 90px 1fr 12px",
              minHeight: 36,
              alignItems: "center",
              background: idx % 2 === 0 ? "rgba(0,0,0,0.02)" : "transparent",
              cursor: onIncidentClick ? "pointer" : "default",
              pointerEvents: "auto",
            }}
          >
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold"
              style={getCategoryStyle(inc.category)}
            >
              {inc.category}
            </span>
            <span className="shrink-0 text-[11px] font-medium safety-bot-text">{inc.ghrNumber || "—"}</span>
            <span className="min-w-0 truncate text-[11px] safety-bot-muted">{inc.incidentType}</span>
            <span
              className="mx-auto h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: getStatusDotColor(inc.status) }}
              title={inc.status}
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function ComparisonCard({ data }: { data: DashboardData }) {
  const sides = ["RAMP", "GSD"] as const;
  return (
    <div className="grid grid-cols-2 gap-2">
      {sides.map((dept) => {
        const list = data.incidents.filter((i) => i.department === dept);
        const closed = list.filter((i) => i.status === "Closed").length;
        const rate = list.length ? Math.round((closed / list.length) * 1000) / 10 : 0;
        const catA = list.filter((i) => i.category === "CAT-A").length;
        return (
          <div
            key={dept}
            className="safety-bot-answer-card rounded-lg border border-[#d4af37]/40 p-2 text-[11px]"
          >
            <p className="safety-bot-answer-card-headline mb-1">{dept}</p>
            <p className="safety-bot-text">Total: {list.length}</p>
            <p className="safety-bot-text">Closure: {rate}%</p>
            <p className="safety-bot-text">CAT-A: {catA}</p>
            <p className="safety-bot-text">Open: {list.filter((i) => i.status === "Open").length}</p>
          </div>
        );
      })}
    </div>
  );
}

function SummaryBulletsCard({ summary }: { summary: string }) {
  const bullets = parseBulletLines(summary);
  if (bullets.length <= 1) return null;
  return (
    <ul className="safety-bot-answer-card space-y-1 rounded-lg border border-[#d4af37]/60">
      {bullets.map((line) => (
        <li key={line} className="flex gap-2 safety-bot-text text-[13px]">
          <span className="text-[#d4af37]">•</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

export function SafetyBotResponseCards({
  type,
  summary,
  rows,
  data,
  matchedIncidents,
  onIncidentClick,
}: Props) {
  if (matchedIncidents.length > 0) {
    return <IncidentListCard incidents={matchedIncidents} onIncidentClick={onIncidentClick} />;
  }

  switch (type) {
    case "risk":
      return <RiskGaugeCard summary={summary} rows={rows} />;
    case "monthly":
      return <MonthlySparklineCard data={data} rows={rows} />;
    case "list":
      return <DefaultCard rows={rows} />;
    case "comparison":
      return (
        <>
          <ComparisonCard data={data} />
          {rows.length > 0 ? <DefaultCard rows={rows} /> : null}
        </>
      );
    case "summary":
      return <SummaryBulletsCard summary={summary} />;
    default:
      return <DefaultCard rows={rows} />;
  }
}
