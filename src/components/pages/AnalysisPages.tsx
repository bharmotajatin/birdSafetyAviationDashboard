"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { READ_ONLY_CLIENT } from "@/lib/read-only";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { readSharedFilters, SHARED_FILTER_LABELS } from "@/lib/url-filters";
import { PageDataRequired } from "@/components/layout/PageDataRequired";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { AnimatedKpiCard } from "@/components/ui/AnimatedKpiCard";
import { ExpandableChart, type ExpandableChartColumn } from "@/components/ui/ExpandableChart";
import { CountChart } from "@/components/charts/DashboardCharts";
import { incidentLogHref, CLICK_HINT } from "@/lib/incident-links";
import { HIDDEN } from "@/lib/analysis-excel/privacy";
import {
  ageColor,
  categoryCounts,
  openAge,
  repeats,
  reportingDelay,
  timeOfDay,
  type Bucket,
  type RepeatGroup,
} from "@/lib/analyses";
import { CATEGORY_COLORS } from "@/lib/constants";
import type { DashboardData, Incident } from "@/lib/types";

const ghrHref = (ghrs: string[]) => (ghrs.length ? incidentLogHref({ ghr: ghrs.join(",") }) : "/incident-log");

function Tiles({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>;
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="glass-card mt-4 overflow-x-auto p-0">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-2 align-top theme-text">
                    {c}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={head.length} className="px-3 py-6 text-center text-slate-500">
                Nothing to show for the selected filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const LogLink = ({ ghrs, children }: { ghrs: string[]; children: React.ReactNode }) =>
  ghrs.length ? (
    <Link href={ghrHref(ghrs)} className="font-semibold text-[#1a2a5e] underline-offset-2 hover:underline dark:text-[#d4af37]">
      {children}
    </Link>
  ) : (
    <span>{children}</span>
  );

const pct = (n: number, total: number) => (total ? `${((n / total) * 100).toFixed(0)}%` : "0%");

/** Bar chart of buckets; each bar opens the Incident Log with exactly that bar's incidents. */
function BucketChart({
  title,
  caption,
  buckets,
  total,
  type = "bar",
}: {
  title: string;
  caption: string;
  buckets: Bucket[];
  total: number;
  type?: "bar" | "horizontal";
}) {
  const shown = buckets.filter((b, i) => b.count > 0 || i < 4);
  const byLabel = new Map(shown.map((b) => [b.label, b]));
  const columns: ExpandableChartColumn[] = [
    { key: "label", label: "Group", dotKey: "color" },
    { key: "count", label: "Incidents", align: "right" },
    { key: "share", label: "Share", align: "right" },
  ];
  return (
    <ExpandableChart
      title={title}
      subtitle={caption}
      height={300}
      insight={caption}
      caption={`${CLICK_HINT} Bars add up to ${total}.`}
      columns={columns}
      rows={shown.map((b) => ({ label: b.label, count: b.count, share: pct(b.count, total), color: b.color }))}
      renderChart={() => (
        <CountChart
          type={type}
          labels={shown.map((b) => b.label)}
          values={shown.map((b) => b.count)}
          colors={shown.map((b) => b.color)}
          linkFor={(l) => ghrHref(byLabel.get(l)?.ghrs ?? [])}
          tooltipFor={(l) => {
            const b = byLabel.get(l);
            return b ? [`${b.count} incidents (${pct(b.count, total)})`, CLICK_HINT] : [];
          }}
        />
      )}
    />
  );
}

// ---------------------------------------------------------------- Reporting delay
export function ReportingDelayPage() {
  return <PageDataRequired>{(d) => <ReportingDelayContent data={d} />}</PageDataRequired>;
}

function ReportingDelayContent({ data }: { data: DashboardData }) {
  const r = useMemo(() => reportingDelay(data.incidents), [data.incidents]);
  const n = data.incidents.length;
  return (
    <div>
      <PageHeader title="Reporting delay" subtitle="Days from the date of the incident to its reporting date (IST calendar days)." />
      <Tiles>
        <AnimatedKpiCard index={0} label="Average delay (days)" value={Number(r.avg.toFixed(2))} decimals={2} tone="gold" />
        <AnimatedKpiCard index={1} label="Slowest station (avg days)" textValue={r.slowest ? `${r.slowest.station} · ${r.slowest.avg.toFixed(2)}` : "—"} tone="amber" />
        <AnimatedKpiCard index={2} label="Reported the same day" textValue={`${r.sameDay} of ${n}`} tone="green" />
      </Tiles>
      <BucketChart
        title="How quickly incidents were reported"
        caption="Number of incidents by days between the incident date and the reporting date."
        buckets={r.buckets}
        total={n}
      />
      <Table
        head={["Station", "Incidents with both dates", "Average days", "Longest delay (days)"]}
        rows={r.stations.map((s) => [s.station, s.count, s.avg.toFixed(2), s.max])}
      />
      <Table
        head={["Reported late (GHR)", "Station", "Incident date", "Report date", "Days"]}
        rows={r.late.map(({ incident: i, days }) => [
          <LogLink key="g" ghrs={[i.ghrNumber]}>{i.ghrNumber}</LogLink>,
          i.station,
          i.dateLabel,
          i.reportDate ?? "",
          days,
        ])}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Time of day
export function TimeOfDayPage() {
  return <PageDataRequired>{(d) => <TimeOfDayContent data={d} />}</PageDataRequired>;
}

function TimeOfDayContent({ data }: { data: DashboardData }) {
  const t = useMemo(() => timeOfDay(data.incidents), [data.incidents]);
  const n = data.incidents.length;
  const unreadable = t.buckets[4]!.count;
  return (
    <div>
      <PageHeader title="Time of day" subtitle="When incidents happen, from the Time of Incident column (local time)." />
      <Tiles>
        <AnimatedKpiCard index={0} label="Busiest time band" textValue={`${t.busiest.label} · ${t.busiest.count}`} tone="gold" />
        <AnimatedKpiCard index={1} label="Share at night (00-06)" textValue={pct(t.buckets[0]!.count, n)} tone="purple" />
        <AnimatedKpiCard index={2} label="Time not readable" value={unreadable} tone={unreadable ? "amber" : "green"} />
      </Tiles>
      <BucketChart
        title="Incidents by time of day"
        caption="Number of incidents in each 6-hour band; grey means the time in the sheet could not be read."
        buckets={t.buckets}
        total={n}
      />
      <Table
        head={["Time band", "Incidents", "Share", "Serious (CAT-A/B)"]}
        rows={t.buckets.map((b) => [
          <LogLink key="l" ghrs={b.ghrs}>{b.label}</LogLink>,
          b.count,
          pct(b.count, n),
          t.serious(b.label),
        ])}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Open incident age
export function OpenAgePage() {
  return <PageDataRequired>{(d) => <OpenAgeContent data={d} />}</PageDataRequired>;
}

function OpenAgeContent({ data }: { data: DashboardData }) {
  const o = useMemo(() => openAge(data.incidents), [data.incidents]);
  const oldest = o.open[0];
  const withDays = o.open.filter((x) => x.days !== null);
  return (
    <div>
      <PageHeader title="Open incident age" subtitle="Every incident that is not closed, with days open counted from the incident date to today (IST)." />
      <Tiles>
        <AnimatedKpiCard index={0} label="Not closed" value={o.total} tone="red" />
        <AnimatedKpiCard
          index={1}
          label="Oldest open incident"
          textValue={oldest && oldest.days !== null ? `${oldest.days} days · ${oldest.incident.ghrNumber}` : "—"}
          tone="amber"
        />
        <AnimatedKpiCard index={2} label="Open over 90 days" value={o.over90} tone="red" />
      </Tiles>
      <ExpandableChart
        title="Days open, per incident"
        subtitle="One bar per open incident, oldest first. Green 0-30, amber 31-90, orange 91-180, red over 180 days."
        insight="One bar per open incident, oldest first."
        caption={CLICK_HINT}
        height={Math.max(300, withDays.length * 26 + 60)}
        columns={[
          { key: "ghr", label: "GHR No.", dotKey: "color" },
          { key: "days", label: "Days open", align: "right" },
        ]}
        rows={withDays.map((x) => ({ ghr: x.incident.ghrNumber, days: x.days!, color: ageColor(x.days) }))}
        renderChart={() => (
          <CountChart
            type="horizontal"
            labels={withDays.map((x) => x.incident.ghrNumber)}
            values={withDays.map((x) => x.days!)}
            colors={withDays.map((x) => ageColor(x.days))}
            linkFor={(l) => ghrHref([l])}
            tooltipFor={(l) => {
              const x = withDays.find((w) => w.incident.ghrNumber === l);
              return x ? [`${x.days} days open`, `${x.incident.station} · ${x.incident.status}`, CLICK_HINT] : [];
            }}
          />
        )}
      />
      <Table
        head={["Age band", "Incidents"]}
        rows={o.bands
          .filter((b, i) => i < 4 || b.count > 0)
          .map((b) => [
            <span key="b" className="inline-flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
              <LogLink ghrs={b.ghrs}>{b.label}</LogLink>
            </span>,
            b.count,
          ])}
      />
      <Table
        head={["GHR No.", "Station", "Status", "Incident date", "Days open"]}
        rows={o.open.map(({ incident: i, days }) => [
          <LogLink key="g" ghrs={[i.ghrNumber]}>{i.ghrNumber}</LogLink>,
          i.station,
          i.status,
          i.dateLabel,
          <span key="d" className="font-semibold" style={{ color: ageColor(days) }}>
            {days ?? "No date"}
          </span>,
        ])}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Repeat equipment and staff
export function RepeatPage() {
  return <PageDataRequired>{(d) => <RepeatContent data={d} />}</PageDataRequired>;
}

function repeatLabel(g: RepeatGroup, idx: number, hide: boolean) {
  return g.kind === "Staff" && hide ? `${HIDDEN} staff no. #${idx + 1}` : g.label;
}

function RepeatContent({ data }: { data: DashboardData }) {
  const r = useMemo(() => repeats(data.incidents), [data.incidents]);
  const [hideChoice, setHide] = useState(true);
  const hide = hideChoice || READ_ONLY_CLIENT;
  const labelled = [
    ...r.equipment.map((g) => ({ g, label: repeatLabel(g, 0, hide) })),
    ...r.staff.map((g, i) => ({ g, label: repeatLabel(g, i, hide) })),
  ];
  const top = labelled[0];
  const csv = () => {
    const lines = [["Kind", "Item", "Station", "Count", "GHR numbers"].join(",")];
    for (const { g, label } of labelled)
      lines.push([g.kind, label, g.station, g.count, g.incidents.map((i) => i.ghrNumber).join(" ")].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "repeat-equipment-and-staff.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div>
      <PageHeader
        title="Repeat equipment and staff"
        subtitle="Equipment that matches on type + station + number, and staff numbers, that appear in more than one incident."
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={hide}
          disabled={READ_ONLY_CLIENT}
          title={READ_ONLY_CLIENT ? "Always on: this site is view only" : undefined}
          onClick={() => setHide((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm theme-text"
        >
          <span className={`relative h-5 w-9 rounded-full transition ${hide ? "bg-emerald-600" : "bg-slate-300"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${hide ? "left-[18px]" : "left-0.5"}`} />
          </span>
          Hide personal details
          {READ_ONLY_CLIENT ? <Lock size={14} aria-label="Locked on" className="text-slate-500" /> : null}
        </button>
        <button type="button" onClick={csv} className="rounded-full bg-[#1a2a5e] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#24367a]">
          Download CSV
        </button>
      </div>
      <Tiles>
        <AnimatedKpiCard index={0} label="Repeat equipment" value={r.equipment.length} tone="amber" />
        <AnimatedKpiCard index={1} label="Repeat staff numbers" value={r.staff.length} tone="purple" />
        <AnimatedKpiCard index={2} label="Top repeat" textValue={top ? `${top.label} · ${top.g.count}` : "—"} tone="gold" />
      </Tiles>
      <ExpandableChart
        title="Items in more than one incident"
        subtitle="How many incidents each repeated equipment item or staff number appears in."
        insight="How many incidents each repeated item appears in."
        caption={CLICK_HINT}
        height={Math.max(260, labelled.length * 28 + 60)}
        columns={[
          { key: "item", label: "Item", dotKey: "color" },
          { key: "count", label: "Incidents", align: "right" },
        ]}
        rows={labelled.map(({ g, label }) => ({ item: label, count: g.count, color: g.kind === "Staff" ? "#7c3aed" : "#d4af37" }))}
        renderChart={() => (
          <CountChart
            type="horizontal"
            labels={labelled.map((x) => x.label)}
            values={labelled.map((x) => x.g.count)}
            colors={labelled.map((x) => (x.g.kind === "Staff" ? "#7c3aed" : "#d4af37"))}
            linkFor={(l) => ghrHref(labelled.find((x) => x.label === l)?.g.incidents.map((i) => i.ghrNumber) ?? [])}
          />
        )}
      />
      <Table
        head={["Kind", "Item", "Station", "Count", "Incidents"]}
        rows={labelled.map(({ g, label }) => [
          g.kind,
          label,
          g.station,
          g.count,
          <span key="i" className="flex flex-wrap gap-x-2">
            {g.incidents.map((i: Incident) => (
              <LogLink key={i.id} ghrs={[i.ghrNumber]}>
                {i.ghrNumber}
              </LogLink>
            ))}
            <LogLink ghrs={g.incidents.map((i) => i.ghrNumber)}>(all {g.count})</LogLink>
          </span>,
        ])}
      />
      <p className="mt-2 text-xs text-slate-500">
        Matching on the bare equipment number alone would give {r.bareNumberGroups} groups, many of them different vehicles at different stations, so type and station are matched too. &quot;01&quot; and &quot;1&quot; count as the same number.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Dashboard export
const EXPORT_STATION_ORDER = ["DEL", "TRV", "BLR", "COK", "MAA", "HYD"];
const NAVY = "#1a2a5e";
const RED = "#dc2626";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jan–Sep 2026" / "Dec 2025–Feb 2026" / "Mar 2026" from the incidents' month keys. */
export function periodLabel(incidents: Incident[]): string {
  const keys = incidents.map((i) => i.monthKey).filter((k) => /^\d{4}-\d{2}$/.test(k)).sort();
  if (!keys.length) return "No dated incidents";
  const fmt = (k: string) => ({ m: MONTHS[Number(k.slice(5, 7)) - 1]!, y: k.slice(0, 4) });
  const a = fmt(keys[0]!);
  const b = fmt(keys[keys.length - 1]!);
  if (keys[0] === keys[keys.length - 1]) return `${a.m} ${a.y}`;
  return a.y === b.y ? `${a.m}\u2013${b.m} ${b.y}` : `${a.m} ${a.y}\u2013${b.m} ${b.y}`;
}

export function exportStationRows(incidents: Incident[]) {
  const present = new Set(incidents.map((i) => String(i.station || "Unknown")));
  const extra = [...present].filter((s) => !EXPORT_STATION_ORDER.includes(s) && s !== "Unknown").sort();
  const order = [...EXPORT_STATION_ORDER, ...extra, ...(present.has("Unknown") ? ["Unknown"] : [])];
  return order
    .map((s) => {
      const list = incidents.filter((i) => String(i.station || "Unknown") === s);
      const closed = list.filter((i) => i.status === "Closed").length;
      return { label: s, count: list.length, closed, notClosed: list.length - closed, ghrs: list.map((i) => i.ghrNumber) };
    })
    .filter((s) => s.count > 0 || EXPORT_STATION_ORDER.includes(s.label));
}

function generatedLabel(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${v("day")} ${v("month")} ${v("year")}, ${v("hour")}:${v("minute")} ${v("dayPeriod").toUpperCase()} IST`;
}

export function DashboardExportPage() {
  return <PageDataRequired>{(d) => <DashboardExportContent data={d} />}</PageDataRequired>;
}

function DashboardExportContent({ data }: { data: DashboardData }) {
  const inc = data.incidents;
  const params = useSearchParams();
  const forPdf = params?.get("pdf") === "1";
  const filters = readSharedFilters(params);
  const filterText = [
    filters.station ? `Station: ${filters.station}` : "All stations",
    ...(["month", "category", "status"] as const).filter((k) => filters[k]).map((k) => `${SHARED_FILTER_LABELS[k]}: ${filters[k]}`),
  ].join(" \u00b7 ");
  const closed = inc.filter((i) => i.status === "Closed").length;
  const stations = exportStationRows(inc);
  const cats = categoryCounts(inc);
  const [generated] = useState(() => generatedLabel(new Date()));
  const router = useRouter();

  const chartBox = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  // Print: Chart.js canvases often print blank, so print a PNG snapshot of the chart instead.
  useEffect(() => {
    const take = () => {
      const canvas = chartBox.current?.querySelector("canvas");
      if (canvas && canvas.width > 0) setSnapshot(canvas.toDataURL("image/png"));
    };
    const t = window.setTimeout(take, 800);
    window.addEventListener("beforeprint", take);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeprint", take);
    };
  }, [inc]);

  const font = { size: 12, family: "Inter, system-ui, sans-serif" };
  const chartData = {
    labels: stations.map((s) => s.label),
    datasets: [
      { label: "Closed", data: stations.map((s) => s.closed), backgroundColor: NAVY, stack: "s" },
      { label: "Not closed", data: stations.map((s) => s.notClosed), backgroundColor: RED, stack: "s" },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    devicePixelRatio: 2,
    layout: { padding: { top: 18 } },
    scales: {
      x: { stacked: true, ticks: { font, color: "#334155" }, grid: { display: false } },
      y: { stacked: true, beginAtZero: true, ticks: { font, color: "#334155", precision: 0 }, grid: { color: "#e2e8f0" } },
    },
    plugins: {
      legend: { position: "top" as const, labels: { font, color: "#334155", boxWidth: 14 } },
      tooltip: { enabled: true },
      datalabels: {
        color: "#fff",
        font: { size: 11, weight: "bold" as const },
        display: (ctx: { dataset: { data: unknown[] }; dataIndex: number }) => Number(ctx.dataset.data[ctx.dataIndex]) > 0,
      },
    },
    onClick: (_e: unknown, els: { index: number }[]) => {
      const s = els[0] ? stations[els[0].index] : undefined;
      if (s) router.push(ghrHref(s.ghrs));
    },
  };

  return (
    <div className="dashboard-export">
      <style>{printCss(forPdf)}</style>
      <div className="export-print-header hidden items-center gap-4 border-b border-slate-300 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bird-flight-services-logo.png" alt="Bird Flight Services" className="h-12 w-auto" />
        <div>
          <h1 className="text-xl font-bold text-[#1a2a5e]">Safety Incident Summary</h1>
          <p className="text-sm text-slate-600">
            {periodLabel(inc)} · {filterText} · Generated {generated}
          </p>
        </div>
      </div>
      <div className="print:hidden">
        <PageHeader title="Dashboard export" subtitle="A printable summary of the selected filters." />
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => window.print()} className="rounded-full bg-[#1a2a5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#24367a]">
            Print / Save as PDF
          </button>
          <span className="text-sm text-slate-500">Use Print, then Save as PDF.</span>
        </div>
      </div>
      <Tiles>
        <AnimatedKpiCard index={0} label="Incidents" value={inc.length} tone="gold" />
        <AnimatedKpiCard index={1} label="Closed" value={closed} tone="green" />
        <AnimatedKpiCard index={2} label="Not closed" value={inc.length - closed} tone="red" />
      </Tiles>
      <section className="glass-card p-4">
        <h3 className="text-base font-semibold theme-text">Incidents by station</h3>
        <p className="mb-1 text-sm text-slate-500">Closed (navy) and not closed (red) incidents at each station for the selected filters.</p>
        <div className="export-chart-live h-[260px] w-full">
          <Bar data={chartData} options={options as never} />
        </div>
        {/* Off-screen copy at A4 print width (about 700px), so the printed snapshot keeps 12px labels at 1:1. */}
        <div ref={chartBox} aria-hidden className="pointer-events-none fixed -left-[10000px] top-0" style={{ width: 700, height: 280 }}>
          <Bar data={chartData} options={{ ...options, responsive: false, onClick: undefined } as never} width={700} height={280} />
        </div>
        {snapshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={snapshot} alt="Incidents by station chart" className="export-chart-print hidden h-auto w-full" />
        ) : null}
      </section>
      <Table
        head={["Station", "Incidents", "Closed", "Not closed"]}
        rows={[
          ...stations.map((s) => [<LogLink key="s" ghrs={s.ghrs}>{s.label}</LogLink>, s.count, s.closed, s.notClosed]),
          [<strong key="t">Total</strong>, <strong key="a">{inc.length}</strong>, <strong key="b">{closed}</strong>, <strong key="c">{inc.length - closed}</strong>],
        ]}
      />
      <Table
        head={["Category", "Incidents"]}
        rows={[
          ...cats.map((c) => [
            <span key="c" style={{ color: c.label === "Not set" ? "#64748b" : CATEGORY_COLORS[c.label] }} className="font-semibold">
              <LogLink ghrs={c.ghrs}>{c.label}</LogLink>
            </span>,
            c.count,
          ]),
          [<strong key="t">Total</strong>, <strong key="n">{cats.reduce((s, c) => s + c.count, 0)}</strong>],
        ]}
      />
      <div className="export-print-footer hidden">Bird Flight Services · Safety Sheet Analyser</div>
    </div>
  );
}

/** Print only the export: hide app chrome, show the print header, swap the live chart for its snapshot.
 *  forPdf: the generated PDF adds its own "Page X of Y" footer, so the CSS page footer is left out. */
function printCss(forPdf: boolean) {
  return `
@media print {
  @page {
    size: A4;
    margin: 12mm 12mm 16mm;
    ${forPdf ? "" : `@bottom-center { content: "Bird Flight Services \\00b7 Safety Sheet Analyser \\00b7 Page " counter(page) " of " counter(pages); font: 9px Inter, system-ui, sans-serif; color: #64748b; }`}
  }
  html, body { background: #fff !important; }
  header:not(.dashboard-export header), aside, nav, .app-bottombar, .shared-filter-bar, .error-monitor-fab, .safety-bot-fab, nextjs-portal,
  [class*="app-sidebar"], [class*="glass-header"] { display: none !important; }
  body * { visibility: hidden; }
  .dashboard-export, .dashboard-export * { visibility: visible; }
  .dashboard-export { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
  .dashboard-export .print\\:hidden { display: none !important; }
  .export-print-header { display: flex !important; margin-bottom: 12px; }
  .export-chart-live { display: none !important; }
  .export-chart-print { display: block !important; }
  .glass-card { box-shadow: none !important; break-inside: avoid; }
  table { font-size: 12px; }
  * { animation: none !important; transition: none !important; }
}
`;
}